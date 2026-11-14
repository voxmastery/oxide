// Build-along progress. Persisted to AsyncStorage under oxide-buildalong-v1.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ProjectProgress = {
  /** When "Start" first created the project folder (ms). */
  startedAt: number;
  /** Milestone id → time its tests first passed (ms). */
  done: Record<string, number>;
  /** When the last milestone passed (ms). */
  finishedAt?: number;
};

export type BuildAlongData = {
  version: 1;
  projects: Record<string, ProjectProgress>;
};

type State = BuildAlongData & {
  hydrated: boolean;
  markStarted: (project: string) => void;
  /** Records a passed milestone. Returns true the first time (when XP is due). */
  markDone: (project: string, milestone: string, total: number) => boolean;
};

export const useBuildAlong = create<State>()(
  persist(
    (set, get) => ({
      version: 1,
      projects: {},
      hydrated: false,
      markStarted: (project) =>
        set((s) => (s.projects[project] ? {} : { projects: { ...s.projects, [project]: { startedAt: Date.now(), done: {} } } })),
      markDone: (project, milestone, total) => {
        const cur = get().projects[project] ?? { startedAt: Date.now(), done: {} };
        if (cur.done[milestone]) return false;
        const done = { ...cur.done, [milestone]: Date.now() };
        const finishedAt = cur.finishedAt ?? (Object.keys(done).length >= total ? Date.now() : undefined);
        set((s) => ({ projects: { ...s.projects, [project]: { ...cur, done, finishedAt } } }));
        return true;
      },
    }),
    {
      name: 'oxide-buildalong-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ version, projects }) => ({ version, projects }),
      onRehydrateStorage: () => () => { useBuildAlong.setState({ hydrated: true }); },
    },
  ),
);
