// When each error code was first met (fixed). useApp only keeps counts, so this store keeps the timeline
// by watching useApp().fixed. Persisted under oxide-collection-v1.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useApp } from '../../state/app';

export type FirstMet = {
  at: number;
  /** Already in useApp when the collection started watching: the real date is unknown, `at` is an upper bound. */
  before?: boolean;
};

type CollectionState = { version: 1; firstMet: Record<string, FirstMet>; initialized: boolean; hydrated: boolean };

export const useCollection = create<CollectionState>()(
  persist(
    (): CollectionState => ({ version: 1, firstMet: {}, initialized: false, hydrated: false }),
    {
      name: 'oxide-collection-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ version, firstMet, initialized }) => ({ version, firstMet, initialized }),
      onRehydrateStorage: () => () => { useCollection.setState({ hydrated: true }); },
    },
  ),
);

function sync() {
  const fixed = useApp.getState().fixed;
  const { firstMet, initialized } = useCollection.getState();
  const now = Date.now();
  let next: Record<string, FirstMet> | null = null;
  for (const [code, n] of Object.entries(fixed)) {
    if (n > 0 && !firstMet[code]) (next ??= { ...firstMet })[code] = initialized ? { at: now } : { at: now, before: true };
  }
  // Codes that vanished (account deleted / reset) leave the timeline too.
  for (const code of Object.keys(firstMet)) if (!(fixed[code] > 0)) { next ??= { ...firstMet }; delete next[code]; }
  if (next || !initialized) useCollection.setState({ firstMet: next ?? firstMet, initialized: true });
}

/** Records first-met dates as useApp().fixed changes. Mounted by <BadgeWatcher/>. */
export function useCollectionWatcher() {
  const a = useApp((s) => s.hydrated);
  const b = useCollection((s) => s.hydrated);
  useEffect(() => {
    if (!a || !b) return;
    sync();
    let last = useApp.getState().fixed;
    return useApp.subscribe((s) => { if (s.fixed !== last) { last = s.fixed; sync(); } });
  }, [a, b]);
}
