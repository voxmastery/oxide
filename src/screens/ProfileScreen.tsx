// Profile (design/project/Profile.dc.html): identity + level, streak and daily goal, progress,
// and the compiler errors you've fixed.
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row, SectionLabel } from '../ui/core';
import { Bar, ErrorBadge, IconButton, LevelBadge } from '../ui/controls';
import { navActions } from '../nav/store';
import { today, useApp } from '../state/app';
import { bookProgress, levelOf, rustlingsProgress, streak } from '../state/selectors';
import { errors } from '../content';
import { comma, initialOf, sinceLine } from './home/format';
import { WeekDots } from './profile/WeekDots';
import { bookProjectsMade, useProjects } from './profile/useProjects';
import type { ScreenProps } from './registry';
import { BadgesRow } from '../features/badges';

function ProgressRow({ icon, label, val, frac, color, onPress }: { icon: string; label: string; val: string; frac: number; color: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} overlay={null} accessibilityRole="button" accessibilityLabel={`${label}, ${val}`}
      style={{ minHeight: 56, justifyContent: 'center', gap: 8, paddingVertical: 6 }}>
      <Row style={{ gap: 10 }}>
        <Icon name={icon} size={20} color={color} />
        <Text style={t(14.5, undefined, 600, C.text, { flex: 1 })}>{label}</Text>
        <Text style={m(12, undefined, 500, C.secondary)}>{val}</Text>
      </Row>
      <Bar value={frac} height={4} color={color} />
    </Press>
  );
}

