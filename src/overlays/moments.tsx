// Moments and messages from design/project/Overlays.dc.html: Mission complete, Level up and the
// heads-up reminder notification.
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme/tokens';
import { m, sectionLabel, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Press, Row } from '../ui/core';
import { Button, IconButton } from '../ui/controls';
import { rustlings } from '../content';
import { navActions } from '../nav/store';
import { today, useApp, XP, type AppData, type Mission, type MissionStep } from '../state/app';
import { buildMission, isDone, LEVELS, planDay, rustlingsProgress, streak, todayLog } from '../state/selectors';
import { Moment } from './primitives';
import type { OverlayProps } from './registry';
import { Burst, Rings } from './fx';
import { OR, num, sectionOrder, sectionTitle } from './parts';

const footerPad = (bottomInset: number) => 8 + Math.max(22, bottomInset);
const secLabel = (id: string) => (id.includes('.') ? `${id} ${sectionTitle(id)}` : `Chapter ${id}, ${sectionTitle(id)}`);
const and = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// ---------- Mission complete ----------

function summary(ms: Mission) {
  if (ms.day1) return 'You wrote and ran your first Rust program.';
  const reads = ms.steps.filter((x): x is Extract<MissionStep, { kind: 'read' }> => x.kind === 'read').map((x) => x.id);
  const exs = ms.steps.filter((x) => x.kind === 'ex').length;
  const terms = ms.steps.filter((x): x is Extract<MissionStep, { kind: 'term' }> => x.kind === 'term').map((x) => x.cmd);
  const parts: string[] = [];
  if (reads.length) parts.push(`read ${and(reads)}`);
  if (exs) parts.push(`fixed ${exs} exercise${exs === 1 ? '' : 's'}`);
  if (terms.length) parts.push(`ran ${and(terms)}`);
  return parts.length ? `You ${and(parts)}.` : 'You finished today’s mission.';
}

function tomorrow(s: AppData) {
  const sec = sectionOrder().find((id) => !s.book.read[id]) ?? null;
  const anyDone = rustlings.order.some((n) => s.ex[n]?.status === 'done');
  const ex = rustlingsProgress(s).next;
  const exPart = ex ? (anyDone ? ex : `your first Rustlings exercise, ${ex}`) : null;
  if (sec && exPart) return `${secLabel(sec)}, then ${exPart}.`;
  if (sec) return `${secLabel(sec)}.`;
  if (ex) return anyDone ? `${ex}.` : `Your first Rustlings exercise, ${ex}.`;
  return 'You’ve finished the Book and Rustlings. Build something of your own.';
}

/** XP earned today: exercises passed today plus the mission bonus. */
function xpToday(s: AppData) {
  const d = today();
  let n = XP.mission;
  for (const e of Object.values(s.ex)) if (e.status === 'done' && e.passedAt && today(new Date(e.passedAt)) === d) n += e.xp ?? 0;
  return n;
}

export function MissionMoment(_: OverlayProps) {
  const s = useApp();
  const insets = useSafeAreaInsets();
  const { closePop, tab } = navActions();
  const date = today();
  // Freeze the mission and the numbers at the moment it completes.
  const ms = useMemo(() => buildMission(s), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { useApp.getState().completeMission(date); }, [date]);
  const pd = planDay(s);
  const stats = [
    { v: `+${xpToday(s)}`, l: 'XP', c: OR },
    { v: String(streak(s).current), l: 'day streak', c: C.flame },
    { v: String(todayLog(s).minutes), l: 'minutes', c: C.text },
  ];
  return (
    <Moment>
      <Row style={{ height: 56, paddingHorizontal: 4 }}>
        <IconButton name="close" label="Close" onPress={closePop} />
      </Row>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center', gap: 20, paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: C.doneTint, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.done, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={44} color={C.onDone} />
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text style={m(11, undefined, 500, C.done, { letterSpacing: 0.88, textAlign: 'center' })}>{`WEEK ${pd.week} · DAY ${pd.day} · MISSION COMPLETE`}</Text>
          <Text accessibilityRole="header" style={t(26, 1.2, 650, C.text, { letterSpacing: -0.52, textAlign: 'center' })}>{summary(ms)}</Text>
        </View>
        <Row style={{ alignSelf: 'stretch', gap: 8 }}>
          {stats.map((x) => (
            <View key={x.l} style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 16, backgroundColor: C.s1, alignItems: 'center', gap: 6 }}>
              <Text style={m(22, 22, 600, x.c)}>{x.v}</Text>
              <Text style={t(12.5, undefined, 400, C.secondary)}>{x.l}</Text>
            </View>
          ))}
        </Row>
        <View style={{ alignSelf: 'stretch', padding: 16, borderRadius: 18, backgroundColor: C.s1, gap: 12 }}>
          <Text style={sectionLabel}>Today</Text>
          {ms.steps.map((st, i) => (
            <Row key={i} style={{ gap: 10 }}>
              <Icon name={isDone(s, st) ? 'check_circle' : 'radio_button_unchecked'} size={20} fill={isDone(s, st)} color={isDone(s, st) ? C.done : C.disabled} />
              {st.kind === 'read'
                ? <Text style={t(15, 1.35, 400, C.text, { flex: 1 })}>{secLabel(st.id)}</Text>
                : <Text style={m(14, 20, 400, C.text, { flex: 1 })}>{st.kind === 'ex' ? st.id : st.cmd}</Text>}
            </Row>
          ))}
        </View>
        <View style={{ alignSelf: 'stretch', padding: 16, borderRadius: 18, backgroundColor: C.s1, gap: 8 }}>
          <Text style={sectionLabel}>Tomorrow</Text>
          <Text style={t(15, 1.5, 400, C.reading)}>{tomorrow(s)}</Text>
        </View>
      </ScrollView>
      <View style={{ gap: 6, paddingTop: 12, paddingHorizontal: 20, paddingBottom: footerPad(insets.bottom) }}>
        <Button label="Done" onPress={closePop} height={56} fontSize={16.5} />
        <Button label="See your progress" variant="text" onPress={() => tab('profile')} height={48} fontSize={15} labelStyle={{ color: C.text }} />
      </View>
    </Moment>
  );
}

