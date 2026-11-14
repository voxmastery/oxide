# Helpers shared by build-android-host.sh and fetch-termux.sh. Sourced, not executed.
#
# Android installs only files named lib*.so from the APK's lib/<abi>/ into nativeLibraryDir,
# and only those can be executed. So every program becomes lib<name>.so and every shared
# library it needs must also be named lib*.so (no version suffixes like libz.so.1).

# Libraries every Android 10+ device provides to apps (NDK "stable APIs").
ANDROID_SYSTEM_LIBS="libc.so libm.so libdl.so liblog.so libz.so libandroid.so libEGL.so libGLESv2.so libjnigraphics.so libmediandk.so libOpenSLES.so libvulkan.so libnativewindow.so libsync.so libneuralnetworks.so libamidi.so libbinder_ndk.so"

is_system_lib() {
  case " $ANDROID_SYSTEM_LIBS " in *" $1 "*) return 0 ;; esac
  return 1
}

needed_of() { # ELF -> NEEDED entries, one per line
  readelf -d "$1" 2>/dev/null | sed -n 's/.*(NEEDED).*\[\(.*\)\].*/\1/p'
}

is_elf() {
  [ "$(head -c 4 "$1" 2>/dev/null | od -An -tx1 | tr -d ' \n')" = "7f454c46" ]
}

# Reports NEEDED entries that neither jniLibs nor the system provide. Exit 1 if any.
check_jnilibs() { # dir
  local dir="$1" bad=0 f n
  for f in "$dir"/*.so; do
    is_elf "$f" || continue
    for n in $(needed_of "$f"); do
      if [ ! -f "$dir/$n" ] && ! is_system_lib "$n"; then
        echo "  $(basename "$f") needs $n, which is neither in jniLibs nor an Android system library" >&2
        bad=1
      fi
    done
    if readelf -d "$f" 2>/dev/null | grep -q '(RPATH)\|(RUNPATH)'; then
      echo "  note: $(basename "$f") has an RPATH/RUNPATH; LD_LIBRARY_PATH (nativeLibraryDir) is used first" >&2
    fi
    case "$(readelf -h "$f" 2>/dev/null | sed -n 's/.*Machine: *//p')" in
      *AArch64*) ;;
      *) echo "  $(basename "$f") is not an AArch64 ELF" >&2; bad=1 ;;
    esac
  done
  return $bad
}

# The interpreter of an executable must be Android's linker, not Termux's or glibc's.
check_interpreter() { # elf
  local interp
  interp="$(readelf -l "$1" 2>/dev/null | sed -n 's/.*Requesting program interpreter: \(.*\)\]/\1/p')"
  if [ -n "$interp" ] && [ "$interp" != "/system/bin/linker64" ]; then
    echo "  $(basename "$1"): interpreter is $interp, expected /system/bin/linker64" >&2
    return 1
  fi
}
