// The real toolchain, on Android, through the OxideToolchain Expo module
// (modules/oxide-toolchain). See toolchain/README.md for how the pieces fit together.

import Constants from 'expo-constants';

import type { NativeToolchainInfo, OxideToolchain as OxideToolchainType } from '../../modules/oxide-toolchain';
import {
  cargoClippy,
  cargoRun,
  cargoTest,
  runCommand,
  type BuildResult,
  type CargoContext,
} from './cargo';
import { parsePanic } from './diagnostics';
import * as fsx from './fs';
import { scriptProc, type Backend, type ChildHandle, type ChildResult, type LineFn, type Session } from './proc';
import type {
  CheckResult,
  Diagnostic,
  InstallProgress,
  Proc,
  ProcEvent,
  RunOptions,
  Toolchain,
  ToolchainInfo,
  ToolchainPaths,
} from './types';
import { MESSAGE_NOT_INSTALLED, UnavailableToolchain } from './unavailable';
import { useNet } from '../shell/net';

type Module = NonNullable<typeof OxideToolchainType>;

/** app.json → expo.extra.toolchainPayloadUrl: the payload manifest. */
export function payloadManifestUrl(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const url = extra.toolchainPayloadUrl;
  return typeof url === 'string' && url ? url : null;
}

// ---------------------------------------------------------------------------
// Backend: native children, events routed by id
// ---------------------------------------------------------------------------

type Handlers = { line: LineFn; exit: (r: ChildResult) => void; waiting?: () => void };

class NativeBackend implements Backend {
  private handlers = new Map<string, Handlers>();
  /** Events that arrived before their handler was registered (should not happen; be safe). */
  private early = new Map<string, Array<() => void>>();

  constructor(private readonly mod: Module) {
    mod.addListener('onProcOutput', (e) => this.dispatch(e.id, (h) => h.line(e.stream, e.line, e.partial)));
    mod.addListener('onProcWaiting', (e) => this.dispatch(e.id, (h) => h.waiting?.()));
    mod.addListener('onProcExit', (e) =>
      this.dispatch(e.id, (h) => {
        this.handlers.delete(e.id);
        h.exit({ code: e.code, signal: e.signal, durationMs: e.durationMs });
      }),
    );
  }

  private dispatch(id: string, fn: (h: Handlers) => void) {
    const h = this.handlers.get(id);
    if (h) fn(h);
    else {
      const q = this.early.get(id) ?? [];
      q.push(() => {
        const h2 = this.handlers.get(id);
        if (h2) fn(h2);
      });
      this.early.set(id, q);
    }
  }

  private attach(id: string, onLine: LineFn, onWaiting?: () => void): ChildHandle {
    const mod = this.mod;
    const done = new Promise<ChildResult>((resolve) => {
      this.handlers.set(id, { line: onLine, exit: resolve, waiting: onWaiting });
    });
    const q = this.early.get(id);
    if (q) {
      this.early.delete(id);
      for (const f of q) f();
    }
    return {
      id,
      done,
      writeLine: (line) => mod.writeStdin(id, line),
      closeStdin: () => mod.closeStdin(id),
      kill: () => mod.kill(id),
    };
  }

  private failed(message: string, onLine: LineFn): ChildHandle {
    const done = new Promise<ChildResult>((resolve) =>
      setTimeout(() => {
        onLine('stderr', message, false);
        resolve({ code: 127, signal: null, durationMs: 0 });
      }, 0),
    );
    return { id: 'failed', done, writeLine() {}, closeStdin() {}, kill() {} };
  }

  host(argv: string[], cwd: string, env: Record<string, string>, onLine: LineFn): ChildHandle {
    try {
      // cargo uses crates.io while online and the vendored crates offline.
      if (argv[0] === 'cargo') this.mod.setOnline?.(!useNet.getState().offline);
      return this.attach(this.mod.spawn(argv, cwd, env), onLine);
    } catch (e) {
      return this.failed(`${argv[0]}: ${e instanceof Error ? e.message : String(e)}`, onLine);
    }
  }

