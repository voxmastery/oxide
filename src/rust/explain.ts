// rustc diagnostics → the Exercise "Explain" walkthrough, line marks and sheet status.
// Everything shown comes from the compiler's own JSON diagnostics (labels, help suggestions),
// the rustc error index (src/content errors) and the official Rustlings solution.
import type { CheckResult, Diagnostic } from '../toolchain/types';
import type { Inline, SectionId } from '../content/types';
import { errors } from '../content';
import type { Mark, MarkKind } from './highlight';
import { changedLines, type DiffLine } from './diff';

/** rustc JSON spans carry `suggested_replacement` for machine-applicable help. */
type Span = Diagnostic['spans'][number] & { suggestedReplacement?: string | null; suggested_replacement?: string | null };

export type ExplainStep = { line: number | null; text: string; ok: boolean };
export type ExplainFix = {
  label: string;
  /** Code to show (rust). */
  code?: string;
  /** Or a compact diff (the official solution). */
  diff?: DiffLine[];
  note: string;
  apply?: (code: string) => string;
  /** Applying it means "solution applied" (10 XP). */
  isSolution?: boolean;
};
export type Explanation = {
  kind: 'error' | 'panic';
  code: string | null;
  /** rustc's message, e.g. "borrow of moved value: `vec0`". */
  title: string;
  lead: string;
  steps: ExplainStep[];
  fixes: ExplainFix[];
  read?: SectionId;
  /** Error code for `rustc --explain`. */
  rustc?: string;
  line: number | null;
};

const inlineText = (xs: Inline[]): string => xs.map((x) => (x.k === 't' ? x.v : x.k === 'code' ? '`' + x.v + '`' : inlineText(x.c))).join('');

/** First paragraph of the rustc error index entry ("A variable was used after its contents have been moved elsewhere."). */
export function errorLead(code: string | null): string | null {
  if (!code) return null;
  const doc = errors[code];
  const p = doc?.blocks.find((b) => b.type === 'p');
  return p && p.type === 'p' ? inlineText(p.text) : doc?.title ?? null;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const inFile = (file: string, exercise: string) => {
  const base = file.split(/[\\/]/).pop() ?? file;
  return base === `${exercise}.rs`;
};

/** The diagnostic the walkthrough is about: the first error with spans in the exercise file. */
export function primaryError(result: CheckResult, exercise: string): Diagnostic | null {
  const errs = result.diagnostics.filter((d) => d.level === 'error');
  return errs.find((d) => d.code && d.spans.some((s) => inFile(s.file, exercise)))
    ?? errs.find((d) => d.spans.some((s) => inFile(s.file, exercise)))
    ?? errs.find((d) => d.code)
    ?? errs[0]
    ?? null;
}

export function primaryLine(d: Diagnostic | null, exercise: string): number | null {
  const sp = d?.spans.find((s) => s.primary && inFile(s.file, exercise)) ?? d?.spans.find((s) => inFile(s.file, exercise));
  return sp ? sp.lineStart : null;
}

/** Line marks from diagnostics (errors and warnings, primary spans) and a panic location. */
export function marksFrom(result: CheckResult | null, exercise: string, code: string): Mark[] {
  if (!result) return [];
  const lines = code.split('\n');
  const out: Mark[] = [];
  for (const d of result.diagnostics) {
    const kind: MarkKind | null = d.level === 'error' ? 'err' : d.level === 'warning' ? 'warn' : null;
    if (!kind) continue;
    for (const s of d.spans) {
      if (!s.primary || !inFile(s.file, exercise)) continue;
      const len = s.lineEnd === s.lineStart ? Math.max(1, s.colEnd - s.colStart) : Math.max(1, (lines[s.lineStart - 1]?.length ?? 0) - s.colStart + 1);
      out.push({ line: s.lineStart, col: s.colStart, len, kind });
    }
  }
  if (result.panic && inFile(result.panic.file, exercise)) {
    const l = lines[result.panic.line - 1] ?? '';
    const ind = l.length - l.trimStart().length;
    out.push({ line: result.panic.line, col: ind + 1, len: Math.max(1, l.trim().length), kind: 'run' });
  }
  return out;
}

function offsetOf(lines: string[], line: number, col: number) {
  let o = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) o += lines[i].length + 1;
  return o + col - 1;
}

/** Apply a help child's suggested replacements to the file. */
function applySuggestion(code: string, spans: Span[]): string {
  const lines = code.split('\n');
  const edits = spans
    .map((s) => ({ a: offsetOf(lines, s.lineStart, s.colStart), b: offsetOf(lines, s.lineEnd, s.colEnd), r: (s.suggestedReplacement ?? s.suggested_replacement) as string }))
    .sort((x, y) => y.a - x.a);
  let out = code;
  for (const e of edits) out = out.slice(0, e.a) + e.r + out.slice(e.b);
  return out;
}

