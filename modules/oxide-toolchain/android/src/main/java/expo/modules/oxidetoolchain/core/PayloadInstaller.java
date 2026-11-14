package expo.modules.oxidetoolchain.core;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InterruptedIOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream;
import org.apache.commons.compress.compressors.xz.XZCompressorInputStream;

/**
 * Downloads and unpacks the toolchain's data payload (sysroot, vendored crates…).
 *
 * <p>Pure Java, no Android dependencies, so it can be exercised on a desktop JDK. Downloads
 * resume with an HTTP Range request from the bytes already in {@code <dest>.part}; the file is
 * verified against its SHA-256 before it is unpacked. {@link #pause()} stops at the next chunk
 * and keeps the partial file.
 */
public final class PayloadInstaller {
    public interface Progress {
        /** @param state "downloading" | "installing" */
        void onProgress(String state, long done, long total, String log);
    }

    /** Thrown when {@link #pause()} interrupted a download; the partial file is kept. */
    public static final class PausedException extends IOException {
        public PausedException() {
            super("paused");
        }
    }

    private volatile boolean paused;

    public void pause() {
        paused = true;
    }

    public void resetPause() {
        paused = false;
    }

    /**
     * Downloads {@code url} to {@code dest}, resuming {@code dest.part} when the server honours
     * Range requests. Returns immediately when {@code dest} already exists with the right hash.
     */
    public void download(String url, File dest, String sha256, long expectedSize, Progress progress)
            throws IOException {
        if (dest.isFile() && (sha256 == null || sha256.equalsIgnoreCase(sha256(dest)))) {
            progress.onProgress("downloading", dest.length(), dest.length(), null);
            return;
        }
        File part = new File(dest.getPath() + ".part");
        File parent = dest.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
            throw new IOException("cannot create " + parent);
        }
        int redirects = 0;
        String current = url;
        while (true) {
            long have = part.isFile() ? part.length() : 0;
            HttpURLConnection c = (HttpURLConnection) new URL(current).openConnection();
            c.setConnectTimeout(20_000);
            c.setReadTimeout(30_000);
            c.setInstanceFollowRedirects(false);
            c.setRequestProperty("Accept-Encoding", "identity");
            if (have > 0) c.setRequestProperty("Range", "bytes=" + have + "-");
            int status = c.getResponseCode();
            if (status >= 300 && status < 400 && c.getHeaderField("Location") != null) {
                if (++redirects > 5) throw new IOException("too many redirects for " + url);
                current = new URL(new URL(current), c.getHeaderField("Location")).toString();
                c.disconnect();
                continue;
            }
            boolean append;
            long total;
            if (status == HttpURLConnection.HTTP_PARTIAL && have > 0) {
                append = true;
                total = parseTotal(c.getHeaderField("Content-Range"), have + c.getContentLengthLong());
            } else if (status == HttpURLConnection.HTTP_OK) {
                append = false; // server ignored Range: start over
                have = 0;
                total = c.getContentLengthLong();
            } else if (status == 416 && have > 0 && (expectedSize <= 0 || have == expectedSize)) {
                // Already complete.
                c.disconnect();
                break;
            } else {
                c.disconnect();
                throw new IOException("HTTP " + status + " for " + current);
            }
            if (total <= 0) total = expectedSize;
            try (InputStream in = new BufferedInputStream(c.getInputStream(), 1 << 16);
                    OutputStream out = new FileOutputStream(part, append)) {
                byte[] buf = new byte[1 << 16];
                long done = have;
                long lastReport = 0;
                int n;
                while ((n = in.read(buf)) > 0) {
                    if (paused) throw new PausedException();
                    if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException();
                    out.write(buf, 0, n);
                    done += n;
                    if (done - lastReport >= (256 << 10) || done == total) {
                        lastReport = done;
                        progress.onProgress("downloading", done, total, null);
                    }
                }
            } finally {
                c.disconnect();
            }
            break;
        }
        if (sha256 != null) {
            progress.onProgress("installing", 0, 1, "info: verifying " + dest.getName());
            String got = sha256(part);
            if (!sha256.equalsIgnoreCase(got)) {
                // A corrupt partial file must not be resumed again.
                part.delete();
                throw new IOException("checksum mismatch for " + dest.getName() + ": expected " + sha256 + ", got " + got);
            }
        }
        Files.move(part.toPath(), dest.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
    }

