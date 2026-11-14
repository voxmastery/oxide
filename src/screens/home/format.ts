// Small date/number formatters shared by Home, Profile, Settings and Account.
// Written by hand so they don't depend on the Intl data available in Hermes.

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** en-GB short months, as the prototype's heatmap prints them ("Sept"). */
const MO_GB = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Sat 14 Nov" */
export const fmtDay = (d: Date) => `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
/** "Nov" */
export const monthShort = (d: Date) => MO_GB[d.getMonth()];

/** "1,840" */
export const comma = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** ISO date (YYYY-MM-DD) → Date at local midnight. */
export const parseIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** "Learning Rust since July" / "Joined today" from the plan's start date. */
export function sinceLine(startDate: string | null, todayIso: string) {
  if (!startDate || startDate === todayIso) return 'Joined today';
  return `Learning Rust since ${MONTH[parseIso(startDate).getMonth()]}`;
}

/** "2 min ago", "just now", "3 h ago", "5 days ago". */
export function ago(ts: number, now = Date.now()) {
  const min = Math.floor((now - ts) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Morning before 12, afternoon before 18, evening after. */
export function greeting(name: string, day1: boolean, d = new Date()) {
  const n = name.trim();
  if (day1) return n ? `Welcome, ${n}` : 'Welcome';
  const h = d.getHours();
  const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return n ? `${g}, ${n}` : g;
}

export const initialOf = (name: string) => (name.trim()[0] ?? '').toUpperCase();
