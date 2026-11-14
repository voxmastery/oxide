package expo.modules.oxidetoolchain

import expo.modules.oxidetoolchain.core.LineSplitter
import expo.modules.oxidetoolchain.core.ProcessListener
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.TimeUnit

/**
 * A real child process (cargo, rustc, rustfmt…) started from the APK's native library dir.
 * stdout and stderr are pumped on their own threads and split into lines.
 */
class HostProcess(
  private val argv: List<String>,
  private val cwd: File,
  private val env: Map<String, String>,
  private val listener: ProcessListener,
) {
  @Volatile private var process: Process? = null
  @Volatile private var killed = false
  private var stdin: OutputStream? = null

  fun start() {
    val started = System.nanoTime()
    val pb = ProcessBuilder(argv).directory(cwd)
    val e = pb.environment()
    // Keep the platform's ANDROID_* / BOOTCLASSPATH variables, replace the rest.
    e.keys.retainAll { it.startsWith("ANDROID_") || it == "BOOTCLASSPATH" || it == "DEX2OATBOOTCLASSPATH" }
    e.putAll(env)
    val p = try {
      pb.start()
    } catch (t: Throwable) {
      listener.onLine("stderr", "oxide: could not start ${File(argv[0]).name}: ${t.message}", false)
      listener.onExit(127, null, 0)
      return
    }
    process = p
    stdin = p.outputStream
    val out = LineSplitter(listener, "stdout")
    val err = LineSplitter(listener, "stderr")
    val tOut = pump(p.inputStream, out, "out")
    val tErr = pump(p.errorStream, err, "err")
    Thread({
      val code = try { p.waitFor() } catch (_: InterruptedException) { -1 }
      tOut.join(2000)
      tErr.join(2000)
      out.close()
      err.close()
      val ms = (System.nanoTime() - started) / 1_000_000
      // Java reports 128+N for a signal on Android's UNIXProcess.
      val signal = when {
        killed -> "SIGINT"
        code == 128 + 9 -> "SIGKILL"
        code == 128 + 15 -> "SIGTERM"
        code == 128 + 6 -> "SIGABRT"
        code == 128 + 11 -> "SIGSEGV"
        else -> null
      }
      listener.onExit(if (killed) 130 else code, signal, ms)
    }, "host-wait").apply { isDaemon = true; start() }
  }

  private fun pump(input: InputStream, sink: LineSplitter, name: String): Thread =
    Thread({
      val buf = ByteArray(8192)
      try {
        input.use {
          while (true) {
            val n = it.read(buf)
            if (n < 0) break
            sink.write(buf, 0, n)
          }
        }
      } catch (_: Exception) {
        // stream closed by kill()
      }
    }, "host-$name").apply { isDaemon = true; start() }

  fun writeLine(line: String) {
    try {
      stdin?.let {
        it.write((line + "\n").toByteArray())
        it.flush()
      }
    } catch (_: Exception) {
      // the process closed its stdin
    }
  }

  fun closeStdin() {
    try { stdin?.close() } catch (_: Exception) {}
  }

  /** ⌃C: SIGTERM, then SIGKILL if the process does not stop within two seconds. */
  fun kill() {
    val p = process ?: return
    killed = true
    p.destroy()
    Thread({
      try {
        if (!p.waitFor(2, TimeUnit.SECONDS)) p.destroyForcibly()
      } catch (_: InterruptedException) {}
    }, "host-kill").apply { isDaemon = true; start() }
  }
}