    private static long parseTotal(String contentRange, long fallback) {
        // "bytes 100-199/200"
        if (contentRange == null) return fallback;
        int slash = contentRange.lastIndexOf('/');
        if (slash < 0) return fallback;
        try {
            return Long.parseLong(contentRange.substring(slash + 1).trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    public static String sha256(File f) throws IOException {
        MessageDigest md;
        try {
            md = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IOException(e);
        }
        try (InputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
        }
        StringBuilder sb = new StringBuilder();
        for (byte b : md.digest()) sb.append(String.format(Locale.ROOT, "%02x", b));
        return sb.toString();
    }

    /**
     * Unpacks a {@code .tar.xz}, {@code .tar.gz} or {@code .tar} archive into {@code destDir}.
     *
     * @param stripComponents leading path components to drop, like {@code tar --strip-components}
     * @param keepExisting do not overwrite files that already exist (user-edited files)
     * @return bytes written
     */
    public long extract(File archive, File destDir, int stripComponents, boolean keepExisting, Progress progress)
            throws IOException {
        Path root = destDir.getCanonicalFile().toPath();
        Files.createDirectories(root);
        long total = archive.length();
        long written = 0;
        String name = archive.getName().toLowerCase(Locale.ROOT);
        try (CountingInputStream raw = new CountingInputStream(new BufferedInputStream(new FileInputStream(archive), 1 << 16));
                InputStream decompressed = name.endsWith(".xz")
                        ? new XZCompressorInputStream(raw)
                        : name.endsWith(".gz") || name.endsWith(".tgz")
                                ? new GzipCompressorInputStream(raw)
                                : raw;
                TarArchiveInputStream tar = new TarArchiveInputStream(decompressed)) {
            TarArchiveEntry e;
            byte[] buf = new byte[1 << 16];
            long lastReport = 0;
            while ((e = tar.getNextEntry()) != null) {
                if (paused) throw new PausedException();
                String rel = strip(e.getName(), stripComponents);
                if (rel == null || rel.isEmpty()) continue;
                Path out = root.resolve(rel).normalize();
                if (!out.startsWith(root)) throw new IOException("unsafe path in archive: " + e.getName());
                if (e.isDirectory()) {
                    Files.createDirectories(out);
                } else if (e.isSymbolicLink()) {
                    Path target = Paths.get(e.getLinkName());
                    Path resolved = out.getParent().resolve(target).normalize();
                    if (!resolved.startsWith(root)) throw new IOException("unsafe link in archive: " + e.getName());
                    Files.createDirectories(out.getParent());
                    if (keepExisting && Files.exists(out, java.nio.file.LinkOption.NOFOLLOW_LINKS)) continue;
                    Files.deleteIfExists(out);
                    Files.createSymbolicLink(out, target);
                } else if (e.isFile()) {
                    Files.createDirectories(out.getParent());
                    if (keepExisting && Files.exists(out)) continue;
                    File tmp = new File(out.toString() + ".oxide-tmp");
                    try (OutputStream os = new FileOutputStream(tmp)) {
                        int n;
                        while ((n = tar.read(buf)) > 0) {
                            os.write(buf, 0, n);
                            written += n;
                        }
                    }
                    // Data only: nothing unpacked here is ever executed (Android forbids it).
                    tmp.setReadable(true, true);
                    Files.move(tmp.toPath(), out, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
                long pos = raw.count();
                if (pos - lastReport >= (512 << 10)) {
                    lastReport = pos;
                    progress.onProgress("installing", pos, total, null);
                }
            }
        }
        progress.onProgress("installing", total, total, null);
        return written;
    }

    private static String strip(String name, int n) {
        String s = name;
        while (s.startsWith("./")) s = s.substring(2);
        for (int i = 0; i < n; i++) {
            int slash = s.indexOf('/');
            if (slash < 0) return null;
            s = s.substring(slash + 1);
        }
        return s;
    }

    /** Deletes a directory tree (used to replace a sysroot on update). */
    public static void deleteTree(File f) throws IOException {
        if (!f.exists()) return;
        Path p = f.toPath();
        if (Files.isDirectory(p, java.nio.file.LinkOption.NOFOLLOW_LINKS)) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) deleteTree(k);
        }
        Files.delete(p);
    }

    /** Total size of a directory tree in bytes. */
    public static long treeSize(File f) {
        if (f.isFile()) return f.length();
        long sum = 0;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) sum += treeSize(k);
        return sum;
    }

    static final class CountingInputStream extends java.io.FilterInputStream {
        private long count;

        CountingInputStream(InputStream in) {
            super(in);
        }

        long count() {
            return count;
        }

        @Override
        public int read() throws IOException {
            int b = super.read();
            if (b >= 0) count++;
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            int n = super.read(b, off, len);
            if (n > 0) count += n;
            return n;
        }

        @Override
        public long skip(long n) throws IOException {
            long s = super.skip(n);
            count += s;
            return s;
        }
    }
}
