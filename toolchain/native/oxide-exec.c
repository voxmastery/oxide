// liboxide-exec.so: an LD_PRELOAD library loaded into cargo on the phone.
//
// Cargo runs build scripts (target/debug/build/<crate>-<hash>/build-script-build) that it has
// just compiled into the app's files dir. Android 10+ forbids execve() of app data files for
// apps targeting API 29+ (SELinux: no execute_no_trans on app_data_file), but still allows
// mapping them executable. So an exec of such a file is rewritten to
//
//     /system/bin/linker64 <file> <args...>
//
// which asks the system dynamic linker to load and run it. This is the technique termux-exec
// uses for the same reason. Files in the APK's nativeLibraryDir and system paths are exec'd
// unchanged.
//
// Only cargo needs this (rustc, the linker and the tools all live in nativeLibraryDir), and
// only crates with build scripts need it (getrandom, libc, proc-macro2, quote… in the vendored
// set). The Book's and Rustlings' own code never needs it: user programs run as WebAssembly.
//
// CAVEATS: UNTESTED ON A DEVICE. Relies on platform behaviour that Google may restrict in a
// future Android release. /proc/self/exe in the child is linker64, not the build script
// (none of the vendored build scripts care).
//
// Environment: OXIDE_NLD (nativeLibraryDir), OXIDE_EXEC_DEBUG=1 logs rewrites to stderr,
// OXIDE_EXEC_ONLY=<dir> limits rewriting to programs under <dir> (Oxide passes its files dir),
// OXIDE_LINKER overrides the loader (desktop tests use /lib64/ld-linux-x86-64.so.2).

#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <spawn.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define LINKER "/system/bin/linker64"

typedef int (*execve_fn)(const char *, char *const[], char *const[]);

static execve_fn real_execve(void) {
    static execve_fn fn;
    if (!fn) fn = (execve_fn)dlsym(RTLD_NEXT, "execve");
    return fn;
}

static int starts_with(const char *s, const char *prefix) {
    return strncmp(s, prefix, strlen(prefix)) == 0;
}

static int is_elf(const char *path) {
    int fd = open(path, O_RDONLY | O_CLOEXEC);
    if (fd < 0) return 0;
    unsigned char m[4];
    ssize_t n = read(fd, m, 4);
    close(fd);
    return n == 4 && m[0] == 0x7f && m[1] == 'E' && m[2] == 'L' && m[3] == 'F';
}

static int needs_linker(const char *path) {
    // Oxide sets this to the app's files dir: only programs built there are rewritten.
    const char *only = getenv("OXIDE_EXEC_ONLY");
    if (only && *only) return starts_with(path, only) && is_elf(path);
    const char *nld = getenv("OXIDE_NLD");
    if (nld && starts_with(path, nld)) return 0;
    if (starts_with(path, "/system/") || starts_with(path, "/apex/") || starts_with(path, "/vendor/") ||
        starts_with(path, "/product/") || starts_with(path, "/odm/"))
        return 0;
    return is_elf(path);
}

// Builds "linker <abs-path> argv[1..]" for a program that needs the system loader.
// Returns NULL when no rewrite is needed. *linker_out receives the loader path.
static char **rewrite(const char *path, char *const argv[], const char **linker_out, char **abs_out) {
    if (!path || !needs_linker(path)) return NULL;
    int argc = 0;
    while (argv && argv[argc]) argc++;
    char **args = calloc((size_t)argc + 3, sizeof(char *));
    if (!args) return NULL;
    const char *linker = getenv("OXIDE_LINKER"); // desktop tests: /lib64/ld-linux-x86-64.so.2
    if (!linker || !*linker) linker = LINKER;
    char *abs = realpath(path, NULL);
    // The loader uses argv[1] as the program path and passes argv[1..] to it.
    args[0] = (char *)linker;
    args[1] = abs ? abs : (char *)path;
    for (int i = 1; i < argc; i++) args[i + 1] = argv[i];
    args[argc + 1] = NULL;
    const char *dbg = getenv("OXIDE_EXEC_DEBUG");
    if (dbg && !strcmp(dbg, "1")) fprintf(stderr, "oxide-exec: %s via %s\n", path, linker);
    *linker_out = linker;
    *abs_out = abs;
    return args;
}

