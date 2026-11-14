// Streak pieces for Home and the Streak sheet: rescue card, "freeze used" notice, freezes block.
import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Inset, Press, Row } from '../../ui/core';
import { Button } from '../../ui/controls';
import { navActions } from '../../nav/store';
import { useApp } from '../../state/app';
import { rustlings } from '../../content';
import { computeStreak, freezeNotice, MAX_FREEZES, type StreakInfo } from './engine';
import { useStreakStore } from './store';
import { RESCUE_MINUTES, useRescue } from './rescue';

/** Freeze color: the app's cool blue (SYN.dark.fn), the only cold tone next to the rust palette. */
export const ICE = { fg: '#8DB6FF', tint: 'rgba(141,182,255,0.14)', line: 'rgba(141,182,255,0.32)' } as const;

export type UseStreak = StreakInfo & { notice: string | null };

/** current / best / freezes / frozenDays (+ rescuedDays, usedRecently, notice), reactive. */
export function useStreak(): UseStreak {
  const days = useApp((s) => s.days);
  const bestStreak = useApp((s) => s.bestStreak);
  const ex = useApp((s) => s.ex);
  const rescues = useStreakStore((s) => s.rescues);
  return useMemo(() => {
    const st = computeStreak({ days, bestStreak, ex, rescues });
    return { ...st, notice: freezeNotice(st) };
  }, [days, bestStreak, ex, rescues]);
}

/** For the Streak sheet calendar: how a day should be drawn. */
export function streakDayKind(key: string, st: Pick<StreakInfo, 'frozenDays' | 'rescuedDays'>, goalMet: boolean): 'done' | 'frozen' | null {
  if (goalMet || st.rescuedDays.includes(key)) return 'done';
  if (st.frozenDays.includes(key)) return 'frozen';
  return null;
}

// ---------- Home: "1 freeze used yesterday" ----------

/** Renders nothing unless a freeze covered yesterday. Tapping opens the Streak sheet. */
export function FreezeNotice() {
  const st = useStreak();
  if (!st.notice) return null;
  return (
    <Press onPress={() => navActions().pop('streak')} overlay="rgba(255,255,255,0.04)" radius={14} accessibilityRole="button"
      accessibilityLabel={`${st.notice}. Your ${st.current}-day streak is safe.`}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: ICE.tint }}>
      <Icon name="ac_unit" size={20} color={ICE.fg} />
      <Text style={t(13.5, 1.4, 500, C.text, { flex: 1 })}>
        {st.notice}
        <Text style={t(13.5, 1.4, 400, C.secondary)}>{` · your ${st.current}-day streak is safe`}</Text>
      </Text>
      <Icon name="chevron_right" size={20} color={C.tertiary} />
    </Press>
  );
}

// ---------- Streak sheet: freezes ----------

function Flake({ on }: { on: boolean }) {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: on ? ICE.tint : C.s3, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="ac_unit" size={20} color={on ? ICE.fg : C.iconOff} />
      {on ? <Inset color={ICE.line} radius={12} /> : null}
    </View>
  );
}

/** Freezes held, what they do and how to earn them; for the Streak sheet under the calendar. */
export function StreakFreezes() {
  const st = useStreak();
  const n = st.freezes;
  const last = [...st.events].reverse().find((e) => e.kind === 'earned');
  const how = last?.reason === 'quiz' && last.quiz
    ? `Last one earned for passing ${last.quiz}.`
    : last?.reason === 'streak' ? 'Last one earned for a 7-day streak.' : '';
  return (
    <View style={{ marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 20, backgroundColor: C.inputBar, gap: 12 }}>
      <Row style={{ gap: 12 }}>
        <Row style={{ gap: 6 }}>
          {Array.from({ length: MAX_FREEZES }, (_, i) => <Flake key={i} on={i < n} />)}
        </Row>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={t(15, undefined, 600, C.text)}>{n === 0 ? 'No streak freezes' : n === 1 ? '1 streak freeze' : `${n} streak freezes`}</Text>
          <Text style={t(12.5, undefined, 400, C.secondary)}>{`You can hold up to ${MAX_FREEZES}`}</Text>
        </View>
      </Row>
      {st.notice ? (
        <Row style={{ gap: 8 }}>
          <Icon name="ac_unit" size={16} color={ICE.fg} />
          <Text style={t(13, 1.45, 500, ICE.fg, { flex: 1 })}>{st.notice}</Text>
        </Row>
      ) : null}
      <Text style={t(13, 1.5, 400, C.mutedHi2)}>
        {`A missed day uses a freeze automatically, so your streak carries on. Earn one for each checkpoint quiz you pass and for every 7 days in a row.${how ? ` ${how}` : ''}`}
      </Text>
    </View>
  );
}

