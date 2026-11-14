# Chicory (WebAssembly runtime) references annotation classes that are only needed when
# compiling it (com.dylibso.chicory.annotations, source-retention, not shipped at runtime),
# and java.lang.System.Logger from its optional SystemLogger, which Android doesn't have.
# Oxide passes its own logger (WasmProcess.QuietLogger), so SystemLogger is never loaded.
-dontwarn com.dylibso.chicory.annotations.**
-dontwarn java.lang.System$Logger
-dontwarn java.lang.System$Logger$Level
-dontwarn com.dylibso.chicory.log.SystemLogger

# Chicory wires WASI host functions by name; keep the runtime, WASI and wasm model intact.
-keep class com.dylibso.chicory.** { *; }

# commons-compress / xz: optional codecs we don't use.
-dontwarn org.apache.commons.compress.**
-dontwarn org.tukaani.xz.**
-dontwarn com.github.luben.zstd.**
-dontwarn org.brotli.dec.**
-dontwarn org.objectweb.asm.**
