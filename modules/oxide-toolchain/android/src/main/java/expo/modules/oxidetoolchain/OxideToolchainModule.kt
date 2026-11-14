package expo.modules.oxidetoolchain

import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.oxidetoolchain.core.PayloadInstaller
import expo.modules.oxidetoolchain.core.ProcessListener
import expo.modules.oxidetoolchain.core.WasmProcess
import java.io.File
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

private const val EVENT_OUTPUT = "onProcOutput"
private const val EVENT_EXIT = "onProcExit"
private const val EVENT_WAITING = "onProcWaiting"
private const val EVENT_INSTALL = "onInstallProgress"

class ToolchainNotInstalledException(what: String) :
  CodedException("ERR_TOOLCHAIN_NOT_INSTALLED", what, null)

class MeteredException :
  CodedException("ERR_METERED", "The download is waiting for Wi-Fi. Allow mobile data to continue.", null)

class InstallPausedException :
  CodedException("ERR_PAUSED", "The download is paused.", null)

/**
 * Oxide's on-device Rust toolchain (Android only).
 *
 * - `spawn` runs cargo/rustc/rustfmt/clippy from the APK's native library dir;
 * - `runWasm` runs a program compiled for wasm32-wasip1(-threads) in-process with Chicory;
 * - `install` downloads the data payload (sysroot, vendored crates, link kit).
 *
 * Both process kinds report through the same events, keyed by id:
 *   onProcOutput { id, stream: "stdout"|"stderr", line, partial }
 *   onProcWaiting { id }            (WebAssembly programs blocked on stdin)
 *   onProcExit   { id, code, signal, durationMs }
 */
class OxideToolchainModule : Module() {
  private val hostProcs = ConcurrentHashMap<String, HostProcess>()
  private val wasmProcs = ConcurrentHashMap<String, WasmProcess>()
  private val nextId = AtomicLong(1)
  private val installExecutor = Executors.newSingleThreadExecutor { r -> Thread(r, "oxide-install").apply { isDaemon = true } }

  private val context
    get() = requireNotNull(appContext.reactContext) { "React Application Context is null" }

  private val layout by lazy { ToolchainLayout(context) }
  private val setup by lazy { PayloadSetup(context, layout) }
  @Volatile private var versionCache: Pair<String?, String?>? = null

