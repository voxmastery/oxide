// Daily Bug Hunt state: one play per puzzle number, persisted so a puzzle can't be re-rolled by leaving.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { today, useApp } from '../../state/app';
import { awardBadge } from '../badges/store';
import { numberFor, puzzleFor } from './daily';

export const MAX_TRIES = 3;
/** XP for solving today's puzzle on the 1st, 2nd or 3rd try. Archive puzzles give none. */
export const BUGHUNT_XP = [30, 20, 10] as const;

/** miss = wrong line, near = right line but wrong fix, hit = fixed. */
export type Mark = 'miss' | 'near' | 'hit';

export type Play = {
  n: number;
  /** Puzzle id, so a later change to the list can't swap the puzzle under a finished play. */
  puzzle: string;
  marks: Mark[];
  found: boolean;
  wrongLines: number[];
  wrongOptions: number[];
  status: 'playing' | 'solved' | 'failed';
  /** Played after its day: no XP, doesn't count for the streak. */
  archive: boolean;
  xp: number;
  startedAt: number;
  finishedAt?: number;
};

type Data = { plays: Record<number, Play>; best: number };
type Actions = {
  /** Tap a line of puzzle `n`. */
  tapLine: (n: number, line: number) => 'found' | 'miss' | 'ignored';
  /** Pick fix option `i` of puzzle `n` (after the line was found). */
  pickFix: (n: number, i: number) => 'hit' | 'near' | 'ignored';
  reset: () => void;
};

const fresh = (n: number): Play => ({
  n, puzzle: puzzleFor(n).id, marks: [], found: false, wrongLines: [], wrongOptions: [],
  status: 'playing', archive: n !== numberFor(today()), xp: 0, startedAt: Date.now(),
});

export const useBugHunt = create<Data & Actions>()(
  persist(
    (set, get) => ({
      plays: {},
      best: 0,
      tapLine: (n, line) => {
        const cur = get().plays[n] ?? fresh(n);
        if (cur.status !== 'playing' || cur.found || cur.wrongLines.includes(line)) return 'ignored';
        const p = puzzleFor(n);
        if (line === p.line) {
          set((s) => ({ plays: { ...s.plays, [n]: { ...cur, found: true } } }));
          return 'found';
        }
        const marks: Mark[] = [...cur.marks, 'miss'];
        const failed = marks.length >= MAX_TRIES;
        set((s) => ({ plays: { ...s.plays, [n]: { ...cur, marks, wrongLines: [...cur.wrongLines, line], status: failed ? 'failed' : 'playing', finishedAt: failed ? Date.now() : undefined } } }));
        return 'miss';
      },
      pickFix: (n, i) => {
        const cur = get().plays[n];
        if (!cur || cur.status !== 'playing' || !cur.found || cur.wrongOptions.includes(i)) return 'ignored';
        const p = puzzleFor(n);
        if (i === p.answer) {
          const marks: Mark[] = [...cur.marks, 'hit'];
          const xp = cur.archive ? 0 : BUGHUNT_XP[marks.length - 1] ?? 0;
          const play: Play = { ...cur, marks, status: 'solved', xp, finishedAt: Date.now() };
          const plays = { ...get().plays, [n]: play };
          set({ plays, best: Math.max(get().best, streakOf(plays).current) });
          if (xp > 0) useApp.getState().addXp(xp);
          awardBadge('bughunt-first');
          return 'hit';
        }
        const marks: Mark[] = [...cur.marks, 'near'];
        const failed = marks.length >= MAX_TRIES;
        set((s) => ({ plays: { ...s.plays, [n]: { ...cur, marks, wrongOptions: [...cur.wrongOptions, i], status: failed ? 'failed' : 'playing', finishedAt: failed ? Date.now() : undefined } } }));
        return 'near';
      },
      reset: () => set({ plays: {}, best: 0 }),
    }),
    {
      name: 'oxide-bughunt-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ plays: s.plays, best: s.best }),
    },
  ),
);

/** Days in a row with the day's own puzzle solved. Today doesn't break it until it's over. */
export function streakOf(plays: Record<number, Play>, date = today()) {
  const solvedOnDay = (n: number) => plays[n]?.status === 'solved' && !plays[n].archive;
  let n = numberFor(date);
  if (!solvedOnDay(n)) n -= 1;
  let current = 0;
  while (n >= 1 && solvedOnDay(n)) { current++; n--; }
  return { current };
}

/** Wordle-style result line, e.g. "Oxide Bug Hunt #42 🦀 🟥🟩 2/3". */
export function shareText(play: Play): string {
  const sq = play.marks.map((x) => (x === 'hit' ? '🟩' : x === 'near' ? '🟨' : '🟥')).join('');
  const score = play.status === 'solved' ? `${play.marks.length}/${MAX_TRIES}` : `X/${MAX_TRIES}`;
  return `Oxide Bug Hunt #${play.n} 🦀 ${sq} ${score}`;
}
