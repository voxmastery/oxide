// Speed runs: best times per exercise and the daily personal-best XP cap.
// Persisted on its own (AsyncStorage key `oxide-speedrun-v1`).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { today, useApp } from '../../state/app';

/** XP for a new personal best, and how many of those count per day. */
export const SPEEDRUN_XP = 5;
export const SPEEDRUN_XP_PER_DAY = 3;

export type SpeedBest = { ms: number; at: number };

export type RunOutcome = {
  exercise: string;
  ms: number;
  /** The best before this run (null on the first run). */
  prevBest: number | null;
  isBest: boolean;
  /** XP awarded for this run (0 or SPEEDRUN_XP). */
  xp: number;
  /** A personal best that earned no XP because today's cap is reached. */
  capped: boolean;
  runs: number;
};

type SpeedState = {
  best: Record<string, SpeedBest>;
  /** Finished runs per exercise. */
  runs: Record<string, number>;
  /** Personal-best XP awards per day (YYYY-MM-DD → count). */
  xpDays: Record<string, number>;
  /** Record a finished, unassisted run and award XP for a new personal best (capped per day). */
  finish: (exercise: string, ms: number) => RunOutcome;
};

export const useSpeedrun = create<SpeedState>()(
  persist(
    (set, get) => ({
      best: {},
      runs: {},
      xpDays: {},
      finish: (exercise, ms) => {
        const s = get();
        const prev = s.best[exercise]?.ms ?? null;
        const isBest = prev === null || ms < prev;
        const d = today();
        const used = s.xpDays[d] ?? 0;
        const xp = isBest && used < SPEEDRUN_XP_PER_DAY ? SPEEDRUN_XP : 0;
        const runs = (s.runs[exercise] ?? 0) + 1;
        set({
          best: isBest ? { ...s.best, [exercise]: { ms, at: Date.now() } } : s.best,
          runs: { ...s.runs, [exercise]: runs },
          // Keep only the last couple of weeks of day counters.
          xpDays: xp ? { ...Object.fromEntries(Object.entries(s.xpDays).filter(([k]) => k >= daysAgo(14))), [d]: used + 1 } : s.xpDays,
        });
        if (xp) useApp.getState().addXp(xp);
        return { exercise, ms, prevBest: prev, isBest, xp, capped: isBest && !xp, runs };
      },
    }),
    {
      name: 'oxide-speedrun-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ best: s.best, runs: s.runs, xpDays: s.xpDays }) as SpeedState,
    },
  ),
);

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return today(d);
}

/** Best time for an exercise in ms, or null. */
export const useBestTime = (exercise: string) => useSpeedrun((s) => s.best[exercise]?.ms ?? null);

/** Personal-best XP awards left today. */
export const speedrunXpLeftToday = () => Math.max(0, SPEEDRUN_XP_PER_DAY - (useSpeedrun.getState().xpDays[today()] ?? 0));

/** "0:42.3", "3:05.0", "1:02:07". Tenths under an hour. */
export function fmtRunTime(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 100));
  const tenths = t % 10;
  const s = Math.floor(t / 10);
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  if (h) return `${h}:${String(mm).padStart(2, '0')}:${ss}`;
  return `${mm}:${ss}.${tenths}`;
}

/** Share text for a run. */
export function shareText(o: Pick<RunOutcome, 'exercise' | 'ms' | 'isBest' | 'prevBest'>): string {
  const pb = o.isBest ? (o.prevBest === null ? ' · first run' : ` · new personal best (was ${fmtRunTime(o.prevBest)})`) : '';
  return `Oxide speed run 🦀 ${o.exercise} in ${fmtRunTime(o.ms)}${pb}`;
}
