# Oxide's on-device Rust toolchain

Oxide compiles and runs Rust on the phone with the real `rustc` and `cargo` (Rust 1.99.1).
Nothing is simulated: the output in the Terminal and in an exercise's Output tab is what
rustc, cargo, clippy, rustfmt and the program printed, with their ANSI colors.

This folder has the scripts that produce the two halves of the toolchain, and this file
explains how it all fits together, what has been verified, and what has not.

## How it works

```
 APK  lib/arm64-v8a/ (jniLibs, extracted to nativeLibraryDir: the only place Android 10+ lets an app exec from)
      librustc.so  libcargo.so  librust-lld.so  libclippy-driver.so  librustfmt.so  librustdoc.so
      librustc_driver-*.so  libstd-*.so  (libc++_shared.so …)
      liboxide-rustc.so  liboxide-cc.so  liboxide-exec.so          ← toolchain/native/*.c

 files/toolchain/   (downloaded on first run: "Setting up Rust"; data only, never executed)
      rust/lib/rustlib/wasm32-wasip1-threads/…   std for user programs
      rust/lib/rustlib/aarch64-linux-android/…   std for build scripts and proc-macros
      vendor/                                    cargo vendor of rand + tokio (offline builds)
      android-link/                              NDK crt objects + libc stubs (host linking)
      cargo-home/config.toml                     regenerated on every start (see below)
 files/home/          the Terminal's ~ (projects/, rustlings/)
```

1. **Host tools run as real processes** from `nativeLibraryDir` (Android 10+ with
   targetSdk ≥ 29 forbids executing files an app writes, "W^X"). They are packaged as
   `lib<name>.so` because Android only installs files with that name pattern from an APK, and
   only installs them as files when `android:extractNativeLibs="true"` /
   `useLegacyPackaging` is set (the config plugin does both).
2. **rustc's sysroot is the downloaded data**, not the directory the compiler sits in.
   `liboxide-rustc.so` is what `RUSTC` points to: it execs `librustc.so --sysroot
   files/toolchain/rust …`, for every crate including build scripts and proc-macros (cargo
   does not apply `rustflags` to those when `--target` is set, so the flag cannot go in
   config.toml). As `RUSTC_WORKSPACE_WRAPPER` with `OXIDE_CLIPPY=1` it starts
   `libclippy-driver.so` instead, which is all `cargo clippy` does (`CLIPPY_ARGS` carries
   `-- -D warnings`).
3. **User programs and tests compile to `wasm32-wasip1-threads`** and run **in-process on the
   JVM with [Chicory](https://github.com/dylibso/chicory)** 1.7.5 (pure-Java WebAssembly
   interpreter + WASI preview 1). Nothing the user compiles is ever exec'd. stdout/stderr
   stream back line by line as events; stdin lines from the Terminal are queued and the
   program's `fd_read` blocks on its worker thread; ⌃C interrupts the threads (Chicory checks
   the interrupt flag on calls and backward branches). A Rust panic exits with 101 as native
   Rust does.
4. `$CARGO_HOME/config.toml` (written by `ToolchainLayout.writeCargoConfig()` on every app
   start, because `nativeLibraryDir` contains a random path segment that changes on each app
   update):

   ```toml
   [build]
   target = "wasm32-wasip1-threads"
   [target.wasm32-wasip1-threads]
   linker = "<nativeLibraryDir>/librust-lld.so"
   rustflags = ["--cfg", "tokio_unstable"]
   [target.aarch64-linux-android]
   linker = "<nativeLibraryDir>/liboxide-cc.so"
   [source.crates-io]
   replace-with = "oxide-vendored"
   [source.oxide-vendored]
   directory = "<files>/toolchain/vendor"
   [net]
   offline = true
   [cargo-new]
   vcs = "none"
   ```
