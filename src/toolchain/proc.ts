// Processes made of several steps ("cargo build", then run the .wasm), exposed as one `Proc`.
// The backend (the native module, or a fake in tests) starts the individual children.

import type { Proc, ProcEvent } from './types';

export type Stream = 'stdout' | 'stderr';
export type LineFn = (stream: Stream, line: string, partial: boolean) => void;
export type ChildResult = { code: number; signal: string | null; durationMs: number };

export interface ChildHandle {
  readonly id: string;
  writeLine(line: string): void;
  closeStdin(): void;
  kill(): void;
  readonly done: Promise<ChildResult>;
}

export interface Backend {
  /** A real process from the native library dir (argv[0] = "cargo", "rustc"…). */
  host(argv: string[], cwd: string, env: Record<string, string>, onLine: LineFn): ChildHandle;
  /** A WebAssembly program run in-process. args[0] is the program name. */
  wasm(path: string, args: string[], cwd: string, env: Record<string, string>, onLine: LineFn, onWaiting?: () => void): ChildHandle;
}

let seq = 0;

/** What a step script gets: output helpers and child management. */
export class Session {
  killed = false;
  private current: ChildHandle | null = null;
  private stdinQueue: string[] = [];
  private stdinClosed = false;

  constructor(
    readonly backend: Backend,
    private readonly onEvent: (e: ProcEvent) => void,
    private readonly onWaiting?: () => void,
  ) {}

  emit(stream: Stream, line: string, partial = false) {
    this.onEvent(partial ? { type: stream, line, partial } : { type: stream, line });
  }
  out(line: string) {
    this.emit('stdout', line);
  }
  err(line: string) {
    this.emit('stderr', line);
  }

  /**
   * Run a child to completion. `onLine` sees every line first; return true from it to swallow
   * the line (it is not shown). Lines typed before the child started are delivered to it.
   */
  async run(start: (onLine: LineFn) => ChildHandle, onLine?: (stream: Stream, line: string, partial: boolean) => boolean | void): Promise<ChildResult> {
    if (this.killed) return { code: 130, signal: 'SIGINT', durationMs: 0 };
    const child = start((stream, line, partial) => {
      if (onLine && onLine(stream, line, partial) === true) return;
      this.emit(stream, line, partial);
    });
    this.current = child;
    for (const l of this.stdinQueue.splice(0)) child.writeLine(l);
    if (this.stdinClosed) child.closeStdin();
    try {
      return await child.done;
    } finally {
      if (this.current === child) this.current = null;
    }
  }

  host(argv: string[], cwd: string, env: Record<string, string>, onLine?: (s: Stream, l: string, p: boolean) => boolean | void) {
    return this.run((fn) => this.backend.host(argv, cwd, env, fn), onLine);
  }

  wasm(path: string, args: string[], cwd: string, env: Record<string, string>, onLine?: (s: Stream, l: string, p: boolean) => boolean | void) {
    return this.run((fn) => this.backend.wasm(path, args, cwd, env, fn, this.onWaiting), onLine);
  }

  writeLine(line: string) {
    if (this.current) this.current.writeLine(line);
    else this.stdinQueue.push(line);
  }

  closeStdin() {
    this.stdinClosed = true;
    this.current?.closeStdin();
  }

  kill() {
    this.killed = true;
    this.current?.kill();
  }
}

/** Wrap a multi-step script as a Proc. The script resolves with the exit code. */
export function scriptProc(
  backend: Backend,
  onEvent: (e: ProcEvent) => void,
  script: (s: Session) => Promise<number>,
  onWaiting?: () => void,
): Proc & { closeStdin(): void } {
  const id = `proc-${++seq}`;
  const s = new Session(backend, onEvent, onWaiting);
  const t0 = Date.now();
  const done = (async () => {
    let code: number;
    try {
      code = await script(s);
    } catch (e) {
      s.err(`oxide: ${e instanceof Error ? e.message : String(e)}`);
      code = 1;
    }
    if (s.killed && code === 0) code = 130;
    onEvent(s.killed ? { type: 'exit', code, signal: 'SIGINT', durationMs: Date.now() - t0 } : { type: 'exit', code, durationMs: Date.now() - t0 });
    return code;
  })();
  return {
    id,
    done,
    writeLine: (line) => s.writeLine(line),
    kill: () => s.kill(),
    closeStdin: () => s.closeStdin(),
  };
}
