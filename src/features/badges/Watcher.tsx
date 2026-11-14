// Mount once, anywhere that's always rendered (the app shell). Renders nothing.
import { useAutoBadges } from './hooks';

export function BadgeWatcher() {
  useAutoBadges();
  return null;
}