  wasm(path: string, args: string[], cwd: string, env: Record<string, string>, onLine: LineFn, onWaiting?: () => void): ChildHandle {
    try {
      return this.attach(this.mod.runWasm(path, args, cwd, env), onLine, onWaiting);
    } catch (e) {
      return this.failed(`bash: ${args[0] ?? path}: ${e instanceof Error ? e.message : String(e)}`, onLine);
    }
  }
}

// ---------------------------------------------------------------------------
// Toolchain
// ---------------------------------------------------------------------------

export class NativeToolchain implements Toolchain {
  private backend: NativeBackend;
  private infoCache: NativeToolchainInfo | null = null;
  private infoPromise: Promise<NativeToolchainInfo> | null = null;

  constructor(
    private readonly mod: Module,
    private readonly paths: ToolchainPaths,
  ) {
    this.backend = new NativeBackend(mod);
  }

  private nativeInfo(refresh = false): Promise<NativeToolchainInfo> {
    if (!refresh && this.infoCache) return Promise.resolve(this.infoCache);
    if (!refresh && this.infoPromise) return this.infoPromise;
    this.infoPromise = this.mod.info().then((i) => {
      this.infoCache = i;
      this.infoPromise = null;
      return i;
    });
    return this.infoPromise;
  }

  async info(): Promise<ToolchainInfo> {
    const i = await this.nativeInfo(true);
    return {
      installed: i.installed,
      rustVersion: i.rustVersion,
      rustcVersionLine: i.rustcVersionLine,
      cargoVersionLine: i.cargoVersionLine,
      sizeBytes: i.sizeBytes,
      unavailableReason: i.unavailableReason ?? undefined,
    };
  }

  private ctx(i: NativeToolchainInfo): CargoContext {
    return { nld: i.nativeLibraryDir, target: i.target, home: this.paths.home, exists: fsx.exists, readText: fsx.readText };
  }

  // ---- install ----

  async install(opts: { allowMetered: boolean; onProgress: (p: InstallProgress) => void }): Promise<void> {
    const { onProgress } = opts;
    const url = payloadManifestUrl();
    onProgress({ pkg: 'rust', progress: 0, bytesDone: 0, bytesTotal: 0, state: 'waiting' });
    onProgress({ pkg: 'book', progress: 0, bytesDone: 0, bytesTotal: 0, state: 'waiting' });
    onProgress({ pkg: 'rustlings', progress: 0, bytesDone: 0, bytesTotal: 0, state: 'waiting' });

    const info = await this.nativeInfo(true);
    let rustError: unknown = null;
    if (!info.nativeToolsPresent) {
      rustError = new Error(info.unavailableReason ?? 'This build has no Rust toolchain binaries.');
      onProgress({ pkg: 'rust', progress: 0, bytesDone: 0, bytesTotal: 0, state: 'error', error: String((rustError as Error).message) });
    } else if (!url) {
      rustError = new Error('No toolchain payload URL configured (app.json expo.extra.toolchainPayloadUrl).');
      onProgress({ pkg: 'rust', progress: 0, bytesDone: 0, bytesTotal: 0, state: 'error', error: (rustError as Error).message });
    } else if (info.dataInstalled) {
      onProgress({ pkg: 'rust', progress: 1, bytesDone: 1, bytesTotal: 1, state: 'done', log: `info: ${info.rustVersion ?? 'Rust'} is already installed` });
    } else {
      const sub = this.mod.addListener('onInstallProgress', (p) =>
        onProgress({
          pkg: 'rust',
          progress: p.progress,
          bytesDone: p.bytesDone,
          bytesTotal: p.bytesTotal,
          state: p.state,
          log: p.log ?? undefined,
          error: p.error ?? undefined,
        }),
      );
      try {
        await this.mod.install(url, opts.allowMetered);
      } catch (e) {
        const code = (e as { code?: string }).code;
        // Paused or waiting for Wi-Fi: stop here, the other rows stay "Waiting".
        if (code === 'ERR_PAUSED' || code === 'ERR_METERED') {
          sub.remove();
          throw e;
        }
        rustError = e;
      } finally {
        sub.remove();
      }
      this.infoCache = null;
    }

    // The Book ships inside the app bundle.
    onProgress({ pkg: 'book', progress: 1, bytesDone: 1, bytesTotal: 1, state: 'done' });

    // Rustlings: materialise ~/rustlings from the bundled content.
    onProgress({ pkg: 'rustlings', progress: 0.1, bytesDone: 0, bytesTotal: 1, state: 'installing', log: 'info: creating ~/rustlings' });
    try {
      const fs = await import('../fs');
      await fs.ensureRustlingsWorkspace();
      onProgress({ pkg: 'rustlings', progress: 1, bytesDone: 1, bytesTotal: 1, state: 'done' });
    } catch (e) {
      onProgress({ pkg: 'rustlings', progress: 0, bytesDone: 0, bytesTotal: 1, state: 'error', error: e instanceof Error ? e.message : String(e) });
      rustError ??= e;
    }
    if (rustError) throw rustError;
  }

