// Shell-level commands on top of the real toolchain.
//
// cargo and rustc run as real processes. What they build is WebAssembly
// (wasm32-wasip1-threads), which cannot be exec'd, so the steps that *run* a program are done
// here: `cargo run` = `cargo build` + run the .wasm; `cargo test` = `cargo test --no-run` + run
// each test binary (see testHarness.ts). The lines cargo itself would print around a run
// ("Running `target/…`", "error: process didn't exit successfully…") are printed in cargo's
// format and colors. `cargo clippy` and `cargo fmt` are what cargo-clippy / cargo-fmt do:
// `cargo check` with clippy-driver as the workspace wrapper, and rustfmt on each target root.

import { parseCargoMessage, renderedLines, type CargoArtifact } from './diagnostics';
import type { Session, Stream } from './proc';
import { runTestHarness } from './testHarness';
import type { Diagnostic } from './types';

export type CargoContext = {
  /** The APK's native library dir (for librust-lld.so / liboxide-rustc.so). */
  nld: string;
  /** "wasm32-wasip1-threads" */
  target: string;
  exists(path: string): boolean;
  readText(path: string): string | null;
};

const BOLD_GREEN = '\x1b[1m\x1b[92m';
const BOLD_RED = '\x1b[1m\x1b[91m';
const RESET = '\x1b[0m';
const JSON_FORMAT = '--message-format=json-diagnostic-rendered-ansi';

export const status = (verb: string, rest: string) => `${BOLD_GREEN}${verb.padStart(12)}${RESET} ${rest}`;
export const cargoError = (msg: string) => `${BOLD_RED}error${RESET}: ${msg}`;

export function relativeTo(cwd: string, abs: string): string {
  const base = cwd.replace(/\/+$/, '');
  if (abs === base) return '.';
  if (abs.startsWith(base + '/')) return abs.slice(base.length + 1);
  return abs;
}

