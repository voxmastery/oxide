package expo.modules.oxidetoolchain

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import expo.modules.oxidetoolchain.core.PayloadInstaller
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * The first-run "Setting up Rust" download.
 *
 * The payload is described by a manifest JSON (app.json `extra.toolchainPayloadUrl`, produced
 * by toolchain/make-data-payload.sh):
 *
 * ```json
 * { "schema": 1, "rustVersion": "1.99.1", "rustcVersionLine": "rustc 1.99.1 (58cf8f9c3 2026-10-13)",
 *   "cargoVersionLine": "cargo 1.99.1 (…)", "target": "wasm32-wasip1-threads",
 *   "archives": [ { "pkg": "rust", "component": "rust-std", "url": "sysroot-1.99.1.tar.xz",
 *                   "sha256": "…", "size": 24585048, "installedSize": 109758743,
 *                   "dest": "toolchain/rust", "strip": 1 }, … ] }
 * ```
 *
 * Relative URLs resolve against the manifest URL. `dest` is relative to filesDir. Only archives
 * with `pkg == "rust"` are handled here; the Book and Rustlings ship inside the JS bundle.
 */
class PayloadSetup(private val context: Context, private val layout: ToolchainLayout) {
  data class Archive(
    val component: String,
    val url: String,
    val sha256: String?,
    val size: Long,
    val installedSize: Long,
    val dest: String,
    val strip: Int,
    val keepExisting: Boolean,
  )

  data class Manifest(
    val json: JSONObject,
    val rustVersion: String,
    val archives: List<Archive>,
  )

  class MeteredNetworkException : IOException("on a metered network")

  val installer = PayloadInstaller()

  fun isMetered(): Boolean {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
    val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
    return !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
  }

  fun fetchManifest(manifestUrl: String): Manifest {
    val c = URL(manifestUrl).openConnection() as HttpURLConnection
    c.connectTimeout = 15_000
    c.readTimeout = 20_000
    try {
      if (c.responseCode != 200) throw IOException("HTTP ${c.responseCode} for $manifestUrl")
      val text = c.inputStream.bufferedReader().use { it.readText() }
      val json = JSONObject(text)
      val list = json.getJSONArray("archives")
      val archives = (0 until list.length()).map { list.getJSONObject(it) }
        .filter { it.optString("pkg", "rust") == "rust" }
        .map {
          Archive(
            component = it.optString("component", it.optString("dest")),
            url = URL(URL(manifestUrl), it.getString("url")).toString(),
            sha256 = it.optString("sha256").ifEmpty { null },
            size = it.optLong("size", -1),
            installedSize = it.optLong("installedSize", -1),
            dest = it.getString("dest"),
            strip = it.optInt("strip", 0),
            keepExisting = it.optBoolean("keepExisting", false),
          )
        }
      return Manifest(json, json.getString("rustVersion"), archives)
    } finally {
      c.disconnect()
    }
  }

  /**
   * Downloads, verifies and unpacks every archive, reporting progress for the whole 'rust'
   * package. Throws [PayloadInstaller.PausedException] after [pause].
   */
  fun install(
    manifestUrl: String,
    allowMetered: Boolean,
    progress: (state: String, done: Long, total: Long, log: String?) -> Unit,
  ) {
    installer.resetPause()
    if (!allowMetered && isMetered()) throw MeteredNetworkException()
    progress("downloading", 0, 1, "info: syncing channel updates for 'stable-aarch64-linux-android'")
    val manifest = fetchManifest(manifestUrl)
    val total = manifest.archives.sumOf { maxOf(it.size, 0) }.coerceAtLeast(1)
    progress("downloading", 0, total, "info: latest update on stable, rust version ${manifest.rustVersion}")
    layout.downloadDir.mkdirs()
    var before = 0L
    for (a in manifest.archives) {
      if (!allowMetered && isMetered()) throw MeteredNetworkException()
      val file = File(layout.downloadDir, a.url.substringAfterLast('/'))
      progress("downloading", before, total, "info: downloading component '${a.component}'")
      val base = before
      installer.download(a.url, file, a.sha256, a.size) { _, done, _, log ->
        progress("downloading", base + done, total, log)
      }
      before += maxOf(a.size, file.length())
    }
    // Everything is downloaded and verified: now replace the installed data.
    val installTotal = manifest.archives.sumOf { maxOf(it.size, 0) }.coerceAtLeast(1)
    var installed = 0L
    for (a in manifest.archives) {
      val file = File(layout.downloadDir, a.url.substringAfterLast('/'))
      val dest = File(layout.filesDir, a.dest)
      progress("installing", installed, installTotal, "info: installing component '${a.component}'")
      if (!a.keepExisting) PayloadInstaller.deleteTree(dest)
      val base = installed
      installer.extract(file, dest, a.strip, a.keepExisting) { _, done, _, log ->
        progress("installing", base + done, installTotal, log)
      }
      installed += maxOf(a.size, 0)
      file.delete()
    }
    layout.toolchainDir.mkdirs()
    val marker = JSONObject()
      .put("rustVersion", manifest.rustVersion)
      .put("rustcVersionLine", manifest.json.optString("rustcVersionLine"))
      .put("cargoVersionLine", manifest.json.optString("cargoVersionLine"))
      .put("target", manifest.json.optString("target", ToolchainLayout.WASM_TARGET))
      .put("manifestUrl", manifestUrl)
      .put("installedAt", System.currentTimeMillis())
    layout.installedMarker.writeText(marker.toString(2))
    layout.writeCargoConfig()
    progress("done", installTotal, installTotal, "info: default toolchain set to '${manifest.rustVersion}'")
  }

  fun pause() = installer.pause()

  fun installedInfo(): JSONObject? =
    try {
      if (layout.installedMarker.isFile) JSONObject(layout.installedMarker.readText()) else null
    } catch (_: Exception) {
      null
    }
}
