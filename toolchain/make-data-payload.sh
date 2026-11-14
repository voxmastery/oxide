#!/usr/bin/env bash
# Builds the data payload that the app downloads on first run ("Setting up Rust"):
#
#   sysroot-<ver>-<target>.tar.xz  -> files/toolchain/rust     std for the wasm target + for
#                                                              aarch64-linux-android (build
#                                                              scripts and proc-macros)
#   vendor-<ver>.tar.xz            -> files/toolchain/vendor   `cargo vendor` of vendor-manifest/
#   android-link-<api>.tar.xz      -> files/toolchain/android-link  NDK crt objects + libc stubs
#   manifest.json                                              what PayloadSetup.kt reads
#
# Nothing in it is executable: the binaries ship in the APK (jniLibs). Host the directory
# anywhere (GitHub Releases, a bucket, a CDN) and put manifest.json's URL in app.json
# expo.extra.toolchainPayloadUrl.
#
# Usage:
#   toolchain/make-data-payload.sh [--std-dir DIR] [--ndk DIR | --link-kit DIR] [--out DIR]
#
#   --std-dir DIR   directory holding rust-std-<ver>-<target>.tar.{xz,gz} for both targets.
#                   Use the x.py output (build/dist) of build-android-host.sh: std must come
#                   from the same build as the rustc in jniLibs (see README, "std must match").
#                   Default: download the official ones from static.rust-lang.org, which is
#                   right only when the APK's rustc is the official release build.
#   --ndk DIR       Android NDK, for the link kit (default: $ANDROID_NDK_HOME).
#   --link-kit DIR  use a ready link kit directory instead (e.g. from fetch-termux.sh).
#   --out DIR       default: toolchain/dist/payload
set -euo pipefail
. "$(dirname "$0")/config.sh"

STD_DIR=""
NDK="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
LINK_KIT=""
OUT="$DIST/payload"
while [ $# -gt 0 ]; do
  case "$1" in
    --std-dir) STD_DIR="$2"; shift 2 ;;
    --ndk) NDK="$2"; shift 2 ;;
    --link-kit) LINK_KIT="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

mkdir -p "$OUT" "$WORK"
STAGE="$WORK/payload-stage"
rm -rf "$STAGE"; mkdir -p "$STAGE"

# ---------------------------------------------------------------------------
# 1. sysroot
# ---------------------------------------------------------------------------
fetch_std() {
  local target="$1" f
  for ext in tar.xz tar.gz; do
    f="$STD_DIR/rust-std-$RUST_VERSION-$target.$ext"
    if [ -n "$STD_DIR" ] && [ -f "$f" ]; then echo "$f"; return; fi
  done
  [ -z "$STD_DIR" ] || { echo "missing rust-std-$RUST_VERSION-$target in $STD_DIR" >&2; exit 1; }
  f="$WORK/rust-std-$RUST_VERSION-$target.tar.xz"
  if [ ! -f "$f" ]; then
    echo "downloading official rust-std for $target" >&2
    curl -fL --retry 3 -o "$f.part" "https://static.rust-lang.org/dist/rust-std-$RUST_VERSION-$target.tar.xz"
    curl -fsSL "https://static.rust-lang.org/dist/rust-std-$RUST_VERSION-$target.tar.xz.sha256" | awk '{print $1}' > "$f.sha256"
    echo "$(cat "$f.sha256")  $f.part" | sha256sum -c - >&2
    mv "$f.part" "$f"
  fi
  echo "$f"
}

mkdir -p "$STAGE/rust/lib/rustlib"
for target in "$WASM_TARGET" "$HOST_TARGET"; do
  tarball="$(fetch_std "$target")"
  tmp="$WORK/std-$target"; rm -rf "$tmp"; mkdir -p "$tmp"
  tar -xf "$tarball" -C "$tmp"
  src="$(find "$tmp" -type d -path "*/lib/rustlib/$target" | head -1)"
  [ -n "$src" ] || { echo "no lib/rustlib/$target in $tarball" >&2; exit 1; }
  cp -a "$src" "$STAGE/rust/lib/rustlib/"
  rm -rf "$tmp"
done
# The host's codegen-backends/bin dirs are not needed (the compiler itself is in jniLibs).
rm -rf "$STAGE/rust/lib/rustlib/$HOST_TARGET/bin"
echo "$RUST_VERSION" > "$STAGE/rust/lib/rustlib/oxide-version"

