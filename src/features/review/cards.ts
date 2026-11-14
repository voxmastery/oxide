// Review cards, derived from what the learner has actually done:
//  - error codes they fixed (useApp().fixed): the rustc docs' erroneous example + "What's wrong?" choices
//  - Brown quick-check questions they answered wrong (useApp().quickChecks[id] === false)
//  - Rustlings exercises they passed: one changed line of the official solution, "What does this line do?"
import { errors, exercise, quizzes, rustlings, sectionById, type Block, type Inline, type QuizQuestion } from '../../content';
import { today, type AppData } from '../../state/app';
import { lineDiff } from '../../rust/diff';
import type { CardSched } from './sm2';
import { NEW_PER_DAY } from './store';

export type ErrorCard = {
  id: string; kind: 'error'; code: string; title: string; snippet: string;
  /** Plain first paragraph of the error's documentation. */
  about: string; section?: string;
};
export type QuizCard = { id: string; kind: 'quiz'; qid: string; question: QuizQuestion; section: string; quizId: string; index: number };
export type ExerciseCard = {
  id: string; kind: 'exercise'; exercise: string; summary: string;
  /** Solution excerpt (comments removed) and the 1-based line to ask about. */
  snippet: string; line: number; lineText: string;
  /** The original exercise's line(s) it replaced (may be empty when the line was added). */
  before: string[];
  /** The official solution's own comment(s) next to the change. */
  notes: string[];
  section?: string;
};
export type Card = ErrorCard | QuizCard | ExerciseCard;

type Src = Pick<AppData, 'fixed' | 'quickChecks' | 'ex'>;

// ---------- error cards ----------

const plain = (ns: Inline[]): string => ns.map((n) => (n.k === 't' ? n.v : n.k === 'code' ? `\`${n.v}\`` : plain(n.c))).join('');

/** Removes `//` comments (outside string literals) so the example doesn't announce its own error. */
export function stripComments(code: string): string {
  const out: string[] = [];
  for (const raw of code.split('\n')) {
    let inStr = false, cut = -1;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '/' && raw[i + 1] === '/') { cut = i; break; }
    }
    if (cut === -1) { out.push(raw.trimEnd()); continue; }
    const kept = raw.slice(0, cut).trimEnd();
    if (kept.trim()) out.push(kept);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function firstRustExample(blocks: Block[]): string | null {
  for (const b of blocks) if (b.type === 'code' && (b.lang === 'rust' || b.lang === '') && b.code.trim()) return b.code;
  return null;
}

function errorCard(code: string): ErrorCard | null {
  const doc = errors[code];
  if (!doc || doc.removed) return null;
  const ex = firstRustExample(doc.blocks);
  if (!ex) return null;
  // Several examples in one block are separated by "// or:"; the first one is enough.
  const first = ex.split(/\n\s*\/\/\s*or\b.*\n/i)[0];
  const snippet = stripComments(first);
  if (!snippet || snippet.split('\n').length > 24) return null;
  const p = doc.blocks.find((b): b is Extract<Block, { type: 'p' }> => b.type === 'p');
  return { id: `err:${code}`, kind: 'error', code, title: doc.title, snippet, about: p ? plain(p.text) : '', section: doc.section };
}