5. **`cargo run` / `cargo test`** (src/toolchain/cargo.ts): the real `cargo build` /
   `cargo test --no-run` runs with `--message-format=json-diagnostic-rendered-ansi`; rustc's
   rendered diagnostics are printed verbatim and also parsed into `Diagnostic` objects; then
   the produced `.wasm` runs in Chicory after cargo's own `Running \`target/…\`` line, and a
   failing program gets cargo's `error: process didn't exit successfully: … (exit status: 101)`.
   `./target/debug/x` and `./x` (after `rustc x.rs`) resolve to the `.wasm` file.
6. **Tests.** The prebuilt std for wasm is `panic=abort`, so a failing test would end the whole
   libtest run before it prints a report, and libtest's capture would swallow the panic
   message. src/toolchain/testHarness.ts does what libtest's own `-Z panic-abort-tests` does:
   list the tests (`--list --format terse`), run each in its own instance
   (`<name> --exact --nocapture --test-threads=1`) and print libtest's report format from the
   results. Each test's output (panic message, assertion diff) is the program's real output.
   Doc-tests are not run (they need rustdoc to execute native test programs).
7. **Build scripts and proc-macros** (getrandom, libc, proc-macro2, quote, tokio-macros in the
   vendored set) are compiled for the phone itself. `liboxide-cc.so` is a minimal `cc` that
   turns rustc's gcc-style link line into an `ld.lld` one with the NDK's crt objects and libc
   stubs (the "link kit" in the payload). Cargo then has to *run* the build script it just
   built in `files/`, which W^X forbids; `liboxide-exec.so`, `LD_PRELOAD`ed into cargo only,
   rewrites that exec to `/system/bin/linker64 <script>` (the technique termux-exec uses).
   Proc-macro `.so` files are `dlopen`ed by rustc, which Android still allows for app data.

### Threads: wasm32-wasip1-threads

wasm32-wasip1 has no threads: `std::thread::spawn` fails with "operation not supported", so
Rustlings' `20_threads`, `24_async` (tokio's multi-threaded runtime) and the Book's chapter 16
could not pass. Chicory 1.7.5 implements the threads proposal (shared memory, atomics,
`memory.atomic.wait/notify`) but not the `wasi-threads` host API, so `WasmProcess.java`
implements `wasi.thread-spawn`: each new thread is a new Chicory instance of the same module,
importing the same shared memory, entered through the module's `wasi_thread_start` export, as
the wasi-threads proposal specifies (that is how wasmtime does it). `proc_exit` or a trap in any
thread ends the whole program; when `main` returns, the other threads are stopped.

**Decision: user code targets `wasm32-wasip1-threads`.** Verified on a desktop JVM (below):
10 threads + `Arc<Mutex>` + `mpsc` channels work, and the solution of Rustlings `async1`
(`#[tokio::main]`, `tokio::spawn`, `tokio::fs`) runs and passes. The Termux path only has std for
`wasm32-wasip1`; its manifest says so (`"target"`) and the app then uses that target.

