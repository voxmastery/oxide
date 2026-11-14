// Terminal session: one per app run (cwd, blocks, running process, day-1 mission ticks).
// Only the command history outlives the app run (AsyncStorage).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * One output line.
 * - string: ANSI escapes and/or the app's `§x` markup, shown as is (no wrapping, scrolls sideways)
 * - { w }: prose, wraps to the screen width
 * - { code, lang }: a source line, syntax-highlighted
 */
export type Line = string | { w: string } | { code: string; lang: 'rust' | 'toml'; pre?: string };

export type BlockStatus = 'run' | 'ok' | 'err';

export type Block = {
  id: number;
  /** '' for the welcome message. */
  cmd: string;
  lines: Line[];
  /** Lines dropped from the start to keep long outputs light. */
  dropped: number;
  st: BlockStatus;
  code: number;
  /** "0.48s", '' for instant built-ins. */
  dur: string;
  cwd: string;
  /** Error code found in the output (E0382). */
  err?: string;
  /** Rustlings exercise this block ran. */
  ex?: string;
  /** `rustc --explain` code. */
  explain?: string;
  /** Show "Open Practice". */
  practice?: boolean;
};

export type ProcInfo = {
  blockId: number;
  /** Program name shown in the process row ("guessing_game"). */
  name: string;
  /** The program itself runs (after cargo's "Running" line); its stdin is the input field. */
  program: boolean;
  /** The program asks for a number (the guessing game). */
  numeric: boolean;
};

export type MissionTicks = { new: boolean; cd: boolean; run: boolean; name: string; doneHere: boolean };

export type RootKind = 'project' | 'rustlings' | null;

type TermState = {
  cwd: string;
  prevCwd: string | null;
  blocks: Block[];
  history: string[];
  proc: ProcInfo | null;
  mission: MissionTicks;
  /** Cargo root of cwd and what it is. */
  root: { path: string | null; kind: RootKind };
  started: boolean;
  /** entry.key values whose `params.run` already ran. */
  handled: string[];
};

export const MAX_LINES = 4000;
export const MAX_BLOCKS = 160;
export const MAX_HISTORY = 500;

export const useTerm = create<TermState>()(
  persist(
    (): TermState => ({
      cwd: '~',
      prevCwd: null,
      blocks: [],
      history: [],
      proc: null,
      mission: { new: false, cd: false, run: false, name: 'hello_world', doneHere: false },
      root: { path: null, kind: null },
      started: false,
      handled: [],
    }),
    {
      name: 'oxide-terminal-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ history: s.history }) as unknown as TermState,
    },
  ),
);

let seq = 0;
export const nextId = () => ++seq;

const cap = (b: Block): Block => {
  if (b.lines.length <= MAX_LINES) return b;
  const drop = b.lines.length - MAX_LINES;
  return { ...b, lines: b.lines.slice(drop), dropped: b.dropped + drop };
};

export const term = {
  get: () => useTerm.getState(),
  addBlock(cmd: string, o: Partial<Block> = {}): number {
    const id = nextId();
    const b: Block = { id, cmd, lines: [], dropped: 0, st: 'run', code: 0, dur: '', cwd: useTerm.getState().cwd, ...o };
    useTerm.setState((s) => {
      const blocks = s.blocks.concat([b]);
      return { blocks: blocks.length > MAX_BLOCKS ? blocks.slice(blocks.length - MAX_BLOCKS) : blocks };
    });
    return id;
  },
  update(id: number, f: (b: Block) => Partial<Block>) {
    useTerm.setState((s) => ({ blocks: s.blocks.map((b) => (b.id === id ? cap({ ...b, ...f(b) }) : b)) }));
  },
  append(id: number, lines: Line[]) {
    if (lines.length) term.update(id, (b) => ({ lines: b.lines.concat(lines) }));
  },
  finish(id: number, lines: Line[], code: number, o: Partial<Block> = {}) {
    term.update(id, (b) => ({ lines: b.lines.concat(lines), st: code ? 'err' : 'ok', code, ...o }));
  },
  clear() { useTerm.setState({ blocks: [] }); },
  pushHistory(cmd: string) {
    useTerm.setState((s) => {
      const h = s.history[s.history.length - 1] === cmd ? s.history : s.history.concat([cmd]);
      return { history: h.length > MAX_HISTORY ? h.slice(h.length - MAX_HISTORY) : h };
    });
  },
};

/** Plain text of a line (for copy, matching). */
export function lineText(l: Line): string {
  // eslint-disable-next-line no-control-regex
  const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m|§./g, '');
  if (typeof l === 'string') return strip(l);
  if ('w' in l) return strip(l.w);
  return (l.pre ?? '') + l.code;
}

/** "0.48s", "41s", "1m 5s". */
export function fmtDur(ms: number): string {
  if (ms < 10000) {
    const s = (ms / 1000).toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
    return (s === '0' ? '0.01' : s) + 's';
  }
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
