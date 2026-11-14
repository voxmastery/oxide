// Runs a Rust test binary (libtest) compiled to WebAssembly.
//
// WebAssembly has no unwinding in the prebuilt std, so Rust code on wasm32-wasip1(-threads)
// is panic=abort: the first failing test would end the whole harness before libtest prints its
// report, and libtest's output capture would swallow the panic message. libtest itself solves
// this for panic=abort targets (-Z panic-abort-tests) by running each test in its own process;
// this does the same with one WebAssembly instance per test:
//
//   1. `<bin> --list --format terse` (and `--ignored`) to learn the tests,
//   2. `<bin> <name> --exact --nocapture --test-threads=1` for each selected test,
//   3. print libtest's own report format (running N tests / test x ... ok / failures: / test
//      result: …) from the results.
//
// The per-test output (panic messages, assertion diffs, println!) is the program's real output.

import type { Session, Stream } from './proc';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

export type HarnessResult = { code: number; passed: number; failed: number; ignored: number; lines: string[] };

type Opts = {
  filters: string[];
  skip: string[];
  exact: boolean;
  ignored: boolean;
  includeIgnored: boolean;
  nocapture: boolean;
  color: boolean;
  passthrough: boolean;
};

function parseArgs(args: string[]): Opts {
  const o: Opts = { filters: [], skip: [], exact: false, ignored: false, includeIgnored: false, nocapture: false, color: true, passthrough: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--exact') o.exact = true;
    else if (a === '--ignored') o.ignored = true;
    else if (a === '--include-ignored') o.includeIgnored = true;
    else if (a === '--nocapture' || a === '--no-capture' || a === '--show-output') o.nocapture = true;
    else if (a === '--skip') o.skip.push(args[++i] ?? '');
    else if (a.startsWith('--skip=')) o.skip.push(a.slice(7));
    else if (a === '--color') o.color = (args[++i] ?? 'auto') !== 'never';
    else if (a.startsWith('--color=')) o.color = a.slice(8) !== 'never';
    else if (a === '--test-threads' || a === '--format' || a === '-Z' || a === '--logfile' || a === '--report-time') i++;
    else if (a.startsWith('--test-threads=') || a.startsWith('--format=') || a === '-q' || a === '--quiet') {
      // accepted, no effect: tests run one at a time
    } else if (a === '--list' || a === '--help' || a === '-h' || a === '--bench' || a.startsWith('--format')) o.passthrough = true;
    else if (a.startsWith('-')) o.passthrough = true; // unknown flag: let libtest answer
    else o.filters.push(a);
  }
  return o;
}

function selected(name: string, o: Opts): boolean {
  const match = (f: string) => (o.exact ? name === f : name.includes(f));
  if (o.filters.length && !o.filters.some(match)) return false;
  if (o.skip.some(match)) return false;
  return true;
}

/** Collect a child's output instead of showing it. */
async function capture(s: Session, wasm: string, args: string[], cwd: string, env: Record<string, string>) {
  const lines: { stream: Stream; line: string }[] = [];
  let open: { stream: Stream; line: string } | null = null;
  const r = await s.wasm(wasm, args, cwd, env, (stream, line, partial) => {
    if (open && open.stream === stream) {
      open.line += line;
      if (!partial) open = null;
    } else {
      const l = { stream, line };
      lines.push(l);
      open = partial ? l : null;
    }
    return true;
  });
  return { ...r, lines };
}

function listed(lines: { stream: Stream; line: string }[]): string[] {
  const names: string[] = [];
  for (const { stream, line } of lines) {
    if (stream !== 'stdout') continue;
    const m = /^(.*): (test|bench)$/.exec(line);
    if (m) names.push(m[1]);
  }
  return names;
}

const word = (color: boolean, c: string, w: string) => (color ? `${c}${w}${RESET}` : w);

/**
 * Runs the test binary `wasm` as `cargo test` would, emitting libtest's report on stdout.
 * `argv0` is the program name shown to the program (target/…/deps/x-hash.wasm).
 */
