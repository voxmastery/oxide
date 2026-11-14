// Pops the Level up moment when XP crosses into a level the user hasn't been congratulated for.
// Mounted once by the Shell. Waits until no popup is open (e.g. after Mission complete closes)
// and never interrupts onboarding.
import { useEffect } from 'react';
import { useNav } from '../nav/store';
import { useApp } from '../state/app';
import { levelOf } from '../state/selectors';

export function useCelebrations() {
  const level = useApp((s) => levelOf(s.xp).level);
  const seen = useApp((s) => s.levelSeen);
  const onboarded = useApp((s) => s.onboarded);
  const hydrated = useApp((s) => s.hydrated);
  const popupOpen = useNav((s) => s.popup !== null);
  const onOnboarding = useNav((s) => s.stack[s.stack.length - 1]?.screen === 'onboarding');

  useEffect(() => {
    if (!hydrated || !onboarded || onOnboarding || popupOpen || level <= seen) return;
    // A short pause so it doesn't land in the same frame as the popup that just closed.
    const id = setTimeout(() => {
      const nav = useNav.getState();
      const app = useApp.getState();
      const lv = levelOf(app.xp).level;
      if (nav.popup || lv <= app.levelSeen) return;
      nav.pop('levelup', { level: lv });
    }, 450);
    return () => clearTimeout(id);
  }, [hydrated, onboarded, onOnboarding, popupOpen, level, seen]);
}
