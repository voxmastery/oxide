// League weeks run Monday 00:00 to Sunday 24:00, local time. A week is keyed by its Monday (YYYY-MM-DD).
import { today } from '../../state/app';

const DAY = 864e5;
const REF_MONDAY = '2024-01-01';
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const iso = (ms: number) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

/** Monday of the week containing `now`. */
export function weekKey(now = new Date()): string {
  const key = today(now);
  const dow = (new Date(utc(key)).getUTCDay() + 6) % 7; // Monday = 0
  return iso(utc(key) - dow * DAY);
}

export const addWeeks = (key: string, n: number) => iso(utc(key) + n * 7 * DAY);
export const weekNumber = (key: string) => Math.round((utc(key) - utc(REF_MONDAY)) / (7 * DAY));
export const weeksBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / (7 * DAY));

/** How far through its week `now` is, 0..1. */
export function weekFraction(now = new Date()): number {
  const key = weekKey(now);
  const [y, m, d] = key.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const end = new Date(y, m - 1, d + 7).getTime();
  return Math.max(0, Math.min(1, (now.getTime() - start) / (end - start)));
}

/** Whole days left including today (Sunday = 1). */
export function daysLeft(now = new Date()): number {
  const dow = (now.getDay() + 6) % 7;
  return 7 - dow;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "9 Nov" */
export function fmtWeek(key: string): string {
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