function dedent(ls: string[]) {
  const ind = Math.min(...ls.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
  return ls.map((l) => l.slice(Number.isFinite(ind) ? ind : 0)).join('\n');
}

function suggestionFixes(d: Diagnostic, code: string, exercise: string): ExplainFix[] {
  const fixes: ExplainFix[] = [];
  const walk = (x: Diagnostic) => {
    for (const c of x.children) {
      const spans = (c.spans as Span[]).filter((s) => inFile(s.file, exercise) && (s.suggestedReplacement ?? s.suggested_replacement) != null);
      if (c.level === 'help' && spans.length) {
        const apply = (src: string) => applySuggestion(src, spans);
        const after = apply(code).split('\n');
        const first = Math.min(...spans.map((s) => s.lineStart));
        const delta = after.length - code.split('\n').length;
        const last = Math.max(...spans.map((s) => s.lineEnd)) + Math.max(0, delta);
        const lines = after.slice(first - 1, last);
        fixes.push({
          label: cap(c.message.replace(/:$/, '')),
          code: dedent(lines),
          note: `rustc’s suggestion for line ${first}.`,
          apply,
        });
      }
      walk(c);
    }
  };
  walk(d);
  return fixes;
}

export function solutionFix(original: string, solution: string, xp: number): ExplainFix | null {
  if (!solution) return null;
  const diff = changedLines(original, solution);
  if (!diff.length) return null;
  return {
    label: 'Use the official solution',
    diff,
    note: `From Rustlings. Passing with the solution applied earns 10 XP instead of ${xp}.`,
    apply: () => solution,
    isSolution: true,
  };
}

/** Build the walkthrough for a failed Check. Returns null when there is nothing to explain. */
export function buildExplanation(opts: {
  result: CheckResult;
  exercise: string;
  code: string;
  /** Section the exercise's topic drills (fallback for "Read …"). */
  topicSection?: SectionId;
  /** Present when the solution is unlocked. */
  solution?: ExplainFix | null;
}): Explanation | null {
  const { result, exercise, code, topicSection, solution } = opts;
  if (result.outcome === 'pass') return null;
  const d = primaryError(result, exercise);
  if (d && result.outcome === 'compile-error') {
    const steps: ExplainStep[] = [];
    const seen = new Set<string>();
    for (const s of [...d.spans].filter((x) => inFile(x.file, exercise)).sort((a, b) => a.lineStart - b.lineStart || a.colStart - b.colStart)) {
      const text = s.label ?? (s.primary ? d.message : null);
      if (!text) continue;
      const k = s.lineStart + '|' + text;
      if (seen.has(k)) continue;
      seen.add(k);
      steps.push({ line: s.lineStart, text: cap(text), ok: !s.primary });
    }
    if (!steps.length) steps.push({ line: primaryLine(d, exercise), text: cap(d.message), ok: false });
    // Notes with a span in the file (e.g. "this parameter takes ownership of the value").
    for (const c of d.children) {
      for (const s of c.spans) if (inFile(s.file, exercise) && s.label && !(s as Span).suggestedReplacement && !(s as Span).suggested_replacement) {
        const k = s.lineStart + '|' + s.label;
        if (!seen.has(k)) { seen.add(k); steps.push({ line: s.lineStart, text: cap(s.label), ok: true }); }
      }
    }
    steps.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
    const fixes = suggestionFixes(d, code, exercise);
    if (solution) fixes.push(solution);
    const lead = errorLead(d.code) ?? cap(d.message);
    return {
      kind: 'error', code: d.code, title: d.message, lead, steps, fixes,
      read: (d.code && errors[d.code]?.section) || topicSection, rustc: d.code ?? undefined, line: primaryLine(d, exercise),
    };
  }
  if (result.panic) {
    const p = result.panic;
    const here = inFile(p.file, exercise);
    const steps: ExplainStep[] = [{ line: here ? p.line : null, text: p.message, ok: false }];
    return {
      kind: 'panic', code: null, title: p.message,
      lead: `The code compiled, but it panicked${here ? ` at line ${p.line}` : ''}. A panic stops the program, so the test fails. Rust printed this message:`,
      steps, fixes: solution ? [solution] : [], read: topicSection, line: here ? p.line : null,
    };
  }
  if (d) {
    return { kind: 'error', code: d.code, title: d.message, lead: errorLead(d.code) ?? cap(d.message), steps: [{ line: primaryLine(d, exercise), text: cap(d.message), ok: false }], fixes: solution ? [solution] : [], read: (d.code && errors[d.code]?.section) || topicSection, rustc: d.code ?? undefined, line: primaryLine(d, exercise) };
  }
  return null;
}