// ---------- Level up ----------

/** opts: { level } */
export function LevelUpMoment({ opts }: OverlayProps) {
  const insets = useSafeAreaInsets();
  const { closePop } = navActions();
  const level = Number(opts.level) || 1;
  const i = Math.max(0, LEVELS.findIndex((x) => x.lv === level));
  const L = LEVELS[i];
  const next = LEVELS[i + 1];
  useEffect(() => {
    // Mark it seen as soon as it shows, so Back or a tab switch doesn't bring it back.
    const s = useApp.getState();
    if (s.levelSeen < level) s.set({ levelSeen: level });
  }, [level]);
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, delay: 120, friction: 6, tension: 90, useNativeDriver: true }).start();
  }, [pop]);
  return (
    <Moment>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 24, paddingHorizontal: 28 }}>
        <View style={{ width: 148, height: 148, alignItems: 'center', justifyContent: 'center' }}>
          <Rings size={148} color={C.rust} />
          <Burst colors={[C.rust, OR, C.checkpoint, C.done]} distance={96} spread={18} count={20} delay={300} />
          <Animated.View style={{ width: 148, height: 148, borderRadius: 74, backgroundColor: C.rust, alignItems: 'center', justifyContent: 'center', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
            <View style={{ width: 134, height: 134, borderRadius: 67, backgroundColor: C.ground, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Text style={m(13, undefined, 500, OR)}>Lv</Text>
              <Text style={m(56, 56, 600, C.text, { letterSpacing: -1.68 })}>{L.lv}</Text>
            </View>
          </Animated.View>
        </View>
        <Text style={m(11, undefined, 500, OR, { marginTop: 8, letterSpacing: 0.99 })}>LEVEL UP</Text>
        <Text accessibilityRole="header" style={t(28, 1.2, 650, C.text, { letterSpacing: -0.56, textAlign: 'center' })}>{L.title}</Text>
        <Text style={t(15.5, 1.55, 400, C.secondary, { maxWidth: 300, textAlign: 'center' })}>{`You passed ${num(L.from)} XP. ${L.next}`}</Text>
        <View style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.s1 }}>
          <Text style={m(12.5, undefined, 500, C.secondary)}>{next ? `Next: Lv ${next.lv} at ${num(next.from)} XP` : 'You reached the top level'}</Text>
        </View>
      </View>
      <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: footerPad(insets.bottom) }}>
        <Button label="Continue" onPress={closePop} height={56} fontSize={16.5} />
      </View>
    </Moment>
  );
}

// ---------- Heads-up reminder ----------

export function PushNotice(_: OverlayProps) {
  const s = useApp();
  const insets = useSafeAreaInsets();
  const { closePop, nav, tab } = navActions();
  const st = streak(s);
  const log = todayLog(s);
  const left = Math.max(0, s.plan.goal - log.minutes);
  const ms = buildMission(s);
  const pending = ms.steps.find((x): x is Extract<MissionStep, { kind: 'ex' }> => x.kind === 'ex' && !isDone(s, x));
  const nextEx = pending?.id ?? rustlingsProgress(s).next;
  const title = st.current > 0 && !log.goalMet ? `Your ${st.current}-day streak ends at midnight` : st.current > 0 ? `Your streak is ${st.current} days` : 'Start your streak today';
  const body = [
    left > 0 ? `${left} minute${left === 1 ? '' : 's'} left on today’s goal.` : 'You’ve reached today’s goal.',
    nextEx ? `Pick up at ${nextEx}.` : '',
  ].filter(Boolean).join(' ');

  const y = useRef(new Animated.Value(-140)).current;
  useEffect(() => {
    Animated.timing(y, { toValue: 0, duration: 320, easing: Easing.bezier(0.2, 0.9, 0.25, 1.04), useNativeDriver: true }).start();
  }, [y]);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Animated.View
        accessibilityRole="alert"
        style={{
          position: 'absolute', top: 6 + insets.top, left: 8, right: 8, borderRadius: 24, backgroundColor: C.dialog,
          paddingTop: 14, paddingHorizontal: 16, paddingBottom: 8, gap: 6, transform: [{ translateY: y }],
          shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 12,
        }}
      >
        <Row style={{ gap: 8 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.rust, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: C.onRust }} />
          </View>
          <Text style={t(12.5, undefined, 400, C.mutedHi)}>Oxide · now</Text>
        </Row>
        <Text style={t(15, 1.35, 600, C.text)}>{title}</Text>
        <Text style={t(14, 1.45, 400, C.mutedHi)}>{body}</Text>
        <Row style={{ gap: 4, marginTop: 2, marginHorizontal: -10 }}>
          <Press onPress={() => (nextEx ? nav('workspace', { arg: nextEx }) : tab('home'))} radius={20} accessibilityRole="button" style={{ height: 40, paddingHorizontal: 12, borderRadius: 20, justifyContent: 'center' }}>
            <Text style={t(14, undefined, 600, OR)}>Continue</Text>
          </Press>
          <Press onPress={closePop} radius={20} accessibilityRole="button" style={{ height: 40, paddingHorizontal: 12, borderRadius: 20, justifyContent: 'center' }}>
            <Text style={t(14, undefined, 600, OR)}>Later</Text>
          </Press>
        </Row>
      </Animated.View>
    </View>
  );
}
