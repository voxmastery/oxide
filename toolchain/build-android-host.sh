#!/usr/bin/env bash
# Preferred way to make the toolchain: build Rust from source for host aarch64-linux-android
# with the Android NDK, then lay the binaries out as jniLibs and std as the data payload.
#
# Needs (on an x86_64 Linux build machine): the Android NDK r27+, wasi-sdk (for std's
# wasm32-wasip1* C parts), python3, cmake, ninja, a C/C++ compiler, ~60 GB of disk and a few
# hours of CPU. UNTESTED end to end: the configuration follows bootstrap.example.toml and what
# Termux does for the same host (see README).
#
# Usage:
#   ANDROID_NDK_HOME=… WASI_SDK_PATH=… toolchain/build-android-host.sh
#
# Output:
#   toolchain/dist/jniLibs/arm64-v8a/lib*.so      -> packaged into the APK by the config plugin
#   toolchain/dist/rust-dist/rust-std-*.tar.xz    -> input of make-data-payload.sh --std-dir
set -euo pipefail
. "$(dirname "$0")/config.sh"
. "$(dirname "$0")/lib-jnilibs.sh"

NDK="${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME to the Android NDK (r27 or later)}"
WASI_SDK="${WASI_SDK_PATH:?set WASI_SDK_PATH to a wasi-sdk install (for wasm32-wasip1 std)}"
NDK_BIN="$(ls -d "$NDK"/toolchains/llvm/prebuilt/*/bin | head -1)"
SRC="$WORK/rustc-$RUST_VERSION-src"
JNI="$DIST/jniLibs/$ABI"

mkdir -p "$WORK" "$DIST/rust-dist" "$JNI"

# 1. Source tarball (verified against the release manifest).
if [ ! -d "$SRC" ]; then
  tarball="$WORK/rustc-$RUST_VERSION-src.tar.xz"
  if [ ! -f "$tarball" ]; then
    curl -fL --retry 3 -o "$tarball.part" "https://static.rust-lang.org/dist/rustc-$RUST_VERSION-src.tar.xz"
    expected="$(curl -fsSL "https://static.rust-lang.org/dist/rustc-$RUST_VERSION-src.tar.xz.sha256" | awk '{print $1}')"
    echo "$expected  $tarball.part" | sha256sum -c -
    mv "$tarball.part" "$tarball"
  fi
  tar -xf "$tarball" -C "$WORK"
fi

# 2. bootstrap.toml
sed -e "s|@RUST_VERSION@|$RUST_VERSION|g" \
    -e "s|@NDK_BIN@|$NDK_BIN|g" \
    -e "s|@ANDROID_API@|$ANDROID_API|g" \
    -e "s|@WASI_SDK@|$WASI_SDK|g" \
    "$TOOLCHAIN_DIR/bootstrap.toml.in" > "$SRC/bootstrap.toml"

# 3. Build. `dist` produces rustc, cargo, clippy, rustfmt for the host and rust-std for every
#    target, all from the same build (so std matches the compiler exactly).
(
  cd "$SRC"
  export CC_wasm32_wasip1="$WASI_SDK/bin/clang" CC_wasm32_wasip1_threads="$WASI_SDK/bin/clang"
  export AR_aarch64_linux_android="$NDK_BIN/llvm-ar"
  python3 x.py dist --stage 2 \
    rustc rust-std cargo clippy rustfmt
)
cp "$SRC"/build/dist/rust-std-"$RUST_VERSION"-*.tar.xz "$DIST/rust-dist/"

# 4. jniLibs: every program becomes lib<name>.so next to the shared libraries it needs.
UNPACK="$WORK/host-unpack"; rm -rf "$UNPACK"; mkdir -p "$UNPACK"
for c in rustc cargo clippy rustfmt; do
  f="$(ls "$SRC"/build/dist/$c-*"$RUST_VERSION"-"$HOST_TARGET".tar.xz 2>/dev/null | head -1)"
  [ -n "$f" ] || { echo "missing dist tarball for $c" >&2; exit 1; }
  tar -xf "$f" -C "$UNPACK"
done
find_one() { find "$UNPACK" -type f -path "$1" | head -1; }
install_exe() { # pattern name
  local f; f="$(find_one "$1")"
  [ -n "$f" ] || { echo "not found: $1" >&2; exit 1; }
  cp "$f" "$JNI/lib$2.so"
}
install_exe "*/bin/rustc" rustc
install_exe "*/bin/rustdoc" rustdoc
install_exe "*/bin/cargo" cargo
install_exe "*/bin/clippy-driver" clippy-driver
install_exe "*/bin/rustfmt" rustfmt
install_exe "*/lib/rustlib/$HOST_TARGET/bin/rust-lld" rust-lld
# librustc_driver-<hash>.so, libstd-<hash>.so … (already lib*.so)
find "$UNPACK" -path "*/lib/*.so" -not -path "*/rustlib/*" -exec cp {} "$JNI/" \;
# libc++_shared.so only if something still needs it (static-libstdcpp should avoid it).
if grep -q "libc++_shared.so" <(for f in "$JNI"/*.so; do needed_of "$f"; done); then
  cp "$(find "$NDK" -path "*aarch64-linux-android/libc++_shared.so" | head -1)" "$JNI/"
fi
"$NDK_BIN/llvm-strip" --strip-unneeded "$JNI"/*.so || true

# 5. Oxide's helpers.
"$TOOLCHAIN_DIR/build-native-helpers.sh"

echo "checking jniLibs:"
for f in "$JNI"/*.so; do is_elf "$f" && check_interpreter "$f" || true; done
check_jnilibs "$JNI" && echo "  all NEEDED libraries resolve"
du -sh "$JNI"
echo
echo "Next: toolchain/make-data-payload.sh --std-dir $DIST/rust-dist --ndk $NDK"
