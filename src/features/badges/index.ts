// Badges: definitions, awarding, and the pieces other screens mount.
//   awardBadge(id)   award once (toast "Badge earned · <title>" with View → Badges screen)
//   useBadges()      { list, earned, recent, count, total, has(id) }
//   <BadgesRow/>     Profile card
//   <BadgeWatcher/>  mount once in the app shell: awards state-based badges and keeps the
//                    error collection and code journal timelines up to date
export { BADGES, BADGE_BY_ID, GROUPS, BOOK_PARTS, BUILD_PROJECTS, OWNERSHIP_CORE } from './defs';
export type { Badge, BadgeGroup } from './defs';
export { awardBadge, resetBadges, useBadgeStore } from './store';
export { useBadges, type BadgeView } from './hooks';
export { Emblem } from './Emblem';
export { BadgesRow } from './BadgesRow';
export { BadgeWatcher } from './Watcher';
