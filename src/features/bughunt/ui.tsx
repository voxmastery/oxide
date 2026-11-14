import React from 'react';
import { Text, View } from 'react-native';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Press, Row } from '../../ui/core';
import { navActions } from '../../nav/store';
import { useBugHuntToday } from './hooks';
import { MAX_TRIES, type Mark } from './store';

const MARK_COLOR: Record<Mark, string> = { miss: C.error, near: C.checkpoint, hit: C.done };

/** Three small squares: one per try, colored like the share text (red, yellow, green). */
export function TryDots({ marks, size = 10 }: { marks: Mark[]; size?: number }) {
  return (
    <Row style={{ gap: 4 }} accessibilityLabel={`${marks.length} of ${MAX_TRIES} tries used`}>
      {Array.from({ length: MAX_TRIES }, (_, i) => (
        <View key={i} style={{ width: size, height: size, borderRadius: 3, backgroundColor: marks[i] ? MARK_COLOR[marks[i]] : C.track }} />
      ))}
    </Row>
  );
}

/** Home card: today's Bug Hunt and how it went. */
export function BugHuntCard() {
  const { n, puzzle, play, streak } = useBugHuntToday();
  const status = play?.status ?? 'new';
  const tries = play?.marks.length ?? 0;
  const sub =
    status === 'solved' ? `Fixed in ${tries}/${MAX_TRIES}${play!.xp ? ` · +${play!.xp} XP` : ''}${streak > 1 ? ` · ${streak}-day streak` : ''}`
    : status === 'failed' ? 'It got away this time · a new one tomorrow'
    : tries > 0 || play?.found ? `${MAX_TRIES - tries} ${MAX_TRIES - tries === 1 ? 'try' : 'tries'} left · keep going`
    : `Spot the bug in 3 tries · Ch ${puzzle.chapter}`;
  const done = status === 'solved' || status === 'failed';
  return (
    <Press onPress={() => navActions().nav('bughunt')} overlay={null} pressedStyle={{ backgroundColor: C.s3 }} accessibilityRole="button"
      accessibilityLabel={`Daily Bug Hunt number ${n}. ${sub}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 14, paddingRight: 10, borderRadius: 18, backgroundColor: C.s1 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: status === 'solved' ? C.doneTint : C.checkpointTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={status === 'solved' ? 'check' : 'bug_report'} size={24} color={status === 'solved' ? C.done : C.checkpoint} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Row style={{ gap: 8 }}>
          <Text numberOfLines={1} style={t(15, undefined, 600, C.text, { flexShrink: 1 })}>Daily Bug Hunt</Text>
          <Text style={m(12, undefined, 500, C.tertiary)}>#{n}</Text>
        </Row>
        <Text numberOfLines={1} style={t(12.5, undefined, 400, C.tertiary)}>{sub}</Text>
      </View>
      {done || tries > 0 ? <TryDots marks={play?.marks ?? []} /> : <Text style={m(12, undefined, 500, C.tertiary)}>+30</Text>}
      <Icon name="chevron_right" size={22} color={C.tertiary} />
    </Press>
  );
}
