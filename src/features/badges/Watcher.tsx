// Mount once, anywhere that's always rendered (the app shell). Renders nothing.
// Awards state-based badges and keeps the error collection's first-met dates and the code journal's
// project / hello-world entries up to date.
import { useCollectionWatcher } from '../collection/store';
import { useJournalWatcher } from '../journal/store';
import { useAutoBadges } from './hooks';

export function BadgeWatcher() {
  useAutoBadges();
  useCollectionWatcher();
  useJournalWatcher();
  return null;
}
