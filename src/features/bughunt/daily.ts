// Which puzzle belongs to which day. Puzzle #1 was 1 Nov 2026; every calendar day gets the next
// number, the same for everyone on that date, and the list cycles in Book order.
import { today } from '../../state/app';
import { PUZZLES, type Puzzle } from './puzzles';

export const EPOCH = '2026-11-01';
const DAY = 864e5;

const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };

/** Puzzle number for a local date (YYYY-MM-DD). Never below 1. */
export function numberFor(date = today()): number {
  return Math.max(1, Math.round((utc(date) - utc(EPOCH)) / DAY) + 1);
}

/** Local date (YYYY-MM-DD) puzzle `n` belongs to. */
export function dateOf(n: number): string {
  const d = new Date(utc(EPOCH) + (n - 1) * DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function puzzleFor(n: number): Puzzle {
  return PUZZLES[(((n - 1) % PUZZLES.length) + PUZZLES.length) % PUZZLES.length];
}

/** The program with the bug line replaced by option `i`, keeping the line's indentation. */
export function withOption(p: Puzzle, i: number): string {
  const lines = p.code.split('\n');
  const indent = lines[p.line - 1].match(/^\s*/)?.[0] ?? '';
  lines[p.line - 1] = indent + p.options[i];
  return lines.join('\n');
}

export const fixedCode = (p: Puzzle) => withOption(p, p.answer);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "14 Nov" */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