export async function runTestHarness(
  s: Session,
  wasm: string,
  argv0: string,
  userArgs: string[],
  cwd: string,
  env: Record<string, string>,
): Promise<HarnessResult> {
  const o = parseArgs(userArgs);
  const shown: string[] = [];
  const out = (line: string) => {
    shown.push(line);
    s.out(line);
  };

  if (o.passthrough) {
    const r = await s.wasm(wasm, [argv0, ...userArgs], cwd, env, (_st, line) => {
      shown.push(line);
    });
    return { code: r.code, passed: 0, failed: r.code ? 1 : 0, ignored: 0, lines: shown };
  }

  const t0 = Date.now();
  const all = await capture(s, wasm, [argv0, '--list', '--format', 'terse'], cwd, env);
  if (all.code !== 0) {
    for (const l of all.lines) s.emit(l.stream, l.line);
    return { code: all.code, passed: 0, failed: 0, ignored: 0, lines: all.lines.map((l) => l.line) };
  }
  const names = listed(all.lines);
  const ign = await capture(s, wasm, [argv0, '--list', '--format', 'terse', '--ignored'], cwd, env);
  const ignoredSet = new Set(ign.code === 0 ? listed(ign.lines) : []);

  const chosen = names.filter((n) => selected(n, o) && (!o.ignored || ignoredSet.has(n)));
  const filteredOut = names.length - chosen.length;

  out('');
  out(`running ${chosen.length} test${chosen.length === 1 ? '' : 's'}`);

  let passed = 0;
  let failed = 0;
  let ignored = 0;
  const failures: { name: string; lines: string[] }[] = [];

  for (const name of chosen) {
    if (s.killed) break;
    const isIgnored = ignoredSet.has(name);
    if (isIgnored && !o.ignored && !o.includeIgnored) {
      out(`test ${name} ... ${word(o.color, YELLOW, 'ignored')}`);
      ignored++;
      continue;
    }
    const args = [argv0, name, '--exact', '--nocapture', '--test-threads=1', '--color', 'never'];
    if (isIgnored) args.push('--include-ignored');

    const body: string[] = [];
    const open: Record<Stream, number> = { stdout: -1, stderr: -1 };
    let sawHeader = false;
    let headerOpen = false;
    const head = `test ${name} ... `;
    if (o.nocapture) s.emit('stdout', head, true);
    const r = await s.wasm(wasm, args, cwd, env, (stream, line, partial) => {
      // Drop libtest's framing of the single-test run; keep everything the test printed.
      let text = line;
      if (stream === 'stdout') {
        if (headerOpen) {
          // The continuation of "test x ... " is the verdict, or the test's own output.
          headerOpen = partial;
          if (/^(ok|FAILED|ignored)$/.test(text)) return true;
        } else if (!sawHeader && (text === '' || /^running 1 tests?$/.test(text))) {
          return true;
        } else if (open.stdout < 0 && text.startsWith(head)) {
          sawHeader = true;
          text = text.slice(head.length);
          headerOpen = partial;
          if (text === '' || /^(ok|FAILED|ignored)$/.test(text)) return true;
        } else if (/^test result: /.test(text) || /^(successes|failures):$/.test(text)) {
          return true;
        }
      }
      if (open[stream] >= 0) body[open[stream]] += text;
      else body.push(text);
      open[stream] = partial ? body.length - 1 : -1;
      if (o.nocapture) s.emit(stream, text, partial);
      return true;
    });
    // Trim the trailing blank lines libtest prints around its own report.
    while (body.length && body[body.length - 1] === '') body.pop();
    // Run alone, the test ran on the harness's main thread; natively libtest names the
    // thread after the test, and that is what the panic message shows.
    for (let k = 0; k < body.length; k++) {
      if (body[k].startsWith("thread 'main'")) body[k] = `thread '${name}'` + body[k].slice("thread 'main'".length);
    }
    const ok = r.code === 0;
    if (o.nocapture) out(word(o.color, ok ? GREEN : RED, ok ? 'ok' : 'FAILED'));
    else out(`${head}${word(o.color, ok ? GREEN : RED, ok ? 'ok' : 'FAILED')}`);
    if (ok) passed++;
    else {
      failed++;
      failures.push({ name, lines: body });
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(2);
  if (failures.length) {
    out('');
    out('failures:');
    out('');
    for (const f of failures) {
      out(`---- ${f.name} stdout ----`);
      for (const l of f.lines) out(l);
      out('');
    }
    out('');
    out('failures:');
    for (const f of failures) out(`    ${f.name}`);
  }
  out('');
  const status = failed ? word(o.color, RED, 'FAILED') : word(o.color, GREEN, 'ok');
  out(`test result: ${status}. ${passed} passed; ${failed} failed; ${ignored} ignored; 0 measured; ${filteredOut} filtered out; finished in ${secs}s`);
  out('');
  if (s.killed) return { code: 130, passed, failed, ignored, lines: shown };
  return { code: failed ? 101 : 0, passed, failed, ignored, lines: shown };
}