function quoteArg(a: string): string {
  return /^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`;
}

function splitDashDash(args: string[]): [string[], string[]] {
  const i = args.indexOf('--');
  return i < 0 ? [args, []] : [args.slice(0, i), args.slice(i + 1)];
}

function flagValue(args: string[], name: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name) return args[i + 1];
    if (args[i].startsWith(name + '=')) return args[i].slice(name.length + 1);
  }
  return undefined;
}

function findManifest(ctx: CargoContext, cwd: string): string | null {
  let dir = cwd.replace(/\/+$/, '');
  while (dir) {
    const p = `${dir}/Cargo.toml`;
    if (ctx.exists(p)) return p;
    const i = dir.lastIndexOf('/');
    if (i <= 0) break;
    dir = dir.slice(0, i);
  }
  return null;
}

function packageRootOf(srcPath: string): string {
  const m = /^(.*?)\/(src|tests|examples|benches)\//.exec(srcPath);
  return m ? m[1] : srcPath.slice(0, srcPath.lastIndexOf('/'));
}

export type BuildResult = { code: number; artifacts: CargoArtifact[]; diagnostics: Diagnostic[] };

/**
 * `cargo <sub> … --message-format=json-diagnostic-rendered-ansi`, showing cargo's status lines
 * and rustc's rendered diagnostics exactly as a terminal would, and collecting the artifacts.
 */
export async function cargoJson(
  s: Session,
  sub: 'build' | 'test' | 'check',
  args: string[],
  cwd: string,
  env: Record<string, string>,
  onLine?: (stream: Stream, line: string) => void,
): Promise<BuildResult> {
  const artifacts: CargoArtifact[] = [];
  const diagnostics: Diagnostic[] = [];
  const argv = ['cargo', sub, ...args, JSON_FORMAT];
  const r = await s.host(argv, cwd, env, (stream, line) => {
    if (stream === 'stdout') {
      const m = parseCargoMessage(line);
      if (m.kind === 'artifact') {
        artifacts.push(m.artifact);
        return true;
      }
      if (m.kind === 'diagnostic') {
        diagnostics.push(m.diagnostic);
        for (const l of renderedLines(m.diagnostic)) {
          s.err(l);
          onLine?.('stderr', l);
        }
        return true;
      }
      if (line.startsWith('{')) return true;
    } else if (sub === 'test' && /^\s*Executable /.test(line.replace(/\x1b\[[0-9;]*m/g, ''))) {
      // `--no-run` lists the test executables; plain `cargo test` does not.
      return true;
    }
    onLine?.(stream, line);
    return false;
  });
  return { code: r.code, artifacts, diagnostics };
}

/** Cargo's message for a program that failed, e.g. "(exit status: 101)". */
function exitDescription(code: number, signal: string | null): string {
  if (signal === 'SIGABRT') return 'signal: 6, SIGABRT: process abort signal';
  if (signal === 'SIGKILL') return 'signal: 9, SIGKILL: kill';
  return `exit status: ${code}`;
}

export type RunOptions = {
  /** Working directory of the program (Rustlings runs exercises from their own folder). */
  programCwd?: string;
  /** Collects everything shown (for CheckResult.lines). */
  onLine?: (stream: Stream, line: string) => void;
  /** Called once the build step has finished. */
  onBuild?: (b: BuildResult) => void;
};

/** `cargo run [cargo args] [-- program args]` */
export async function cargoRun(
  s: Session,
  ctx: CargoContext,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  opts: RunOptions = {},
): Promise<number> {
  const [cargoArgs, progArgs] = splitDashDash(args);
  const build = await cargoJson(s, 'build', cargoArgs, cwd, env, opts.onLine);
  opts.onBuild?.(build);
  if (build.code !== 0) return build.code;

  const example = flagValue(cargoArgs, '--example');
  const bin = flagValue(cargoArgs, '--bin');
  const wanted = example ? 'example' : 'bin';
  const runnable = build.artifacts.filter((a) => a.executable && a.kinds.includes(wanted) && !a.test);
  let pick: CargoArtifact | undefined;
  if (bin || example) pick = runnable.find((a) => a.name === (bin ?? example));
  else if (runnable.length === 1) pick = runnable[0];
  else if (runnable.length > 1) {
    const manifest = findManifest(ctx, cwd);
    const text = manifest ? ctx.readText(manifest) : null;
    const def = text ? /^\s*default-run\s*=\s*"([^"]+)"/m.exec(text)?.[1] : undefined;
    pick = def ? runnable.find((a) => a.name === def) : undefined;
    if (!pick) {
      const msg = [
        cargoError('`cargo run` could not determine which binary to run. Use the `--bin` option to specify a binary, or the `default-run` manifest key.'),
        `available binaries: ${runnable.map((a) => a.name).join(', ')}`,
      ];
      for (const l of msg) {
        s.err(l);
        opts.onLine?.('stderr', l);
      }
      return 101;
    }
  }
  if (!pick || !pick.executable) {
    const l = cargoError('a bin target must be available for `cargo run`');
    s.err(l);
    opts.onLine?.('stderr', l);
    return 101;
  }
  const rel = relativeTo(cwd, pick.executable);
  const shown = [rel, ...progArgs].map(quoteArg).join(' ');
  const quiet = cargoArgs.includes('-q') || cargoArgs.includes('--quiet');
  if (!quiet) {
    const l = status('Running', '`' + shown + '`');
    s.err(l);
    opts.onLine?.('stderr', l);
  }
  const r = await s.wasm(pick.executable, [rel, ...progArgs], opts.programCwd ?? cwd, env, (stream, line) => {
    opts.onLine?.(stream, line);
  });
  if (r.code !== 0 && !s.killed) {
    const l = cargoError(`process didn't exit successfully: \`${shown}\` (${exitDescription(r.code, r.signal)})`);
    s.err(l);
    opts.onLine?.('stderr', l);
  }
  return r.code;
}

const VALUE_FLAGS = new Set([
  '--bin', '--test', '--example', '--bench', '-p', '--package', '--features', '-F', '--target', '--target-dir',
  '--manifest-path', '--profile', '-j', '--jobs', '--message-format', '--color', '--exclude', '--config', '-Z',
]);

/** `cargo test [TESTNAME]`: cargo hands a positional TESTNAME to the harness as a filter. */
function splitTestName(args: string[]): [string[], string[]] {
  const cargo: string[] = [];
  const filters: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (VALUE_FLAGS.has(a)) {
      cargo.push(a, args[++i] ?? '');
    } else if (!a.startsWith('-') && filters.length === 0) {
      filters.push(a);
    } else {
      cargo.push(a);
    }
  }
  return [cargo, filters];
}

