// Where league standings come from. There is no Oxide server yet, so the only implementation is
// local: you race your own previous weeks and practice rivals generated from the week number.
// A server-backed league implements the same interface and is installed with setLeagueBackend().
import { standings, type Standings, type WeekResult } from './model';
import { useLeagueStore } from './store';
import { weekFraction, weekKey } from './week';

export interface LeagueBackend {
  /** 'local' = practice rivals on this device; a server would say 'remote'. */
  readonly kind: 'local' | 'remote';
  /** This week's table, live. */
  current(now?: Date): Promise<Standings>;
  /** Finished weeks, newest first. */
  history(limit?: number): Promise<WeekResult[]>;
  /** The latest table without waiting, if there is one (a cache for a remote backend). */
  peek?(now?: Date): Standings | null;
}

function localCurrent(now = new Date(), settleFirst = true): Standings {
  if (settleFirst) useLeagueStore.getState().rollover(now);
  const s = useLeagueStore.getState();
  return standings(s, weekKey(now), weekFraction(now));
}

export const localLeague: LeagueBackend = {
  kind: 'local',
  current: async (now) => localCurrent(now),
  history: async (limit = 8) => Object.values(useLeagueStore.getState().results).sort((a, b) => (a.week < b.week ? 1 : -1)).slice(0, limit),
  // Pure read (safe during render): weeks that ended are settled by current().
  peek: (now) => (useLeagueStore.getState().hydrated ? localCurrent(now, false) : null),
};

let active: LeagueBackend = localLeague;
export const getLeagueBackend = () => active;
export function setLeagueBackend(b: LeagueBackend) { active = b; }