  override fun definition() = ModuleDefinition {
    Name("OxideToolchain")

    Events(EVENT_OUTPUT, EVENT_EXIT, EVENT_WAITING, EVENT_INSTALL)

    Constant("isSupported") { Build.SUPPORTED_ABIS.firstOrNull() == "arm64-v8a" && Build.VERSION.SDK_INT >= 29 }
    Constant("wasmTarget") { ToolchainLayout.WASM_TARGET }
    Constant("hostTarget") { ToolchainLayout.HOST_TARGET }

    OnCreate {
      try {
        if (layout.dataInstalled) layout.writeCargoConfig()
      } catch (_: Exception) {
        // info() reports what is missing
      }
    }

    OnDestroy {
      hostProcs.values.forEach { it.kill() }
      wasmProcs.values.forEach { it.kill() }
      installExecutor.shutdownNow()
    }

    AsyncFunction("info") {
      val marker = setup.installedInfo()
      val tools = layout.nativeToolsPresent
      val data = layout.dataInstalled
      val versions = if (tools && data) toolVersions() else null to null
      val reason = when {
        !layout.is64BitArm -> "Compiling needs a 64-bit ARM phone (arm64-v8a). This one is ${Build.SUPPORTED_ABIS.firstOrNull()}."
        Build.VERSION.SDK_INT < 29 -> "Compiling needs Android 10 or later."
        !tools -> "This build of Oxide doesn't include the Rust toolchain binaries (toolchain/dist/jniLibs was empty when it was built)."
        !data -> "Rust isn't set up yet. Finish \"Setting up Rust\" to compile and run code."
        versions.first == null -> "rustc didn't start on this phone. Reinstall Rust from Settings."
        else -> null
      }
      mapOf(
        "installed" to (reason == null),
        "nativeToolsPresent" to tools,
        "dataInstalled" to data,
        "rustVersion" to marker?.optString("rustVersion")?.ifEmpty { null },
        "rustcVersionLine" to (versions.first ?: marker?.optString("rustcVersionLine")?.ifEmpty { null }),
        "cargoVersionLine" to (versions.second ?: marker?.optString("cargoVersionLine")?.ifEmpty { null }),
        "sizeBytes" to (PayloadInstaller.treeSize(layout.toolchainDir) + nativeToolsSize()),
        "unavailableReason" to reason,
        "nativeLibraryDir" to layout.nativeLibDir.absolutePath,
        "filesDir" to layout.filesDir.absolutePath,
        "sysroot" to layout.sysroot.absolutePath,
        "cargoHome" to layout.cargoHome.absolutePath,
        "target" to layout.wasmTarget,
      )
    }

    AsyncFunction("env") {
      layout.baseEnv()
    }

    AsyncFunction("install") { manifestUrl: String, allowMetered: Boolean ->
      // Runs on the install thread; the promise settles when it ends.
      val future = installExecutor.submit<Unit> {
        try {
          setup.install(manifestUrl, allowMetered) { state, done, total, log ->
            sendInstall(state, done, total, log, null)
          }
        } catch (e: PayloadSetup.MeteredNetworkException) {
          sendInstall("waiting", 0, 0, "info: waiting for Wi-Fi", "metered")
          throw MeteredException()
        } catch (e: PayloadInstaller.PausedException) {
          sendInstall("paused", 0, 0, "info: download paused", null)
          throw InstallPausedException()
        } catch (e: Exception) {
          sendInstall("error", 0, 0, null, e.message ?: e.toString())
          throw e
        }
      }
      try {
        future.get()
      } catch (e: java.util.concurrent.ExecutionException) {
        throw e.cause ?: e
      }
      versionCache = null
      true
    }

    Function("pauseInstall") {
      setup.pause()
    }

    AsyncFunction("fetchManifest") { manifestUrl: String ->
      val m = setup.fetchManifest(manifestUrl)
      mapOf(
        "rustVersion" to m.rustVersion,
        "rustcVersionLine" to m.json.optString("rustcVersionLine"),
        "downloadBytes" to m.archives.sumOf { maxOf(it.size, 0) },
        "installedBytes" to m.archives.sumOf { maxOf(it.installedSize, 0) },
      )
    }

    Function("isMetered") {
      setup.isMetered()
    }

    /**
     * argv[0] is a tool name ("cargo", "rustc", "rustfmt", "rust-lld", "clippy-driver") or an
     * absolute path inside the native library dir. env is added to the base environment.
     */
    /** Switch cargo between crates.io (online) and the vendored crates (offline). */
    Function("setOnline") { online: Boolean ->
      if (layout.dataInstalled) layout.writeCargoConfig(online) else layout.online = online
    }

    Function("spawn") { argv: List<String>, cwd: String, env: Map<String, String> ->
      if (argv.isEmpty()) throw CodedException("ERR_ARGV", "empty command", null)
      val exe = layout.tool(argv[0])
        ?: File(argv[0]).takeIf { it.isAbsolute && it.canonicalPath.startsWith(layout.nativeLibDir.canonicalPath) }
        ?: File(argv[0]).takeIf { it.isAbsolute && (it.canonicalPath.startsWith("/system/bin/") || it.canonicalPath.startsWith("/system/xbin/")) }
        ?: throw CodedException("ERR_NOT_A_TOOL", "${argv[0]}: not a toolchain program", null)
      if (!exe.isFile) throw ToolchainNotInstalledException("${exe.name} is missing from ${layout.nativeLibDir}")
      val id = "h" + nextId.getAndIncrement()
      val fullEnv = LinkedHashMap(layout.baseEnv())
      if (argv[0] == "cargo") {
        // Lets cargo run the build scripts it compiles (see toolchain/native/oxide-exec.c).
        val shim = File(layout.nativeLibDir, "liboxide-exec.so")
        if (shim.isFile) fullEnv["LD_PRELOAD"] = shim.absolutePath
      }
      fullEnv.putAll(env)
      val dir = File(cwd).takeIf { it.isDirectory } ?: layout.home.also { it.mkdirs() }
      val proc = HostProcess(listOf(exe.absolutePath) + argv.drop(1), dir, fullEnv, listenerFor(id) { hostProcs.remove(id) })
      hostProcs[id] = proc
      proc.start()
      id
    }

    /**
     * Runs a .wasm file. args[0] is the program name as the user typed it. The working
     * directory is preopened as "." (relative paths), and the home directory as itself.
     */
    Function("runWasm") { path: String, args: List<String>, cwd: String, env: Map<String, String> ->
      val file = File(path)
      if (!file.isFile) throw CodedException("ERR_NO_SUCH_FILE", "$path: No such file or directory", null)
      val id = "w" + nextId.getAndIncrement()
      val dir = File(cwd).takeIf { it.isDirectory } ?: layout.home
      val preopens = linkedMapOf<String, Path>("." to dir.toPath())
      preopens[layout.home.absolutePath] = layout.home.toPath()
      val wenv = linkedMapOf(
        "HOME" to layout.home.absolutePath,
        "PWD" to dir.absolutePath,
        "TERM" to "xterm-256color",
      )
      wenv.putAll(env)
      val proc = WasmProcess(file, if (args.isEmpty()) listOf(file.nameWithoutExtension) else args, wenv, preopens, listenerFor(id) { wasmProcs.remove(id) })
      proc.setOnWaitingForInput { sendEvent(EVENT_WAITING, mapOf("id" to id)) }
      wasmProcs[id] = proc
      proc.start()
      id
    }

    Function("writeStdin") { id: String, line: String ->
      val host = hostProcs[id]
      if (host != null) host.writeLine(line) else wasmProcs[id]?.writeLine(line)
    }

    Function("closeStdin") { id: String ->
      val host = hostProcs[id]
      if (host != null) host.closeStdin() else wasmProcs[id]?.closeStdin()
    }

    Function("kill") { id: String ->
      val host = hostProcs[id]
      if (host != null) host.kill() else wasmProcs[id]?.kill()
    }
  }

