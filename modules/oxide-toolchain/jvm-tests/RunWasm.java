import expo.modules.oxidetoolchain.core.ProcessListener;
import expo.modules.oxidetoolchain.core.WasmProcess;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Desktop harness for the Chicory runner used by the Android module.
 *
 * <pre>
 *   java -cp ... RunWasm [--cwd DIR] [--kill-after MS] program.wasm [args...]
 * </pre>
 *
 * Lines read from this process's stdin are fed to the program one by one, the way the
 * Terminal does. Every event is printed with a prefix so tests can assert on it.
 */
public final class RunWasm {
    public static void main(String[] argv) throws Exception {
        List<String> a = new ArrayList<>(Arrays.asList(argv));
        String cwd = System.getProperty("user.dir");
        long killAfter = -1;
        while (!a.isEmpty() && a.get(0).startsWith("--")) {
            String flag = a.remove(0);
            if (flag.equals("--cwd")) cwd = a.remove(0);
            else if (flag.equals("--kill-after")) killAfter = Long.parseLong(a.remove(0));
        }
        File wasm = new File(a.remove(0));
        List<String> args = new ArrayList<>();
        args.add(wasm.getName().replaceAll("\\.wasm$", ""));
        args.addAll(a);
        Map<String, String> env = new LinkedHashMap<>();
        env.put("HOME", cwd);
        Map<String, Path> preopens = new LinkedHashMap<>();
        preopens.put(".", Path.of(cwd));

        ProcessListener l =
                new ProcessListener() {
                    @Override
                    public synchronized void onLine(String stream, String line, boolean partial) {
                        System.out.println((stream.equals("stdout") ? "OUT" : "ERR") + (partial ? "~ " : ": ") + line);
                    }

                    @Override
                    public synchronized void onExit(int code, String signal, long ms) {
                        System.out.println("EXIT " + code + (signal == null ? "" : " " + signal) + " in " + ms + "ms");
                    }
                };
        WasmProcess p = new WasmProcess(wasm, args, env, preopens, l);
        p.setOnWaitingForInput(() -> System.out.println("WAITING"));
        p.start();
        if (killAfter >= 0) {
            Thread.sleep(killAfter);
            p.kill();
        } else {
            Thread feeder =
                    new Thread(
                            () -> {
                                try (BufferedReader r = new BufferedReader(new InputStreamReader(System.in))) {
                                    String line;
                                    while ((line = r.readLine()) != null) {
                                        if (p.isFinished()) break;
                                        p.writeLine(line);
                                    }
                                    p.closeStdin();
                                } catch (Exception ignored) {
                                }
                            });
            feeder.setDaemon(true);
            feeder.start();
        }
        System.exit(p.waitFor() == 0 ? 0 : 1);
    }
}
