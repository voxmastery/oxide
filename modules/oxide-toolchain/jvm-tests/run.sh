#!/usr/bin/env bash
# Compiles the module's pure-JVM core (no Android dependencies) with the same Chicory jars the
# Android build uses, so the WebAssembly runner can be tested on a desktop JDK:
#
#   modules/oxide-toolchain/jvm-tests/run.sh build
#   modules/oxide-toolchain/jvm-tests/run.sh run path/to/program.wasm [args...]
#   modules/oxide-toolchain/jvm-tests/run.sh test URL SHA256 DEST_DIR   (download + unpack)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
core="$here/../android/src/main/java"
out="${OXIDE_JVM_TEST_OUT:-$here/.build}"
CHICORY_VERSION="$(sed -n 's/^chicoryVersion=//p' "$here/../android/gradle.properties")"
mkdir -p "$out/jars" "$out/classes"
for a in wasm runtime wasi log; do
  jar="$out/jars/$a-$CHICORY_VERSION.jar"
  [ -f "$jar" ] || curl -fsSL -o "$jar" "https://repo1.maven.org/maven2/com/dylibso/chicory/$a/$CHICORY_VERSION/$a-$CHICORY_VERSION.jar"
done
# Same coordinates as android/build.gradle.
for gav in org/apache/commons/commons-compress/1.28.0 commons-io/commons-io/2.20.0 \
           org/apache/commons/commons-lang3/3.18.0 org/tukaani/xz/1.12; do
  a="$(basename "$(dirname "$gav")")"; v="$(basename "$gav")"
  jar="$out/jars/$a-$v.jar"
  [ -f "$jar" ] || curl -fsSL -o "$jar" "https://repo1.maven.org/maven2/$gav/$a-$v.jar"
done
cp="$(ls "$out"/jars/*.jar | tr '\n' ':')"
case "${1:-build}" in
  build)
    javac -d "$out/classes" -cp "$cp" --release 17 \
      $(find "$core/expo/modules/oxidetoolchain/core" -name '*.java') "$here"/*.java
    echo "built into $out/classes"
    ;;
  run)
    shift
    exec java -Xss64m -cp "$out/classes:$cp" RunWasm "$@"
    ;;
  test)
    shift
    exec java -cp "$out/classes:$cp" TestInstaller "$@"
    ;;
esac
