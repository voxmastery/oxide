// Rust lexer + highlighter, ported from design/project/oxide-lib.js (lex / applyMarks / highlight).
import { SYN, type SynKey } from '../theme/tokens';

const KW = new Set('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while'.split(' '));
const PRIM = new Set('i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str'.split(' '));

export type Tok = { t: string; k: SynKey; m?: MarkKind | null };
export type MarkKind = 'err' | 'warn' | 'run';
/** 1-based line and column. */
export type Mark = { line: number; col: number; len: number; kind: MarkKind };

export function lex(line: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < line.length) {
    const r = line.slice(i);
    let m: RegExpMatchArray | string[] | null = null;
    let k: SynKey = 'pun';
    if (r.startsWith('//')) { out.push({ t: r, k: 'com' }); break; }
    if ((m = r.match(/^\s+/))) k = 'id';
    else if ((m = r.match(/^#!?\[.*?\]/))) k = 'attr';
    else if ((m = r.match(/^b?"(?:\\.|[^"\\])*"?/))) k = 'str';
    else if ((m = r.match(/^'(?:\\.|[^\\'])'/))) k = 'str';
    else if ((m = r.match(/^'[A-Za-z_]\w*/))) k = 'life';
    else if ((m = r.match(/^\d[\d_]*(?:\.\d[\d_]*)?(?:[iuf](?:8|16|32|64|128|size))?/))) k = 'num';
    else if ((m = r.match(/^[A-Za-z_]\w*!(?!=)/))) k = 'mac';
    else if ((m = r.match(/^[A-Za-z_]\w*/))) {
      const w = m[0];
      const after = line.slice(i + w.length);
      k = KW.has(w) ? 'kw' : PRIM.has(w) || /^[A-Z]/.test(w) ? 'ty' : /^(\(|::<)/.test(after) ? 'fn' : 'id';
    } else m = [r[0]];
    const s = m[0];
    if (k === 'str' && s.length > 2) s.split(/(\{[^{}]*\})/).forEach((p, j) => p && out.push({ t: p, k: j % 2 ? 'fmt' : 'str' }));
    else out.push({ t: s, k });
    i += s.length;
  }
  return out;
}

function applyMarks(toks: Tok[], marks: Mark[]): Tok[] {
  const res: Tok[] = [];
  let pos = 1;
  for (const tk of toks) {
    const s = pos;
    const e = pos + tk.t.length;
    const cuts = new Set([s, e]);
    marks.forEach((mk) => {
      const a = mk.col;
      const b = mk.col + mk.len;
      if (a > s && a < e) cuts.add(a);
      if (b > s && b < e) cuts.add(b);
    });
    const pts = [...cuts].sort((a, b) => a - b);
    for (let j = 0; j < pts.length - 1; j++) {
      const a = pts[j];
      const b = pts[j + 1];
      const mk = marks.find((x) => a >= x.col && a < x.col + x.len);
      res.push({ t: tk.t.slice(a - s, b - s), k: tk.k, m: mk ? mk.kind : null });
    }
    pos = e;
  }
  return res;
}

export type HLine = { n: number; mark: MarkKind | null; toks: Tok[] };

export function highlight(code: string, marks: Mark[] = []): HLine[] {
  return String(code).split('\n').map((line, idx) => {
    const n = idx + 1;
    const lm = marks.filter((x) => x.line === n);
    let toks = lex(line);
    if (lm.length) toks = applyMarks(toks, lm);
    return { n, mark: lm.length ? lm[0].kind : null, toks };
  });
}

export const synColor = (k: SynKey, light = false) => SYN[light ? 'light' : 'dark'][k];

/** Lightweight highlighters for non-Rust listings. */
export function highlightToml(code: string): HLine[] {
  return code.split('\n').map((line, i) => {
    const toks: Tok[] = [];
    const c = line.match(/^(\s*)(#.*)$/);
    const sec = line.match(/^(\s*)(\[\[?[^\]]+\]\]?)(.*)$/);
    const kv = line.match(/^(\s*)([A-Za-z0-9_.-]+)(\s*=\s*)(.*)$/);
    if (c) toks.push({ t: c[1], k: 'id' }, { t: c[2], k: 'com' });
    else if (sec) toks.push({ t: sec[1], k: 'id' }, { t: sec[2], k: 'ty' }, { t: sec[3], k: 'com' });
    else if (kv) toks.push({ t: kv[1], k: 'id' }, { t: kv[2], k: 'fn' }, { t: kv[3], k: 'pun' }, { t: kv[4], k: /^["']/.test(kv[4]) ? 'str' : /^\d/.test(kv[4]) ? 'num' : 'id' });
    else toks.push({ t: line, k: 'id' });
    return { n: i + 1, mark: null, toks };
  });
}

export function highlightAny(code: string, lang: string, marks: Mark[] = []): HLine[] {
  if (lang === 'toml') return highlightToml(code);
  if (lang === 'rust' || lang === 'rs' || lang === '') return highlight(code, marks);
  return code.split('\n').map((line, i) => ({ n: i + 1, mark: null, toks: [{ t: line, k: 'id' as SynKey }] }));
}
