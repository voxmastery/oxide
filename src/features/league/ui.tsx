import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { Press, Row } from '../../ui/core';
import { navActions } from '../../nav/store';
import { useLeague, useUnseenResult } from './hooks';
import { TIERS } from './model';
import { daysLeft } from './week';

/** Tier emblem: a shield in the tier's color with one chevron per tier (Bronze 1 … Titanium 4). */
export function TierEmblem({ tier, size = 40, dim }: { tier: number; size?: number; dim?: boolean }) {
  const T = TIERS[tier];
  const color = dim ? C.iconOff : T.color;
  const chevrons = tier + 1;
  const top = 21 - (chevrons - 1) * 2.6;
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 40 44">
      <Path d="M20 2.5 L35.5 8.2 V21.5 C35.5 31.2 29 38.2 20 41.5 C11 38.2 4.5 31.2 4.5 21.5 V8.2 Z" fill={dim ? C.s3 : T.tint} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {Array.from({ length: chevrons }, (_, i) => {
        const y = top + i * 5.2;
        return <Path key={i} d={`M13 ${y + 3.6} L20 ${y} L27 ${y + 3.6}`} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </Svg>
  );
}

export const leagueDaysLeft = (now = new Date()) => {
  const d = daysLeft(now);
  return d === 1 ? 'ends tonight' : `${d} days left`;
};

/** Home card: your tier, rank and XP this week. */
export function LeagueCard() {
  const { standings } = useLeague();
  const unseen = useUnseenResult();
  if (!standings) return null;
  const tier = TIERS[standings.tier];
  const you = standings.you;
  const size = standings.entries.length;
  const zone = standings.upTo && you.rank <= standings.upTo ? 'up' : standings.downFrom && you.rank >= standings.downFrom ? 'down' : null;
  const sub = unseen
    ? unseen.move === 'up' ? `Moved up to ${TIERS[unseen.next].name} this week` : unseen.move === 'down' ? `Moved down to ${TIERS[unseen.next].name} this week` : `Stayed in ${TIERS[unseen.next].name}`
    : `${you.xp} XP this week · ${leagueDaysLeft()}`;
  return (
    <Press onPress={() => navActions().nav('league')} overlay={null} pressedStyle={{ backgroundColor: C.s3 }} accessibilityRole="button"
      accessibilityLabel={`${tier.name} league, rank ${you.rank} of ${size}. ${sub}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 14, paddingRight: 10, borderRadius: 18, backgroundColor: C.s1 }}>
      <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <TierEmblem tier={standings.tier} size={38} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text numberOfLines={1} style={t(15, undefined, 600, C.text)}>{`${tier.name} league`}</Text>
        <Text numberOfLines={1} style={t(12.5, undefined, 400, unseen?.move === 'up' ? C.done : C.tertiary)}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Row style={{ gap: 2 }}>
          {zone ? <Icon name={zone === 'up' ? 'arrow_upward' : 'arrow_downward'} size={16} color={zone === 'up' ? C.done : C.errorText} /> : null}
          <Text style={m(17, undefined, 600, C.text)}>{`#${you.rank}`}</Text>
        </Row>
        <Text style={t(11.5, undefined, 400, C.secondary)}>{`of ${size}`}</Text>
      </View>
      <Icon name="chevron_right" size={22} color={C.tertiary} />
    </Press>
  );
}