  private fun listenerFor(id: String, onDone: () -> Unit) = object : ProcessListener {
    override fun onLine(stream: String, line: String, partial: Boolean) {
      sendEvent(EVENT_OUTPUT, mapOf("id" to id, "stream" to stream, "line" to line, "partial" to partial))
    }

    override fun onExit(code: Int, signal: String?, durationMs: Long) {
      onDone()
      sendEvent(EVENT_EXIT, mapOf("id" to id, "code" to code, "signal" to signal, "durationMs" to durationMs))
    }
  }

  private fun sendInstall(state: String, done: Long, total: Long, log: String?, error: String?) {
    sendEvent(
      EVENT_INSTALL,
      mapOf(
        "pkg" to "rust",
        "state" to state,
        "bytesDone" to done.toDouble(),
        "bytesTotal" to total.toDouble(),
        "progress" to if (total > 0) (done.toDouble() / total).coerceIn(0.0, 1.0) else 0.0,
        "log" to log,
        "error" to error,
      ),
    )
  }

  private fun nativeToolsSize(): Long =
    layout.nativeLibDir.listFiles()?.filter { it.name.startsWith("lib") }?.sumOf { it.length() } ?: 0

  /** Runs `rustc --version` and `cargo --version` once per app start. */
  private fun toolVersions(): Pair<String?, String?> {
    versionCache?.let { return it }
    fun run(tool: String): String? = try {
      val exe = layout.tool(tool) ?: return null
      val pb = ProcessBuilder(exe.absolutePath, "--version").redirectErrorStream(true)
      pb.environment().putAll(layout.baseEnv())
      val p = pb.start()
      val out = p.inputStream.bufferedReader().readText().trim()
      if (p.waitFor(20, TimeUnit.SECONDS) && p.exitValue() == 0) out.lineSequence().firstOrNull() else null
    } catch (_: Exception) {
      null
    }
    val v = run("rustc") to run("cargo")
    if (v.first != null) versionCache = v
    return v
  }
}