  pauseInstall(): void {
    this.mod.pauseInstall();
  }

  async checkForUpdate(): Promise<{ upToDate: boolean; latest: string }> {
    const url = payloadManifestUrl();
    const info = await this.nativeInfo(true);
    if (!url) return { upToDate: true, latest: info.rustVersion ?? '' };
    const m = await this.mod.fetchManifest(url);
    return { upToDate: m.rustVersion === info.rustVersion, latest: m.rustVersion };
  }

  // ---- running ----

  /** Runs `script` once the toolchain is known to be usable, else prints why it is not. */
  private proc(onEvent: (e: ProcEvent) => void, script: (s: Session, i: NativeToolchainInfo) => Promise<number>, onWaiting?: () => void): Proc {
    return scriptProc(
      this.backend,
      onEvent,
      async (s) => {
        const i = await this.nativeInfo();
        if (!i.installed) {
          s.err(i.unavailableReason ?? MESSAGE_NOT_INSTALLED);
          // Recheck next time (the user may have finished setup since).
          this.infoCache = null;
          return 127;
        }
        return script(s, i);
      },
      onWaiting,
    );
  }

  spawn(argv: string[], opts: RunOptions): Proc {
    const env = opts.env ?? {};
    // Android's shell and toybox tools don't need the Rust toolchain.
    if (argv[0] === 'sh') {
      return scriptProc(this.backend, opts.onEvent, async (s) => (await s.host(argv, opts.cwd, env)).code, opts.onWaitingForInput);
    }
    return this.proc(opts.onEvent, (s, i) => runCommand(s, this.ctx(i), argv, opts.cwd, env), opts.onWaitingForInput);
  }

  private exercise(name: string) {
    return import('../content').then((c) => c.rustlings.exercises[name]);
  }

