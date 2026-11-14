// Daily Bug Hunt. Mount <BugHuntCard/> on Home; the screen is registered as 'bughunt'
// (variant 'archive' = past puzzles, arg = puzzle number).
export { BugHuntCard, TryDots } from './ui';
export { useBugHuntToday } from './hooks';
export { useBugHunt, shareText, streakOf, BUGHUNT_XP, MAX_TRIES, type Play } from './store';
export { PUZZLES, type Puzzle } from './puzzles';
export { numberFor, puzzleFor } from './daily';
