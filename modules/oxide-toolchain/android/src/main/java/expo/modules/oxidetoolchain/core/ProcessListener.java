package expo.modules.oxidetoolchain.core;

/**
 * Receives the output of a running host process or WebAssembly program, already split into
 * lines. Implementations must be thread-safe: stdout and stderr are delivered from different
 * threads.
 */
public interface ProcessListener {
    /**
     * One line of output, without its trailing newline. ANSI escape codes are kept.
     *
     * @param stream "stdout" or "stderr"
     * @param partial true when the line has no newline yet (a prompt such as {@code print!("> ")}
     *     flushed because the program is now waiting for input or has exited)
     */
    void onLine(String stream, String line, boolean partial);

    /**
     * The process finished. Called exactly once.
     *
     * @param signal null, or a POSIX-style signal name ("SIGINT" after kill, "SIGABRT" for a
     *     WebAssembly trap that was not a Rust panic)
     */
    void onExit(int code, String signal, long durationMs);
}
