// Badges: every badge by group, earned ones in colour with the date, the rest dimmed with how to earn
// them. Tapping one opens a detail sheet. `entry.arg` = badge id opens that badge's sheet.
import React, { useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Press, Row, SectionLabel } from '../ui/core';
import { Rich } from '../ui/code';
import { Button } from '../ui/controls';
import { TopBar } from '../ui/bars';
import { BottomSheet } from '../overlays/primitives';
import { navActions } from '../nav/store';
import { Emblem } from '../features/badges/Emblem';
import { GROUPS, BADGE_BY_ID } from '../features/badges/defs';
import { useBadges, type BadgeView } from '../features/badges/hooks';
import { shortDate } from '../features/journal/format';
import type { ScreenProps } from './registry';

function Tile({ b, width, onPress }: { b: BadgeView; width: number; onPress: () => void }) {
  return (
    <Press onPress={onPress} radius={16} overlay="rgba(255,255,255,0.04)" accessibilityRole="button"
      accessibilityLabel={`${b.title}, ${b.earnedAt ? `earned ${shortDate(b.earnedAt)}` : 'not earned yet'}`}
      style={{ width, alignItems: 'center', gap: 8, paddingTop: 12, paddingBottom: 10, paddingHorizontal: 6, borderRadius: 16 }}>
      <Emblem badge={b} earned={!!b.earnedAt} size={60} />
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text numberOfLines={2} style={t(13, 1.3, 600, b.earnedAt ? C.text : C.tertiary, { textAlign: 'center' })}>{b.title}</Text>
        <Text numberOfLines={1} style={m(11, 15, 500, b.earnedAt ? C.secondary : C.disabled)}>{b.earnedAt ? shortDate(b.earnedAt) : 'Locked'}</Text>
      </View>
    </Press>
  );
}

function Detail({ b, onClose }: { b: BadgeView; onClose: () => void }) {
  const go = (fn: () => void) => { onClose(); fn(); };
  const { nav, tab } = navActions();
  // A shortcut toward the badge, where there's an obvious place to go.
  const action = b.earnedAt ? null
    : b.group === 'book' ? { label: 'Open the Book', run: () => tab('learn') }
    : b.group === 'topics' || b.id === 'first-pass' || b.id === 'first-checkpoint' || b.id === 'rustlings-all' ? { label: 'Open Rustlings', run: () => tab('practice') }
    : b.group === 'errors' ? { label: 'See your error collection', run: () => nav('collection') }
    : b.group === 'projects' ? { label: 'Open build-along projects', run: () => nav('buildalong') }
    : b.id === 'bughunt-first' ? { label: 'Open today’s Bug Hunt', run: () => nav('bughunt') }
    : null;
  return (
    <BottomSheet onClose={onClose}>
      <View style={{ alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 }}>
        <Emblem badge={b} earned={!!b.earnedAt} size={96} />
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={t(22, 1.25, 650, C.text, { textAlign: 'center', letterSpacing: -0.2 })}>{b.title}</Text>
          <Rich text={b.desc} style={t(15, 1.5, 400, C.secondary, { textAlign: 'center' })} />
          <Text style={m(12, 18, 500, b.earnedAt ? C.done : C.tertiary)}>{b.earnedAt ? `Earned ${shortDate(b.earnedAt)}` : 'Not earned yet'}</Text>
        </View>
        {action ? <Button variant="tonal" height={44} label={action.label} onPress={() => go(action.run)} style={{ alignSelf: 'stretch' }} /> : null}
      </View>
    </BottomSheet>
  );
}

export default function BadgesScreen({ entry }: ScreenProps) {
  const { list, count, total } = useBadges();
  const { back } = navActions();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<string | null>(entry.arg && BADGE_BY_ID[entry.arg] ? entry.arg : null);
  const tileW = Math.floor((Math.min(width, 600) - 32) / 3);
  const sel = open ? list.find((b) => b.id === open) : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title="Badges" subtitle={`${count} of ${total} earned`} onBack={back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 24 }} showsVerticalScrollIndicator={false}>
        {GROUPS.map((g) => {
          const items = list.filter((b) => b.group === g.id);
          if (!items.length) return null;
          const got = items.filter((b) => b.earnedAt).length;
          return (
            <View key={g.id} style={{ gap: 4 }}>
              <SectionLabel right={`${got} of ${items.length}`} style={{ paddingHorizontal: 4 }}>{g.title.toUpperCase()}</SectionLabel>
              <Row style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {items.map((b) => <Tile key={b.id} b={b} width={tileW} onPress={() => setOpen(b.id)} />)}
              </Row>
            </View>
          );
        })}
      </ScrollView>
      {sel ? <Detail b={sel} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}
