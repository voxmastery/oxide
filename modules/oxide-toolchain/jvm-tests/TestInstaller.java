import expo.modules.oxidetoolchain.core.PayloadInstaller;
import java.io.File;

/** Downloads URL (resuming), checks SHA256, unpacks into DEST_DIR with --strip-components=1. */
public final class TestInstaller {
    public static void main(String[] a) throws Exception {
        String url = a[0], sha = a[1];
        File dest = new File(a[2]);
        File archive = new File(dest.getParentFile(), url.substring(url.lastIndexOf('/') + 1));
        PayloadInstaller inst = new PayloadInstaller();
        long[] last = {-1};
        PayloadInstaller.Progress p = (state, done, total, log) -> {
            long pct = total > 0 ? done * 100 / total : -1;
            if (log != null) System.out.println(log);
            if (pct / 10 != last[0]) { last[0] = pct / 10; System.out.println(state + " " + pct + "% " + done + "/" + total); }
        };
        if (a.length > 3 && a[3].equals("--pause-at-start")) {
            // Simulate a pause: stop after the first chunk, then resume with Range.
            PayloadInstaller.Progress pausing = (state, done, total, log) -> { if (done > (5 << 20)) inst.pause(); };
            try { inst.download(url, archive, sha, -1, pausing); } catch (PayloadInstaller.PausedException e) {
                System.out.println("paused at " + new File(archive + ".part").length());
            }
            inst.resetPause();
        }
        inst.download(url, archive, sha, -1, p);
        long n = inst.extract(archive, dest, 1, false, p);
        System.out.println("extracted " + n + " bytes into " + dest);
    }
}
