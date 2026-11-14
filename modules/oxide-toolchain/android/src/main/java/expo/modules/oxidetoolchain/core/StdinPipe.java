package expo.modules.oxidetoolchain.core;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.LinkedBlockingQueue;

/**
 * The stdin of a WebAssembly program: lines typed in the Terminal are queued here, and the
 * program's {@code fd_read} blocks on a worker thread until one arrives.
 *
 * <p>Before blocking, {@link #beforeBlock} runs so a prompt printed without a newline becomes
 * visible. Interrupting the reading thread (⌃C) makes the read return EOF; the interpreter then
 * stops at its next interruption check.
 */
public final class StdinPipe extends InputStream {
    private static final byte[] EOF = new byte[0];
    private final LinkedBlockingQueue<byte[]> queue = new LinkedBlockingQueue<>();
    private byte[] current;
    private int pos;
    private volatile boolean closed;
    private final Runnable beforeBlock;
    private volatile Runnable onWaiting;

    public StdinPipe(Runnable beforeBlock) {
        this.beforeBlock = beforeBlock;
    }

    /** Called (once per blocking read) when the program starts waiting for input. */
    public void setOnWaiting(Runnable onWaiting) {
        this.onWaiting = onWaiting;
    }

    /** Queue one line; a newline is appended. */
    public void writeLine(String line) {
        if (closed) return;
        queue.offer((line + "\n").getBytes(StandardCharsets.UTF_8));
    }

    /** Queue raw text with no newline added. */
    public void write(String text) {
        if (closed) return;
        queue.offer(text.getBytes(StandardCharsets.UTF_8));
    }

    /** ⌃D: the program sees end of file. */
    public void closeInput() {
        closed = true;
        queue.offer(EOF);
    }

    @Override
    public int read() throws IOException {
        byte[] one = new byte[1];
        int n = read(one, 0, 1);
        return n <= 0 ? -1 : (one[0] & 0xff);
    }

    @Override
    public int read(byte[] b, int off, int len) throws IOException {
        if (len == 0) return 0;
        if (current == null || pos >= current.length) {
            current = queue.poll();
            pos = 0;
            if (current == null) {
                if (beforeBlock != null) beforeBlock.run();
                Runnable w = onWaiting;
                if (w != null) w.run();
                try {
                    current = queue.take();
                } catch (InterruptedException e) {
                    // Keep the flag so the interpreter notices it and stops the program.
                    Thread.currentThread().interrupt();
                    current = null;
                    return -1;
                }
            }
            if (current == EOF) {
                // Stay at EOF for later reads too.
                queue.offer(EOF);
                current = null;
                return -1;
            }
        }
        int n = Math.min(len, current.length - pos);
        System.arraycopy(current, pos, b, off, n);
        pos += n;
        return n;
    }

    @Override
    public int available() {
        if (current != null && pos < current.length) return current.length - pos;
        byte[] next = queue.peek();
        return next == null || next == EOF ? 0 : next.length;
    }
}