export default function ProfileScreen(_: ScreenProps) {
  const s = useApp();
  const { nav, tab, pop } = navActions();
  const lv = levelOf(s.xp);
  const st = streak(s);
  const book = bookProgress(s);
  const rl = rustlingsProgress(s);
  const proj = bookProjectsMade(useProjects());
  const initial = initialOf(s.user.name);
  const fixed = Object.entries(s.fixed).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const fixes = fixed.reduce((a, [, n]) => a + n, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.ground }} contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <Row style={{ height: 68, gap: 4, paddingTop: 4, paddingLeft: 4 }}>
        <Text style={t(24, undefined, 650, C.text, { flex: 1, letterSpacing: -0.48 })}>Profile</Text>
        <IconButton name="settings" color={C.strong2} label="Settings" onPress={() => nav('settings')} />
      </Row>

      {/* Identity */}
      <Press onPress={() => pop('xp')} overlay={null} accessibilityRole="button" accessibilityLabel={`Level ${lv.level}, ${lv.title}`}
        style={{ padding: 18, borderRadius: 24, backgroundColor: C.s2, gap: 16 }}>
        <Row style={{ gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' }}>
            {initial ? <Text style={t(22, undefined, 600, C.text)}>{initial}</Text> : <Icon name="person" size={28} color={C.text} />}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text numberOfLines={1} style={t(20, undefined, 650, C.text, { letterSpacing: -0.2 })}>{s.user.name.trim() || 'You'}</Text>
            <Text style={t(13, undefined, 400, C.secondary)}>{sinceLine(s.startDate, today())}</Text>
          </View>
        </Row>
        <View style={{ gap: 10 }}>
          <Row style={{ gap: 10 }}>
            <LevelBadge level={lv.level} />
            <Text numberOfLines={1} style={t(15, undefined, 600, C.text, { flex: 1, minWidth: 0 })}>{lv.title}</Text>
          </Row>
          <Bar value={s.xp / Math.max(1, lv.to)} height={6} />
          <Row style={{ justifyContent: 'space-between', gap: 8 }}>
            <Text style={m(12, undefined, 500, C.secondary)}>{`${comma(s.xp)} / ${comma(lv.to)} XP`}</Text>
            <Text style={m(12, undefined, 500, C.secondary)}>{`${comma(lv.toNext)} XP to Lv ${lv.nextLv}`}</Text>
          </Row>
        </View>
        <Inset radius={24} />
      </Press>

      {/* Streak + daily goal */}
      <Row style={{ gap: 8, alignItems: 'stretch' }}>
        <Press onPress={() => pop('streak')} overlay={null} pressedStyle={{ backgroundColor: C.s3 }} accessibilityRole="button" accessibilityLabel={`Streak ${st.current} days`}
          style={{ flex: 1, minWidth: 0, padding: 14, borderRadius: 18, backgroundColor: C.s1, gap: 10 }}>
          <Row style={{ gap: 6 }}>
            <Icon name="local_fire_department" size={20} fill color={st.current > 0 ? C.flame : C.disabled} />
            <Text style={t(13.5, undefined, 600, C.text)}>Streak</Text>
          </Row>
          <Row style={{ alignItems: 'baseline', gap: 6 }}>
            <Text style={m(28, 28, 600, C.text)}>{st.current}</Text>
            <Text style={t(13, undefined, 400, C.secondary)}>{st.current === 1 ? 'day' : 'days'}</Text>
          </Row>
          <Text style={t(12.5, 1.35, 400, C.tertiary)}>{st.best > 0 ? `Best: ${st.best} ${st.best === 1 ? 'day' : 'days'}` : 'Starts when you finish today’s mission'}</Text>
        </Press>
        <View style={{ flex: 1, minWidth: 0, padding: 14, borderRadius: 18, backgroundColor: C.s1, gap: 10 }}>
          <Row style={{ gap: 6 }}>
            <Icon name="timer" size={20} color={C.strong2} />
            <Text style={t(13.5, undefined, 600, C.text)}>Daily goal</Text>
          </Row>
          <Row style={{ alignItems: 'baseline', gap: 6 }}>
            <Text style={m(28, 28, 600, C.text)}>{s.plan.goal}</Text>
            <Text style={t(13, undefined, 400, C.secondary)}>min</Text>
          </Row>
          <WeekDots days={s.days} goal={s.plan.goal} />
        </View>
      </Row>

      {/* Progress */}
      <View style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 10, borderRadius: 18, backgroundColor: C.s1, gap: 6 }}>
        <SectionLabel>PROGRESS</SectionLabel>
        <ProgressRow icon="menu_book" label="The Book" val={`${book.read} of ${book.total} sections`} frac={book.frac} color={C.rust} onPress={() => tab('learn')} />
        <ProgressRow icon="data_object" label="Rustlings" val={`${rl.done} of ${rl.total} exercises`} frac={rl.frac} color={C.done} onPress={() => tab('practice')} />
        <ProgressRow icon="folder_code" label="Book projects" val={`${proj.made} of ${proj.total}`} frac={proj.made / Math.max(1, proj.total)} color={C.checkpoint} onPress={() => tab('terminal')} />
      </View>

      {/* Badges */}
      <BadgesRow />

      {/* Errors you've fixed */}
      <View style={{ paddingTop: 16, paddingHorizontal: 8, paddingBottom: 8, borderRadius: 18, backgroundColor: C.s1, gap: 4 }}>
        <Row style={{ alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 6 }}>
          <SectionLabel>ERRORS YOU’VE FIXED</SectionLabel>
          {fixes ? <Text style={m(12, undefined, 500, C.tertiary)}>{`${fixes} ${fixes === 1 ? 'fix' : 'fixes'}`}</Text> : null}
        </Row>
        <Press onPress={() => nav('collection')} overlay="rgba(255,255,255,0.04)" radius={12} accessibilityRole="button" accessibilityLabel="Error collection"
          style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, borderRadius: 12 }}>
          <Icon name="collections_bookmark" size={22} color={C.rustLight} />
          <Text style={t(14.5, 1.35, 600, C.text, { flex: 1 })}>Error collection</Text>
          <Text style={t(13, undefined, 500, C.rustLight)}>See all</Text>
          <Icon name="chevron_right" size={20} color={C.disabled} />
        </Press>
        {fixed.length === 0 ? (
          <Text style={t(14, 1.5, 400, C.secondary, { marginHorizontal: 8, marginBottom: 8 })}>When you fix a compiler error, it shows up here. Tap one to read what it means.</Text>
        ) : null}
        {fixed.map(([code, n]) => (
          <Press key={code} onPress={() => nav('terminal', { params: { run: `rustc --explain ${code}` } })} overlay="rgba(255,255,255,0.04)" radius={12}
            accessibilityRole="button" accessibilityLabel={`${code}, fixed ${n} times`}
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12 }}>
            <ErrorBadge code={code} />
            <Text style={t(14, 1.35, 400, C.strong2, { flex: 1, minWidth: 0 })}>{errors[code]?.title ?? code}</Text>
            <Text style={m(12.5, undefined, 500, C.secondary)}>×{n}</Text>
            <Icon name="chevron_right" size={20} color={C.disabled} />
          </Press>
        ))}
      </View>

      {/* Code journal */}
      <Press onPress={() => nav('journal')} overlay="rgba(255,255,255,0.04)" radius={18} accessibilityRole="button" accessibilityLabel="Code journal"
        style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: C.s1 }}>
        <Icon name="history_edu" size={24} color={C.done} />
        <View style={{ flex: 1 }}>
          <Text style={t(15, 1.3, 600, C.text)}>Code journal</Text>
          <Text style={t(13, 1.4, 400, C.secondary)}>Every program you’ve passed, then and now</Text>
        </View>
        <Icon name="chevron_right" size={20} color={C.disabled} />
      </Press>
    </ScrollView>
  );
}
