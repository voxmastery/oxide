#!/usr/bin/env bash
# Compiles Oxide's three small native helpers with the Android NDK into dist/jniLibs:
#
#   liboxide-rustc.so  rustc/clippy-driver with --sysroot (native/oxide-rustc.c)
#   liboxide-cc.so     gcc-style driver over ld.lld for host artifacts (native/oxide-cc.c)
#   liboxide-exec.so   LD_PRELOAD shim that runs build scripts via linker64 (native/oxide-exec.c)
#
# Usage: ANDROID_NDK_HOME=/path/to/ndk toolchain/build-native-helpers.sh
set -euo pipefail
. "$(dirname "$0")/config.sh"
NDK="${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME to the Android NDK (r27 or later)}"
BIN="$(ls -d "$NDK"/toolchains/llvm/prebuilt/*/bin | head -1)"
CC="$BIN/aarch64-linux-android$ANDROID_API-clang"
OUT="$DIST/jniLibs/$ABI"
mkdir -p "$OUT"
src="$TOOLCHAIN_DIR/native"
"$CC" -O2 -Wall -fPIE -pie -o "$OUT/liboxide-rustc.so" "$src/oxide-rustc.c"
"$CC" -O2 -Wall -fPIE -pie -o "$OUT/liboxide-cc.so" "$src/oxide-cc.c"
"$CC" -O2 -Wall -fPIC -shared -o "$OUT/liboxide-exec.so" "$src/oxide-exec.c" -ldl
"$BIN/llvm-strip" "$OUT"/liboxide-*.so
ls -la "$OUT"/liboxide-*.so