  async checkExercise(name: string, code: string): Promise<CheckResult> {
    const t0 = Date.now();
    const lines: string[] = [];
    const diagnostics: Diagnostic[] = [];
    const ex = await this.exercise(name);
    const testFirst = ex ? ex.test : /#\[test\]/.test(code);
    let command = testFirst ? `cargo test --bin ${name}` : `cargo run --bin ${name}`;
    let outcome = 'pass' as CheckResult['outcome'];

    const proc = this.proc(
      (e) => {
        if (e.type !== 'exit') lines.push(e.line);
      },
      async (s, i) => {
        const fs = await import('../fs');
        if (!fsx.exists(`${this.paths.rustlings}/Cargo.toml`)) await fs.ensureRustlingsWorkspace();
        await fs.syncExercise(name, code);
        const ctx = this.ctx(i);
        const root = this.paths.rustlings;
        const programCwd = ex ? `${root}/exercises/${ex.dir}` : root;
        const env = { CARGO_TERM_COLOR: 'always' };
        const quiet = ['--quiet'];

        if (testFirst) {
          const r = await cargoTest(s, ctx, [...quiet, '--bin', name, '--', '--color', 'always'], root, env, { programCwd });
          diagnostics.push(...r.build.diagnostics);
          if (r.build.code !== 0) {
            outcome = 'compile-error';
            return r.code;
          }
          if (r.code !== 0) {
            outcome = 'test-failed';
            return r.code;
          }
        } else {
          let build: BuildResult | null = null;
          const rc = await cargoRun(s, ctx, [...quiet, '--bin', name], root, env, {
            programCwd,
            onBuild: (b) => (build = b),
          });
          const b = build as BuildResult | null;
          if (b) diagnostics.push(...b.diagnostics);
          if (rc !== 0) {
            outcome = b && b.code === 0 ? 'run-failed' : 'compile-error';
            return rc;
          }
        }

        // Rustlings also runs Clippy. Clippy exercises fail on any warning; the others on
        // denied lints (todo!, empty loops…) only.
        const strict = ex?.strictClippy ?? false;
        if (strict || /\btodo!\s*\(/.test(code)) {
          const args = [...quiet, '--bin', name, ...(strict ? ['--', '-D', 'warnings'] : [])];
          const c = await cargoClippy(s, ctx, args, root, env);
          diagnostics.push(...c.diagnostics.filter((d) => !diagnostics.some((x) => x.rendered === d.rendered)));
          if (c.code !== 0) {
            outcome = 'compile-error';
            command = `cargo clippy --bin ${name}${strict ? ' -- -D warnings' : ''}`;
            return c.code;
          }
        }
        return 0;
      },
    );
    const exit = await proc.done;
    if (exit === 127 && outcome === 'pass') outcome = 'compile-error';
    const panic = outcome === 'test-failed' || outcome === 'run-failed' ? parsePanic(lines) : undefined;
    return { outcome, command, lines, diagnostics, panic, durationMs: Date.now() - t0 };
  }

  runExercise(name: string, code: string, onEvent: (e: ProcEvent) => void): Proc {
    return this.proc(onEvent, async (s, i) => {
      const fs = await import('../fs');
      if (!fsx.exists(`${this.paths.rustlings}/Cargo.toml`)) await fs.ensureRustlingsWorkspace();
      await fs.syncExercise(name, code);
      const ex = await this.exercise(name);
      const root = this.paths.rustlings;
      return cargoRun(s, this.ctx(i), ['--bin', name], root, { CARGO_TERM_COLOR: 'always' }, {
        programCwd: ex ? `${root}/exercises/${ex.dir}` : root,
      });
    });
  }

  runSnippet(code: string, onEvent: (e: ProcEvent) => void): Proc {
    return this.proc(onEvent, async (s, i) => {
      // One reusable crate outside ~ so dependencies stay compiled between runs.
      const dir = `${snippetsDir()}/playground`;
      const deps = /\brand::/.test(code) ? 'rand = "0.10"\n' : '';
      const toml = `[package]\nname = "playground"\nversion = "0.1.0"\nedition = "2024"\n\n[dependencies]\n${deps}`;
      if (fsx.readText(`${dir}/Cargo.toml`) !== toml) fsx.writeText(`${dir}/Cargo.toml`, toml);
      fsx.writeText(`${dir}/src/main.rs`, code);
      return cargoRun(s, this.ctx(i), ['--quiet'], dir, { CARGO_TERM_COLOR: 'always' });
    });
  }
}

function snippetsDir(): string {
  return (fsx.documentDirPath() ?? '/data/oxide') + '/toolchain/snippets';
}

export function createNativeToolchain(mod: Module | null, paths: ToolchainPaths, fallbackReason: string): Toolchain {
  if (!mod || !mod.isSupported) return new UnavailableToolchain(fallbackReason);
  return new NativeToolchain(mod, paths);
}
