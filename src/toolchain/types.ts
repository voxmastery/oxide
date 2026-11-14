// The app's only view of the Rust toolchain. Screens never talk to the native module directly.

export type ToolchainPackage = 'rust' | 'book' | 'rustlings';

export type InstallProgress = {
  pkg: ToolchainPackage;
  /** 0..1 */
  progress: number;
  bytesDone: number;
  bytesTotal: number;
  state: 'waiting' | 'downloading' | 'installing' | 'done' | 'paused' | 'error';
  /** rustup-style log line, e.g. "info: downloading component 'cargo'". */
  log?: string;
  error?: string;
};

export type ToolchainInfo = {
  installed: boolean;
  /** "1.99.1" */
  rustVersion: string | null;
  /** Full `rustc --version` line, e.g. "rustc 1.99.1 (f0e3b1c27 2026-10-15)". */
  rustcVersionLine: string | null;
  cargoVersionLine: string | null;
  /** Bytes on disk for the toolchain payload. */
  sizeBytes: number;
  /** Why compiling is unavailable (web build, not installed, unsupported ABI…). */
  unavailableReason?: string;
};

/** One stream chunk from a running process, already split into lines. */
export type ProcEvent =
  | {
      type: 'stdout' | 'stderr';
      line: string;
      /**
       * True when the line has no newline yet: a prompt such as `print!("Guess: ")` shown
       * because the program is now waiting for input. The next event on the same stream
       * continues this line (and closes it unless it is partial too).
       */
      partial?: boolean;
    }
  | { type: 'exit'; code: number; signal?: string; durationMs: number };

export interface Proc {
  readonly id: string;
  /** Write a line to the process's stdin (a trailing newline is added). */
  writeLine(line: string): void;
  /** ⌃C */
  kill(): void;
  /** Resolves with the exit code. */
  readonly done: Promise<number>;
}

export type RunOptions = {
  /** Absolute path inside the app sandbox (see `paths`). */
  cwd: string;
  env?: Record<string, string>;
  /** Called for every line, in order. Output keeps ANSI escape codes (CARGO_TERM_COLOR=always). */
  onEvent: (e: ProcEvent) => void;
  /** Called each time a running program blocks reading stdin ("… is waiting for input"). */
  onWaitingForInput?: () => void;
};

/** A compiler diagnostic from `--message-format=json` / `--error-format=json`. */
export type Diagnostic = {
  level: 'error' | 'warning' | 'note' | 'help' | 'failure-note';
  message: string;
  code: string | null;          // "E0382"
  spans: {
    file: string;
    lineStart: number;
    lineEnd: number;
    colStart: number;
    colEnd: number;
    primary: boolean;
    label: string | null;
    /** rustc's `suggested_replacement` for this span (machine-applicable fixes). */
    suggestedReplacement?: string | null;
    /** rustc's `suggestion_applicability`: "MachineApplicable" | "MaybeIncorrect" | … */
    applicability?: string | null;
  }[];
  children: Diagnostic[];
  /** rustc's human-readable rendering, with ANSI colors. Shown verbatim in Output. */
  rendered: string | null;
};

export type CheckResult = {
  /** compile error, test failure (panic), or pass. */
  outcome: 'pass' | 'compile-error' | 'test-failed' | 'run-failed';
  /** Exact command shown above the output, e.g. "cargo test --bin move_semantics2". */
  command: string;
  /** Combined output lines with ANSI colors, verbatim. */
  lines: string[];
  diagnostics: Diagnostic[];
  /** For panics: message and location parsed from the test output. */
  panic?: { message: string; file: string; line: number; col: number };
  durationMs: number;
};

export interface Toolchain {
  info(): Promise<ToolchainInfo>;
  /** Start or resume the first-run download. `allowMetered` = "Use mobile data". */
  install(opts: { allowMetered: boolean; onProgress: (p: InstallProgress) => void }): Promise<void>;
  pauseInstall(): void;
  /** Compare installed version with the latest published payload. */
  checkForUpdate(): Promise<{ upToDate: boolean; latest: string }>;

  /** Run a shell-level command in a working directory: `cargo …`, `rustc …`, or a built binary. */
  spawn(argv: string[], opts: RunOptions): Proc;

  /** Rustlings: compile the exercise and run its tests (or main when it has none). */
  checkExercise(name: string, code: string): Promise<CheckResult>;
  /** Rustlings: run main() only. */
  runExercise(name: string, code: string, onEvent: (e: ProcEvent) => void): Proc;

  /** Book listings: compile and run a single-file program (Reader "Run"). */
  runSnippet(code: string, onEvent: (e: ProcEvent) => void): Proc;
}

/** Sandbox paths, mirroring the shell's view (`~` = home). */
export type ToolchainPaths = {
  home: string;            // ~
  projects: string;        // ~/projects
  rustlings: string;       // ~/rustlings
};
