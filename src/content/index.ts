// Typed loaders for the generated content in ./data (built by `npm run content`).
// Small indexes are imported eagerly; Book pages are loaded lazily, one JSON per page.

import type {
  BookChapter,
  BookProject,
  BookSection,
  BookSectionMeta,
  BookToc,
  ContentLicense,
  ErrorCodeDoc,
  Quiz,
  RustlingsData,
  RustlingsExercise,
  RustlingsPathNode,
  SearchEntry,
  SectionId,
} from './types';
import { bookPages } from './data/book';
import tocJson from './data/book-toc.json';
import rustlingsJson from './data/rustlings.json';
import errorsJson from './data/errors.json';
import quizzesJson from './data/quizzes.json';
import projectsJson from './data/projects.json';
import searchJson from './data/search.json';

export * from './types';

export const toc = tocJson as unknown as BookToc;
export const rustlings = rustlingsJson as unknown as RustlingsData;
export const errors = errorsJson as unknown as Record<string, ErrorCodeDoc>;
export const quizzes = quizzesJson as unknown as Record<string, Quiz>;
export const projects = projectsJson as unknown as BookProject[];
export const searchIndex = searchJson as unknown as SearchEntry[];

// ---------------------------------------------------------------------------
// Book
// ---------------------------------------------------------------------------

/** Every page in reading order: each chapter's intro followed by its numbered sections. */
export const readingOrder: BookSectionMeta[] = toc.chapters.flatMap((c) => [c.intro, ...c.sections]);

const metaById = new Map<SectionId, BookSectionMeta>(readingOrder.map((m) => [m.id, m]));
const chapterById = new Map<SectionId, BookChapter>();
for (const c of toc.chapters) {
  chapterById.set(c.intro.id, c);
  for (const s of c.sections) chapterById.set(s.id, c);
}
const orderIndex = new Map<SectionId, number>(readingOrder.map((m, i) => [m.id, i]));

export function sectionById(id: SectionId): BookSectionMeta | undefined {
  return metaById.get(id);
}

export function chapterOf(id: SectionId): BookChapter | undefined {
  return chapterById.get(id) ?? chapterById.get(id.split('.')[0]);
}

export function nextSection(id: SectionId): BookSectionMeta | undefined {
  const i = orderIndex.get(id);
  return i === undefined ? undefined : readingOrder[i + 1];
}

export function prevSection(id: SectionId): BookSectionMeta | undefined {
  const i = orderIndex.get(id);
  return i === undefined || i === 0 ? undefined : readingOrder[i - 1];
}

export function hasSection(id: SectionId): boolean {
  return id in bookPages;
}

const pageCache = new Map<SectionId, BookSection>();

/** Load one Book page (blocks). Throws for an unknown id. */
export function loadSection(id: SectionId): BookSection {
  const cached = pageCache.get(id);
  if (cached) return cached;
  const load = bookPages[id];
  if (!load) throw new Error(`Unknown Book section "${id}"`);
  const page = load();
  pageCache.set(id, page);
  return page;
}

/** "book:4.2#anchor" link targets produced by the generator. */
export function parseBookLink(href: string): { id: SectionId; anchor?: string } | undefined {
  const m = /^book:([^#]+)(?:#(.+))?$/.exec(href);
  return m ? { id: m[1], anchor: m[2] } : undefined;
}

export function projectByName(name: BookProject['name']): BookProject | undefined {
  return projects.find((p) => p.name === name);
}

export function quizzesForSection(id: SectionId): Quiz[] {
  return (sectionById(id)?.quizzes ?? []).map((q) => quizzes[q]).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Rustlings
// ---------------------------------------------------------------------------

type TopicNode = Extract<RustlingsPathNode, { t: 'topic' }>;
type QuizNode = Extract<RustlingsPathNode, { t: 'quiz' }>;

const topicByName = new Map<string, TopicNode>();
const nodeByExercise = new Map<string, TopicNode | QuizNode>();
for (const node of rustlings.path) {
  if (node.t === 'topic') {
    topicByName.set(node.name, node);
    for (const e of node.exercises) nodeByExercise.set(e, node);
  } else nodeByExercise.set(node.exercise, node);
}
const exerciseIndex = new Map<string, number>(rustlings.order.map((n, i) => [n, i]));

export function exercise(name: string): RustlingsExercise | undefined {
  return rustlings.exercises[name];
}

/** Rustlings exercises that drill a Book section (via the topic → chapter map). */
export function exercisesForSection(id: SectionId): RustlingsExercise[] {
  const topics = sectionById(id)?.rustlings ?? [];
  return topics.flatMap((t) => (topicByName.get(t)?.exercises ?? []).map((n) => rustlings.exercises[n]));
}

/** The path node (topic, or quiz) an exercise belongs to. */
export function topicOf(exerciseName: string): TopicNode | QuizNode | undefined {
  return nodeByExercise.get(exerciseName);
}

export function topicByTopicName(name: string): TopicNode | undefined {
  return topicByName.get(name);
}

export function nextExercise(name: string): RustlingsExercise | undefined {
  const i = exerciseIndex.get(name);
  if (i === undefined) return undefined;
  const next = rustlings.order[i + 1];
  return next ? rustlings.exercises[next] : undefined;
}

// ---------------------------------------------------------------------------
// Licenses (Settings → About → Content licenses), loaded on demand
// ---------------------------------------------------------------------------

export function loadLicenses(): ContentLicense[] {
  return require('./data/licenses.json') as ContentLicense[];
}
