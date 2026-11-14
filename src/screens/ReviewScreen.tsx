// Review: a spaced-repetition session over the learner's own history (src/features/review).
// entry.params: { rescue?: boolean, limit?: number } (the streak rescue opens a short session).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row } from '../ui/core';
import { Bar, Button } from '../ui/controls';
import { TopBar } from '../ui/bars';
import { navActions } from '../nav/store';
import { useApp } from '../state/app';
import { useActiveMinutes } from '../state/useActiveMinutes';
import { currentDeck, SESSION_MAX, useDeck } from '../features/review/deck';
import { useReviewStore, XP_DAILY_MAX } from '../features/review/store';
import { fmtInterval, GRADES, nextInterval, type Grade } from '../features/review/sm2';
import { CardView, type CardResult } from '../features/review/CardViews';
import type { Card, Deck } from '../features/review/cards';
import { finishRescue } from '../features/streak/rescue';
import { useStreak } from '../features/streak/ui';
import { fmtDay, parseIso } from './home/format';
import type { ScreenProps } from './registry';

const GRADE_UI: Record<Grade, { label: string; color: string }> = {
  again: { label: 'Again', color: C.errorText },
  hard: { label: 'Hard', color: C.checkpoint },
  good: { label: 'Good', color: C.done },
  easy: { label: 'Easy', color: C.rustLight },
};

function nextLine(d: Deck): string | null {
  if (!d.nextDue) return null;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const when = parseIso(d.nextDue).toDateString() === tomorrow.toDateString() ? 'tomorrow' : `on ${fmtDay(parseIso(d.nextDue))}`;
  return `Next: ${d.nextDueCount} ${d.nextDueCount === 1 ? 'card' : 'cards'} ${when}`;
}

