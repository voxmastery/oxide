// Home (design/project/Home.dc.html, rl variant): greeting, level, today's mission, track cards,
// roadmap and activity heatmap. Everything is derived from useApp + selectors + content.
import React, { useEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row, SectionLabel } from '../ui/core';
import { Bar, Button, LevelBadge, Ring } from '../ui/controls';
import { navActions } from '../nav/store';
import { today, useApp, type AppData, type Mission, type MissionStep } from '../state/app';
import { bookProgress, buildMission, isDone, levelOf, planDay, rustlingsProgress, streak, todayLog } from '../state/selectors';
import { rustlings, sectionById, toc } from '../content';
import { comma, fmtDay, greeting, initialOf } from './home/format';
import { roadmap } from './home/roadmap';
import { Heatmap } from './home/Heatmap';
import type { ScreenProps } from './registry';
import { FreezeNotice, RescueCard } from '../features/streak';
import { ReviewCard } from '../features/review';
import { BugHuntCard } from '../features/bughunt';
import { LeagueCard } from '../features/league';

type StepView = {
  key: string;
  label: string;
  sub: string;
  meta: string;
  metaColor: string;
  mono: boolean;
  done: boolean;
  progress: number;
  go: () => void;
};

function stepView(s: AppData, st: MissionStep, i: number, day1: boolean): StepView {
  const { nav, tab } = navActions();
  const done = isDone(s, st);
  if (st.kind === 'read') {
    const sec = sectionById(st.id);
    const scroll = done ? 0 : s.book.scroll[st.id] ?? 0;
    const mins = sec?.mins ?? 0;
    const started = scroll > 0.005;
    return {
      key: `r${st.id}${i}`,
      label: `${st.id} ${sec?.title ?? ''}`.trim(),
      sub: day1 && st.id === '1.1' && done ? 'Done during setup' : started ? `The Book · ${Math.max(1, Math.round(mins * (1 - scroll)))} min left` : `The Book · ${mins} min`,
      meta: started ? `${Math.round(scroll * 100)}%` : '',
      metaColor: C.rustLight,
      mono: false,
      done,
      progress: scroll,
      go: () => (day1 && st.id === '1.1' && done ? tab('learn') : nav('reader', { arg: st.id, variant: started ? 'resume' : undefined })),
    };
  }
  if (st.kind === 'ex') {
    const ex = rustlings.exercises[st.id];
    return {
      key: `e${st.id}`,
      label: st.id,
      sub: ex?.summary ? `Rustlings · ${ex.summary.replace(/`/g, '')}` : 'Rustlings',
      meta: done ? '' : `+${ex?.xp ?? 0}`,
      metaColor: C.tertiary,
      mono: true,
      done,
      progress: 0,
      go: () => nav('workspace', { arg: st.id }),
    };
  }
  return {
    key: `t${i}`,
    label: st.cmd,
    sub: 'Terminal · make a project and run it',
    meta: '',
    metaColor: C.tertiary,
    mono: true,
    done,
    progress: 0,
    // Terminal is a tab root; on day 1 it shows the mission card itself.
    go: () => tab('terminal'),
  };
}

function StepRow({ v }: { v: StepView }) {
  return (
    <Press onPress={v.go} overlay="rgba(255,255,255,0.03)" radius={10} accessibilityRole="button" accessibilityLabel={`${v.label}, ${v.sub}`}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 4, borderRadius: 10 }}>
      <Ring value={v.progress} done={v.done} bg={C.s2}>
        {v.done ? <Icon name="check" size={20} color={C.onDone} /> : null}
      </Ring>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={v.mono ? m(14, undefined, 500, v.done ? C.secondary : C.text) : t(15, undefined, 500, v.done ? C.secondary : C.text)}>{v.label}</Text>
        <Text numberOfLines={1} style={t(12.5, undefined, 400, C.tertiary)}>{v.sub}</Text>
      </View>
      {v.meta ? <Text style={m(12, undefined, 500, v.metaColor)}>{v.meta}</Text> : null}
    </Press>
  );
}

function TrackCard({ icon, label, big, of, frac, color, sub, onPress }: { icon: string; label: string; big: string; of: string; frac: number; color: string; sub: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} overlay={null} pressedStyle={{ backgroundColor: C.s3 }} accessibilityRole="button" accessibilityLabel={label}
      style={{ flex: 1, minWidth: 0, gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.s1 }}>
      <Row style={{ gap: 8 }}>
        <Icon name={icon} size={20} color={color} />
        <Text style={t(13.5, undefined, 600, C.text)}>{label}</Text>
      </Row>
      <Row style={{ alignItems: 'baseline', gap: 6, minWidth: 0 }}>
        <Text style={m(24, 24, 600, C.text, { letterSpacing: -0.48 })}>{big}</Text>
        <Text numberOfLines={1} style={t(12.5, undefined, 400, C.secondary)}>{of}</Text>
      </Row>
      <Bar value={frac} height={4} color={color} />
      <Text numberOfLines={1} style={m(11.5, undefined, 400, C.tertiary)}>{sub}</Text>
    </Press>
  );
}

export default function HomeScreen(_: ScreenProps) {
  const s = useApp();
  const { nav, tab, pop } = navActions();
  const date = today();
  const pd = planDay(s);

  // The day's mission is built once, then frozen so its steps don't shift as you finish them.
  const mission: Mission = useMemo(() => buildMission(s), [s.missions[date], s.book, s.ex, s.helloRan, s.plan.goal, s.startDate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (s.onboarded && !useApp.getState().missions[date]) useApp.getState().setMission(mission);
  }, [s.onboarded, date, mission]);

  const steps = mission.steps.map((st, i) => stepView(s, st, i, !!mission.day1));
  const allDone = steps.length > 0 && steps.every((x) => x.done);
  const log = todayLog(s);

  useEffect(() => {
    if (allDone && !useApp.getState().days[date]?.missionDone) {
      useApp.getState().completeMission(date);
      pop('mission');
    }
  }, [allDone, date, pop]);

  const lv = levelOf(s.xp);
  const st = streak(s);
  const day1 = pd.index === 0;
  const next = steps.find((x) => !x.done);
  const r12 = mission.day1 ? isDone(s, { kind: 'read', id: '1.2' }) : false;
  const cta = allDone ? 'Done for today' : mission.day1 ? (r12 ? 'Open the Terminal' : 'Start') : 'Continue';
  const onCta = () => (allDone ? pop('mission') : next ? next.go() : tab('learn'));

  const book = bookProgress(s);
  const rl = rustlingsProgress(s);
  const curCh = s.book.current.split('.')[0];
  const chapters = toc.chapters.filter((c) => typeof c.n === 'number').length;
  const rm = roadmap(s);
  const initial = initialOf(s.user.name);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.ground }} contentContainerStyle={{ gap: 14, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Row style={{ height: 68, gap: 12, paddingLeft: 4 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={1} style={t(22, undefined, 650, C.text, { letterSpacing: -0.33 })}>{greeting(s.user.name, day1)}</Text>
          <Text numberOfLines={1} style={t(13.5, undefined, 400, C.secondary)}>{`${fmtDay(new Date())} · Week ${pd.week}, day ${pd.day}`}</Text>
        </View>
        <Press onPress={() => pop('streak')} overlay={null} hitSlop={{ top: 4, bottom: 4 }} pressedStyle={{ backgroundColor: C.raised }}
          accessibilityRole="button" accessibilityLabel={`Streak ${st.current}`}
          style={{ height: 36, paddingLeft: 8, paddingRight: 12, borderRadius: 18, backgroundColor: C.s3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="local_fire_department" size={22} fill color={st.current > 0 ? C.flame : C.disabled} />
          <Text style={m(15, undefined, 600, C.text)}>{st.current}</Text>
        </Press>
        <Press onPress={() => tab('profile')} radius={22} accessibilityRole="button" accessibilityLabel="Profile"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' }}>
          {initial ? <Text style={t(16, undefined, 600, C.text)}>{initial}</Text> : <Icon name="person" size={22} color={C.text} />}
        </Press>
      </Row>

      {/* Streak safety and reviews (each renders nothing when it doesn't apply) */}
      <FreezeNotice />
      <RescueCard />
      <ReviewCard />

      {/* Level */}
      <Press onPress={() => pop('xp')} overlay={null} pressedStyle={{ backgroundColor: C.s3 }} accessibilityRole="button" accessibilityLabel={`Level ${lv.level}`}
        style={{ gap: 10, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, borderRadius: 18, backgroundColor: C.s1 }}>
        <Row style={{ gap: 10 }}>
          <LevelBadge level={lv.level} />
          <Text numberOfLines={1} style={t(15, undefined, 600, C.text, { flex: 1, minWidth: 0 })}>{lv.title}</Text>
          <Text numberOfLines={1} style={m(12, undefined, 500, C.secondary)}>{`${comma(s.xp)} / ${comma(lv.to)} XP`}</Text>
        </Row>
        <Bar value={s.xp / Math.max(1, lv.to)} height={6} />
      </Press>

      {/* Today's mission */}
      <View style={{ gap: 16, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, borderRadius: 24, backgroundColor: C.s2 }}>
        <SectionLabel right={log.minutes > 0 ? `≈ ${log.minutes} of ${s.plan.goal} min` : `≈ ${mission.mins} min`} rightStyle={m(12, undefined, 500, C.secondary)}>
          TODAY’S MISSION
        </SectionLabel>
        <Text style={t(24, 1.22, 650, C.text, { letterSpacing: -0.48 })}>{mission.title}</Text>
        <View>
          {steps.map((v) => <StepRow key={v.key} v={v} />)}
        </View>
        <Button label={cta} onPress={onCta} height={56} fontSize={17} glow style={{ gap: 10 }}>
          <Icon name="arrow_forward" size={24} color={C.onRust} />
        </Button>
        <Inset radius={24} />
      </View>

      {/* Tracks */}
      <Row style={{ gap: 8, alignItems: 'stretch' }}>
        <TrackCard icon="menu_book" label="The Book" big={s.book.current} of={`Ch ${curCh} of ${chapters}`} frac={book.frac} color={C.rust}
          sub={`${book.read} of ${book.total} sections read`} onPress={() => tab('learn')} />
        <TrackCard icon="data_object" label="Rustlings" big={String(rl.done)} of={`of ${rl.total}`} frac={rl.frac} color={C.done}
          sub={rl.next ? `next: ${rl.next}` : 'all done'} onPress={() => tab('practice')} />
      </Row>

      {/* Daily Bug Hunt and this week's league */}
      <BugHuntCard />
      <LeagueCard />

      {/* Roadmap */}
      <View style={{ gap: 14, padding: 16, borderRadius: 18, backgroundColor: C.s1 }}>
        <Row style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <View style={{ gap: 4, flex: 1 }}>
            <SectionLabel>ROADMAP</SectionLabel>
            <Text style={t(17, undefined, 600, C.text)}>{`Week ${rm.week} of ${rm.total} · ${rm.phase}`}</Text>
          </View>
          <Text style={m(12, undefined, 500, C.secondary)}>{rm.pct}%</Text>
        </Row>
        <Row style={{ gap: 8, alignItems: 'flex-start' }}>
          {rm.phases.map((p) => (
            <View key={p.name} style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <Row style={{ gap: 3 }}>
                {p.weeks.map((w) => (
                  <View key={w.n} style={{ flex: 1, height: 8, borderRadius: 3, backgroundColor: w.state === 'done' ? C.done : w.state === 'now' ? C.rust : C.track }} />
                ))}
              </Row>
              <Text style={t(11.5, 1.25, p.current ? 600 : 400, p.current ? C.text : C.tertiary)}>{p.name}</Text>
            </View>
          ))}
        </Row>
      </View>

      <Heatmap days={s.days} best={st.best} day1={day1} />
    </ScrollView>
  );
}
