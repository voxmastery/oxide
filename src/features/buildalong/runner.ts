// Creating a build-along project on disk and checking a milestone with the real toolchain.
import * as fs from '../../fs';
import { getToolchain, stripAnsi, type Proc } from '../../toolchain';
import { useApp } from '../../state/app';
import { awardBadge } from '../badges';
import { useBuildAlong } from './store';
import type { BuildAlongMilestone, BuildAlongProject } from './types';

/** XP for each milestone, the first time its tests pass. */
export const XP_PER_MILESTONE = 40;

/** Badge id from src/features/badges (BUILD_PROJECTS). */
export const badgeId = (project: string) => `build-${project}`;

export const projectRoot = (project: string) => `${fs.PROJECTS}/${project}`;

/** The command "Check milestone" runs in the project folder. */
export const checkArgv = (m: BuildAlongMilestone) => ['cargo', 'test', '--test', 'milestones', m.filter];
export const checkCommand = (m: BuildAlongMilestone) => checkArgv(m).join(' ');

/**
 * Writes the project into ~/projects/<name>: Cargo.toml, starter code and tests. If the folder is
 * already there (started before, or made by hand), files that exist are kept, so the learner's
 * code is never overwritten; only the milestone tests are always written fresh.
 */
export async function startProject(p: BuildAlongProject): Promise<{ created: boolean; kept: string[] }> {
  const root = projectRoot(p.name);
  const existed = await fs.exists(root);
  const kept: string[] = [];
  for (const [rel, text] of Object.entries(p.files)) {
    const path = `${root}/${rel}`;
    if (rel !== p.testFile && existed && (await fs.exists(path))) {
      kept.push(rel);
      continue;
    }
    await fs.write(path, text);
  }
  useBuildAlong.getState().markStarted(p.name);
  return { created: !existed, kept };
}

export type CheckOutcome = {
  ok: boolean;
  /** Process exit code (127 when the toolchain is unavailable). */
  code: number;
  passed: number;
  failed: number;
  /** Everything cargo printed, ANSI colors kept. */
  lines: string[];
  command: string;
};

/** Sums libtest's `test result: … N passed; M failed` lines. */
export function summarize(lines: string[]): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  for (const l of lines) {
    const m = /test result: \w+\. (\d+) passed; (\d+) failed/.exec(stripAnsi(l));
    if (m) {
      passed += Number(m[1]);
      failed += Number(m[2]);
    }
  }
  return { passed, failed };
}

export type CheckHandle = { done: Promise<CheckOutcome>; kill: () => void };

/**
 * Puts tests/milestones.rs back the way the project shipped it (so editing the tests can't pass a
 * milestone), then runs `cargo test --test milestones mN_` in the project folder. Passing means
 * cargo exited 0 with at least one test run and none failed.
 */
export function checkMilestone(p: BuildAlongProject, m: BuildAlongMilestone, onLines?: (lines: string[]) => void): CheckHandle {
  const lines: string[] = [];
  const open: Record<'stdout' | 'stderr', number> = { stdout: -1, stderr: -1 };
  let proc: Proc | null = null;
  let killed = false;
  const root = projectRoot(p.name);
  const done = (async (): Promise<CheckOutcome> => {
    await fs.write(`${root}/${p.testFile}`, p.files[p.testFile]);
    if (killed) return { ok: false, code: 130, passed: 0, failed: 0, lines, command: checkCommand(m) };
    proc = getToolchain().spawn(checkArgv(m), {
      cwd: fs.native(root),
      env: { CARGO_TERM_COLOR: 'always' },
      onEvent: (e) => {
        if (e.type === 'exit') return;
        if (open[e.type] >= 0) lines[open[e.type]] += e.line;
        else lines.push(e.line);
        open[e.type] = e.partial ? (open[e.type] >= 0 ? open[e.type] : lines.length - 1) : -1;
        onLines?.(lines.slice());
      },
    });
    const code = await proc.done;
    const { passed, failed } = summarize(lines);
    return { ok: code === 0 && passed > 0 && failed === 0, code, passed, failed, lines, command: checkCommand(m) };
  })();
  return {
    done,
    kill: () => {
      killed = true;
      proc?.kill();
    },
  };
}

/**
 * Records a passed milestone: XP the first time, and the project's badge when it is the last one.
 * Returns what happened so the screen can say so.
 */
export function completeMilestone(p: BuildAlongProject, m: BuildAlongMilestone): { first: boolean; finished: boolean; xp: number } {
  const first = useBuildAlong.getState().markDone(p.name, m.id, p.milestones.length);
  if (first) useApp.getState().addXp(XP_PER_MILESTONE);
  const prog = useBuildAlong.getState().projects[p.name];
  const finished = !!prog && p.milestones.every((x) => prog.done[x.id]);
  if (first && finished) awardBadge(badgeId(p.name));
  return { first, finished, xp: first ? XP_PER_MILESTONE : 0 };
}
