import { useEffect, useMemo } from 'react';
import { useApp } from '../../state/app';
import { BADGES, type Badge } from './defs';
import { earnedFromState } from './eval';
import { awardBadge, useBadgeStore } from './store';

export type BadgeView = Badge & { earnedAt: number | null };

/** All badges with their earned time, plus counts and the most recently earned first. */
export function useBadges() {
  const earned = useBadgeStore((s) => s.earned);
  return useMemo(() => {
    const list: BadgeView[] = BADGES.map((b) => ({ ...b, earnedAt: earned[b.id] ?? null }));
    const recent = list.filter((b) => b.earnedAt).sort((a, b) => (b.earnedAt ?? 0) - (a.earnedAt ?? 0));
    return { list, earned, recent, count: recent.length, total: list.length, has: (id: string) => !!earned[id] };
  }, [earned]);
}

/** Awards "auto" badges whenever app state changes. Mount once (see <BadgeWatcher/>). */
export function useAutoBadges() {
  const appHydrated = useApp((s) => s.hydrated);
  const badgesHydrated = useBadgeStore((s) => s.hydrated);
  useEffect(() => {
    if (!appHydrated || !badgesHydrated) return;
    const run = () => {
      const silent = !useBadgeStore.getState().initialized;
      const s = useApp.getState();
      // A user who hasn't onboarded yet (or just deleted their account) has nothing to earn.
      if (s.onboarded) earnedFromState(s).forEach((id) => awardBadge(id, { silent }));
      if (silent) useBadgeStore.setState({ initialized: true });
    };
    run();
    let last = useApp.getState();
    return useApp.subscribe((s) => {
      if (s.ex === last.ex && s.book === last.book && s.fixed === last.fixed && s.days === last.days && s.xp === last.xp && s.helloRan === last.helloRan && s.bestStreak === last.bestStreak && s.onboarded === last.onboarded) return;
      last = s;
      run();
    });
  }, [appHydrated, badgesHydrated]);
}
