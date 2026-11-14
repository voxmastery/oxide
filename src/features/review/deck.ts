// Hooks and plain functions over the deck (app state + review schedules).
import { useMemo } from 'react';
import { today, useApp } from '../../state/app';
import { buildDeck, type Deck } from './cards';
import { useReviewStore } from './store';

/** A session holds at most this many cards (due first, then new ones). */
export const SESSION_MAX = 20;

function freshToday(f: { date: string; n: number }, on: string) { return f.date === on ? f.n : 0; }

/** The deck right now, outside React. */
export function currentDeck(): Deck {
  const a = useApp.getState();
  const r = useReviewStore.getState();
  const on = today();
  return buildDeck(a, r.cards, freshToday(r.fresh, on), on);
}

/** Cards you could review today (due + today's new allowance), capped at one session. */
export function reviewDueCount(): number {
  const d = currentDeck();
  return Math.min(SESSION_MAX, d.due.length + d.fresh.length);
}

export function useDeck(): Deck {
  const fixed = useApp((s) => s.fixed);
  const quickChecks = useApp((s) => s.quickChecks);
  const ex = useApp((s) => s.ex);
  const cards = useReviewStore((s) => s.cards);
  const fresh = useReviewStore((s) => s.fresh);
  const on = today();
  return useMemo(() => buildDeck({ fixed, quickChecks, ex }, cards, freshToday(fresh, on), on), [fixed, quickChecks, ex, cards, fresh, on]);
}

/** Reactive version of reviewDueCount(). */
export function useReviewDueCount(): number {
  const d = useDeck();
  return Math.min(SESSION_MAX, d.due.length + d.fresh.length);
}

/** About 30 s a card. */
export const minutesFor = (cards: number) => Math.max(1, Math.round(cards * 0.5));
