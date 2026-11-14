// Badge definitions. Ids are a contract: other features call awardBadge(id) with the "external" ones,
// so never rename an id. "auto" badges are evaluated from app state by <BadgeWatcher/> (./eval.ts).
import { rustlings } from '../../content';
import { C, SYN } from '../../theme/tokens';

export type BadgeGroup = 'milestones' | 'streaks' | 'errors' | 'book' | 'projects' | 'topics';
export type BadgeShape = 'circle' | 'hex' | 'shield' | 'square';
export type GlyphName =
  | 'check' | 'flame' | 'book' | 'prompt' | 'bug' | 'crate' | 'key' | 'grid' | 'spark' | 'trophy' | 'chevrons'
  | 'flag' | 'download' | 'list' | 'tags' | 'bars' | 'ledger' | 'cells' | 'bubble';

export type Badge = {
  id: string;
  title: string;
  /** How to earn it, shown on locked badges and in the detail sheet. */
  desc: string;
  group: BadgeGroup;
  shape: BadgeShape;
  color: string;
  glyph?: GlyphName;
  /** Short text on the emblem (streak length, Book part, Rustlings topic number). */
  label?: string;
  /** auto: evaluated from app state. external: another feature calls awardBadge(id). */
  source: 'auto' | 'external';
};

export const GROUPS: { id: BadgeGroup; title: string }[] = [
  { id: 'milestones', title: 'Milestones' },
  { id: 'streaks', title: 'Streaks' },
  { id: 'errors', title: 'Compiler errors' },
  { id: 'book', title: 'The Book' },
  { id: 'projects', title: 'Projects' },
  { id: 'topics', title: 'Rustlings topics' },
];

/** Book parts (the Book has no official parts; these group its chapters by theme). */
export const BOOK_PARTS: { id: string; title: string; chapters: number[] }[] = [
  { id: 'book-part-1', title: 'First steps', chapters: [1, 2] },
  { id: 'book-part-2', title: 'Core concepts', chapters: [3, 4, 5, 6] },
  { id: 'book-part-3', title: 'Organizing code', chapters: [7, 8, 9, 10, 11] },
  { id: 'book-part-4', title: 'Building tools', chapters: [12, 13, 14] },
  { id: 'book-part-5', title: 'Pointers and threads', chapters: [15, 16, 17] },
  { id: 'book-part-6', title: 'Advanced Rust', chapters: [18, 19, 20, 21] },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** The ten ownership and borrowing errors a learner usually meets (the "Ownership" badge). */
export const OWNERSHIP_CORE = ['E0382', 'E0384', 'E0499', 'E0502', 'E0505', 'E0506', 'E0507', 'E0596', 'E0597', 'E0716'];

/** Build-along project ids (agent 4) → badge id `build-<id>`. */
export const BUILD_PROJECTS: { id: string; title: string; glyph: GlyphName }[] = [
  { id: 'todo', title: 'Todo list', glyph: 'list' },
  { id: 'mdhtml', title: 'Markdown to HTML', glyph: 'tags' },
  { id: 'wordfreq', title: 'Word counter', glyph: 'bars' },
  { id: 'bank', title: 'Ledger', glyph: 'ledger' },
  { id: 'life', title: 'Game of Life', glyph: 'cells' },
];

const CORE: Badge[] = [
  // Milestones
  { id: 'hello-world', title: 'Hello, world!', desc: 'Run your first Rust program.', group: 'milestones', shape: 'circle', color: C.rustLight, glyph: 'bubble', source: 'auto' },
  { id: 'first-pass', title: 'First pass', desc: 'Pass your first Rustlings exercise.', group: 'milestones', shape: 'circle', color: C.done, glyph: 'check', source: 'auto' },
  { id: 'first-checkpoint', title: 'Checkpoint', desc: 'Pass a Rustlings checkpoint quiz.', group: 'milestones', shape: 'shield', color: C.checkpoint, glyph: 'flag', source: 'auto' },
  { id: 'bughunt-first', title: 'Bug hunter', desc: 'Solve your first Daily Bug Hunt.', group: 'milestones', shape: 'circle', color: C.checkpoint, glyph: 'bug', source: 'external' },
  { id: 'cargo-install', title: 'Tool belt', desc: 'Install a crate with `cargo install`.', group: 'milestones', shape: 'square', color: SYN.dark.mac, glyph: 'download', source: 'external' },
  { id: 'level-10', title: 'Level 10', desc: 'Reach level 10.', group: 'milestones', shape: 'shield', color: C.rust, glyph: 'chevrons', source: 'auto' },
  { id: 'rustlings-all', title: 'All of Rustlings', desc: 'Pass every Rustlings exercise.', group: 'milestones', shape: 'shield', color: C.done, glyph: 'trophy', source: 'auto' },
  // Streaks
  { id: 'streak-7', title: 'One week', desc: 'Keep a 7-day streak.', group: 'streaks', shape: 'circle', color: C.flame, glyph: 'flame', label: '7', source: 'auto' },
  { id: 'streak-30', title: 'One month', desc: 'Keep a 30-day streak.', group: 'streaks', shape: 'hex', color: C.flame, glyph: 'flame', label: '30', source: 'auto' },
  { id: 'streak-100', title: 'A hundred days', desc: 'Keep a 100-day streak.', group: 'streaks', shape: 'shield', color: C.flame, glyph: 'flame', label: '100', source: 'auto' },
  // Errors
  { id: 'errors-first', title: 'First fix', desc: 'Fix your first compiler error.', group: 'errors', shape: 'circle', color: C.error, glyph: 'spark', source: 'auto' },
  { id: 'errors-10', title: 'Ten errors met', desc: 'Fix 10 different compiler errors.', group: 'errors', shape: 'hex', color: C.error, glyph: 'grid', label: '10', source: 'auto' },
  { id: 'ownership-all', title: 'Borrow checker’s friend', desc: `Fix all ${OWNERSHIP_CORE.length} core ownership and borrowing errors.`, group: 'errors', shape: 'shield', color: C.error, glyph: 'key', source: 'auto' },
  // The Book
  ...BOOK_PARTS.map((p, i): Badge => ({
    id: p.id, title: p.title, group: 'book', shape: 'hex', color: C.rust, glyph: 'book', label: ROMAN[i], source: 'auto',
    desc: `Read chapters ${p.chapters[0]}–${p.chapters[p.chapters.length - 1]} of the Book.`,
  })),
  // Build-along projects (awarded by src/features/buildalong)
  ...BUILD_PROJECTS.map((p): Badge => ({
    id: `build-${p.id}`, title: p.title, desc: `Finish the ${p.title} build-along project.`, group: 'projects', shape: 'square', color: SYN.dark.fn, glyph: p.glyph, source: 'external',
  })),
];

/** One badge per Rustlings topic, generated from the content so it follows Rustlings' own path. */
const TOPICS: Badge[] = rustlings.path.flatMap((n) => (n.t === 'topic' ? [{
  id: `topic-${n.name}`,
  title: n.name.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
  desc: `Pass all ${n.exercises.length} ${n.name} exercises.`,
  group: 'topics' as const, shape: 'hex' as const, color: C.done, label: n.num, source: 'auto' as const,
}] : []));

export const BADGES: Badge[] = [...CORE, ...TOPICS];
export const BADGE_BY_ID: Record<string, Badge> = Object.fromEntries(BADGES.map((b) => [b.id, b]));
