import { useEffect, useState } from 'react';
import { getLeagueBackend } from './backend';
import type { Standings, WeekResult } from './model';
import { useLeagueStore } from './store';

/** This week's standings and past results, refreshed when XP changes and once a minute. */
export function useLeague(): { standings: Standings | null; history: WeekResult[]; local: boolean } {
  const backend = getLeagueBackend();
  const weeks = useLeagueStore((s) => s.weeks);
  const tiers = useLeagueStore((s) => s.tiers);
  const results = useLeagueStore((s) => s.results);
  const hydrated = useLeagueStore((s) => s.hydrated);
  const [tick, setTick] = useState(0);
  const [st, setSt] = useState<Standings | null>(() => backend.peek?.() ?? null);
  const [history, setHistory] = useState<WeekResult[]>([]);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!hydrated && backend.kind === 'local') return;
    let live = true;
    backend.current().then((x) => { if (live) setSt(x); }, () => {});
    backend.history().then((x) => { if (live) setHistory(x); }, () => {});
    return () => { live = false; };
  }, [backend, weeks, tiers, results, hydrated, tick]);
  return { standings: st, history, local: backend.kind === 'local' };
}

/** The newest finished week's result if the user hasn't seen it yet (for a "Promoted" banner). */
export function useUnseenResult(): WeekResult | null {
  const results = useLeagueStore((s) => s.results);
  const seen = useLeagueStore((s) => s.seen);
  const latest = Object.keys(results).sort().pop();
  if (!latest || (seen && seen >= latest)) return null;
  const r = results[latest];
  return r.move === 'stay' && r.xp === 0 ? null : r;
}