/** Calendar legend entry for frozen days (add next to “Goal reached” and “Today”). */
export function FrozenLegend() {
  return (
    <Row style={{ gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ICE.fg }} />
      <Text style={t(12, undefined, 400, C.secondary)}>Freeze used</Text>
    </Row>
  );
}

// ---------- Home: rescue mission ----------

/** Shown after 19:00 when a streak of 2+ days is at risk; renders nothing otherwise. */
export function RescueCard() {
  const view = useRescue();
  const st = useStreak();
  if (!view) return null;
  const { rescue: r, done } = view;
  const days = Math.max(st.current, done ? 1 : 0);
  const { nav } = navActions();
  const ex = r.exercise ? rustlings.exercises[r.exercise] : undefined;
  const go = () => (r.kind === 'review' ? nav('review', { params: { rescue: true, limit: r.cards } }) : r.exercise ? nav('workspace', { arg: r.exercise }) : undefined);
  const tint = done ? C.doneTint : 'rgba(255,122,61,0.14)';
  return (
    <View style={{ gap: 14, padding: 16, borderRadius: 24, backgroundColor: C.s2 }}>
      <Row style={{ gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={done ? 'check' : 'local_fire_department'} size={24} fill={!done} color={done ? C.done : C.flame} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={m(11, undefined, 500, done ? C.done : C.flame, { letterSpacing: 0.99 })}>{done ? 'STREAK RESCUED' : `STREAK RESCUE · ${RESCUE_MINUTES} MIN`}</Text>
          <Text style={t(17, 1.3, 600, C.text)}>{done ? 'Today counts' : `Keep your ${days}-day streak`}</Text>
        </View>
      </Row>
      <Text style={t(14, 1.5, 400, C.mutedHi)}>
        {done
          ? `Your ${days}-day streak is safe. See you tomorrow.`
          : 'Today’s goal isn’t met yet. Finish this short mission before midnight and today still counts.'}
      </Text>
      {!done ? (
        <>
          <Press onPress={go} overlay="rgba(255,255,255,0.03)" radius={12} accessibilityRole="button"
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.s3 }}>
            <Icon name={r.kind === 'review' ? 'cards' : 'data_object'} size={22} color={r.kind === 'review' ? C.rustLight : C.done} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text numberOfLines={1} style={r.kind === 'ex' ? m(14, undefined, 500, C.text) : t(15, undefined, 500, C.text)}>
                {r.kind === 'review' ? 'One review session' : r.exercise}
              </Text>
              <Text numberOfLines={1} style={t(12.5, undefined, 400, C.tertiary)}>
                {r.kind === 'review' ? `${r.cards} ${r.cards === 1 ? 'card' : 'cards'} · things you’ve already met` : ex?.summary ? `Rustlings · ${ex.summary.replace(/`/g, '')}` : 'Rustlings · one short exercise'}
              </Text>
            </View>
            <Icon name="chevron_right" size={20} color={C.tertiary} />
          </Press>
          <Button label="Start rescue" onPress={go} height={48} fontSize={15.5} />
        </>
      ) : null}
      <Inset color={done ? C.doneTint22 : 'rgba(255,122,61,0.26)'} radius={24} />
    </View>
  );
}

// ---------- toasts ----------

/**
 * Shows a toast once when a freeze is used for yesterday or a new freeze is earned.
 * Mount once in a component that is always there (e.g. the Shell).
 */
export function useStreakToasts() {
  const st = useStreak();
  const hydrated = useApp((s) => s.hydrated);
  const earned = st.events.filter((e) => e.kind === 'earned').length;
  useEffect(() => {
    if (!hydrated) return;
    const store = useStreakStore.getState();
    const { showToast } = navActions();
    const yesterdayUsed = st.notice && st.frozenDays[st.frozenDays.length - 1];
    if (yesterdayUsed && store.seen.usedFor !== yesterdayUsed) {
      store.markSeen({ usedFor: yesterdayUsed, earnedCount: earned });
      showToast(`${st.notice}. Your ${st.current}-day streak is safe.`);
      return;
    }
    if (store.seen.earnedCount === null) { store.markSeen({ earnedCount: earned }); return; }
    if (earned > store.seen.earnedCount) {
      store.markSeen({ earnedCount: earned });
      const last = st.events.filter((e) => e.kind === 'earned').pop();
      showToast(last?.reason === 'quiz' ? 'Streak freeze earned for passing the quiz' : 'Streak freeze earned for 7 days in a row');
    }
  }, [hydrated, earned, st.notice, st.frozenDays, st.current, st.events]);
}
