// Derived values. Pure functions over AppData + content; screens call these with useApp(s => …).
import { rustlings, toc, sectionById } from '../content';
import { today, type AppData, type Mission, type MissionStep } from './app';

// ---------- Levels ----------
// Spec: Lv 1 0–300 "Hello, World"; Lv 7 "Borrow Checker Apprentice" up to 2,400; Lv 8 "Struct Builder" up to 3,100.
// The rest are ours (spec: "Define the remaining titles and thresholds"); titles follow the Book's order.
export const LEVELS: { lv: number; from: number; title: string; next: string }[] = [
  { lv: 1, from: 0, title: 'Hello, World', next: 'Chapter 2 is next: a guessing game with real input.' },
  { lv: 2, from: 300, title: 'Cargo Cadet', next: 'Chapter 3 is next: variables, types and functions.' },
  { lv: 3, from: 600, title: 'Variable Binder', next: 'Keep going through common programming concepts.' },
  { lv: 4, from: 900, title: 'Type Annotator', next: 'Control flow and your first Rustlings quiz are next.' },
  { lv: 5, from: 1200, title: 'Loop Runner', next: 'Chapter 4 is next: ownership, the heart of Rust.' },
  { lv: 6, from: 1500, title: 'Owner', next: 'References and borrowing are next.' },
  { lv: 7, from: 1800, title: 'Borrow Checker Apprentice', next: 'Slices, then structs.' },
  { lv: 8, from: 2400, title: 'Struct Builder', next: 'Chapter 5 is next: structs, methods and grouping related data.' },
  { lv: 9, from: 3100, title: 'Pattern Matcher', next: 'Enums and match are next.' },
  { lv: 10, from: 3900, title: 'Module Maker', next: 'Packages, crates and modules are next.' },
  { lv: 11, from: 4800, title: 'Collector', next: 'Error handling is next.' },
  { lv: 12, from: 5800, title: 'Error Handler', next: 'Generics, traits and lifetimes are next.' },
  { lv: 13, from: 6900, title: 'Trait Implementer', next: 'Tests and your I/O project are next.' },
  { lv: 14, from: 8100, title: 'Lifetime Annotator', next: 'Iterators and closures are next.' },
  { lv: 15, from: 9400, title: 'Iterator Chainer', next: 'Smart pointers are next.' },
  { lv: 16, from: 10800, title: 'Smart Pointer', next: 'Fearless concurrency is next.' },
  { lv: 17, from: 12300, title: 'Fearless', next: 'Async, patterns and advanced features are next.' },
  { lv: 18, from: 13900, title: 'Async Awaiter', next: 'The final project is next.' },
  { lv: 19, from: 15600, title: 'Rustacean', next: 'Build something of your own.' },
];

export function levelOf(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].from) i++;
  const cur = LEVELS[i];
  const nxt = LEVELS[i + 1];
  const to = nxt ? nxt.from : cur.from + 2000;
  return { level: cur.lv, title: cur.title, from: cur.from, to, /** The design's XP bars show total XP against the next threshold (1,840 / 2,400). */
    frac: xp / to, toNext: to - xp, nextLv: cur.lv + 1, nextFrom: to, nextTo: LEVELS[i + 2]?.from, blurb: nxt ? LEVELS[i + 1].next : cur.next };
}

// ---------- Dates, streak ----------
const DAY = 864e5;
const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

export function planDay(s: Pick<AppData, 'startDate'>, date = new Date()) {
  if (!s.startDate) return { week: 1, day: 1, index: 0 };
  const idx = Math.max(0, Math.round((parse(today(date)).getTime() - parse(s.startDate).getTime()) / DAY));
  return { week: Math.floor(idx / 7) + 1, day: (idx % 7) + 1, index: idx };
}

export function streak(s: Pick<AppData, 'days' | 'bestStreak'>) {
  let n = 0;
  const d = new Date();
  const t = s.days[today(d)];
  const counts = (x?: { goalMet: boolean; missionDone?: boolean }) => !!x && (x.goalMet || !!x.missionDone);
  if (counts(t)) n = 1;
  // Today doesn't break the streak until midnight.
  for (let i = 1; i < 4000; i++) {
    const x = new Date(d); x.setDate(d.getDate() - i);
    if (counts(s.days[today(x)])) n++; else break;
  }
  return { current: n, best: Math.max(s.bestStreak, n) };
}

export const todayLog = (s: Pick<AppData, 'days'>) => s.days[today()] ?? { minutes: 0, exercises: 0, sections: 0, goalMet: false };

export const weeksForGoal: Record<number, number> = { 10: 36, 20: 18, 30: 12, 45: 8 };

// ---------- Progress ----------
export function bookProgress(s: Pick<AppData, 'book'>) {
  const numbered = toc.chapters.filter((c) => c.n !== 'A').flatMap((c) => c.sections.length ? c.sections.map((x) => x.id) : c.n === 2 ? ['2'] : []);
  const read = numbered.filter((id) => s.book.read[id]).length;
  // Numbered sections plus chapter 2 (a single page) = the design's "of 80 sections".
  return { read, total: numbered.length, current: s.book.current, frac: read / Math.max(1, numbered.length) };
}

export function rustlingsProgress(s: Pick<AppData, 'ex'>) {
  const done = rustlings.order.filter((n) => s.ex[n]?.status === 'done').length;
  const next = rustlings.order.find((n) => s.ex[n]?.status !== 'done') ?? null;
  return { done, total: rustlings.total, next, frac: done / Math.max(1, rustlings.total) };
}

export const isDone = (s: Pick<AppData, 'ex' | 'book' | 'helloRan'>, st: MissionStep) =>
  st.kind === 'read' ? !!s.book.read[st.id] : st.kind === 'ex' ? s.ex[st.id]?.status === 'done' : s.helloRan;

// ---------- Daily mission ----------
/** Built once per day from the Book position and Rustlings' chapter map, then frozen. */
export function buildMission(s: AppData, date = today()): Mission {
  const existing = s.missions[date];
  if (existing) return existing;
  const pd = planDay(s);
  if (pd.index === 0 && !s.helloRan) {
    return {
      date, day1: true, mins: 15, title: 'Write and run your first Rust program',
      steps: [{ kind: 'read', id: '1.1' }, { kind: 'read', id: '1.2' }, { kind: 'term', cmd: 'cargo new hello_world', project: 'hello_world' }],
    };
  }
  const order = toc.chapters.flatMap((c) => (c.sections.length ? c.sections.map((x) => x.id) : [String(c.n)]));
  const nextRead = order.find((id) => !s.book.read[id]) ?? null;
  const steps: MissionStep[] = [];
  if (nextRead) steps.push({ kind: 'read', id: nextRead });
  const todo = rustlings.order.filter((n) => s.ex[n]?.status !== 'done');
  const exCount = s.plan.goal >= 30 ? 3 : s.plan.goal >= 20 ? 2 : 1;
  todo.slice(0, exCount).forEach((n) => steps.push({ kind: 'ex', id: n }));
  const sec = nextRead ? sectionById(nextRead) : null;
  const n = steps.filter((x) => x.kind === 'ex').length;
  const title = nextRead && n ? `Read ${nextRead}, then ${n} Rustlings exercise${n > 1 ? 's' : ''}` : nextRead ? `Read ${nextRead}` : `${n} Rustlings exercises`;
  return { date, title, steps, mins: (sec?.mins ?? 0) + n * 8 };
}
