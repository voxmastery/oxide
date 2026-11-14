// Terminal output → styled segments.
// Accepts real ANSI SGR escapes (rustc/cargo with CARGO_TERM_COLOR=always) and the prototype's
// `§X` markup used for the app's own messages (lower case = color, upper case = bold color).
import { TC } from '../theme/tokens';

export type TKey = keyof typeof TC;
export type Seg = { t: string; c: TKey; bold: boolean };

const SGR_COLOR: Record<number, TKey> = {
  30: 'd', 31: 'r', 32: 'g', 33: 'y', 34: 'b', 35: 'm', 36: 'c', 37: 'w', 39: 'n',
  90: 'd', 91: 'r', 92: 'g', 93: 'y', 94: 'b', 95: 'm', 96: 'c', 97: 'w',
};
const XTERM_16: TKey[] = ['d', 'r', 'g', 'y', 'b', 'm', 'c', 'w', 'd', 'r', 'g', 'y', 'b', 'm', 'c', 'w'];

// eslint-disable-next-line no-control-regex
const ESC = /\x1b\[([0-9;]*)m|§(.)/g;

export function ansi(line: string): Seg[] {
  const out: Seg[] = [];
  let c: TKey = 'n';
  let bold = false;
  let last = 0;
  let m: RegExpExecArray | null;
  ESC.lastIndex = 0;
  const push = (t: string) => { if (t) out.push({ t, c, bold }); };
  while ((m = ESC.exec(line))) {
    push(line.slice(last, m.index));
    last = ESC.lastIndex;
    if (m[2] !== undefined) {
      const ch = m[2];
      const lower = ch.toLowerCase() as TKey;
      c = lower in TC ? lower : 'n';
      bold = ch !== ch.toLowerCase();
      continue;
    }
    const codes = (m[1] || '0').split(';').map((x) => parseInt(x || '0', 10));
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (code === 0) { c = 'n'; bold = false; }
      else if (code === 1) bold = true;
      else if (code === 22) bold = false;
      else if (code === 38 && codes[i + 1] === 5) { const idx = codes[i + 2]; c = idx < 16 ? XTERM_16[idx] : 'n'; i += 2; }
      else if (SGR_COLOR[code]) c = SGR_COLOR[code];
    }
  }
  push(line.slice(last));
  return out;
}

/** Strip both escape styles, e.g. for copy-to-clipboard and matching. */
export const plain = (line: string) => line.replace(ESC, '');
