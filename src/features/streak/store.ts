// Streak feature state (rescue missions + which freeze notices were already shown).
// Freezes themselves are not stored: they are re-derived from the day log by ./engine.ts, so they can
// never drift from the history they describe.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RescueKind = 'review' | 'ex';

/** One rescue mission, offered at most once per day (after 19:00 with a streak ≥ 2 at risk). */
export type Rescue = {
  date: string;          // YYYY-MM-DD it belongs to
  offeredAt: number;     // ms; any exercise passed or review session finished after this counts
  kind: RescueKind;
  /** kind 'ex': the short exercise suggested. */
  exercise?: string;
  /** kind 'review': cards in the session (≤ 6). */
  cards?: number;
  /** Streak length it protects, for the copy. */
  streak: number;
  doneAt?: number;
  /** How it was finished. */
  via?: 'review' | 'ex';
};

type StreakData = {
  rescues: Record<string, Rescue>;
  /** Last day a "freeze used" / "freeze earned" toast was shown, so each shows once. */
  seen: { usedFor: string | null; earnedCount: number | null };
};

type StreakActions = {
  offerRescue: (r: Rescue) => void;
  finishRescue: (date: string, via: 'review' | 'ex') => void;
  markSeen: (p: Partial<StreakData['seen']>) => void;
  reset: () => void;
};

const INITIAL: StreakData = { rescues: {}, seen: { usedFor: null, earnedCount: null } };

export const useStreakStore = create<StreakData & StreakActions>()(
  persist(
    (set) => ({
      ...INITIAL,
      offerRescue: (r) => set((s) => (s.rescues[r.date] ? {} : { rescues: pruned({ ...s.rescues, [r.date]: r }) })),
      finishRescue: (date, via) => set((s) => {
        const r = s.rescues[date];
        if (!r || r.doneAt) return {};
        return { rescues: { ...s.rescues, [date]: { ...r, doneAt: Date.now(), via } } };
      }),
      markSeen: (p) => set((s) => ({ seen: { ...s.seen, ...p } })),
      reset: () => set({ ...INITIAL }),
    }),
    {
      name: 'oxide-streak-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ rescues: s.rescues, seen: s.seen }),
    },
  ),
);

/** Rescues are part of the streak history, so finished ones are kept; unfinished ones older than 60 days are dropped. */
function pruned(r: Record<string, Rescue>): Record<string, Rescue> {
  const cutoff = Date.now() - 60 * 864e5;
  return Object.fromEntries(Object.entries(r).filter(([, x]) => x.doneAt || x.offeredAt >= cutoff));
}