/** `cargo test [cargo args] [TESTNAME] [-- harness args]` */
export async function cargoTest(
  s: Session,
  ctx: CargoContext,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  opts: RunOptions = {},
): Promise<{ code: number; build: BuildResult }> {
  const [beforeDashDash, afterDashDash] = splitDashDash(args);
  const [cargoArgs, testName] = splitTestName(beforeDashDash);
  const harnessArgs = [...testName, ...afterDashDash];
  if (cargoArgs.includes('--doc')) {
    const l = cargoError('doctests need rustdoc to run native programs, which Android does not allow; Oxide runs unit and integration tests only');
    s.err(l);
    return { code: 101, build: { code: 101, artifacts: [], diagnostics: [] } };
  }
  const build = await cargoJson(s, 'test', ['--no-run', ...cargoArgs], cwd, env, opts.onLine);
  if (build.code !== 0) return { code: build.code, build };
  const tests = build.artifacts.filter((a) => a.test && a.executable);
  for (const t of tests) {
    if (s.killed) return { code: 130, build };
    const root = packageRootOf(t.srcPath);
    const src = relativeTo(root, t.srcPath);
    const exe = relativeTo(cwd, t.executable!);
    const label = t.kinds.includes('test') ? src : `unittests ${src}`;
    const l = status('Running', `${label} (${exe})`);
    s.err(l);
    opts.onLine?.('stderr', l);
    const r = await runTestHarness(s, t.executable!, exe, harnessArgs, opts.programCwd ?? root, env);
    for (const line of r.lines) opts.onLine?.('stdout', line);
    if (r.code !== 0) {
      if (s.killed) return { code: 130, build };
      const kind = t.kinds.includes('lib')
        ? '--lib'
        : t.kinds.includes('bin')
          ? `--bin ${t.name}`
          : t.kinds.includes('test')
            ? `--test ${t.name}`
            : t.kinds.includes('example')
              ? `--example ${t.name}`
              : `--bench ${t.name}`;
      const e = cargoError(`test failed, to rerun pass \`${kind}\``);
      s.err(e);
      opts.onLine?.('stderr', e);
      return { code: 101, build };
    }
  }
  return { code: 0, build };
}

/** `cargo clippy [args] [-- clippy args]`, as cargo-clippy implements it. */
export async function cargoClippy(
  s: Session,
  ctx: CargoContext,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  opts: RunOptions = {},
): Promise<BuildResult> {
  const [cargoArgs, clippyArgs] = splitDashDash(args);
  const clippyEnv = {
    ...env,
    RUSTC_WORKSPACE_WRAPPER: `${ctx.nld}/liboxide-rustc.so`,
    OXIDE_CLIPPY: '1',
    CLIPPY_ARGS: clippyArgs.map((a) => a + '__CLIPPY_HACKERY__').join(''),
  };
  return cargoJson(s, 'check', cargoArgs.filter((a) => a !== '--fix' && a !== '--no-deps'), cwd, clippyEnv, opts.onLine);
}

/** `cargo fmt [--check] [-- rustfmt args]`, as cargo-fmt does it: rustfmt on every target root. */
export async function cargoFmt(s: Session, args: string[], cwd: string, env: Record<string, string>): Promise<number> {
  const [own, rustfmtArgs] = splitDashDash(args);
  const extra = [...rustfmtArgs];
  if (own.includes('--check')) extra.unshift('--check');
  let json = '';
  const meta = await s.host(['cargo', 'metadata', '--no-deps', '--format-version', '1', '--offline'], cwd, env, (stream, line) => {
    if (stream === 'stdout') {
      json += line + '\n';
      return true;
    }
    return false;
  });
  if (meta.code !== 0) return meta.code;
  let pkgs: { targets: { src_path: string; edition: string }[]; edition: string }[] = [];
  try {
    pkgs = JSON.parse(json).packages ?? [];
  } catch {
    s.err(cargoError('failed to read `cargo metadata`'));
    return 1;
  }
  const byEdition = new Map<string, Set<string>>();
  for (const p of pkgs)
    for (const t of p.targets) {
      const ed = t.edition || p.edition || '2015';
      if (!byEdition.has(ed)) byEdition.set(ed, new Set());
      byEdition.get(ed)!.add(t.src_path);
    }
  let code = 0;
  for (const [ed, files] of byEdition) {
    const r = await s.host(['rustfmt', '--edition', ed, ...extra, ...files], cwd, env);
    if (r.code !== 0) code = r.code;
  }
  return code;
}

