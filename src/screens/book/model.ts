// Derived view model for the Learn tab (design/project/Book.dc.html), from app state + the Book's toc.
import { rustlings, sectionById, toc, topicByTopicName, type BookChapter, type SectionId } from '../../content';
import type { AppData } from '../../state/app';

export type SecState = 'done' | 'cur' | 'todo';

export type SecRow = {
  id: SectionId;
  /** Mono number shown before the title ("4.2"); empty for appendix sections and chapter-only pages. */
  num: string;
  title: string;
  state: SecState;
  isCurrent: boolean;
  /** "Rustlings · move_semantics 1/5" or "". */
  rl: string;
  /** "62%" on the current section. */
  meta: string;
};

export type ChapterRow = {
  key: string;
  n: BookChapter['n'];
  label: string;          // "04" / "A"
  title: string;
  sub: string;
  subKind: 'project' | 'rustlings' | 'plain';
  state: SecState;
  frac: number;
  /** Number of pages counted for this chapter (numbered sections, or 1 for chapter 2). */
  weight: number;
  appendix: boolean;
  secs: SecRow[];
};

/** Pages a chapter is made of in the contents: its numbered sections, or the chapter page itself (chapter 2). */
export const pagesOf = (c: BookChapter): { id: SectionId; title: string }[] =>
  c.sections.length ? c.sections.map((s) => ({ id: s.id, title: s.title })) : [{ id: c.intro.id, title: c.title }];

export function topicDone(ex: AppData['ex'], topic: string) {
  const t = topicByTopicName(topic);
  if (!t) return { done: 0, of: 0 };
  return { done: t.exercises.filter((n) => ex[n]?.status === 'done').length, of: t.exercises.length };
}

/** "move_semantics 1/5" */
const tag = (ex: AppData['ex'], topic: string) => {
  const d = topicDone(ex, topic);
  return `${topic} ${d.done}/${d.of}`;
};

const uniq = <T,>(xs: T[]) => xs.filter((x, i) => xs.indexOf(x) === i);
const pathOrder = new Map(rustlings.path.map((n, i) => [n.name, i]));
/** Topics in Rustlings' own order (as the prototype lists them). */
const byPath = (xs: string[]) => uniq(xs).sort((a, b) => (pathOrder.get(a) ?? 0) - (pathOrder.get(b) ?? 0));

export function readFrac(book: AppData['book'], id: SectionId) {
  if (book.read[id]) return 1;
  return Math.min(0.99, book.scroll[id] ?? 0);
}

/** Pages in reading order as listed in the contents (chapter intros other than chapter 2 aren't listed). */
const listedPages = toc.chapters.flatMap((c) => pagesOf(c).map((p) => p.id));

/**
 * The page to continue with: `book.current` until it's read, then the next unread page after it
 * (or the first unread one anywhere).
 */
export function continueId(book: AppData['book']): SectionId {
  if (!book.read[book.current]) return book.current;
  const i = listedPages.indexOf(book.current);
  return listedPages.slice(i + 1).find((id) => !book.read[id]) ?? listedPages.find((id) => !book.read[id]) ?? book.current;
}

export function chapterRows(book: AppData['book'], ex: AppData['ex']): ChapterRow[] {
  const current = continueId(book);
  return toc.chapters.map((c) => {
    const appendix = c.n === 'A';
    const pages = pagesOf(c);
    const got = pages.reduce((a, p) => a + (book.read[p.id] ? 1 : p.id === current ? readFrac(book, p.id) : 0), 0);
    const frac = got / pages.length;
    const state: SecState = frac >= 1 ? 'done' : frac > 0 ? 'cur' : 'todo';
    const topics = byPath([...c.intro.rustlings, ...c.sections.flatMap((s) => s.rustlings)]);
    const sub = c.project
      ? `Project · ${c.project.label === 'minigrep' ? c.project.label : c.project.label.toLowerCase()}`
      : topics.length ? 'Rustlings · ' + topics.map((t) => tag(ex, t)).join(' · ')
      : `${pages.length} ${pages.length === 1 ? 'section' : 'sections'}`;
    const secs: SecRow[] = pages.map((p) => {
      const meta = sectionById(p.id);
      const isCurrent = p.id === current && !book.read[p.id];
      const st: SecState = book.read[p.id] ? 'done' : isCurrent || (book.scroll[p.id] ?? 0) > 0 ? 'cur' : 'todo';
      const tps = byPath([...(meta?.rustlings ?? []), ...c.intro.rustlings]);
      return {
        id: p.id,
        num: c.sections.length && !appendix ? p.id : '',
        title: p.title,
        state: st,
        isCurrent,
        rl: tps.length ? 'Rustlings · ' + tps.map((t) => tag(ex, t)).join(' · ') : '',
        meta: isCurrent ? `${Math.round(readFrac(book, p.id) * 100)}%` : '',
      };
    });
    return {
      key: String(c.n), n: c.n, label: appendix ? 'A' : String(c.n).padStart(2, '0'), title: c.title, sub,
      subKind: c.project ? 'project' : topics.length ? 'rustlings' : 'plain',
      state, frac, weight: pages.length, appendix, secs,
    };
  });
}

/** "10 of 80 sections": every chapter page in chapters 1–21 (chapter 2 counts as one). */
export function contentsStats(rows: ChapterRow[], book: AppData['book']) {
  const pages = rows.filter((r) => !r.appendix).flatMap((r) => r.secs);
  return { read: pages.filter((p) => book.read[p.id]).length, total: pages.length };
}

export const exerciseCount = () => rustlings.total;