function GradeRow({ card, suggested, onGrade }: { card: Card; suggested: Grade | null; onGrade: (g: Grade) => void }) {
  const sched = useReviewStore((s) => s.cards[card.id]);
  return (
    <View style={{ gap: 8 }}>
      <Text style={t(13, undefined, 500, C.secondary, { paddingHorizontal: 4 })}>How well did you know it?</Text>
      <Row style={{ gap: 8 }}>
        {GRADES.map((g) => {
          const ui = GRADE_UI[g];
          const on = suggested === g;
          return (
            <Press key={g} onPress={() => onGrade(g)} overlay={null} pressedStyle={{ backgroundColor: C.raised }} radius={14}
              accessibilityRole="button" accessibilityLabel={`${ui.label}, next in ${fmtInterval(nextInterval(sched, g))}`}
              style={{ flex: 1, height: 60, borderRadius: 14, backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Text style={t(14.5, undefined, 600, ui.color)}>{ui.label}</Text>
              <Text style={m(11.5, undefined, 400, C.tertiary)}>{fmtInterval(nextInterval(sched, g))}</Text>
              {on ? <Inset color={ui.color} width={1.5} radius={14} /> : null}
            </Press>
          );
        })}
      </Row>
    </View>
  );
}

function Empty({ deck }: { deck: Deck }) {
  const { back } = navActions();
  const none = deck.total === 0;
  const next = nextLine(deck);
  return (
    <View style={{ flex: 1, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: none ? C.s3 : C.doneTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={none ? 'cards' : 'done_all'} size={32} color={none ? C.disabled : C.done} />
      </View>
      <Text accessibilityRole="header" style={t(22, 1.25, 650, C.text, { textAlign: 'center', letterSpacing: -0.22 })}>{none ? 'Nothing to review yet' : 'All caught up'}</Text>
      <Text style={t(14.5, 1.55, 400, C.mutedHi, { textAlign: 'center' })}>
        {none
          ? 'Review cards come from errors you fix, quick checks you miss and exercises you pass. Keep going and they’ll show up here.'
          : `${next ?? 'Nothing else is scheduled.'} Spacing reviews out is what makes them stick.`}
      </Text>
      <Button variant="tonal" label="Back" onPress={back} style={{ marginTop: 6, minWidth: 120 }} />
    </View>
  );
}

type Stats = Record<Grade, number> & { xp: number };

function Summary({ stats, cards, rescued, streakDays }: { stats: Stats; cards: number; rescued: boolean; streakDays: number }) {
  const { back } = navActions();
  const deck = useDeck();
  const capped = stats.xp === 0 && (useReviewStore.getState().xp.xp >= XP_DAILY_MAX);
  const next = nextLine(deck);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 28 }}>
      <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.doneTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="done_all" size={32} color={C.done} />
        </View>
        <Text accessibilityRole="header" style={t(24, 1.22, 650, C.text, { letterSpacing: -0.48 })}>Review done</Text>
        <Text style={t(14.5, 1.5, 400, C.mutedHi, { textAlign: 'center' })}>
          {`${cards} ${cards === 1 ? 'card' : 'cards'} reviewed${stats.xp ? ` · +${stats.xp} XP` : ''}`}
        </Text>
        {capped ? <Text style={t(13, 1.5, 400, C.tertiary, { textAlign: 'center' })}>{`Review XP is capped at ${XP_DAILY_MAX} a day.`}</Text> : null}
      </View>
      <Row style={{ gap: 8 }}>
        {GRADES.map((g) => (
          <View key={g} style={{ flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: C.s1, alignItems: 'center', gap: 2 }}>
            <Text style={m(20, 26, 600, C.text)}>{stats[g]}</Text>
            <Text style={t(12.5, undefined, 500, GRADE_UI[g].color)}>{GRADE_UI[g].label}</Text>
          </View>
        ))}
      </Row>
      {rescued ? (
        <Row style={{ gap: 12, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,122,61,0.1)' }}>
          <Icon name="local_fire_department" size={24} fill color={C.flame} />
          <Text style={t(14, 1.5, 500, C.text, { flex: 1 })}>{`Streak rescued. Today counts, and your ${streakDays}-day streak carries on.`}</Text>
          <Inset color="rgba(255,122,61,0.26)" radius={18} />
        </Row>
      ) : null}
      {next ? (
        <Row style={{ gap: 10, paddingHorizontal: 4 }}>
          <Icon name="event_repeat" size={20} color={C.secondary} />
          <Text style={t(14, 1.45, 400, C.secondary, { flex: 1 })}>{next}</Text>
        </Row>
      ) : null}
      <Button label="Done" onPress={back} height={52} style={{ marginTop: 4 }} />
    </ScrollView>
  );
}

export default function ReviewScreen({ entry }: ScreenProps) {
  const { back } = navActions();
  useActiveMinutes();
  const params = (entry.params ?? {}) as { rescue?: boolean; limit?: number };
  const liveDeck = useDeck();
  const met = Object.keys(useApp((s) => s.fixed));
  const grade = useReviewStore((s) => s.grade);
  const st = useStreak();

  // The session's cards are fixed when it opens (due first, then today's new ones).
  const [queue, setQueue] = useState<Card[]>(() => {
    const d = currentDeck();
    const limit = Math.max(1, Math.min(SESSION_MAX, params.limit ?? SESSION_MAX));
    return [...d.due, ...d.fresh].slice(0, limit);
  });
  const firstCount = useRef(queue.length).current;
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<CardResult | null>(null);
  const [graded, setGraded] = useState<Set<string>>(() => new Set());
  const [stats, setStats] = useState<Stats>({ again: 0, hard: 0, good: 0, easy: 0, xp: 0 });
  const [rescued, setRescued] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  const finished = queue.length > 0 && idx >= queue.length;
  useEffect(() => {
    if (finished && graded.size > 0 && finishRescue('review')) setRescued(true);
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = queue[idx];
  const repeat = useMemo(() => !!card && queue.indexOf(card) !== idx, [card, queue, idx]);

  const onGrade = (g: Grade) => {
    if (!card) return;
    if (!graded.has(card.id)) {
      const xp = grade(card.id, g);
      setGraded((s) => new Set(s).add(card.id));
      setStats((s) => ({ ...s, [g]: s[g] + 1, xp: s.xp + xp }));
      // Again: once more at the end of this session.
      if (g === 'again') setQueue((q) => [...q, card]);
    }
    setResult(null);
    setIdx((i) => i + 1);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  if (queue.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: C.ground }}>
        <TopBar title="Review" onBack={back} />
        <Empty deck={liveDeck} />
      </View>
    );
  }

  if (finished) {
    return (
      <View style={{ flex: 1, backgroundColor: C.ground }}>
        <TopBar title="Review" onBack={back} />
        <Summary stats={stats} cards={graded.size} rescued={rescued} streakDays={st.current} />
      </View>
    );
  }

  const pos = Math.min(idx + 1, queue.length);
  const suggested: Grade | null = result?.correct === false ? 'again' : result?.correct === true ? 'good' : null;
  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title="Review" subtitle={`${Math.min(graded.size + 1, firstCount)} of ${firstCount}${repeat ? ' · once more' : ''}${params.rescue ? ' · streak rescue' : ''}`} onBack={back} />
      <Bar value={graded.size / Math.max(1, firstCount)} height={3} radius={0} />
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: 16, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        <CardView key={`${card.id}#${idx}`} card={card} seed={`${pos}:${useReviewStore.getState().cards[card.id]?.reviews ?? 0}`} met={met} onResult={setResult} />
        {result ? <GradeRow card={card} suggested={suggested} onGrade={onGrade} /> : null}
      </ScrollView>
    </View>
  );
}
