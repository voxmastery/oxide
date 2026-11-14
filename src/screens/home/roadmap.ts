// Roadmap phases over the Book (the prototype's four phase names, mapped onto chapter ranges).
// The plan length comes from the daily goal (weeksForGoal); each phase gets a share of the weeks
// proportional to the Book sections it covers.
import { toc } from '../../content';
import type { AppData } from '../../state/app';
import { bookProgress, planDay, rustlingsProgress, weeksForGoal } from '../../state/selectors';

export const PHASES: { name: string; from: number; to: number }[] = [
  { name: 'Core Language', from: 1, to: 6 },     // basics, ownership, structs, enums
  { name: 'Idiomatic Rust', from: 7, to: 11 },   // modules, collections, errors, generics/traits, tests
  { name: 'Systems Depth', from: 12, to: 16 },   // I/O project, closures/iterators, Cargo, smart pointers, threads
  { name: 'Mastery', from: 17, to: 21 },         // async, OOP, patterns, advanced features, web server
];

const chapterNum = (id: string) => {
  const n = parseInt(id.split('.')[0], 10);
  return Number.isFinite(n) ? n : 21;
};

export const phaseOfChapter = (ch: number) => Math.max(0, PHASES.findIndex((p) => ch >= p.from && ch <= p.to));

/** Split `weeks` across phases by section count (largest remainder, at least one week each). */
function allocate(weeks: number): number[] {
  const w = PHASES.map((p) =>
    toc.chapters
      .filter((c) => typeof c.n === 'number' && c.n >= p.from && c.n <= p.to)
      .reduce((a, c) => a + Math.max(1, c.sections.length), 0),
  );
  const total = w.reduce((a, b) => a + b, 0) || 1;
  const raw = w.map((x) => Math.max(1, (x / total) * weeks));
  const out = raw.map(Math.floor);
  let left = weeks - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f);
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length].i]++;
  while (left < 0) { const i = out.indexOf(Math.max(...out)); out[i]--; left++; }
  return out;
}

export type RoadmapWeek = { n: number; state: 'done' | 'now' | 'todo' };
export type RoadmapPhase = { name: string; current: boolean; weeks: RoadmapWeek[] };

export function roadmap(s: AppData) {
  const total = weeksForGoal[s.plan.goal] ?? 12;
  const week = Math.min(planDay(s).week, total);
  const cur = phaseOfChapter(chapterNum(s.book.current));
  const alloc = allocate(total);
  let n = 0;
  const phases: RoadmapPhase[] = PHASES.map((p, i) => ({
    name: p.name,
    current: i === cur,
    weeks: Array.from({ length: alloc[i] }, () => {
      n++;
      return { n, state: n < week ? 'done' : n === week ? 'now' : 'todo' } as RoadmapWeek;
    }),
  }));
  const b = bookProgress(s);
  const r = rustlingsProgress(s);
  const pct = Math.floor(((b.read + r.done) / Math.max(1, b.total + r.total)) * 100);
  return { week, total, phase: PHASES[cur].name, phases, pct };
}
