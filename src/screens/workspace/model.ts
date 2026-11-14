// Exercise screen data derived from Rustlings content + the prototype's curated copy.
import { exercise as getExercise, topicOf, type RustlingsExercise } from '../../content';
import { changedLines, type DiffLine } from '../../rust/diff';
import type { SolutionPolicy } from '../../state/app';
import { CURATED } from './curated';

/** Official hints are hard-wrapped at 80 columns; reflow paragraphs, keep lists and blank lines. */
export function reflow(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => para.split('\n').reduce((acc, line, i) => {
      if (i === 0) return line;
      const keep = /^\s*([-*+]|\d+[.)])\s/.test(line) || /^\s{4,}/.test(line) || /^https?:\/\//.test(line.trim());
      return acc + (keep ? '\n' : ' ') + (keep ? line : line.trim());
    }, ''))
    .join('\n\n');
}

export function firstSentence(text: string): string {
  const flat = reflow(text).split('\n\n')[0];
  const m = flat.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : flat).trim();
}

export type HintCard =
  | { kind: 'NUDGE' | 'FROM RUSTLINGS' | 'ANSWER'; text: string; diff?: undefined }
  | { kind: 'ANSWER'; text?: undefined; diff: DiffLine[] };

export function hintsFor(ex: RustlingsExercise): HintCard[] {
  const cur = CURATED[ex.name];
  const official = reflow(ex.hint || '');
  const diff = ex.solution ? changedLines(ex.code, ex.solution) : [];
  return [
    { kind: 'NUDGE', text: cur?.nudge ?? firstSentence(ex.hint || '') },
    { kind: 'FROM RUSTLINGS', text: official },
    cur ? { kind: 'ANSWER', text: cur.answer } : diff.length ? { kind: 'ANSWER', diff } : { kind: 'ANSWER', text: 'The official solution doesn’t change any lines.' },
  ];
}

export function exerciseMeta(name: string) {
  const ex = getExercise(name);
  if (!ex) return null;
  const node = topicOf(name);
  const secs = node && node.t === 'topic' ? node.secs : [];
  const tests = (ex.code.match(/#\[test\]/g) ?? []).length;
  const diff = ex.difficulty === 'Medium' ? 2 : ex.difficulty === 'Quiz' ? 3 : 1;
  return {
    ex,
    subtitle: CURATED[name]?.subtitle ?? ex.summary,
    topicLabel: `${ex.topic} · ${ex.index} of ${ex.of}`,
    diff,
    diffLabel: ex.difficulty,
    tests,
    testsLabel: tests ? (tests === 1 ? '1 test' : `${tests} tests`) : 'runs main()',
    section: secs[0] as string | undefined,
    curated: CURATED[name],
  };
}

export function solutionUnlocked(policy: SolutionPolicy, st: { attempts: number; status: string; solutionViewed: boolean } | undefined) {
  if (!st) return false;
  if (st.solutionViewed) return true;
  if (policy === 'never') return false;
  if (st.status === 'done') return true;
  return policy === 'after3' && st.attempts >= 3;
}

export const fmtDuration = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};
