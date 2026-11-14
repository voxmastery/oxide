// Search over the Book's pages, Rustlings and the rustc error index (searchIndex from src/content).
import { chapterOf, rustlings, searchIndex, sectionById, topicByTopicName, type SearchEntry } from '../../content';

export type Group = 'book' | 'rl' | 'err';

export type Hit = {
  group: Group;
  key: string;
  title: string;
  sub: string;
  /** Error code badge instead of an icon tile. */
  code?: string;
  target:
    | { k: 'reader'; id: string }
    | { k: 'workspace'; name: string }
    | { k: 'topic'; name: string }
    | { k: 'explain'; code: string };
};

const byKind = (k: SearchEntry['kind']) => searchIndex.filter((e) => e.kind === k);
const BOOK = byKind('book');
const RL = byKind('rustlings');
const ERR = byKind('error');

const bookTitle = (e: SearchEntry) => {
  const ch = chapterOf(e.id);
  return e.id.includes('.') && ch?.n !== 'A' ? `${e.id} ${e.title}` : e.title;
};
const bookSub = (e: SearchEntry) => {
  const ch = chapterOf(e.id);
  if (!ch) return e.subtitle;
  if (ch.n === 'A') return 'Appendix';
  if (!e.id.includes('.')) return `Chapter ${ch.n}${ch.project ? ' · project' : ''}`;
  return `Chapter ${ch.n} · ${ch.title}`;
};

export function search(q: string): Record<Group, Hit[]> {
  const ql = q.trim().toLowerCase();
  if (!ql) return { book: [], rl: [], err: [] };
  const has = (s: string | undefined) => !!s && s.toLowerCase().includes(ql);
  const numeric = /^\d/.test(ql);

  // The Book: titles and section numbers first, then pages whose headings match.
  const strong: Hit[] = [];
  const weak: Hit[] = [];
  const matchedSecs: string[] = [];
  for (const e of BOOK) {
    const title = bookTitle(e);
    const ch = chapterOf(e.id);
    if (has(e.title) || (numeric && ch?.n !== 'A' && e.id.startsWith(ql))) {
      strong.push({ group: 'book', key: 'b' + e.id, title, sub: bookSub(e), target: { k: 'reader', id: e.id } });
      matchedSecs.push(e.id);
      continue;
    }
    const term = e.terms?.split(' · ').find((x) => has(x));
    if (term) {
      weak.push({ group: 'book', key: 'b' + e.id, title, sub: `${term} · ${bookSub(e)}`, target: { k: 'reader', id: e.id } });
      matchedSecs.push(e.id);
    }
  }
  const book = [...strong, ...weak];

  // Rustlings: topics by name, topics that drill a matched section, then exercises.
  const topics: string[] = [];
  for (const node of rustlings.path) {
    if (node.t !== 'topic') continue;
    if (has(node.name) || has(node.name.replace(/_/g, ' '))) topics.push(node.name);
  }
  for (const id of matchedSecs) for (const tp of sectionById(id)?.rustlings ?? []) if (!topics.includes(tp)) topics.push(tp);
  const rl: Hit[] = topics.map((name) => {
    const tp = topicByTopicName(name)!;
    const n = tp.exercises.length;
    return { group: 'rl' as const, key: 't' + name, title: name, sub: `${n} ${n === 1 ? 'exercise' : 'exercises'}${tp.book ? ' · drills ' + tp.book : ''}`, target: { k: 'topic' as const, name } };
  });
  for (const e of RL) {
    if (has(e.id) || has(e.terms)) {
      const ex = rustlings.exercises[e.id];
      rl.push({ group: 'rl', key: 'r' + e.id, title: e.title, sub: ex?.summary ? ex.summary.replace(/`/g, '') : e.subtitle, target: { k: 'workspace', name: e.id } });
    }
  }

  // Compiler errors: code matches first, then explanations' first sentence.
  const codeHits: Hit[] = [];
  const textHits: Hit[] = [];
  for (const e of ERR) {
    const hit: Hit = { group: 'err', key: 'e' + e.id, title: e.subtitle, sub: `rustc --explain ${e.id}`, code: e.id, target: { k: 'explain', code: e.id } };
    if (e.id.toLowerCase().includes(ql)) codeHits.push(hit);
    else if (has(e.subtitle)) textHits.push(hit);
  }
  return { book, rl, err: [...codeHits, ...textHits] };
}

/** Split `text` around the first case-insensitive match of `q`. */
export function highlightParts(text: string, q: string): { t: string; on: boolean }[] {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return [{ t: text, on: false }];
  return [{ t: text.slice(0, i), on: false }, { t: text.slice(i, i + q.length), on: true }, { t: text.slice(i + q.length), on: false }].filter((x) => x.t);
}
