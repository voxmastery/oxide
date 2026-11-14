// Rescue mission: after 19:00, when today's goal isn't met and a streak of 2+ days is at risk, a 5-minute
// mission (one short review session, or one short exercise) that makes today count if finished.
import { useEffect, useState } from 'react';
import { rustlings } from '../../content';
import { today, useApp, type AppData } from '../../state/app';
import { streak } from '../../state/selectors';
import { reviewDueCount } from '../review/deck';
import { rescueDone } from './engine';
import { useStreakStore, type Rescue } from './store';

export const RESCUE_HOUR = 19;
export const RESCUE_MIN_STREAK = 2;
export const RESCUE_MINUTES = 5;
/** Cards in a rescue review session (about 30 s each). */
export const RESCUE_CARDS = 6;

/** A short exercise for the rescue: the next unfinished one, preferring Easy over Medium, never a quiz. */
function shortExercise(ex: AppData['ex']): string | null {
  const todo = rustlings.order.filter((n) => ex[n]?.status !== 'done' && rustlings.exercises[n]?.difficulty !== 'Quiz').slice(0, 5);
  return todo.find((n) => rustlings.exercises[n].difficulty === 'Easy') ?? todo[0] ?? null;
}

/** Today's rescue if one would be offered right now (not stored). */
export function rescueCandidate(now = new Date()): Rescue | null {
  const a = useApp.getState();
  if (!a.onboarded || now.getHours() < RESCUE_HOUR) return null;
  const st = streak(a);
  if (st.todayCounts || st.current < RESCUE_MIN_STREAK) return null;
  const date = today(now);
  const due = reviewDueCount();
  if (due >= 3) return { date, offeredAt: now.getTime(), kind: 'review', cards: Math.min(RESCUE_CARDS, due), streak: st.current };
  const ex = shortExercise(a.ex);
  if (ex) return { date, offeredAt: now.getTime(), kind: 'ex', exercise: ex, streak: st.current };
  if (due > 0) return { date, offeredAt: now.getTime(), kind: 'review', cards: due, streak: st.current };
  return null;
}

/** Today's rescue: the stored one, or a newly offered one when it applies now. */
export function ensureRescue(now = new Date()): Rescue | null {
  const date = today(now);
  const existing = useStreakStore.getState().rescues[date];
  if (existing) return existing;
  const c = rescueCandidate(now);
  if (c) useStreakStore.getState().offerRescue(c);
  return c;
}

/** Marks today's rescue finished. Call when a review session ends; exercises are detected on their own. */
export function finishRescue(via: 'review' | 'ex'): boolean {
  const r = ensureRescue();
  if (!r || r.doneAt) return false;
  useStreakStore.getState().finishRescue(r.date, via);
  // Screens that call streak(useApp()) re-render on app changes; nudge them since the day now counts.
  useApp.setState({});
  return true;
}

export type RescueView = { rescue: Rescue; done: boolean };

/** Today's rescue for the Home card, re-checked every minute (it appears at 19:00). */
export function useRescue(): RescueView | null {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 60000); return () => clearInterval(id); }, []);
  const ex = useApp((s) => s.ex);
  const days = useApp((s) => s.days);
  const hydrated = useApp((s) => s.hydrated);
  const rescues = useStreakStore((s) => s.rescues);
  const [view, setView] = useState<RescueView | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const r = ensureRescue();
    if (!r) { setView(null); return; }
    const done = rescueDone(r, ex);
    if (done && !r.doneAt) useStreakStore.getState().finishRescue(r.date, 'ex');
    // Hide when today counts without the rescue (the goal was reached anyway).
    const d = days[r.date];
    if (!done && d && (d.goalMet || d.missionDone)) { setView(null); return; }
    setView({ rescue: r, done });
  }, [tick, ex, days, rescues, hydrated]);
  return view;
}

/**
 * Text for the daily reminder when a rescue applies at that time: a streak of 2+ days and a reminder at or
 * after 19:00. Returns null otherwise (keep the usual text). Pass the app state and the reminder time.
 */
export function rescueReminderText(
  s: Pick<AppData, 'days' | 'bestStreak' | 'ex'> = useApp.getState(),
  time: string = useApp.getState().plan.reminderTime,
): string | null {
  const hour = Number(/^(\d{1,2}):\d{2}$/.exec(time.trim())?.[1] ?? NaN);
  if (!(hour >= RESCUE_HOUR && hour < 24)) return null;
  const n = streak(s).current;
  if (n < RESCUE_MIN_STREAK) return null;
  return `Your ${n}-day streak ends at midnight. A ${RESCUE_MINUTES}-minute rescue keeps it going.`;
}
