// Earned badges. Persisted to AsyncStorage under oxide-badges-v1.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useNav } from '../../nav/store';
import { BADGE_BY_ID } from './defs';

export type BadgesData = {
  version: 1;
  /** Badge id → time earned (ms). */
  earned: Record<string, number>;
  /**
   * False until the first evaluation against app state. That first pass awards silently, so a user who
   * already met conditions before badges existed doesn't get a burst of toasts.
   */
  initialized: boolean;
};

type BadgesState = BadgesData & { hydrated: boolean };

export const useBadgeStore = create<BadgesState>()(
  persist(
    (): BadgesState => ({ version: 1, earned: {}, initialized: false, hydrated: false }),
    {
      name: 'oxide-badges-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ version, earned, initialized }) => ({ version, earned, initialized }),
      onRehydrateStorage: () => () => {
        useBadgeStore.setState({ hydrated: true });
        const q = queued.splice(0);
        q.forEach(([id, silent]) => awardBadge(id, { silent }));
      },
    },
  ),
);

// Awards made before the store hydrated would be overwritten by the persisted state, so they wait.
const queued: [string, boolean][] = [];

// Several awards in the same tick share one toast.
let toastIds: string[] = [];
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function flushToast() {
  const ids = toastIds;
  toastIds = [];
  if (!ids.length) return;
  const nav = useNav.getState();
  const text = ids.length === 1 ? `Badge earned · ${BADGE_BY_ID[ids[0]].title}` : `${ids.length} badges earned`;
  nav.showToast(text, 'View', () => useNav.getState().nav('badges', { arg: ids.length === 1 ? ids[0] : undefined }));
}

/**
 * Award a badge once. Unknown ids are ignored (with a dev warning); already-earned badges are a no-op.
 * Shows a toast unless `silent`. Returns true if the badge was newly earned.
 */
export function awardBadge(id: string, opts: { silent?: boolean } = {}): boolean {
  if (!BADGE_BY_ID[id]) {
    if (__DEV__) console.warn(`awardBadge: unknown badge "${id}"`);
    return false;
  }
  const s = useBadgeStore.getState();
  if (!s.hydrated) {
    queued.push([id, !!opts.silent]);
    return false;
  }
  if (s.earned[id]) return false;
  useBadgeStore.setState({ earned: { ...s.earned, [id]: Date.now() } });
  if (!opts.silent) {
    toastIds.push(id);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(flushToast, 60);
  }
  return true;
}

/** Forget all badges (call alongside useApp's deleteAccount / resetAll). */
export function resetBadges() {
  useBadgeStore.setState({ earned: {}, initialized: false });
}
