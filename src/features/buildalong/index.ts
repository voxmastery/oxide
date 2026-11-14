// Build-along projects (docs/FEATURES_BRIEF.md, agent 4).
//
// Mount points for the lead:
//   <BuildAlongCard/>  in PracticeScreen, after the "PROJECTS FROM THE BOOK" list.
// The screen itself is src/screens/BuildAlongScreen.tsx (`nav('buildalong')`, or
// `nav('buildalong', { arg: 'todo' })` for one project).
export { PROJECTS } from './data';
export type { BuildAlongMilestone, BuildAlongProject } from './types';
export { useBuildAlong, type ProjectProgress } from './store';
export { projectStatus, projectByName, useBuildAlongSummary, type ProjectStatus } from './progress';
export {
  XP_PER_MILESTONE,
  badgeId,
  projectRoot,
  checkArgv,
  checkCommand,
  startProject,
  checkMilestone,
  completeMilestone,
  summarize,
  type CheckHandle,
  type CheckOutcome,
} from './runner';
export { BuildAlongCard } from './BuildAlongCard';
