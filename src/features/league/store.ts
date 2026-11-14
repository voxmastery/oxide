// League state: XP earned per week (watched from useApp's XP total), your tier per week and the
// results of finished weeks. Persisted under oxide-league-v1.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useApp } from '../../state/app';
import { settle, type LeagueData } from './model';
import { addWeeks, weekKey, weeksBetween } from './week';

/**
 * A jump in the XP total bigger than this isn't something you earned in one go (the largest single
 * award is a 100 XP quiz); it's an import or the demo seed, so it doesn't count for the week.
 */
const MAX_STEP = 300;
/** After this many idle weeks, start again in Bronze instead of replaying every week. */
const MAX_REPLAY = 26;

type Store = LeagueData & {
  /** The XP total last seen, so only increases are credited to the week. */
  lastXp: number | null;
  /** Newest finished week whose result the user has seen (banner dismissed). */
  seen: string | null;
  hydrated: boolean;
  /** Credit XP gained since the last look to this week. */
  syncXp: () => void;
  /** Settle any weeks that ended since the last visit (promote / demote). */
  rollover: (now?: Date) => void;
  markSeen: (week: string) => void;
  reset: () => void;
};

const EMPTY: LeagueData & { lastXp: number | null; seen: string | null } = { weeks: {}, tiers: {}, results: {}, lastXp: null, seen: null };

export const useLeagueStore = create<Store>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      hydrated: false,
      syncXp: () => {
        const app = useApp.getState();
        const s = get();
        if (!app.hydrated || !s.hydrated) return;
        const xp = app.xp;
        if (s.lastXp === null || xp <= s.lastXp || xp - s.lastXp > MAX_STEP) {
          if (s.lastXp !== xp) set({ lastXp: xp });
          return;
        }
        const wk = weekKey();
        get().rollover();
        set((x) => ({ lastXp: xp, weeks: { ...x.weeks, [wk]: (x.weeks[wk] ?? 0) + (xp - (s.lastXp ?? xp)) } }));
      },
      rollover: (now = new Date()) => {
        const s = get();
        if (!s.hydrated) return;
        const cur = weekKey(now);
        const keys = Object.keys(s.tiers).sort();
        if (keys.length === 0) { set({ tiers: { [cur]: 0 } }); return; }
        let last = keys[keys.length - 1];
        if (last >= cur) return;
        const gap = weeksBetween(last, cur);
        if (gap > MAX_REPLAY) { set({ tiers: { ...s.tiers, [cur]: 0 } }); return; }
        const data: LeagueData = { weeks: s.weeks, tiers: { ...s.tiers }, results: { ...s.results } };
        while (last < cur) {
          const r = settle(data, last);
          data.results[last] = r;
          last = addWeeks(last, 1);
          data.tiers[last] = r.next;
        }
        set({ tiers: data.tiers, results: data.results });
      },
      markSeen: (week) => set({ seen: week }),
      reset: () => set({ ...EMPTY }),
    }),
    {
      name: 'oxide-league-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ weeks: s.weeks, tiers: s.tiers, results: s.results, lastXp: s.lastXp, seen: s.seen }),
      onRehydrateStorage: () => () => {
        useLeagueStore.setState({ hydrated: true });
        useLeagueStore.getState().rollover();
        useLeagueStore.getState().syncXp();
      },
    },
  ),
);

// Watch the XP total for the life of the app (this module is loaded with the screen registry).
useApp.subscribe((s, prev) => {
  if (s.xp !== prev.xp || s.hydrated !== prev.hydrated) useLeagueStore.getState().syncXp();
  // A full reset of the app (sign-out with delete, "reset") starts the league over too.
  if (prev.xp > 0 && s.xp === 0 && !s.onboarded) useLeagueStore.getState().reset();
});
