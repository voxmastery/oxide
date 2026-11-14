// Review (spaced repetition) state: one schedule per card id, plus today's XP and new-card counters.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { today, useApp } from '../../state/app';
import { schedule, type CardSched, type Grade } from './sm2';

export const XP_PER_CARD = 2;
export const XP_DAILY_MAX = 40;
/** New cards introduced per day (keeps the first sessions short for someone with a long history). */
export const NEW_PER_DAY = 10;

type ReviewData = {
  cards: Record<string, CardSched>;
  /** XP earned from review today. */
  xp: { date: string; xp: number };
  /** New cards first reviewed today. */
  fresh: { date: string; n: number };
  /** Cards graded per day (first grade per card per session), for the summary and stats. */
  log: Record<string, number>;
};

type ReviewActions = {
  /** Records a grade and returns the XP it earned (0 once today's cap is reached). */
  grade: (id: string, g: Grade) => number;
  reset: () => void;
};

const INITIAL: ReviewData = { cards: {}, xp: { date: '', xp: 0 }, fresh: { date: '', n: 0 }, log: {} };

export const useReviewStore = create<ReviewData & ReviewActions>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      grade: (id, g) => {
        const s = get();
        const d = today();
        const prev = s.cards[id];
        const xpToday = s.xp.date === d ? s.xp.xp : 0;
        const earned = Math.max(0, Math.min(XP_PER_CARD, XP_DAILY_MAX - xpToday));
        const freshToday = s.fresh.date === d ? s.fresh.n : 0;
        set({
          cards: { ...s.cards, [id]: schedule(prev, g, d) },
          xp: { date: d, xp: xpToday + earned },
          fresh: { date: d, n: freshToday + (prev ? 0 : 1) },
          log: { ...s.log, [d]: (s.log[d] ?? 0) + 1 },
        });
        if (earned) useApp.getState().addXp(earned);
        return earned;
      },
      reset: () => set({ ...INITIAL }),
    }),
    {
      name: 'oxide-review-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ cards: s.cards, xp: s.xp, fresh: s.fresh, log: s.log }),
    },
  ),
);
