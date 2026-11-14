// Daily goal week row (M–S): done #57D6C8, today ringed #F74C00 with a partial fill, others outlined.
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { C } from '../../theme/tokens';
import { m } from '../../theme/fonts';
import { Row } from '../../ui/core';
import { today, type DayLog } from '../../state/app';

function TodayDot({ frac }: { frac: number }) {
  const f = Math.max(0, Math.min(0.9999, frac));
  const a = f * 2 * Math.PI - Math.PI / 2;
  const x = 7 + 7 * Math.cos(a);
  const y = 7 + 7 * Math.sin(a);
  return (
    <Svg width={14} height={14}>
      {f > 0 ? (frac >= 1 ? <Circle cx={7} cy={7} r={7} fill={C.rust} /> : <Path d={`M 7 7 L 7 0 A 7 7 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y} Z`} fill={C.rust} />) : null}
      <Circle cx={7} cy={7} r={6} stroke={C.rust} strokeWidth={2} fill="none" />
    </Svg>
  );
}

export function WeekDots({ days, goal }: { days: Record<string, DayLog>; goal: number }) {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + i);
        const log = days[today(date)];
        const isToday = i === dow;
        const done = !isToday && !!log?.goalMet;
        return (
          <View key={i} style={{ alignItems: 'center', gap: 4 }}>
            {isToday ? (
              <TodayDot frac={(log?.minutes ?? 0) / Math.max(1, goal)} />
            ) : (
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: done ? C.done : 'transparent', borderWidth: done ? 0 : 1.5, borderColor: C.outline }} />
            )}
            <Text style={m(10, undefined, 500, isToday ? C.text : C.tertiary)}>{d}</Text>
          </View>
        );
      })}
    </Row>
  );
}