Differences from native that remain: a panic in a spawned thread aborts the whole program
(panic=abort) instead of returning `Err` from `join()`; `std::env::current_dir()` returns `/`
(relative paths still resolve against the working directory, which is preopened as `.`);
`std::net` sockets are not available in WASI preview 1, so the Book's chapter 21 web server
compiles but `TcpListener::bind` fails at run time; deep recursion ends in a trap ("out of
bounds memory access") rather than "has overflowed its stack".

## Producing the payload

### (a) jniLibs: the host binaries

**Preferred: build from source** (`build-android-host.sh`, `bootstrap.toml.in`). x.py builds
Rust 1.99.1 with `host = aarch64-linux-android` using the NDK's clang, plus std for
aarch64-linux-android, wasm32-wasip1-threads and wasm32-wasip1 (needs wasi-sdk for the
`wasi-root`), with `lld = true` (rust-lld), static LLVM and libstdc++, and cargo with its C
dependencies static. The script renames the binaries to `lib<name>.so`, strips them, adds the
helpers (`build-native-helpers.sh`) and checks that every `NEEDED` library is either in
jniLibs or an Android system library, and that the ELF interpreter is `/system/bin/linker64`.

```sh
export ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.x  WASI_SDK_PATH=/opt/wasi-sdk
toolchain/build-android-host.sh          # hours; ~60 GB of disk
```

**Alternative: repackage Termux** (`fetch-termux.sh`). Termux builds the same release
(packages/rust: 1.99.1) for Android, plus `rust-std-aarch64-linux-android` and
`rust-std-wasm32-wasip1` (no `-threads`). The script resolves `Depends:` from the Termux apt
index, unpacks the .debs, renames programs, pulls every needed shared library out of the
Termux prefix under a `lib*.so` name, and uses `patchelf` to fix `SONAME`/`NEEDED` and drop the
`RUNPATH` (Termux binaries point at `/data/data/com.termux/files/usr/lib`). Termux's `lld`
package provides `rust-lld`. Its `ndk-sysroot` and `libcompiler-rt` packages provide the link
kit. Mind the licenses of everything it pulls in (all open source; list them in the app).

### (b) the data payload

```sh
toolchain/make-data-payload.sh --std-dir toolchain/dist/rust-dist --ndk "$ANDROID_NDK_HOME"
# Termux path:
WASM_TARGET=wasm32-wasip1 toolchain/make-data-payload.sh --std-dir toolchain/dist/rust-dist --link-kit toolchain/dist/termux-link-kit
```

It writes `toolchain/dist/payload/{sysroot-…, vendor-…, android-link-…}.tar.xz` and
`manifest.json` (sha256, sizes, destinations). Host that folder anywhere over HTTPS that
supports `Range` requests and set `expo.extra.toolchainPayloadUrl` in app.json to the
manifest's URL (it is a clearly marked placeholder now). The installer downloads with resume,
verifies sha256, then unpacks; "Use mobile data" off makes it refuse metered networks
(`ERR_METERED`), and pause keeps the partial file.

**std must match the compiler.** rlibs only load into the rustc that built them (same version
string and build). Use the std tarballs from the same x.py build (or the same Termux build) as
the jniLibs. Without `--std-dir` the script downloads the official ones from
static.rust-lang.org, which is right only for an official rustc build.

Vendored crates (`vendor-manifest/Cargo.toml`): `rand = "0.10"` (the Book uses
`rand = "0.10.1"`; minigrep and the chapter 21 server need no crates) and
`tokio = { version = "1", features = ["fs", "macros", "rt-multi-thread"] }` (the Rustlings
crate's only dependency). Measured: vendor 1.7 MB download / 14 MB installed; sysroot (official
1.99.1 std for wasm32-wasip1-threads + aarch64-linux-android) 57 MB download / 250 MB installed.
Rustlings and the Book are not in the payload: they ship in the JS bundle, and
`ensureRustlingsWorkspace()` (src/fs) writes `~/rustlings` from it during setup.

## Size, and the production path

Measured on the official x86_64 1.99.1 build for scale: `librustc_driver` 158 MB, cargo 36 MB,
rust-lld 12 MB (dynamic LLVM), rustdoc 13 MB. For aarch64 with static LLVM expect roughly
250–300 MB of native libraries (≈ 80–100 MB compressed inside the APK). With
`useLegacyPackaging` the libraries are stored compressed in the APK and extracted at install,
so the device holds both: about 100 MB APK + 300 MB extracted + 265 MB data. That is too big
for the Play Store's 200 MB base-module limit for compressed download size, and every app update
re-downloads the binaries.

**Production:** move the jniLibs into a **Play Feature Delivery dynamic feature module**
(on-demand, `dist:onDemand="true"`) containing only `lib/arm64-v8a/*.so`. Play installs a
feature module's native libraries into the app's `nativeLibraryDir` (split APK), so the exec
layout above is unchanged, and requesting it with `SplitInstallManager` during "Setting up Rust"
matches the design's download screen. Call `SplitCompat.install(context)` and recompute
`nativeLibraryDir`-derived paths afterwards (the module already rewrites config.toml on start).
The data payload can stay a plain download, or become an asset pack (Play Asset Delivery).

**Play policy notes.** The Device and Network Abuse policy forbids an app from downloading
executable code (dex, native code) from outside Google Play. That is why the binaries are in the
APK / a Play-delivered feature module, and the downloaded payload contains only data (rlibs,
sources, object files that are linked, not executed). Code the *user* writes is compiled on
device and runs inside a WebAssembly interpreter, which is the usual reading of the
"educational / interpreter" allowance, but build scripts of vendored crates do run natively via
`linker64`: review this with Play policy before publishing, or remove the need by prebuilding
build-script outputs (see "Not done"). Distribution outside Play (F-Droid, direct APK) has no
such restriction.

**iOS is not supported and cannot be.** iOS forbids apps from executing any code that was not
signed into the app (no `fork`/`exec`, no JIT for third-party apps). The module is Android-only
(`expo-module.config.json` lists only android), so on iOS `OxideToolchain` is `null` and
`getToolchain()` returns the "unavailable" toolchain with an explanation. A remote build service
would be the only way to compile from an iPhone.

## What was verified, and what was not

Verified on this repository's development machine (x86_64 Linux, JDK 21, Rust 1.97/1.99.1):

- `WasmProcess` (the Java class the Android module uses, compiled unchanged with
  `modules/oxide-toolchain/jvm-tests/run.sh`) running rustc-built programs on Chicory 1.7.5:
  the Book's guessing game with vendored `rand` 0.10 (random numbers via WASI `random_get`,
  stdin line by line), prompts without newline flushed when blocking on stdin, args, relative
  file reads/writes in the working directory, no access outside the preopened directories,
  `process::exit(3)` → 3, panic → 101 with rustc's real message, ⌃C on a blocked read and on
  an infinite loop → 130, wasm32-wasip1-threads threads/Mutex/mpsc, tokio `async1` solution.
