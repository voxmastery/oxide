// Content contract between scripts/build-content.mjs (generator) and the app.
// Generated files live in src/content/data/ and are imported by src/content/index.ts.

/** "1.2", "4.2", "2" (a chapter with no numbered sections), "A" (appendix sections are "A.1"…). */
export type SectionId = string;

export type BookSectionMeta = {
  id: SectionId;          // "4.2"
  title: string;          // "References and Borrowing"
  file: string;           // "ch04-02-references-and-borrowing.md"
  mins: number;           // estimated reading time, 230 wpm prose + 40 s per listing
  words: number;
  /** Rustlings topics (by `name`) that drill this section, from rustlings' exercises/README.md map. */
  rustlings: string[];
  /** Brown interactive edition quiz ids mapped onto this official section. */
  quizzes: string[];
};

export type BookChapter = {
  n: number | 'A';        // 1..21, 'A' = appendix
  title: string;          // "Understanding Ownership"
  /** Chapter intro page (e.g. ch04-00-understanding-ownership.md) has id = String(n). */
  intro: BookSectionMeta;
  sections: BookSectionMeta[]; // numbered sections; empty for chapter 2
  project?: { name: 'guessing_game' | 'minigrep' | 'hello'; label: string };
};

export type BookToc = {
  edition: string;        // "Rust 2024"
  rustVersion: string;    // from book's rust-toolchain, e.g. "1.99"
  sourceCommit: string;
  chapters: BookChapter[];
  /** Total numbered sections, used for "10 of 80 sections". */
  sectionCount: number;
};

/** Inline markup in prose: `code`, *em*, **strong**, [link](url). Kept as a tiny AST. */
export type Inline =
  | { k: 't'; v: string }
  | { k: 'code'; v: string }
  | { k: 'em'; c: Inline[] }
  | { k: 'strong'; c: Inline[] }
  | { k: 'link'; href: string; c: Inline[] };

export type Block =
  | { type: 'h2' | 'h3' | 'h4'; text: Inline[]; anchor: string }
  | { type: 'p'; text: Inline[] }
  | { type: 'ul' | 'ol'; items: Inline[][] }
  | { type: 'note'; kind: 'note' | 'warning'; blocks: Block[] }
  | { type: 'quote'; blocks: Block[] }
  | {
      type: 'code';
      lang: string;                 // "rust", "console", "toml", "text"
      code: string;                 // hidden lines (`# `) removed
      /** Full program including hidden lines, for running. */
      runnable?: string;
      file?: string;                // "src/main.rs" or "Filename: src/main.rs" caption
      listing?: string;             // "4-6"
      caption?: string;             // listing caption text
      fails?: boolean;              // does_not_compile
      panics?: boolean;
      ignore?: boolean;
      /** Recorded output from the Book's listings/<…>/output.txt when present. */
      output?: string;
    }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { type: 'img'; alt: string; src: string } // Book SVG diagrams, bundled under assets/book/
  | { type: 'quiz'; id: string }            // placed at the end of the matching Brown section
  | { type: 'hr' };

export type BookSection = {
  id: SectionId;
  title: string;
  blocks: Block[];
};

export type QuizQuestion =
  | {
      type: 'MultipleChoice';
      prompt: string;        // markdown
      code?: string;
      answer: string[];      // correct option(s), markdown
      distractors: string[];
      context?: string;      // explanation shown after answering
      multi?: boolean;
    }
  | {
      type: 'ShortAnswer';
      prompt: string;
      answer: string;
      context?: string;
    }
  | {
      type: 'Tracing';
      program: string;
      doesCompile: boolean;
      stdout?: string;
      lineNumber?: number;
      context?: string;
    };

export type Quiz = { id: string; section: SectionId; questions: QuizQuestion[] };

export type RustlingsExercise = {
  name: string;           // "move_semantics2"
  dir: string;            // "06_move_semantics"
  path: string;           // "exercises/06_move_semantics/move_semantics2.rs"
  topic: string;          // "move_semantics"
  index: number;          // 1-based index within topic
  of: number;             // exercises in topic
  pos: number;            // 1-based position in Rustlings' overall order
  test: boolean;          // info.toml `test` (default true)
  strictClippy: boolean;
  skipCheckUnsolved: boolean;
  hint: string;           // official hint, verbatim
  code: string;           // exercise file
  solution: string;       // solutions/… (empty if none)
  /** Short one-line description derived from the file's leading comment ("TODO: …"). */
  summary: string;
  xp: number;             // 40 easy / 50 medium / 100 quiz / 10 intro
  difficulty: 'Easy' | 'Medium' | 'Quiz';
};

export type RustlingsPathNode =
  | {
      t: 'topic';
      dir: string;            // "06_move_semantics"
      name: string;           // "move_semantics"
      num: string;            // "06"
      book: string;           // "§4.1–2" label from the README map ("" if none)
      secs: SectionId[];      // ["4.1","4.2"]
      exercises: string[];    // exercise names in order
      description: string;    // one line, from the topic README.md first paragraph
    }
  | { t: 'quiz'; name: string; covers: string; exercise: string };

export type RustlingsData = {
  version: string;        // rustlings Cargo.toml version
  sourceCommit: string;
  total: number;          // 95 (quizzes count as exercises, like Rustlings does)
  exercises: Record<string, RustlingsExercise>;
  order: string[];        // all exercise names in Rustlings order
  path: RustlingsPathNode[];
  /** Cargo.toml + helper files needed to build the exercises crate on device. */
  crate: { cargoToml: string; files: Record<string, string> };
};

export type ErrorCodeDoc = {
  code: string;           // "E0382"
  title: string;          // first sentence, lower-case like rustc's message where possible
  /** Markdown body of rustc_error_codes/src/error_codes/EXXXX.md as blocks. */
  blocks: Block[];
  /** Related Book section, hand-mapped for common errors. */
  section?: SectionId;
  removed?: boolean;      // "#### Note: this error code is no longer emitted by the compiler."
};

export type BookProject = {
  name: 'guessing_game' | 'minigrep' | 'hello';
  chapter: number;
  title: string;
  description: string;
  prerequisite?: string;
  steps: { title: string; teaches: string; section: SectionId | string; anchor?: string }[];
  /** Final files for the project from the Book's last listing of the chapter. */
  files: Record<string, string>;
  /** Vendored crates the project needs offline (e.g. rand for guessing_game). */
  crates: string[];
};

export type SearchEntry = {
  kind: 'book' | 'rustlings' | 'error';
  id: string;             // section id / exercise name / error code
  title: string;
  subtitle: string;
  /** Extra terms matched but not shown. */
  terms?: string;
};
