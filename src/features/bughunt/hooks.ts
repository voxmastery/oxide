import { useEffect, useState } from 'react';
import { today } from '../../state/app';
import { numberFor, puzzleFor } from './daily';
import { streakOf, useBugHunt, type Play } from './store';

/** Today's date, re-read every minute so a screen left open rolls over at midnight. */
export function useToday() {
  const [d, setD] = useState(today());
  useEffect(() => {
    const id = setInterval(() => { const x = today(); setD((p) => (p === x ? p : x)); }, 60000);
    return () => clearInterval(id);
  }, []);
  return d;
}

/** Today's puzzle and the player's progress on it, for Home and the screen. */
export function useBugHuntToday() {
  const date = useToday();
  const plays = useBugHunt((s) => s.plays);
  const best = useBugHunt((s) => s.best);
  const n = numberFor(date);
  const play: Play | undefined = plays[n];
  const streak = streakOf(plays, date).current;
  return { n, date, puzzle: puzzleFor(n), play, streak, best: Math.max(best, streak) };
}