# ---------------------------------------------------------------------------
# 2. vendored crates
# ---------------------------------------------------------------------------
(
  cd "$TOOLCHAIN_DIR/vendor-manifest"
  rm -rf "$STAGE/vendor"
  cargo vendor --quiet --versioned-dirs --locked "$STAGE/vendor" > /dev/null 2>&1 ||
    cargo vendor --quiet --versioned-dirs "$STAGE/vendor" > /dev/null
)
# Kept exactly as cargo produced it: cargo verifies every file against .cargo-checksum.json.

# ---------------------------------------------------------------------------
# 3. link kit for host artifacts (build scripts, proc-macros), used by liboxide-cc.so
# ---------------------------------------------------------------------------
mkdir -p "$STAGE/android-link/lib"
if [ -n "$LINK_KIT" ]; then
  cp -a "$LINK_KIT"/. "$STAGE/android-link/"
elif [ -n "$NDK" ] && [ -d "$NDK" ]; then
  prebuilt="$(ls -d "$NDK"/toolchains/llvm/prebuilt/* | head -1)"
  sysroot_lib="$prebuilt/sysroot/usr/lib/$HOST_TARGET"
  for f in crtbegin_dynamic.o crtbegin_so.o crtbegin_static.o crtend_android.o crtend_so.o \
           libc.so libm.so libdl.so liblog.so; do
    cp "$sysroot_lib/$ANDROID_API/$f" "$STAGE/android-link/lib/"
  done
  builtins="$(find "$prebuilt/lib/clang" -name "libclang_rt.builtins-aarch64-android.a" | head -1)"
  unwind="$(find "$prebuilt/lib/clang" -path "*aarch64*" -name "libunwind.a" | head -1)"
  [ -n "$unwind" ] || unwind="$sysroot_lib/libunwind.a"
  cp "$builtins" "$unwind" "$STAGE/android-link/lib/"
  echo "NDK $(sed -n 's/^Pkg.Revision *= *//p' "$NDK/source.properties" 2>/dev/null), API $ANDROID_API" > "$STAGE/android-link/SOURCE"
else
  echo "warning: no --ndk/--link-kit: building without the link kit. Crates with build scripts" >&2
  echo "         or proc-macros (rand's getrandom, tokio) will not build on the phone." >&2
  echo "missing" > "$STAGE/android-link/MISSING"
fi

# ---------------------------------------------------------------------------
# 4. archives + manifest
# ---------------------------------------------------------------------------
pack() { # name dir -> archive path
  local name="$1" dir="$2" out="$OUT/$1.tar.xz"
  tar -C "$STAGE" --owner=0 --group=0 --numeric-owner --sort=name --mtime='2026-01-01' -cf - "$dir" | xz -T0 -6 > "$out"
  echo "$out"
}
entries=()
add() { # pkg component archive dest
  local file="$4" sha size installed
  sha="$(sha256sum "$file" | awk '{print $1}')"
  size="$(stat -c %s "$file")"
  installed="$(du -sb "$STAGE/$5" | awk '{print $1}')"
  entries+=("$(printf '    { "pkg": "%s", "component": "%s", "url": "%s", "sha256": "%s", "size": %s, "installedSize": %s, "dest": "%s", "strip": 1 }' \
    "$1" "$2" "$(basename "$file")" "$sha" "$size" "$installed" "$3")")
}
a="$(pack "sysroot-$RUST_VERSION-$WASM_TARGET" rust)";  add rust rust-std "toolchain/rust" "$a" rust
a="$(pack "vendor-$RUST_VERSION" vendor)";              add rust vendored-crates "toolchain/vendor" "$a" vendor
a="$(pack "android-link-$ANDROID_API" android-link)";   add rust android-link "toolchain/android-link" "$a" android-link

{
  echo "{"
  echo "  \"schema\": 1,"
  echo "  \"rustVersion\": \"$RUST_VERSION\","
  echo "  \"rustcVersionLine\": \"$RUSTC_VERSION_LINE\","
  echo "  \"target\": \"$WASM_TARGET\","
  echo "  \"hostTarget\": \"$HOST_TARGET\","
  echo "  \"archives\": ["
  for i in "${!entries[@]}"; do
    if [ "$i" -lt $(( ${#entries[@]} - 1 )) ]; then echo "${entries[$i]},"; else echo "${entries[$i]}"; fi
  done
  echo "  ]"
  echo "}"
} > "$OUT/manifest.json"

echo "payload in $OUT:"
ls -la "$OUT"
du -sh "$STAGE"/* | sed 's/^/  installed: /'
