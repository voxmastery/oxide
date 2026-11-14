// Derived build-along progress, from the store and the project data.
import { PROJECTS } from './data';
import { useBuildAlong, type ProjectProgress } from './store';
import type { BuildAlongMilestone, BuildAlongProject } from './types';

export type ProjectStatus = {
  started: boolean;
  doneCount: number;
  total: number;
  finished: boolean;
  /** The first milestone not passed yet. */
  next?: BuildAlongMilestone;
  nextIndex: number;
};

export function projectStatus(p: BuildAlongProject, prog: ProjectProgress | undefined): ProjectStatus {
  const done = prog?.done ?? {};
  const nextIndex = p.milestones.findIndex((m) => !done[m.id]);
  const doneCount = p.milestones.filter((m) => done[m.id]).length;
  return {
    started: !!prog,
    doneCount,
    total: p.milestones.length,
    finished: doneCount === p.milestones.length,
    next: nextIndex >= 0 ? p.milestones[nextIndex] : undefined,
    nextIndex,
  };
}

export const projectByName = (name: string | undefined) => PROJECTS.find((p) => p.name === name);

/** Overall progress, e.g. for a Practice or Profile summary. */
export function useBuildAlongSummary() {
  const projects = useBuildAlong((s) => s.projects);
  const statuses = PROJECTS.map((p) => ({ project: p, status: projectStatus(p, projects[p.name]), startedAt: projects[p.name]?.startedAt ?? 0 }));
  const inProgress = statuses.filter((s) => s.status.started && !s.status.finished).sort((a, b) => b.startedAt - a.startedAt);
  return {
    statuses,
    finished: statuses.filter((s) => s.status.finished).length,
    milestonesDone: statuses.reduce((n, s) => n + s.status.doneCount, 0),
    milestonesTotal: statuses.reduce((n, s) => n + s.status.total, 0),
    /** The project to continue: the most recently started unfinished one. */
    current: inProgress[0],
  };
}
