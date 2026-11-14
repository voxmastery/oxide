package expo.modules.oxidetoolchain.core;

import com.dylibso.chicory.log.Logger;
import com.dylibso.chicory.runtime.ByteBufferMemory;
import com.dylibso.chicory.runtime.ChicoryInterruptedException;
import com.dylibso.chicory.runtime.HostFunction;
import com.dylibso.chicory.runtime.ImportMemory;
import com.dylibso.chicory.runtime.ImportValues;
import com.dylibso.chicory.runtime.Instance;
import com.dylibso.chicory.runtime.Memory;
import com.dylibso.chicory.runtime.TrapException;
import com.dylibso.chicory.wasi.WasiExitException;
import com.dylibso.chicory.wasi.WasiOptions;
import com.dylibso.chicory.wasi.WasiPreview1;
import com.dylibso.chicory.wasm.ChicoryException;
import com.dylibso.chicory.wasm.Parser;
import com.dylibso.chicory.wasm.WasmModule;
import com.dylibso.chicory.wasm.types.ExternalType;
import com.dylibso.chicory.wasm.types.FunctionType;
import com.dylibso.chicory.wasm.types.Import;
import com.dylibso.chicory.wasm.types.MemoryImport;
import com.dylibso.chicory.wasm.types.MemoryLimits;
import com.dylibso.chicory.wasm.types.ValType;
import java.io.File;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Runs one WebAssembly program built by rustc for {@code wasm32-wasip1} or
 * {@code wasm32-wasip1-threads}, in-process with the Chicory interpreter.
 *
 * <ul>
 *   <li>stdout/stderr are split into lines for the {@link ProcessListener};
 *   <li>stdin is fed line by line with {@link #writeLine}; reads block the worker thread;
 *   <li>{@link #kill()} interrupts every thread of the program (Chicory checks the interrupt
 *       flag on calls and backward branches);
 *   <li>a Rust panic (panic=abort on wasm, so it ends in an {@code unreachable} trap) exits
 *       with 101, like a native Rust program whose main thread panicked;
 *   <li>modules that import {@code wasi.thread-spawn} (wasm32-wasip1-threads) get real threads:
 *       each spawned thread is a new Chicory instance of the same module sharing one memory,
 *       started through the module's {@code wasi_thread_start} export, as wasi-threads
 *       specifies.
 * </ul>
 */
public final class WasmProcess {
    /** Exit code of a Rust program whose main thread panicked. */
    public static final int PANIC_EXIT_CODE = 101;
    /** 128 + SIGINT, what a shell reports after ⌃C. */
    public static final int INTERRUPTED_EXIT_CODE = 130;
    /** 128 + SIGABRT. */
    public static final int ABORT_EXIT_CODE = 134;

    /** Interpreter frames are deep Java recursion; give program threads a large stack. */
    private static final long THREAD_STACK_BYTES = 256L * 1024 * 1024;

    private static final Map<String, CachedModule> MODULE_CACHE =
            Collections.synchronizedMap(
                    new LinkedHashMap<String, CachedModule>(8, 0.75f, true) {
                        @Override
                        protected boolean removeEldestEntry(Map.Entry<String, CachedModule> e) {
                            return size() > 4;
                        }
                    });

    private static final class CachedModule {
        final long mtime;
        final long size;
        final WasmModule module;

        CachedModule(long mtime, long size, WasmModule module) {
            this.mtime = mtime;
            this.size = size;
            this.module = module;
        }
    }

    private final File wasmFile;
    private final List<String> args;
    private final Map<String, String> env;
    private final Map<String, Path> preopens;
    private final ProcessListener listener;

    private final LineSplitter stdout;
    private final LineSplitter stderr;
    private final StdinPipe stdin;

    private final AtomicBoolean panicked = new AtomicBoolean(false);
    private final AtomicBoolean killed = new AtomicBoolean(false);
    private final AtomicBoolean finished = new AtomicBoolean(false);
    private final Map<Integer, Thread> threads = new ConcurrentHashMap<>();
    private final AtomicInteger nextTid = new AtomicInteger(1);
    private final CountDownLatch done = new CountDownLatch(1);
    private volatile int exitCode = -1;
    private volatile Thread mainThread;
    private long startNanos;

    /** Exit requested by any thread (proc_exit, trap in a spawned thread…). */
    private volatile Integer pendingExit;
    private volatile String pendingSignal;

    /**
     * @param wasmFile the module, e.g. {@code target/wasm32-wasip1/debug/guessing_game.wasm}
     * @param args argv including argv[0] (the program name the user typed)
     * @param env environment visible to the program
     * @param preopens guest directory name → host directory. Use "." for the working directory
     *     so relative paths ({@code fs::read_to_string("poem.txt")}) resolve against it.
     */
    public WasmProcess(
            File wasmFile,
            List<String> args,
            Map<String, String> env,
            Map<String, Path> preopens,
            ProcessListener listener) {
        this.wasmFile = wasmFile;
        this.args = new ArrayList<>(args);
        this.env = new LinkedHashMap<>(env);
        this.preopens = new LinkedHashMap<>(preopens);
        this.listener = listener;
        this.stdout = new LineSplitter(listener, "stdout");
        this.stderr = new LineSplitter(listener, "stderr");
        this.stdin =
                new StdinPipe(
                        () -> {
                            stdout.flushPartial();
                            stderr.flushPartial();
                        });
        // libstd prints "thread 'main' panicked at src/main.rs:4:5:" before aborting.
        this.stderr.setObserver(
                line -> {
                    if (line.contains("panicked at ")) panicked.set(true);
                });
    }

    /** Called each time the program blocks on stdin ("guessing_game is waiting for input"). */
    public void setOnWaitingForInput(Runnable r) {
        stdin.setOnWaiting(r);
    }

    public void writeLine(String line) {
        stdin.writeLine(line);
    }

    public void closeStdin() {
        stdin.closeInput();
    }

    /** ⌃C */
    public void kill() {
        if (finished.get()) return;
        killed.set(true);
        stdin.closeInput();
        Thread m = mainThread;
        if (m != null) m.interrupt();
        for (Thread t : threads.values()) t.interrupt();
    }

    /** Blocks until the program exits and returns its exit code. */
    public int waitFor() throws InterruptedException {
        done.await();
        return exitCode;
    }

    public boolean isFinished() {
        return finished.get();
    }

    /** Starts the program on its own thread and returns immediately. */
    public void start() {
        startNanos = System.nanoTime();
        Thread t = new Thread(null, this::runMain, "wasm-main:" + wasmFile.getName(), THREAD_STACK_BYTES);
        mainThread = t;
        t.setDaemon(true);
        t.start();
    }

    /** Parses the module, reusing the last parse when the file has not changed. */
    static WasmModule loadModule(File file) {
        String key = file.getAbsolutePath();
        long mtime = file.lastModified();
        long size = file.length();
        CachedModule cached = MODULE_CACHE.get(key);
        if (cached != null && cached.mtime == mtime && cached.size == size) {
            return cached.module;
        }
        WasmModule module = Parser.parse(file);
        MODULE_CACHE.put(key, new CachedModule(mtime, size, module));
        return module;
    }

    private void runMain() {
        int code;
        String signal = null;
        WasiPreview1 wasi = null;
        try {
            WasmModule module = loadModule(wasmFile);

            WasiOptions.Builder opts =
                    WasiOptions.builder()
                            .withStdout(stdout, true)
                            .withStderr(stderr, true)
                            .withStdin(stdin, true)
                            .withArguments(args);
            for (Map.Entry<String, String> e : env.entrySet()) {
                opts.withEnvironment(e.getKey(), e.getValue());
            }
            for (Map.Entry<String, Path> e : preopens.entrySet()) {
                opts.withDirectory(e.getKey(), e.getValue());
            }
            wasi =
                    WasiPreview1.builder()
                            .withLogger(QuietLogger.INSTANCE)
                            .withOptions(opts.build())
                            .build();

            Memory sharedMemory = createImportedMemory(module);
            HostFunction[] wasiFns = wasi.toHostFunctions();
            ImportValues imports = buildImports(module, wasiFns, sharedMemory);

            Instance instance =
                    Instance.builder(module).withImportValues(imports).withStart(false).build();
            try {
                instance.export("_start").apply();
                code = 0;
            } catch (WasiExitException e) {
                code = e.exitCode();
            }
        } catch (WasiExitException e) {
            code = e.exitCode();
        } catch (ChicoryInterruptedException e) {
            code = INTERRUPTED_EXIT_CODE;
            signal = "SIGINT";
        } catch (TrapException e) {
            code = trapExitCode(e);
            signal = code == PANIC_EXIT_CODE ? null : "SIGABRT";
        } catch (ChicoryException e) {
            if (killed.get() || isInterruptedCause(e)) {
                code = INTERRUPTED_EXIT_CODE;
                signal = "SIGINT";
            } else if (pendingExit != null) {
                code = pendingExit;
                signal = pendingSignal;
            } else if ("call stack exhausted".equals(e.getMessage())) {
                stderr.close();
                emitStderr("");
                emitStderr("thread 'main' has overflowed its stack");
                emitStderr("fatal runtime error: stack overflow, aborting");
                code = ABORT_EXIT_CODE;
                signal = "SIGABRT";
            } else {
                code = trapExitCode(e);
                signal = code == PANIC_EXIT_CODE ? null : "SIGABRT";
            }
        } catch (OutOfMemoryError e) {
            emitStderr("memory allocation failed: the program used more memory than Oxide can give it");
            code = ABORT_EXIT_CODE;
            signal = "SIGABRT";
        } catch (Throwable e) {
            emitStderr("oxide: could not run " + wasmFile.getName() + ": " + e);
            code = 126;
        }

        // A spawned thread may have decided the exit (proc_exit or trap) and interrupted main.
        if (pendingExit != null && !killed.get()) {
            code = pendingExit;
            signal = pendingSignal;
        }
        if (killed.get()) {
            code = INTERRUPTED_EXIT_CODE;
            signal = "SIGINT";
        }
        // When main returns, the process ends even if other threads still run (as natively).
        for (Thread t : threads.values()) t.interrupt();
        if (wasi != null) {
            try {
                wasi.close();
            } catch (RuntimeException ignored) {
                // closing the preopened directories must not hide the exit status
            }
        }
        finish(code, signal);
    }

    private int trapExitCode(Throwable e) {
        if (panicked.get()) return PANIC_EXIT_CODE;
        stderr.close();
        // An unreachable trap without a panic message: abort(), a failed bounds check in
        // unsafe code, or memory corruption. Native Rust would die with SIGABRT/SIGILL.
        String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        emitStderr("wasm trap: " + msg);
        return ABORT_EXIT_CODE;
    }

    private static boolean isInterruptedCause(Throwable e) {
        for (Throwable c = e; c != null; c = c.getCause()) {
            if (c instanceof ChicoryInterruptedException || c instanceof InterruptedException) {
                return true;
            }
        }
        return false;
    }

    private void emitStderr(String line) {
        listener.onLine("stderr", line, false);
    }

    private void finish(int code, String signal) {
        if (!finished.compareAndSet(false, true)) return;
        stdout.close();
        stderr.close();
        exitCode = code;
        long ms = (System.nanoTime() - startNanos) / 1_000_000L;
        try {
            listener.onExit(code, signal, ms);
        } finally {
            done.countDown();
        }
    }

    // ---- imports ----

    /** wasm32-wasip1-threads modules import their (shared) memory as env.memory. */
    private static Memory createImportedMemory(WasmModule module) {
        int n = module.importSection().importCount();
        for (int i = 0; i < n; i++) {
            Import imp = module.importSection().getImport(i);
            if (imp.importType() == ExternalType.MEMORY) {
                MemoryLimits limits = ((MemoryImport) imp).limits();
                return new ByteBufferMemory(limits);
            }
        }
        return null;
    }

    private static String memoryImportModule(WasmModule module, boolean wantName) {
        int n = module.importSection().importCount();
        for (int i = 0; i < n; i++) {
            Import imp = module.importSection().getImport(i);
            if (imp.importType() == ExternalType.MEMORY) {
                return wantName ? imp.name() : imp.module();
            }
        }
        return null;
    }

    static boolean importsThreadSpawn(WasmModule module) {
        int n = module.importSection().importCount();
        for (int i = 0; i < n; i++) {
            Import imp = module.importSection().getImport(i);
            if (imp.importType() == ExternalType.FUNCTION
                    && "wasi".equals(imp.module())
                    && "thread-spawn".equals(imp.name())) {
                return true;
            }
        }
        return false;
    }

    private ImportValues buildImports(WasmModule module, HostFunction[] wasiFns, Memory memory) {
        ImportValues.Builder b = ImportValues.builder().addFunction(wasiFns);
        if (memory != null) {
            b.addMemory(
                    new ImportMemory(
                            memoryImportModule(module, false),
                            memoryImportModule(module, true),
                            memory));
        }
        if (importsThreadSpawn(module)) {
            b.addFunction(threadSpawn(module, wasiFns, memory));
        }
        return b.build();
    }

    /**
     * wasi-threads: {@code (import "wasi" "thread-spawn" (func (param i32) (result i32)))}.
     * Returns a positive thread id, or a negative value on failure.
     */
    private HostFunction threadSpawn(WasmModule module, HostFunction[] wasiFns, Memory memory) {
        FunctionType type = FunctionType.of(List.of(ValType.I32), List.of(ValType.I32));
        return new HostFunction(
                "wasi",
                "thread-spawn",
                type,
                (caller, argv) -> {
                    if (memory == null || killed.get() || pendingExit != null) {
                        return new long[] {-1};
                    }
                    int startArg = (int) argv[0];
                    int tid = nextTid.getAndIncrement();
                    if (tid > 0x1FFFFFFF) return new long[] {-1};
                    ImportValues imports = buildImports(module, wasiFns, memory);
                    Thread t =
                            new Thread(
                                    null,
                                    () -> runThread(module, imports, tid, startArg),
                                    "wasm-thread-" + tid,
                                    THREAD_STACK_BYTES);
                    t.setDaemon(true);
                    threads.put(tid, t);
                    t.start();
                    return new long[] {tid};
                });
    }

    private void runThread(WasmModule module, ImportValues imports, int tid, int startArg) {
        try {
            Instance inst =
                    Instance.builder(module).withImportValues(imports).withStart(false).build();
            inst.export("wasi_thread_start").apply(tid, startArg);
        } catch (WasiExitException e) {
            exitWholeProgram(e.exitCode(), null);
        } catch (ChicoryInterruptedException e) {
            // main finished or ⌃C
        } catch (TrapException e) {
            int code = trapExitCode(e);
            exitWholeProgram(code, code == PANIC_EXIT_CODE ? null : "SIGABRT");
        } catch (ChicoryException e) {
            if (!killed.get() && !isInterruptedCause(e) && pendingExit == null) {
                int code = trapExitCode(e);
                exitWholeProgram(code, code == PANIC_EXIT_CODE ? null : "SIGABRT");
            }
        } catch (Throwable e) {
            if (!killed.get()) {
                emitStderr("oxide: thread " + tid + " failed: " + e);
                exitWholeProgram(ABORT_EXIT_CODE, "SIGABRT");
            }
        } finally {
            threads.remove(tid);
        }
    }

    /** proc_exit or an abort in a spawned thread ends every thread, like exit(2). */
    private void exitWholeProgram(int code, String signal) {
        synchronized (this) {
            if (pendingExit != null) return;
            pendingSignal = signal;
            pendingExit = code;
        }
        Thread m = mainThread;
        if (m != null) m.interrupt();
        for (Thread t : threads.values()) {
            if (t != Thread.currentThread()) t.interrupt();
        }
    }

    /** Chicory's WASI layer logs every unsupported call; programs should not see that. */
    static final class QuietLogger implements Logger {
        static final QuietLogger INSTANCE = new QuietLogger();

        @Override
        public void log(Level level, String msg, Throwable throwable) {}

        @Override
        public boolean isLoggable(Level level) {
            return false;
        }
    }
}
