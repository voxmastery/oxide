// Date labels for the collection, journal and badges (by hand, no Intl dependency on Hermes).
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Nov", or "12 Nov 2025" outside the current year. */
export function shortDate(ts: number, now = Date.now()) {
  const d = new Date(ts);
  const y = new Date(now).getFullYear();
  return `${d.getDate()} ${MO[d.getMonth()]}${d.getFullYear() !== y ? ` ${d.getFullYear()}` : ''}`;
}

/** "Today", "Yesterday" or shortDate. */
export function dayLabel(ts: number, now = Date.now()) {
  const a = new Date(ts); a.setHours(0, 0, 0, 0);
  const b = new Date(now); b.setHours(0, 0, 0, 0);
  const days = Math.round((b.getTime() - a.getTime()) / 864e5);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : shortDate(ts, now);
}

/** "14:05" */
export const clock = (ts: number) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
