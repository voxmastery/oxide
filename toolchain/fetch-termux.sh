#!/usr/bin/env bash
# Alternative to build-android-host.sh: repackage Termux's prebuilt Rust for Android.
#
# Termux (termux/termux-packages, packages/rust/build.sh) builds rustc, cargo, clippy and
# rustfmt for aarch64-linux-android and ships std for wasm32-wasip1 as the platform-independent
# package rust-std-wasm32-wasip1. It does NOT ship std for wasm32-wasip1-threads, so this path
# gives WASM_TARGET=wasm32-wasip1: no std::thread for user programs (Rustlings 20_threads and
# 24_async fail at run time with "operation not supported").
#
# Termux binaries are built for Termux's prefix /data/data/com.termux/files/usr:
#   - DT_RUNPATH points there            -> removed (LD_LIBRARY_PATH = nativeLibraryDir is used)
#   - shared libraries use versioned names (libz.so.1, libLLVM.so.21.1) that Android will not
#     install from an APK                -> renamed to lib*.so, SONAME/NEEDED patched
#   - cargo reads $PREFIX/etc/tls/…      -> irrelevant offline
#   - lld is a separate package; rust-lld is a symlink to it -> packaged as librust-lld.so
# All patching uses patchelf (>= 0.18). UNTESTED: packages.termux.dev was not reachable from
# the machine this was written on; check the dependency report at the end.
#
# Usage:
#   toolchain/fetch-termux.sh [--mirror URL]
# Output: dist/jniLibs/arm64-v8a/*, dist/rust-dist/rust-std-<ver>-{wasm32-wasip1,aarch64-linux-android}.tar.xz,
#         dist/termux-link-kit/ (for make-data-payload.sh --link-kit)
set -euo pipefail
WASM_TARGET=wasm32-wasip1
. "$(dirname "$0")/config.sh"
. "$(dirname "$0")/lib-jnilibs.sh"

MIRROR="https://packages-cf.termux.dev/apt/termux-main"
while [ $# -gt 0 ]; do
  case "$1" in
    --mirror) MIRROR="$2"; shift 2 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
command -v patchelf >/dev/null || { echo "patchelf is required" >&2; exit 1; }

T="$WORK/termux"; mkdir -p "$T/debs" "$T/root"
JNI="$DIST/jniLibs/$ABI"; mkdir -p "$JNI" "$DIST/rust-dist"
PREFIX_IN_DEB="data/data/com.termux/files/usr"

for arch in aarch64 all; do
  curl -fsSL "$MIRROR/dists/stable/main/binary-$arch/Packages" -o "$T/Packages-$arch"
done

# Resolve dependencies (Depends:, recursively) and download the .debs.
python3 - "$T" "$MIRROR" rust rust-std-aarch64-linux-android rust-std-wasm32-wasip1 lld ndk-sysroot libcompiler-rt <<'PY'
import os, re, sys, urllib.request, hashlib
t, mirror, *roots = sys.argv[1:]
pkgs = {}
for arch in ("aarch64", "all"):
    for block in open(f"{t}/Packages-{arch}").read().split("\n\n"):
        f = dict(re.findall(r"^([A-Za-z-]+): (.*)$", block, re.M))
        if "Package" in f:
            pkgs.setdefault(f["Package"], f)
want, todo = set(), list(roots)
while todo:
    p = todo.pop()
    if p in want: continue
    if p not in pkgs:
        print(f"warning: package {p} not in index", file=sys.stderr); continue
    want.add(p)
    for dep in re.split(r",\s*", pkgs[p].get("Depends", "")):
        name = dep.split(" ")[0].split("|")[0].strip()
        if name: todo.append(name)
for p in sorted(want):
    f = pkgs[p]
    out = f"{t}/debs/{os.path.basename(f['Filename'])}"
    if not os.path.exists(out):
        print(f"fetching {p} {f['Version']}", file=sys.stderr)
        urllib.request.urlretrieve(f"{mirror}/{f['Filename']}", out + ".part")
        h = hashlib.sha256(open(out + ".part", "rb").read()).hexdigest()
        if h != f["SHA256"]: sys.exit(f"sha256 mismatch for {p}")
        os.rename(out + ".part", out)
    open(f"{t}/wanted.txt", "a").write(f"{p} {f['Version']}\n")
PY

