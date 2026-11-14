// SM-2 style scheduling (the Anki variant of SuperMemo 2), in whole days.
//
// Each card keeps an ease factor (starts at 2.5, kept within 1.3–3.0), the current interval in days and the
// number of successful reviews in a row (reps).
//   Again: reps → 0, ease − 0.20, due tomorrow (and shown once more at the end of the session).
//   Hard:  first 1 d, second 2 d, then interval × 1.2 (at least +1 d); ease − 0.15.
//   Good:  first 1 d, second 3 d, then interval × ease.
//   Easy:  first 3 d, second 5 d, then interval × ease × 1.3; ease + 0.15.
// Intervals are capped at 365 days.
import { today } from '../../state/app';

export type Grade = 'again' | 'hard' | 'good' | 'easy';
export const GRADES: Grade[] = ['again', 'hard', 'good', 'easy'];

export type CardSched = {
  ease: number;
  interval: number;   // days
  reps: number;
  lapses: number;
  due: string;        // YYYY-MM-DD
  last: string;       // YYYY-MM-DD of the last review
  reviews: number;
};

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const MAX_IVL = 365;

const clampEase = (e: number) => Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, e)) * 100) / 100;

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return today(new Date(y, m - 1, d + n));
}

/** The interval (days) a grade would give; used for the labels under the grade buttons. */
export function nextInterval(c: CardSched | undefined, g: Grade): number {
  const reps = c?.reps ?? 0;
  const ivl = c?.interval ?? 0;
  const ease = c?.ease ?? 2.5;
  if (g === 'again') return 1;
  let n: number;
  if (reps === 0) n = g === 'easy' ? 3 : 1;
  else if (reps === 1) n = g === 'hard' ? 2 : g === 'good' ? 3 : 5;
  else if (g === 'hard') n = Math.max(ivl + 1, Math.round(ivl * 1.2));
  else if (g === 'good') n = Math.max(ivl + 1, Math.round(ivl * ease));
  else n = Math.max(ivl + 2, Math.round(ivl * ease * 1.3));
  return Math.min(MAX_IVL, n);
}

export function schedule(c: CardSched | undefined, g: Grade, on = today()): CardSched {
  const ease = c?.ease ?? 2.5;
  const interval = nextInterval(c, g);
  const base = { lapses: c?.lapses ?? 0, reviews: (c?.reviews ?? 0) + 1, last: on, interval, due: addDays(on, interval) };
  switch (g) {
    case 'again': return { ...base, ease: clampEase(ease - 0.2), reps: 0, lapses: base.lapses + (c && c.reps > 0 ? 1 : 0) };
    case 'hard': return { ...base, ease: clampEase(ease - 0.15), reps: (c?.reps ?? 0) + 1 };
    case 'good': return { ...base, ease: clampEase(ease), reps: (c?.reps ?? 0) + 1 };
    case 'easy': return { ...base, ease: clampEase(ease + 0.15), reps: (c?.reps ?? 0) + 1 };
  }
}

/** "1 d", "3 d", "2 wk", "4 mo" for grade button labels. */
export function fmtInterval(days: number): string {
  if (days < 14) return `${days} d`;
  if (days < 60) return `${Math.round(days / 7)} wk`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return '1 yr';
}
