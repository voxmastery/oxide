// Ferris's one plain-English line, derived from real compiler output: structured diagnostics in the
// Exercise sheet, rendered text in the Terminal. Never invents a cause: when nothing can be read from
// the output, there is no line (and no reaction).
import type { CheckResult, Diagnostic } from '../../toolchain/types';
import { inFile, primaryError } from '../../rust/explain';
import type { FerrisMood } from './Ferris';

/** The parts of one compiler error that Ferris talks about. */
export type ErrorFacts = {
  code: string | null;
  message: string;
  /** Primary line (1-based) in the user's file. */
  line: number | null;
  /** Label of the primary span ("expected `i32`, found `&str`"). */
  label: string | null;
  /** Where the value moved (E0382's "value moved here"). */
  movedLine: number | null;
};

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const stop = (s: string) => (/[.!?…”]$/.test(s) ? s : s + '.');
const firstTick = (s: string) => /`([^`]+)`/.exec(s)?.[1] ?? null;
const tick = (s: string | null, fallback: string) => (s ? `\`${s}\`` : fallback);

/** Shorten at a word boundary, keeping backtick pairs balanced. */
function short(s: string, max = 90): string {
  const one = s.split('\n')[0].trim();
  if (one.length <= max) return one;
  let cut = one.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  if (sp > max * 0.6) cut = cut.slice(0, sp);
  if ((cut.match(/`/g) ?? []).length % 2) cut = cut.slice(0, cut.lastIndexOf('`')).trimEnd();
  return cut.replace(/[,;:]$/, '') + '…';
}

/** One sentence about a compiler error. */
export function errorSentence(e: ErrorFacts): string {
  const n = e.line;
  const on = n ? ` on line ${n}` : '';
  const at = n ? ` (line ${n})` : '';
  const name = firstTick(e.message);
  switch (e.code) {
    case 'E0382':
      if (e.movedLine) return `Looks like ${tick(name, 'that value')} moved on line ${e.movedLine}.`;
      return `Looks like ${tick(name, 'a value')} is used after it moved${on}.`;
    case 'E0308': {
      const mm = /expected (.+?), found (.+)$/.exec(e.label ?? '') ?? /expected (.+?), found (.+)$/.exec(e.message);
      if (mm) return n ? `Line ${n} expects ${mm[1]} but gets ${mm[2]}.` : `Rust expected ${mm[1]} but got ${mm[2]}.`;
      return `The types don’t match${on}.`;
    }
    case 'E0425': return `Rust can’t find ${tick(name, 'that name')}${on}. Is it declared and spelled the same?`;
    case 'E0412': return `Rust can’t find the type ${tick(name, 'you used')}${on}.`;
    case 'E0384': return `${tick(name, 'That variable')} isn’t \`mut\`, so it can’t change${on}.`;
    case 'E0596': return `${tick(name, 'That value')} needs \`mut\` to be borrowed as mutable${at}.`;
    case 'E0499': return `${tick(name, 'A value')} is borrowed as mutable twice at once${at}.`;
    case 'E0502': return `${tick(name, 'A value')} is borrowed as mutable while another borrow is still in use${at}.`;
    case 'E0505': return `${tick(name, 'A value')} moves while it’s still borrowed${at}.`;
    case 'E0381': return `${tick(name, 'A variable')} is used before it has a value${at}.`;
    case 'E0106': return `A reference${on} needs a lifetime.`;
    case 'E0597': return `${tick(name, 'A value')} doesn’t live long enough${at}.`;
    case 'E0515': return `Line ${n ?? '?'} returns a reference to something that’s dropped when the function ends.`;
    case 'E0507': return `Something${on} tries to move out of a borrow.`;
    case 'E0373': return `A closure${on} borrows something it might outlive. \`move\` may help.`;
    case 'E0004': return `The \`match\`${on} doesn’t cover every case yet.`;
    case 'E0061': return `A call${on} has the wrong number of arguments.`;
    case 'E0599': return `There’s no ${tick(name, 'such')} method for that type${at}.`;
    case 'E0433': return `Rust can’t resolve a path${on}. Is a \`use\` missing?`;
    case 'E0432': return `An import${on} doesn’t point to anything Rust can find.`;
    case 'E0369': return `That operator doesn’t work on these types${at}.`;
    case 'E0282': return `Rust needs a type annotation${on}.`;
    case 'E0603': case 'E0616': case 'E0624': return `${tick(name, 'That item')} is private${at}.`;
    case 'E0063': {
      const mm = /missing fields? (.+?) in initializer of `([^`]+)`/.exec(e.message);
      return mm ? `\`${mm[2]}\` is missing ${mm[1]}${at}.` : `A struct${on} is missing a field.`;
    }
    default:
      if (!e.message) return n ? `Something on line ${n} doesn’t compile.` : 'It doesn’t compile yet.';
      if (!e.code && n) return stop(`Line ${n}: ${short(e.message, 80)}`);
      return stop(cap(short(e.message)) + at);
  }
}

function panicSentence(p: { message: string; line: number | null }): string {
  const msg = short(p.message.replace(/^'|'$/g, ''), 64);
  if (p.line) return msg ? `It compiles, then panics on line ${p.line}: “${msg}”` : `It compiles, then panics on line ${p.line}.`;
  return msg ? `It compiles, then panics: “${msg}”` : 'It compiles, then panics.';
}

// ---------------------------------------------------------------------------
// Exercise sheet (structured result)
// ---------------------------------------------------------------------------

function factsFrom(d: Diagnostic, exercise: string): ErrorFacts {
  const mine = d.spans.filter((s) => inFile(s.file, exercise));
  const prim = mine.find((s) => s.primary) ?? d.spans.find((s) => s.primary) ?? mine[0];
  const all = [...d.spans, ...d.children.flatMap((c) => c.spans)];
  const moved = all.find((s) => !s.primary && /moved/.test(s.label ?? '') && inFile(s.file, exercise));
  return { code: d.code, message: d.message, line: prim?.lineStart ?? null, label: prim?.label ?? null, movedLine: moved?.lineStart ?? null };
}

export type Reaction = { mood: FerrisMood; text: string; nudge?: boolean };

/**
 * Ferris's reaction to a Check result. `failures` is the number of failed Checks so far, including
 * this one; from the second one on, Ferris offers a nudge (Hints).
 */
export function checkReaction(r: CheckResult, exercise: string, failures: number): Reaction | null {
  if (r.outcome === 'pass') {
    const tests = r.lines.some((l) => /test result: ok/.test(l));
    return { mood: 'celebrating', text: tests ? 'All tests pass. Nicely done.' : 'It runs clean. Nicely done.' };
  }
  const d = primaryError(r, exercise);
  let text: string;
  if (d && r.outcome === 'compile-error') text = errorSentence(factsFrom(d, exercise));
  else if (r.panic) text = panicSentence({ message: r.panic.message, line: inFile(r.panic.file, exercise) ? r.panic.line : null });
  else if (d) text = errorSentence(factsFrom(d, exercise));
  else if (r.outcome === 'test-failed') text = 'It compiles, but a test fails. The output shows which one.';
  else return null;
  return failures >= 2 ? { mood: 'thinking', text, nudge: true } : { mood: 'worried', text };
}

// ---------------------------------------------------------------------------
// Terminal (rendered text)
// ---------------------------------------------------------------------------

const ERR = /^error(?:\[(E\d{4})\])?: (.*)$/;
const META = /^error: (could not compile|aborting due to|test failed|process didn't exit successfully)/;

/** Ferris's line for a failed cargo/rustc command, from its plain-text output. */
export function terminalSentence(lines: string[]): string | null {
  // 1. A compiler error.
  const i = lines.findIndex((l) => ERR.test(l) && !META.test(l));
  if (i >= 0) {
    const [, code, message] = ERR.exec(lines[i])!;
    if (/could not find `Cargo\.toml`/.test(message)) return 'There’s no Cargo project here. `cd` into one, or make one with `cargo new`.';
    if (/no such command/.test(message)) return stop(cap(short(message)));
    let line: number | null = null;
    let label: string | null = null;
    let movedLine: number | null = null;
    let lastNo: number | null = null;
    for (let j = i + 1; j < lines.length && j < i + 60; j++) {
      const l = lines[j];
      if (/^(error|warning)/.test(l)) break;
      const at = /-->\s+(.+?):(\d+):(\d+)/.exec(l);
      if (at && line === null) { line = Number(at[2]); continue; }
      const num = /^\s*(\d+)\s+\|/.exec(l);
      if (num) { lastNo = Number(num[1]); continue; }
      if (!/^\s*\|/.test(l)) continue;
      const prim = /\^+\s+(.+)$/.exec(l);
      if (prim && label === null) label = prim[1].trim();
      if (movedLine === null && /[-^]+\s+value moved/.test(l)) movedLine = lastNo;
    }
    return errorSentence({ code: code ?? null, message, line, label, movedLine });
  }

  // 2. Failing tests.
  const tr = lines.map((l) => /^test result: FAILED\. (\d+) passed; (\d+) failed/.exec(l)).find(Boolean);
  const panicAt = lines.findIndex((l) => /panicked at/.test(l));
  let panic: { message: string; line: number | null } | null = null;
  if (panicAt >= 0) {
    const l = lines[panicAt];
    const old = /panicked at '(.*)', .+?:(\d+):\d+/.exec(l);
    const now = /panicked at .+?:(\d+):\d+:?\s*$/.exec(l);
    if (old) panic = { message: old[1], line: Number(old[2]) };
    else if (now) panic = { message: (lines[panicAt + 1] ?? '').trim(), line: Number(now[1]) };
    else panic = { message: '', line: null };
  }
  if (tr) {
    const failed = Number(tr[2]);
    const head = `It compiles, but ${failed} ${failed === 1 ? 'test fails' : 'tests fail'}.`;
    return panic?.line ? `${head} The first one panics on line ${panic.line}.` : head;
  }

  // 3. A panic while running.
  if (panic) return panicSentence(panic);

  // 4. The program exited with an error code.
  const ex = lines.map((l) => /process didn't exit successfully: .*\(exit (?:status|code): (\d+)\)/.exec(l)).find(Boolean);
  if (ex) return `It compiles and runs, then exits with status ${ex[1]}.`;
  return null;
}
