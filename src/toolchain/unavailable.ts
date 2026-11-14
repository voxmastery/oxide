// The Toolchain on platforms (or installs) that cannot compile: web, iOS, Android without the
// payload. Every command answers with a clear message on stderr instead of failing silently.

import type {
  CheckResult,
  InstallProgress,
  Proc,
  ProcEvent,
  RunOptions,
  Toolchain,
  ToolchainInfo,
} from './types';

export const MESSAGE_WEB =
  'Compiling needs the Rust toolchain on Android. In the web preview you can read, edit and explore, but cargo and rustc only run in the Android app.';
export const MESSAGE_IOS =
  'Compiling needs the Rust toolchain on Android. iOS does not allow apps to run compilers or other programs they download, so Oxide on iPhone can’t build or run code.';
export const MESSAGE_NOT_INSTALLED =
  'Compiling needs the Rust toolchain on Android. Rust isn’t set up on this phone yet: open Settings → Storage and download Rust.';

let seq = 0;

/** A process that prints `message` on stderr and exits with `code` on the next tick. */
export function failedProc(lines: string[], onEvent: (e: ProcEvent) => void, code = 127): Proc {
  const id = `unavailable-${++seq}`;
  const done = new Promise<number>((resolve) => {
    setTimeout(() => {
      for (const line of lines) onEvent({ type: 'stderr', line });
      onEvent({ type: 'exit', code, durationMs: 0 });
      resolve(code);
    }, 0);
  });
  return { id, writeLine() {}, kill() {}, done };
}

export class UnavailableToolchain implements Toolchain {
  constructor(private readonly reason: string) {}

  async info(): Promise<ToolchainInfo> {
    return {
      installed: false,
      rustVersion: null,
      rustcVersionLine: null,
      cargoVersionLine: null,
      sizeBytes: 0,
      unavailableReason: this.reason,
    };
  }

  async install(opts: { allowMetered: boolean; onProgress: (p: InstallProgress) => void }): Promise<void> {
    opts.onProgress({ pkg: 'rust', progress: 0, bytesDone: 0, bytesTotal: 0, state: 'error', error: this.reason });
    throw new Error(this.reason);
  }

  pauseInstall(): void {}

  async checkForUpdate(): Promise<{ upToDate: boolean; latest: string }> {
    return { upToDate: true, latest: '' };
  }

  spawn(argv: string[], opts: RunOptions): Proc {
    const cmd = argv[0] ?? '';
    return failedProc([`${cmd}: ${this.reason}`], opts.onEvent);
  }

  async checkExercise(name: string): Promise<CheckResult> {
    return {
      outcome: 'compile-error',
      command: `cargo test --bin ${name}`,
      lines: [this.reason],
      diagnostics: [],
      durationMs: 0,
    };
  }

  runExercise(_name: string, _code: string, onEvent: (e: ProcEvent) => void): Proc {
    return failedProc([this.reason], onEvent);
  }

  runSnippet(_code: string, onEvent: (e: ProcEvent) => void): Proc {
    return failedProc([this.reason], onEvent);
  }
}
