// Which "auto" badges the current app state has earned. Pure; <BadgeWatcher/> awards the result.
import { rustlings, toc } from '../../content';
import type { AppData } from '../../state/app';
import { levelOf, rustlingsProgress, streak } from '../../state/selectors';
import { BOOK_PARTS, OWNERSHIP_CORE } from './defs';

const partSections = (chapters: number[]) =>
  toc.chapters
    .filter((c) => typeof c.n === 'number' && chapters.includes(c.n))
    .flatMap((c) => (c.sections.length ? c.sections.map((x) => x.id) : [String(c.n)]));

const PARTS = BOOK_PARTS.map((p) => ({ id: p.id, sections: partSections(p.chapters) }));

export function earnedFromState(s: AppData): string[] {
  const out: string[] = [];
  const done = (n: string) => s.ex[n]?.status === 'done';

  if (s.helloRan) out.push('hello-world');
  if (rustlings.order.some(done)) out.push('first-pass');
  if (rustlings.path.some((n) => n.t === 'quiz' && done(n.exercise))) out.push('first-checkpoint');
  if (levelOf(s.xp).level >= 10) out.push('level-10');
  const rl = rustlingsProgress(s);
  if (rl.total > 0 && rl.done >= rl.total) out.push('rustlings-all');

  const best = streak(s).best;
  if (best >= 7) out.push('streak-7');
  if (best >= 30) out.push('streak-30');
  if (best >= 100) out.push('streak-100');

  const met = Object.keys(s.fixed).filter((c) => (s.fixed[c] ?? 0) > 0);
  if (met.length >= 1) out.push('errors-first');
  if (met.length >= 10) out.push('errors-10');
  if (OWNERSHIP_CORE.every((c) => (s.fixed[c] ?? 0) > 0)) out.push('ownership-all');

  for (const p of PARTS) if (p.sections.length && p.sections.every((id) => s.book.read[id])) out.push(p.id);

  for (const n of rustlings.path) if (n.t === 'topic' && n.exercises.length && n.exercises.every(done)) out.push(`topic-${n.name}`);
  return out;
}
