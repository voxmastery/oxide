// liboxide-rustc.so: the `rustc` that cargo runs on the phone.
//
// The real compiler lives in the APK's nativeLibraryDir as librustc.so, next to
// librustc_driver-*.so. rustc derives its default sysroot from where librustc_driver is, which
// on Android is <app>/lib/arm64, not a Rust sysroot. The sysroot (std for wasm32-wasip1-threads
// and aarch64-linux-android) is unpacked into the app's files dir instead, so every compiler
// invocation needs `--sysroot`. Cargo only adds RUSTFLAGS to target crates, not to build
// scripts or proc-macros, so the flag is added here, for all of them.
//
// Modes:
//   RUSTC=liboxide-rustc.so                -> exec librustc.so --sysroot $OXIDE_SYSROOT ARGS
//   RUSTC_WORKSPACE_WRAPPER=liboxide-rustc.so with OXIDE_CLIPPY=1
//     cargo runs: wrapper <path-to-rustc> ARGS
//                                         -> exec libclippy-driver.so rustc --sysroot ... ARGS
//     (clippy-driver drops a first argument named "rustc", as cargo-clippy arranges)
//
// Environment: OXIDE_NLD (nativeLibraryDir), OXIDE_SYSROOT. OXIDE_RUSTC_REAL and
// OXIDE_CLIPPY_REAL override the binaries (desktop tests).
//
// Build (see toolchain/build-native-helpers.sh):
//   aarch64-linux-android29-clang -O2 -fPIE -pie -o liboxide-rustc.so oxide-rustc.c

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static const char *base_name(const char *p) {
    const char *s = strrchr(p, '/');
    return s ? s + 1 : p;
}

static int has_sysroot(int argc, char **argv, int from) {
    for (int i = from; i < argc; i++) {
        if (strcmp(argv[i], "--sysroot") == 0 || strncmp(argv[i], "--sysroot=", 10) == 0) return 1;
    }
    return 0;
}

static char *join(const char *dir, const char *file) {
    size_t n = strlen(dir) + strlen(file) + 2;
    char *s = malloc(n);
    if (!s) return NULL;
    snprintf(s, n, "%s/%s", dir, file);
    return s;
}

int main(int argc, char **argv) {
    const char *nld = getenv("OXIDE_NLD");
    const char *sysroot = getenv("OXIDE_SYSROOT");
    if (!sysroot || !*sysroot) {
        fprintf(stderr, "error: OXIDE_SYSROOT is not set; Oxide starts rustc with it\n");
        return 1;
    }

    // Used as RUSTC_WORKSPACE_WRAPPER: argv[1] is the rustc cargo would have run.
    int as_wrapper = argc > 1 && (strcmp(base_name(argv[1]), base_name(argv[0])) == 0 ||
                                  strcmp(base_name(argv[1]), "rustc") == 0 ||
                                  strcmp(base_name(argv[1]), "liboxide-rustc.so") == 0);
    const char *clippy = getenv("OXIDE_CLIPPY");
    int use_clippy = as_wrapper && clippy && strcmp(clippy, "1") == 0;
    int first = as_wrapper ? 2 : 1;

    const char *real;
    if (use_clippy) {
        real = getenv("OXIDE_CLIPPY_REAL");
        if (!real) real = nld ? join(nld, "libclippy-driver.so") : NULL;
    } else {
        real = getenv("OXIDE_RUSTC_REAL");
        if (!real) real = nld ? join(nld, "librustc.so") : NULL;
    }
    if (!real) {
        fprintf(stderr, "error: OXIDE_NLD is not set; cannot find the compiler\n");
        return 1;
    }

    // rustc --version / -vV and friends do not need a sysroot, but it is harmless.
    int add_sysroot = !has_sysroot(argc, argv, first);
    char **args = calloc((size_t)argc + 4, sizeof(char *));
    if (!args) return 1;
    int k = 0;
    args[k++] = use_clippy ? "clippy-driver" : "rustc";
    if (use_clippy) args[k++] = "rustc";
    if (add_sysroot) {
        args[k++] = "--sysroot";
        args[k++] = (char *)sysroot;
    }
    for (int i = first; i < argc; i++) args[k++] = argv[i];
    args[k] = NULL;

    execv(real, args);
    fprintf(stderr, "error: could not execute %s: %s\n", real, strerror(errno));
    return 127;
}
