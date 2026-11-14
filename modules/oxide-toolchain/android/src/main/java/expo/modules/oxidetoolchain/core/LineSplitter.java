package expo.modules.oxidetoolchain.core;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * An OutputStream that turns a byte stream into UTF-8 lines for a {@link ProcessListener}.
 * "\r\n" and "\n" end a line. A lone "\r" is kept in the line (progress bars), which the
 * terminal renderer may interpret.
 *
 * <p>{@link #flushPartial()} emits a pending line without a newline, which is used for prompts
 * when the program blocks on stdin.
 */
public final class LineSplitter extends OutputStream {
    private final ProcessListener listener;
    private final String stream;
    private final ByteArrayOutputStream buf = new ByteArrayOutputStream(256);
    /** Bytes of the current line already sent as a partial line. */
    private int partialSent = 0;
    /** Cap so a program that never prints a newline cannot exhaust memory. */
    private static final int MAX_LINE = 64 * 1024;

    /** Called after every complete line; used to detect Rust panics. */
    public interface LineObserver {
        void observe(String line);
    }

    private volatile LineObserver observer;

    public LineSplitter(ProcessListener listener, String stream) {
        this.listener = listener;
        this.stream = stream;
    }

    public void setObserver(LineObserver observer) {
        this.observer = observer;
    }

    @Override
    public synchronized void write(int b) {
        if (b == '\n') {
            emitLine(false);
            return;
        }
        buf.write(b);
        if (buf.size() >= MAX_LINE) {
            emitLine(false);
        }
    }

    @Override
    public synchronized void write(byte[] b, int off, int len) {
        int end = off + len;
        int start = off;
        for (int i = off; i < end; i++) {
            if (b[i] == '\n') {
                buf.write(b, start, i - start);
                emitLine(false);
                start = i + 1;
            }
        }
        if (start < end) {
            buf.write(b, start, end - start);
            if (buf.size() >= MAX_LINE) {
                emitLine(false);
            }
        }
    }

    /** Emit the pending bytes as a partial line, if there are new ones. */
    public synchronized void flushPartial() {
        if (buf.size() > partialSent) {
            byte[] bytes = buf.toByteArray();
            String text = new String(bytes, partialSent, bytes.length - partialSent, StandardCharsets.UTF_8);
            partialSent = bytes.length;
            listener.onLine(stream, text, true);
        }
    }

    /** Emit whatever is left when the process ends. */
    @Override
    public synchronized void close() {
        if (buf.size() > partialSent) {
            flushPartial();
        }
        buf.reset();
        partialSent = 0;
    }

    private void emitLine(boolean partial) {
        byte[] bytes = buf.toByteArray();
        int len = bytes.length;
        if (len > 0 && bytes[len - 1] == '\r') {
            len--;
        }
        String full = new String(bytes, 0, len, StandardCharsets.UTF_8);
        String rest = partialSent == 0
                ? full
                : new String(bytes, Math.min(partialSent, len), Math.max(0, len - partialSent), StandardCharsets.UTF_8);
        buf.reset();
        partialSent = 0;
        // After a partial line the UI already shows its start ("Guess: "); this event carries
        // only the rest and closes the line (it may be empty).
        listener.onLine(stream, rest, partial);
        LineObserver o = observer;
        if (o != null) {
            o.observe(full);
        }
    }
}