function needsTarget(args: string[]): boolean {
  return !args.some(
    (a) =>
      a === '--explain' || a === '--version' || a === '-V' || a === '-vV' || a === '--help' || a === '-h' ||
      a.startsWith('--print') || a === '--target' || a.startsWith('--target='),
  ) && args.some((a) => !a.startsWith('-'));
}

/** `rustc …`: single files compile to WebAssembly (`rustc main.rs` makes main.wasm). */
export async function rustc(s: Session, ctx: CargoContext, args: string[], cwd: string, env: Record<string, string>): Promise<number> {
  const argv = ['rustc', ...args];
  if (needsTarget(args)) argv.push('--target', ctx.target, '-C', `linker=${ctx.nld}/librust-lld.so`);
  if (!args.some((a) => a === '--color' || a.startsWith('--color='))) argv.push('--color', 'always');
  const r = await s.host(argv, cwd, env);
  return r.code;
}

/** Path the user typed for a program → the .wasm file that stands for it, or null. */
export function resolveProgram(ctx: CargoContext, typed: string, cwd: string): string | null {
  const abs = typed.startsWith('/') ? typed : `${cwd.replace(/\/+$/, '')}/${typed.replace(/^\.\//, '')}`;
  const cands = [abs, abs + '.wasm'];
  const mapped = abs.replace(/\/target\/(debug|release)\//, `/target/${ctx.target}/$1/`);
  if (mapped !== abs) cands.push(mapped, mapped + '.wasm');
  for (const c of cands) if (c.endsWith('.wasm') && ctx.exists(c)) return c;
  return null;
}

/** `./guessing_game`, `target/debug/minigrep the poem.txt` … */
export async function runProgram(s: Session, ctx: CargoContext, argv: string[], cwd: string, env: Record<string, string>): Promise<number> {
  const typed = argv[0];
  const wasm = resolveProgram(ctx, typed, cwd);
  if (!wasm) {
    const abs = typed.startsWith('/') ? typed : `${cwd}/${typed}`;
    s.err(ctx.exists(abs) ? `bash: ${typed}: Permission denied` : `bash: ${typed}: No such file or directory`);
    return ctx.exists(abs) ? 126 : 127;
  }
  const r = await s.wasm(wasm, argv, cwd, env);
  return r.code;
}

export function isProgramPath(cmd: string): boolean {
  return cmd.startsWith('./') || cmd.startsWith('../') || cmd.startsWith('/') || cmd.startsWith('target/');
}

const ALIASES: Record<string, string> = { b: 'build', c: 'check', r: 'run', t: 'test', d: 'doc' };

/** Dispatch one argv the way a shell with cargo and rustc installed would. */
export async function runCommand(s: Session, ctx: CargoContext, argv: string[], cwd: string, env: Record<string, string>): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === 'cargo') {
    const sub = ALIASES[rest[0]] ?? rest[0];
    const args = rest.slice(1);
    switch (sub) {
      case 'run':
        return cargoRun(s, ctx, args, cwd, env);
      case 'test': {
        if (args.includes('--no-run')) return (await s.host(['cargo', 'test', ...args], cwd, env)).code;
        return (await cargoTest(s, ctx, args, cwd, env)).code;
      }
      case 'clippy':
        return (await cargoClippy(s, ctx, args, cwd, env)).code;
      case 'fmt':
        return cargoFmt(s, args, cwd, env);
      case 'install':
        s.err(cargoError('`cargo install` builds native programs, which Android does not let apps run. Use `cargo run` in a project instead.'));
        return 101;
      default:
        return (await s.host(['cargo', ...rest], cwd, env)).code;
    }
  }
  if (cmd === 'rustc') return rustc(s, ctx, rest, cwd, env);
  if (cmd === 'rustfmt') {
    const args = rest.some((a) => a === '--edition' || a.startsWith('--edition=')) ? rest : ['--edition', '2024', ...rest];
    return (await s.host(['rustfmt', ...args], cwd, env)).code;
  }
  if (cmd === 'clippy-driver' || cmd === 'rust-lld') return (await s.host(argv, cwd, env)).code;
  if (isProgramPath(cmd)) return runProgram(s, ctx, argv, cwd, env);
  s.err(`bash: ${cmd}: command not found`);
  return 127;
}
