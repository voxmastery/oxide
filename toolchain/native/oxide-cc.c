// liboxide-cc.so: a minimal `cc` for linking host (aarch64-linux-android) artifacts on the phone.
//
// Cargo compiles build scripts (build.rs) and proc-macro crates for the host. rustc links them
// by running the target's linker, which for Android is a gcc-style driver (clang). There is no
// clang on the phone, so this program translates the gcc-style command line rustc produces into
// an ld.lld command line, adds what clang's driver would add (Bionic crt objects, libc stubs,
// compiler-rt builtins, libunwind, the dynamic linker) and execs librust-lld.so -flavor gnu.
//
// The link kit (crt*.o, libc.so/libm.so/libdl.so/liblog.so stubs for API 29, libunwind.a,
// libclang_rt.builtins-aarch64-android.a) comes from the NDK and is unpacked with the data
// payload into $OXIDE_LINKKIT. See toolchain/make-data-payload.sh.
//
// UNTESTED ON A DEVICE. The translation follows what `clang -###` prints for
// --target=aarch64-linux-android29 in NDK r27; verify with `clang -###` when the NDK changes.
//
// Environment: OXIDE_NLD (nativeLibraryDir, for librust-lld.so), OXIDE_LINKKIT.
// OXIDE_LLD_REAL overrides the linker binary; OXIDE_CC_VERBOSE=1 prints the final command.

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

typedef struct {
    char **v;
    int n, cap;
} vec;

static void push(vec *a, const char *s) {
    if (a->n + 1 >= a->cap) {
        a->cap = a->cap ? a->cap * 2 : 64;
        a->v = realloc(a->v, (size_t)a->cap * sizeof(char *));
        if (!a->v) exit(1);
    }
    a->v[a->n++] = strdup(s);
    a->v[a->n] = NULL;
}

static char *cat3(const char *a, const char *b, const char *c) {
    size_t n = strlen(a) + strlen(b) + strlen(c) + 1;
    char *s = malloc(n);
    snprintf(s, n, "%s%s%s", a, b, c);
    return s;
}

// gcc-style response file: whitespace separates arguments; quotes and backslashes escape.
static void read_response_file(const char *path, vec *out) {
    FILE *f = fopen(path, "rb");
    if (!f) {
        push(out, cat3("@", path, ""));
        return;
    }
    char *arg = malloc(4096);
    size_t cap = 4096, len = 0;
    int c, in_arg = 0, quote = 0;
    while ((c = fgetc(f)) != EOF) {
        if (quote) {
            if (c == quote) {
                quote = 0;
                continue;
            }
            if (c == '\\' && quote == '"') {
                int d = fgetc(f);
                if (d == EOF) break;
                c = d;
            }
        } else if (c == '\'' || c == '"') {
            quote = c;
            in_arg = 1;
            continue;
        } else if (c == '\\') {
            int d = fgetc(f);
            if (d == EOF) break;
            c = d;
        } else if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
            if (in_arg) {
                arg[len] = 0;
                push(out, arg);
                len = 0;
                in_arg = 0;
            }
            continue;
        }
        in_arg = 1;
        if (len + 2 >= cap) {
            cap *= 2;
            arg = realloc(arg, cap);
        }
        arg[len++] = (char)c;
    }
    if (in_arg) {
        arg[len] = 0;
        push(out, arg);
    }
    free(arg);
    fclose(f);
}

// Splits "-Wl,a,b,c" into linker arguments.
static void push_wl(vec *ld, const char *s) {
    char *copy = strdup(s);
    for (char *tok = strtok(copy, ","); tok; tok = strtok(NULL, ",")) push(ld, tok);
    free(copy);
}