# Unpack every .deb (ar archive with data.tar.xz) into one tree.
for deb in "$T"/debs/*.deb; do
  d="$T/x"; rm -rf "$d"; mkdir -p "$d"
  (cd "$d" && ar x "$deb")
  tar -xf "$d"/data.tar.* -C "$T/root"
done
P="$T/root/$PREFIX_IN_DEB"
grep -q "^rust $RUST_VERSION" "$T/wanted.txt" || echo "warning: Termux rust is $(grep '^rust ' "$T/wanted.txt"), not $RUST_VERSION" >&2

# Programs -> lib<name>.so
cp -L "$P/bin/rustc" "$JNI/librustc.so"
cp -L "$P/bin/rustdoc" "$JNI/librustdoc.so" 2>/dev/null || true
cp -L "$P/bin/cargo" "$JNI/libcargo.so"
cp -L "$P/bin/clippy-driver" "$JNI/libclippy-driver.so"
cp -L "$P/bin/rustfmt" "$JNI/librustfmt.so"
cp -L "$P/bin/lld" "$JNI/librust-lld.so"

# Pull in every shared library they need from the Termux prefix, under a lib*.so name.
python3 - "$JNI" "$P/lib" "$ANDROID_SYSTEM_LIBS" <<'PY'
import os, re, shutil, subprocess, sys
jni, libdir, system = sys.argv[1], sys.argv[2], set(sys.argv[3].split())
def needed(f):
    out = subprocess.run(["patchelf", "--print-needed", f], capture_output=True, text=True).stdout
    return [l.strip() for l in out.splitlines() if l.strip()]
def jni_name(n):
    m = re.match(r"^(lib.+?\.so)(\..*)?$", n)
    base = m.group(1) if m else "lib" + n + ".so"
    return base if not m or not m.group(2) else base[:-3] + "-" + m.group(2)[1:].replace(".", "_") + ".so"
renames, queue = {}, [os.path.join(jni, f) for f in os.listdir(jni) if f.endswith(".so")]
seen = set()
while queue:
    f = queue.pop()
    if f in seen: continue
    seen.add(f)
    for n in needed(f):
        if n in system or n in renames: continue
        src = os.path.join(libdir, n)
        if not os.path.exists(src):
            print(f"  {os.path.basename(f)} needs {n}: not in Termux prefix (system library?)", file=sys.stderr); continue
        new = n if re.fullmatch(r"lib.+\.so", n) else jni_name(n)
        # Never shadow Android's own zlib etc. with Termux copies under the same name.
        if new in system: new = new[:-3] + "-termux.so"
        renames[n] = new
        dst = os.path.join(jni, new)
        shutil.copy(os.path.realpath(src), dst)
        subprocess.run(["patchelf", "--set-soname", new, dst], check=True)
        queue.append(dst)
for f in seen:
    for n in needed(f):
        if n in renames and renames[n] != n:
            subprocess.run(["patchelf", "--replace-needed", n, renames[n], f], check=True)
    subprocess.run(["patchelf", "--remove-rpath", f], check=True)
print(f"  {len(renames)} libraries pulled in from Termux", file=sys.stderr)
PY

"$TOOLCHAIN_DIR/build-native-helpers.sh" || echo "warning: build the oxide helpers with the NDK (build-native-helpers.sh)" >&2

# std for both targets, as rust-std tarballs for make-data-payload.sh --std-dir.
for target in "$WASM_TARGET" "$HOST_TARGET"; do
  d="$T/std/rust-std-$RUST_VERSION-$target/rust-std-$target/lib/rustlib"
  mkdir -p "$d"
  cp -a "$P/lib/rustlib/$target" "$d/"
  tar -C "$T/std" -cJf "$DIST/rust-dist/rust-std-$RUST_VERSION-$target.tar.xz" "rust-std-$RUST_VERSION-$target"
done

# Link kit from ndk-sysroot + libcompiler-rt (same files the NDK has).
K="$DIST/termux-link-kit/lib"; mkdir -p "$K"
for f in crtbegin_dynamic.o crtbegin_so.o crtbegin_static.o crtend_android.o crtend_so.o libc.so libm.so libdl.so liblog.so libunwind.a; do
  cp "$P/lib/$f" "$K/" 2>/dev/null || echo "warning: $f missing from ndk-sysroot" >&2
done
cp "$(find "$P/lib" -name 'libclang_rt.builtins-aarch64-android.a' | head -1)" "$K/" || echo "warning: compiler-rt builtins missing" >&2

echo "checking jniLibs:"
for f in "$JNI"/*.so; do is_elf "$f" && check_interpreter "$f" || true; done
check_jnilibs "$JNI" && echo "  all NEEDED libraries resolve"
du -sh "$JNI"
echo
echo "Next: WASM_TARGET=wasm32-wasip1 toolchain/make-data-payload.sh --std-dir $DIST/rust-dist --link-kit $DIST/termux-link-kit"
