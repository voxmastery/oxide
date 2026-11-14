// Profile card: the latest badges earned (then the next ones to earn, dimmed). Tapping opens Badges.
import React from 'react';
import { Text, View } from 'react-native';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Press, Row, SectionLabel } from '../../ui/core';
import { navActions } from '../../nav/store';
import { Emblem } from './Emblem';
import { useBadges } from './hooks';

const SHOWN = 5;

export function BadgesRow() {
  const { list, recent, count, total } = useBadges();
  const locked = list.filter((b) => !b.earnedAt && b.group !== 'topics');
  const shown = [...recent.slice(0, SHOWN), ...locked.slice(0, Math.max(0, SHOWN - recent.length))];
  return (
    <Press onPress={() => navActions().nav('badges')} overlay={null} pressedStyle={{ backgroundColor: C.s3 }}
      accessibilityRole="button" accessibilityLabel={`Badges, ${count} of ${total} earned`}
      style={{ padding: 16, borderRadius: 18, backgroundColor: C.s1, gap: 14 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <SectionLabel>BADGES</SectionLabel>
        <Row style={{ gap: 2 }}>
          <Text style={m(12, undefined, 500, C.tertiary)}>{`${count} of ${total}`}</Text>
          <Icon name="chevron_right" size={18} color={C.disabled} />
        </Row>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        {shown.map((b) => (
          <View key={b.id} style={{ width: 56, alignItems: 'center', gap: 6 }}>
            <Emblem badge={b} earned={!!b.earnedAt} size={48} />
            <Text numberOfLines={1} style={t(11, 1.3, 500, b.earnedAt ? C.mutedHi : C.disabled, { textAlign: 'center', width: 64 })}>{b.title}</Text>
          </View>
        ))}
      </Row>
      {count === 0 ? (
        <Text style={t(13, 1.45, 400, C.secondary)}>Badges mark the milestones along the way: your first program, a week-long streak, a finished part of the Book.</Text>
      ) : null}
    </Press>
  );
}
