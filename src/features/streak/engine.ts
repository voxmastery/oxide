// Streak with freezes, derived from the day log. Pure: same inputs → same answer.
//
// Rules
// - A day counts when the daily goal is met, the daily mission is done, or a rescue mission was finished.
// - Freezes are earned for every passed Rustlings checkpoint quiz (quiz1, quiz2, quiz3: on the day it was
//   passed) and every time the streak reaches a multiple of 7 days. At most 2 are held; extra ones are lost.
// - A missed day (any day before today that doesn't count) while a streak is running uses one freeze
//   automatically. The streak survives but frozen days don't add to its length. With no freeze left the
//   streak ends.
// - Today never breaks or freezes anything until it is over.
import { rustlings } from '../../content';
import { today, type DayLog, type ExerciseState } from '../../state/app';
import type { Rescue } from './store';

export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

export type FreezeEvent = { date: string; kind: 'earned' | 'used' | 'lost'; reason?: 'quiz' | 'streak'; quiz?: string };

export type StreakInfo = {
  current: number;
  best: number;
  /** Freezes held now (0..2). */
  freezes: number;
  /** Every day a freeze covered, oldest first (YYYY-MM-DD). */
  frozenDays: string[];
  /** Days that counted only because a rescue mission was finished. */
  rescuedDays: string[];
  /** Whether today already counts. */
  todayCounts: boolean;
  /** Freezes used for the days right before today (consecutive, ending yesterday): 0, 1 or 2. */
  usedRecently: number;
  /** Earned/used history, oldest first (for the Streak sheet and toasts). */
  events: FreezeEvent[];
};

type Input = {
  days: Record<string, DayLog>;
  bestStreak: number;
  ex?: Record<string, ExerciseState>;
  rescues?: Record<string, Rescue>;
};

const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (iso: string, n: number) => { const d = parse(iso); d.setDate(d.getDate() + n); return today(d); };

const QUIZZES = rustlings.order.filter((n) => rustlings.exercises[n]?.difficulty === 'Quiz');

/** Did this rescue get finished (explicitly, or by passing any exercise that day after it was offered)? */
export function rescueDone(r: Rescue | undefined, ex: Record<string, ExerciseState> | undefined): boolean {
  if (!r) return false;
  if (r.doneAt) return true;
  if (!ex) return false;
  return Object.values(ex).some((e) => e.status === 'done' && !!e.passedAt && e.passedAt >= r.offeredAt && today(new Date(e.passedAt)) === r.date);
}

export const dayCounts = (d: DayLog | undefined) => !!d && (d.goalMet || !!d.missionDone);

let memo: { key: unknown[]; res: StreakInfo } | null = null;

export function computeStreak(s: Input, now = new Date()): StreakInfo {
  const t0 = today(now);
  const key = [s.days, s.bestStreak, s.ex, s.rescues, t0];
  if (memo && memo.key.every((k, i) => k === key[i])) return memo.res;

  // Quiz passes by date.
  const quizOn = new Map<string, string[]>();
  for (const q of QUIZZES) {
    const e = s.ex?.[q];
    if (e?.status === 'done' && e.passedAt) {
      const d = today(new Date(e.passedAt));
      quizOn.set(d, [...(quizOn.get(d) ?? []), q]);
    }
  }
  const rescued = new Set<string>();
  for (const [d, r] of Object.entries(s.rescues ?? {})) if (rescueDone(r, s.ex)) rescued.add(d);
  const counts = (d: string) => dayCounts(s.days[d]) || rescued.has(d);

  const starts = [...Object.keys(s.days), ...quizOn.keys(), ...rescued].filter((d) => d <= t0).sort();
  let cur = 0, best = 0, held = 0;
  const frozenDays: string[] = [];
  const rescuedDays: string[] = [];
  const events: FreezeEvent[] = [];
  const earn = (d: string, reason: 'quiz' | 'streak', quiz?: string) => {
    if (held < MAX_FREEZES) { held++; events.push({ date: d, kind: 'earned', reason, quiz }); }
    else events.push({ date: d, kind: 'lost', reason, quiz });
  };

  if (starts.length) {
    for (let d = starts[0], guard = 0; d <= t0 && guard < 20000; d = addDays(d, 1), guard++) {
      for (const q of quizOn.get(d) ?? []) earn(d, 'quiz', q);
      if (counts(d)) {
        cur++;
        if (!dayCounts(s.days[d])) rescuedDays.push(d);
        if (cur % FREEZE_EVERY === 0) earn(d, 'streak');
      } else if (d !== t0) {
        if (cur > 0 && held > 0) { held--; frozenDays.push(d); events.push({ date: d, kind: 'used' }); }
        else cur = 0;
      }
      best = Math.max(best, cur);
    }
  }

  let usedRecently = 0;
  for (let d = addDays(t0, -1); frozenDays.includes(d); d = addDays(d, -1)) usedRecently++;

  const res: StreakInfo = {
    current: cur,
    best: Math.max(s.bestStreak, best),
    freezes: held,
    frozenDays,
    rescuedDays,
    todayCounts: counts(t0),
    usedRecently: cur > 0 ? usedRecently : 0,
    events,
  };
  memo = { key, res };
  return res;
}

/** "1 freeze used yesterday" / "2 freezes used: yesterday and the day before", or null. */
export function freezeNotice(st: Pick<StreakInfo, 'usedRecently'>): string | null {
  if (st.usedRecently <= 0) return null;
  if (st.usedRecently === 1) return '1 freeze used yesterday';
  if (st.usedRecently === 2) return '2 freezes used: yesterday and the day before';
  return `${st.usedRecently} freezes used over the last ${st.usedRecently} days`;
}