- `PayloadInstaller`: download of the real 1.99.1 rust-std, pause after 5 MB, resume with
  `Range`, sha256 check, `.tar.xz` unpack.
- The TS command layer (`cargo.ts`, `testHarness.ts`, `proc.ts`, `diagnostics.ts`) end to end
  with a desktop backend (real cargo/rustc for x86_64 compiling to wasm32-wasip1-threads + the
  JVM runner): `cargo run` with stdin, `cargo test` report with a failing test, test name
  filters, compile errors with rendered diagnostics, `cargo clippy -- -D warnings` through the
  `liboxide-rustc` wrapper, `cargo fmt [--check]`, `rustc main.rs` + `./main`,
  `./target/debug/x`.
- `liboxide-rustc` (as RUSTC and as clippy workspace wrapper) and `liboxide-exec` (cargo
  running a build script through the loader; `/lib64/ld-linux-x86-64.so.2` standing in for
  `linker64`) built for x86_64 with gcc.
- `make-data-payload.sh` without the NDK: the staged sysroot works with rustc 1.99.1
  `--sysroot` + `librust-lld.so` (renamed) for wasm32-wasip1-threads.
- The config plugin's manifest and gradle-property changes (`npx expo config --type
  introspect`), and Expo autolinking of `modules/oxide-toolchain`.

Not verified (no Android SDK/NDK or device on that machine):

- Any of the Kotlin (`OxideToolchainModule.kt`, `HostProcess.kt`, `PayloadSetup.kt`,
  `ToolchainLayout.kt`) has not been compiled. It was written against expo-modules-core 58's
  sources in node_modules.
- Chicory on ART (Chicory tests on Android API 28+; its interpreter is much slower than on
  HotSpot, so expect seconds for a test run).
- `build-android-host.sh` (an x.py cross build for an Android host), `fetch-termux.sh`
  (packages.termux.dev was unreachable), `build-native-helpers.sh`, `liboxide-cc` on
  Android (written from what `clang -###` does for aarch64-linux-android29), `linker64` exec of
  build scripts, proc-macro `dlopen` from app data, and the size numbers above.
- The withDangerousMod jniLibs copy and the `abiFilters` edit run only during `expo prebuild`.

## Developer steps (machine with Android SDK + NDK)

```sh
npm install
# 1. host binaries -> toolchain/dist/jniLibs/arm64-v8a
export ANDROID_NDK_HOME=… WASI_SDK_PATH=…
toolchain/build-android-host.sh            # or: toolchain/fetch-termux.sh
# 2. data payload -> toolchain/dist/payload, then upload it and set
#    app.json expo.extra.toolchainPayloadUrl to …/manifest.json
toolchain/make-data-payload.sh --std-dir toolchain/dist/rust-dist --ndk "$ANDROID_NDK_HOME"
# 3. native project + dev build on an arm64 device (Android 10+)
npx expo prebuild --platform android --clean
npx expo run:android --device
# Desktop check of the WebAssembly runner:
modules/oxide-toolchain/jvm-tests/run.sh build
modules/oxide-toolchain/jvm-tests/run.sh run some_program.wasm
```

Without step 1 the app still builds and runs; `info()` then reports that this build has no
toolchain binaries and every compile command prints that reason.

## Not done / next steps

- Prebuild build-script outputs for the vendored crates so `liboxide-exec` is not needed.
- `panic=unwind` std built with wasm exception handling (Chicory supports the proposal), so
  `join()` on a panicked thread returns `Err` and libtest can run tests in one instance.
- cargo's `warning: \`x\` (bin "x") generated N warnings` summary line is not printed in JSON
  mode; the per-warning diagnostics are.
