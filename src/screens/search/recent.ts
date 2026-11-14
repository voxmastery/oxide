// Last six search queries, persisted on their own (kept out of the shared app state).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Recent = { recent: string[]; remember: (q: string) => void; clear: () => void };

export const useRecentSearches = create<Recent>()(
  persist(
    (set) => ({
      recent: [],
      remember: (q) => {
        const v = q.trim();
        if (!v) return;
        set((s) => ({ recent: [v, ...s.recent.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 6) }));
      },
      clear: () => set({ recent: [] }),
    }),
    { name: 'oxide-recent-searches-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ recent: s.recent }) },
  ),
);