typedef int (*spawn_fn)(pid_t *, const char *, const posix_spawn_file_actions_t *, const posix_spawnattr_t *,
                        char *const[], char *const[]);

static int spawn_common(const char *sym, pid_t *pid, const char *path, const posix_spawn_file_actions_t *fa,
                        const posix_spawnattr_t *attr, char *const argv[], char *const envp[]) {
    spawn_fn next = (spawn_fn)dlsym(RTLD_NEXT, sym);
    if (!next) return ENOSYS;
    const char *linker;
    char *abs = NULL;
    char **args = rewrite(path, argv, &linker, &abs);
    if (!args) return next(pid, path, fa, attr, argv, envp);
    spawn_fn plain = (spawn_fn)dlsym(RTLD_NEXT, "posix_spawn");
    int r = plain(pid, linker, fa, attr, args, envp);
    free(args);
    free(abs);
    return r;
}

int posix_spawn(pid_t *pid, const char *path, const posix_spawn_file_actions_t *fa, const posix_spawnattr_t *attr,
                char *const argv[], char *const envp[]) {
    return spawn_common("posix_spawn", pid, path, fa, attr, argv, envp);
}

// posix_spawnp only searches PATH for names without a slash; cargo passes full paths to the
// build scripts it runs, so only those are rewritten.
int posix_spawnp(pid_t *pid, const char *file, const posix_spawn_file_actions_t *fa, const posix_spawnattr_t *attr,
                 char *const argv[], char *const envp[]) {
    if (file && strchr(file, '/')) return spawn_common("posix_spawnp", pid, file, fa, attr, argv, envp);
    spawn_fn next = (spawn_fn)dlsym(RTLD_NEXT, "posix_spawnp");
    return next ? next(pid, file, fa, attr, argv, envp) : ENOSYS;
}

int execve(const char *path, char *const argv[], char *const envp[]) {
    execve_fn next = real_execve();
    if (!next) {
        errno = ENOSYS;
        return -1;
    }
    const char *linker;
    char *abs = NULL;
    char **args = rewrite(path, argv, &linker, &abs);
    if (!args) return next(path, argv, envp);
    int r = next(linker, args, envp);
    int saved = errno;
    free(args);
    free(abs);
    errno = saved;
    return r;
}

int execv(const char *path, char *const argv[]) {
    extern char **environ;
    return execve(path, argv, environ);
}

// PATH search like execvp(3), then our execve.
int execvpe(const char *file, char *const argv[], char *const envp[]) {
    if (!file || !*file) {
        errno = ENOENT;
        return -1;
    }
    if (strchr(file, '/')) return execve(file, argv, envp);
    const char *path = getenv("PATH");
    if (!path) path = "/system/bin";
    char buf[4096];
    int last = ENOENT;
    const char *p = path;
    while (*p) {
        const char *end = strchr(p, ':');
        size_t len = end ? (size_t)(end - p) : strlen(p);
        if (len + strlen(file) + 2 < sizeof buf) {
            memcpy(buf, p, len);
            buf[len] = '/';
            strcpy(buf + len + 1, file);
            if (access(buf, F_OK) == 0) {
                execve(buf, argv, envp);
                last = errno;
                if (last != ENOENT && last != EACCES && last != ENOTDIR) return -1;
            }
        }
        if (!end) break;
        p = end + 1;
    }
    errno = last;
    return -1;
}

int execvp(const char *file, char *const argv[]) {
    extern char **environ;
    return execvpe(file, argv, environ);
}
