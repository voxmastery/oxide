// Oxide's on-device Rust toolchain: an Expo local module, Android only.
//
// iOS cannot support this at all: iOS apps may not execute any binary they did not ship
// signed (no fork/exec, no JIT), so rustc and cargo cannot run there. On iOS and web this
// module is absent and `OxideToolchain` is null; src/toolchain falls back to the
// "unavailable" implementation.

import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  NativeManifestInfo,
  NativeToolchainInfo,
  OxideToolchainEvents,
} from './src/OxideToolchain.types';

export * from './src/OxideToolchain.types';

declare class OxideToolchainModule extends NativeModule<OxideToolchainEvents> {
  /** arm64-v8a and Android 10+. */
  readonly isSupported: boolean;
  /** "wasm32-wasip1-threads" */
  readonly wasmTarget: string;
  readonly hostTarget: string;

  info(): Promise<NativeToolchainInfo>;
  /** The environment every host tool gets (CARGO_HOME, RUSTC, LD_LIBRARY_PATH…). */
  env(): Promise<Record<string, string>>;
  /** Download + verify + unpack the payload. Rejects with ERR_PAUSED / ERR_METERED. */
  install(manifestUrl: string, allowMetered: boolean): Promise<boolean>;
  pauseInstall(): void;
  fetchManifest(manifestUrl: string): Promise<NativeManifestInfo>;
  isMetered(): boolean;
  /** Point cargo at crates.io (true) or at the vendored crates (false). */
  setOnline?(online: boolean): void;

  /** argv[0]: "cargo" | "rustc" | "rustfmt" | "rust-lld" | "clippy-driver". Returns a process id. */
  spawn(argv: string[], cwd: string, env: Record<string, string>): string;
  /** Run a .wasm program in-process (Chicory). args[0] is the program name. */
  runWasm(path: string, args: string[], cwd: string, env: Record<string, string>): string;
  writeStdin(id: string, line: string): void;
  closeStdin(id: string): void;
  kill(id: string): void;
}

/** null on iOS, web, and Android builds without the module. */
export const OxideToolchain: OxideToolchainModule | null =
  requireOptionalNativeModule<OxideToolchainModule>('OxideToolchain');

export default OxideToolchain;
