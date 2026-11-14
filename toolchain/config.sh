# Shared settings for the toolchain scripts. Sourced, not executed.
RUST_VERSION="${RUST_VERSION:-1.99.1}"
# rustc --version of the official 1.99.1 release (static.rust-lang.org/dist/channel-rust-1.99.1.toml)
RUSTC_VERSION_LINE="${RUSTC_VERSION_LINE:-rustc 1.99.1 (58cf8f9c3 2026-10-13)}"
# Where user programs are compiled to. wasm32-wasip1-threads gives std::thread (see README).
WASM_TARGET="${WASM_TARGET:-wasm32-wasip1-threads}"
HOST_TARGET="aarch64-linux-android"
ANDROID_API="${ANDROID_API:-29}"
ABI="arm64-v8a"

TOOLCHAIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="${DIST:-$TOOLCHAIN_DIR/dist}"
WORK="${WORK:-$TOOLCHAIN_DIR/.work}"