int main(int argc, char **argv) {
    const char *nld = getenv("OXIDE_NLD");
    const char *kit = getenv("OXIDE_LINKKIT");
    if (!kit) {
        fprintf(stderr, "oxide-cc: OXIDE_LINKKIT is not set (Android link kit missing)\n");
        return 1;
    }
    const char *lld = getenv("OXIDE_LLD_REAL");
    if (!lld) lld = nld ? cat3(nld, "/", "librust-lld.so") : "rust-lld";

    vec in = {0};
    for (int i = 1; i < argc; i++) {
        if (argv[i][0] == '@') read_response_file(argv[i] + 1, &in);
        else push(&in, argv[i]);
    }

    int shared = 0, is_static = 0, nostartfiles = 0, nostdlib = 0;
    vec body = {0};
    for (int i = 0; i < in.n; i++) {
        const char *a = in.v[i];
        if (!strcmp(a, "-shared")) shared = 1;
        else if (!strcmp(a, "-static") || !strcmp(a, "-static-pie")) is_static = 1;
        else if (!strcmp(a, "-nostartfiles")) nostartfiles = 1;
        else if (!strcmp(a, "-nostdlib")) nostdlib = nostartfiles = 1;
        else if (!strcmp(a, "-nodefaultlibs")) {
            // rustc passes the libs it needs (-lc -lm -ldl -llog -lunwind) itself.
        } else if (!strcmp(a, "-pie") || !strcmp(a, "-no-pie") || !strncmp(a, "-fuse-ld", 8) ||
                   !strncmp(a, "-m", 2) || !strncmp(a, "-f", 2) || !strncmp(a, "-O", 2) ||
                   !strncmp(a, "-g", 2) || !strncmp(a, "--target", 8) || !strcmp(a, "-pthread")) {
            // driver-only flags
        } else if (!strncmp(a, "-Wl,", 4)) push_wl(&body, a + 4);
        else if (!strcmp(a, "-Xlinker") && i + 1 < in.n) push(&body, in.v[++i]);
        else if (!strcmp(a, "-o") && i + 1 < in.n) {
            push(&body, "-o");
            push(&body, in.v[++i]);
        } else if (!strcmp(a, "-L") && i + 1 < in.n) {
            push(&body, "-L");
            push(&body, in.v[++i]);
        } else if (!strcmp(a, "-l") && i + 1 < in.n) {
            push(&body, cat3("-l", in.v[++i], ""));
        } else if (!strcmp(a, "-s")) push(&body, "--strip-all");
        else if (!strcmp(a, "-rdynamic")) push(&body, "--export-dynamic");
        else push(&body, a); // objects, archives, -lfoo, -Lpath
    }

    char *lib = cat3(kit, "/lib", "");
    vec ld = {0};
    push(&ld, "ld.lld");
    push(&ld, "-flavor");
    push(&ld, "gnu");
    push(&ld, "-EL");
    push(&ld, "-m");
    push(&ld, "aarch64linux");
    push(&ld, "--fix-cortex-a53-843419");
    push(&ld, "--hash-style=gnu");
    push(&ld, "--eh-frame-hdr");
    push(&ld, "-z");
    push(&ld, "noexecstack");
    push(&ld, "-z");
    push(&ld, "relro");
    push(&ld, "-z");
    push(&ld, "now");
    push(&ld, "-z");
    push(&ld, "max-page-size=16384");
    if (shared) {
        push(&ld, "-shared");
    } else if (is_static) {
        push(&ld, "-static");
    } else {
        push(&ld, "-pie");
        push(&ld, "-dynamic-linker");
        push(&ld, "/system/bin/linker64");
    }
    if (!nostartfiles) {
        push(&ld, cat3(lib, shared ? "/crtbegin_so.o" : is_static ? "/crtbegin_static.o" : "/crtbegin_dynamic.o", ""));
    }
    push(&ld, cat3("-L", lib, ""));
    for (int i = 0; i < body.n; i++) push(&ld, body.v[i]);
    if (!nostdlib) {
        push(&ld, cat3(lib, "/libclang_rt.builtins-aarch64-android.a", ""));
        push(&ld, "-l:libunwind.a");
        push(&ld, "-ldl");
        push(&ld, "-lc");
        push(&ld, cat3(lib, "/libclang_rt.builtins-aarch64-android.a", ""));
        push(&ld, "-l:libunwind.a");
        push(&ld, "-ldl");
    }
    if (!nostartfiles) push(&ld, cat3(lib, shared ? "/crtend_so.o" : "/crtend_android.o", ""));

    const char *verbose = getenv("OXIDE_CC_VERBOSE");
    if (verbose && !strcmp(verbose, "1")) {
        for (int i = 0; i < ld.n; i++) fprintf(stderr, "%s%s", i ? " " : "", ld.v[i]);
        fputc('\n', stderr);
    }
    execv(lld, ld.v);
    fprintf(stderr, "oxide-cc: could not execute %s: %s\n", lld, strerror(errno));
    return 127;
}