/** Common codes used as distractors when the learner hasn't met enough different errors yet. */
const COMMON = ['E0382', 'E0499', 'E0502', 'E0308', 'E0425', 'E0596', 'E0384', 'E0106', 'E0277', 'E0433', 'E0599', 'E0507', 'E0505', 'E0597', 'E0061', 'E0369', 'E0004', 'E0412'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function shuffled<T>(xs: T[], seed: string): T[] {
  let a = hash(seed) || 1;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** Four choices (error titles, with codes) for "What's wrong?": the right one and three others. */
export function errorChoices(card: ErrorCard, met: string[], seed: string): { code: string; title: string }[] {
  const pool = [...new Set([...met, ...COMMON])].filter((c) => c !== card.code && errors[c] && !errors[c].removed && errors[c].title !== card.title);
  const others = shuffled(pool, `${card.code}:${seed}`).slice(0, 3).map((c) => ({ code: c, title: errors[c].title }));
  return shuffled([{ code: card.code, title: card.title }, ...others], `${card.code}:${seed}:order`);
}

// ---------- quick-check cards ----------

function quizCard(qid: string): QuizCard | null {
  const [quizId, idx] = qid.split('/');
  const quiz = quizzes[quizId];
  const q = quiz?.questions[Number(idx)];
  if (!quiz || !q) return null;
  return { id: `qc:${qid}`, kind: 'quiz', qid, question: q, section: quiz.section, quizId, index: Number(idx) };
}

// ---------- exercise cards ----------

const isComment = (l: string) => /^\s*\/\//.test(l);
const commentText = (l: string) => l.replace(/^\s*\/\/+\s?/, '').trim();
const isMarker = (s: string) => /^[\^\s]+(added|changed|removed|here)?\b/i.test(s) || /^\^/.test(s);

export function exerciseCard(name: string): ExerciseCard | null {
  const x = exercise(name);
  if (!x?.solution?.trim()) return null;
  const diff = lineDiff(x.code.replace(/\s+$/, ''), x.solution.replace(/\s+$/, ''));
  // First added line that is code (not a comment, not blank).
  const at = diff.findIndex((d) => d.op === '+' && d.t.trim() && !isComment(d.t) && !/^\s*#!?\[/.test(d.t));
  if (at < 0) return null;
  const target = diff[at];
  // The change block around it.
  let a = at; while (a > 0 && diff[a - 1].op !== ' ') a--;
  let b = at; while (b + 1 < diff.length && diff[b + 1].op !== ' ') b++;
  const block = diff.slice(a, b + 1);
  const before = block.filter((d) => d.op === '-' && d.t.trim() && !isComment(d.t)).map((d) => d.t.trim());
  // The solution's comments in that block, joined into paragraphs; code-looking lines become `code`.
  const notes: string[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) notes.push(para.join(' ')); para = []; };
  for (const d of block) {
    if (d.op !== '+' || !isComment(d.t)) { flush(); continue; }
    const c = commentText(d.t);
    if (!c) { flush(); continue; }
    if (isMarker(c) || /^TODO\b/.test(c)) continue;
    if (/[;{}]$/.test(c) && !/[.!?:]$/.test(c) && !c.includes('`')) { flush(); notes.push(`\`${c}\``); continue; }
    para.push(c);
  }
  flush();

  // Solution without comment lines; keep track of where the target line went.
  const sol = x.solution.replace(/\s+$/, '').split('\n');
  const kept: { t: string; orig: number }[] = [];
  sol.forEach((t, i) => { if (!isComment(t)) kept.push({ t: t.replace(/\s+\/\/.*$/, (m) => (m.includes('"') ? m : '')), orig: i + 1 }); });
  const ti = kept.findIndex((k) => k.orig === target.n);
  if (ti < 0) return null;
  let lo = Math.max(0, ti - 4), hi = Math.min(kept.length - 1, ti + 3);
  while (lo < ti && (!kept[lo].t.trim() || /^\s*[}\])]+[;,]?\s*$/.test(kept[lo].t))) lo++;
  while (hi > ti && !kept[hi].t.trim()) hi--;
  // Window around the line, with runs of blank lines (left by removed comments) collapsed.
  const winK = kept.slice(lo, hi + 1).filter((k, i, a) => k.t.trim() || (i > 0 && a[i - 1].t.trim()));
  const win = winK.map((k) => k.t);
  const line = winK.findIndex((k) => k.orig === target.n) + 1;
  // Dedent the window.
  const ind = Math.min(...win.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length));
  const snippet = win.map((l) => l.slice(Math.min(ind, l.match(/^\s*/)![0].length))).join('\n');
  const secs = rustlings.path.find((p) => p.t === 'topic' && p.exercises.includes(name));
  const section = secs && secs.t === 'topic' ? secs.secs.find((id) => sectionById(id)) : undefined;
  return {
    id: `ex:${name}`, kind: 'exercise', exercise: name, summary: x.summary,
    snippet, line, lineText: kept[ti].t.trim(), before, notes, section,
  };
}

// ---------- the deck ----------

const cache = new Map<string, Card | null>();
function cardById(id: string): Card | null {
  if (cache.has(id)) return cache.get(id)!;
  const [kind, ...rest] = id.split(':');
  const ref = rest.join(':');
  const c = kind === 'err' ? errorCard(ref) : kind === 'qc' ? quizCard(ref) : kind === 'ex' ? exerciseCard(ref) : null;
  cache.set(id, c);
  return c;
}

/** Every card the learner's history gives them, in the order new ones are introduced. */
export function allCardIds(s: Src, on = today()): string[] {
  const qc = Object.entries(s.quickChecks).filter(([, ok]) => ok === false).map(([id]) => `qc:${id}`);
  const er = Object.entries(s.fixed).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]).map(([c]) => `err:${c}`);
  const ex = rustlings.order
    .filter((n) => s.ex[n]?.status === 'done')
    // An exercise passed today becomes a card tomorrow.
    .filter((n) => !s.ex[n].passedAt || today(new Date(s.ex[n].passedAt!)) < on)
    .sort((x, y) => (s.ex[x].passedAt ?? 0) - (s.ex[y].passedAt ?? 0))
    .map((n) => `ex:${n}`);
  return [...qc, ...er, ...ex].filter((id) => cardById(id));
}

export type Deck = {
  /** Cards scheduled for today or earlier, most overdue first. */
  due: Card[];
  /** New cards that may be introduced today (already limited to the daily allowance). */
  fresh: Card[];
  /** Total cards in the learner's collection. */
  total: number;
  /** Next date something becomes due after today (null when nothing is scheduled). */
  nextDue: string | null;
  nextDueCount: number;
};

export function buildDeck(s: Src, sched: Record<string, CardSched>, freshToday: number, on = today()): Deck {
  const ids = allCardIds(s, on);
  const due: Card[] = [];
  const fresh: Card[] = [];
  const later = new Map<string, number>();
  for (const id of ids) {
    const c = sched[id];
    if (!c) { fresh.push(cardById(id)!); continue; }
    if (c.due <= on) due.push(cardById(id)!);
    else later.set(c.due, (later.get(c.due) ?? 0) + 1);
  }
  due.sort((x, y) => (sched[x.id].due < sched[y.id].due ? -1 : sched[x.id].due > sched[y.id].due ? 1 : 0));
  const allowance = Math.max(0, NEW_PER_DAY - freshToday);
  const nextDue = [...later.keys()].sort()[0] ?? null;
  return { due, fresh: fresh.slice(0, allowance), total: ids.length, nextDue, nextDueCount: nextDue ? later.get(nextDue)! : 0 };
}

export const cardSection = (c: Card) => c.section;
