// ACTIVITY card: contribution-style heatmap of exercises + sections per day (design/project/Home.dc.html).
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { C } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Inset, Press, Row, SectionLabel } from '../../ui/core';
import { today, type DayLog } from '../../state/app';
import { fmtDay, monthShort } from './format';

const COLS = ['#221F1E', '#4A2516', '#87360F', '#C24208', '#F74C00'];
const CELL = 16;
const GAP = 3;
/** Width taken by the weekday labels column + its 6 dp gap. */
const LABEL_W = 8 + 6;

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function levelOf(d: DayLog | undefined) {
  if (!d) return 0;
  const n = d.exercises + d.sections;
  if (n === 0) return d.minutes > 0 ? 1 : 0;
  return n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4;
}

function tipFor(date: Date, d: DayLog | undefined) {
  const day = fmtDay(date);
  if (!d || levelOf(d) === 0) return `${day} · no activity`;
  const parts: string[] = [];
  if (d.exercises) parts.push(plural(d.exercises, 'exercise'));
  if (d.sections) parts.push(plural(d.sections, 'section'));
  if (!parts.length) parts.push(`${d.minutes} min`);
  return `${parts.join(', ')} · ${day}`;
}

export function Heatmap({ days, best, day1 }: { days: Record<string, DayLog>; best: number; day1: boolean }) {
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  // As many weeks as fit the card (17 at the 412 dp reference), at least 12.
  const weeks = Math.max(12, Math.floor((width - LABEL_W + GAP) / (CELL + GAP)) || 17);

  const data = useMemo(() => {
    const now = new Date();
    const todayIso = today(now);
    const dow = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - (weeks - 1) * 7);
    const cells: { i: number; date: Date; lv: number; future: boolean; isToday: boolean; tip: string }[] = [];
    const months: { col: number; label: string }[] = [];
    let active = 0;
    let lastMonth = -1;
    for (let i = 0; i < weeks * 7; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = today(date);
      const future = iso > todayIso;
      const log = future ? undefined : days[iso];
      const lv = levelOf(log);
      if (lv) active++;
      if (i % 7 === 0 && date.getMonth() !== lastMonth) {
        months.push({ col: i / 7, label: monthShort(date) });
        lastMonth = date.getMonth();
      }
      cells.push({ i, date, lv, future, isToday: iso === todayIso, tip: tipFor(date, log) });
    }
    // Drop a leading month label that would collide with the next one.
    if (months.length > 1 && months[1].col - months[0].col < 2) months.shift();
    return { cells, months, active };
  }, [days, weeks]);

  const empty = data.active === 0;
  const tip = sel !== null ? data.cells[sel]?.tip : null;
  const cols = Array.from({ length: weeks }, (_, c) => data.cells.slice(c * 7, c * 7 + 7));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 32)}
      style={{ gap: 12, padding: 16, borderRadius: 18, backgroundColor: C.s1 }}
    >
      <SectionLabel right={empty ? 'Nothing yet' : `${data.active} active days · best streak ${best}`} rightStyle={t(12.5, undefined, 400, C.secondary, { textAlign: 'right' })}>
        ACTIVITY
      </SectionLabel>
      <Row style={{ height: 20 }}>
        <Text style={m(12, undefined, 500, tip ? C.text : C.disabled)}>{tip ?? (day1 ? 'Day 1' : 'Tap a day')}</Text>
      </Row>
      <Row style={{ gap: 6, alignItems: 'flex-start' }}>
        <View style={{ width: 8, paddingTop: 18, gap: GAP }}>
          {['M', '', 'W', '', 'F', '', 'S'].map((d, i) => (
            <Text key={i} style={m(10, 16, 400, C.disabled, { height: 16 })}>{d}</Text>
          ))}
        </View>
        <View style={{ gap: 2 }}>
          <View style={{ height: 16, width: weeks * (CELL + GAP) - GAP }}>
            {data.months.map((mo) => (
              <Text key={mo.col} numberOfLines={1} style={m(10, 16, 400, C.tertiary, { position: 'absolute', left: mo.col * (CELL + GAP), width: 40 })}>{mo.label}</Text>
            ))}
          </View>
          <Row style={{ gap: GAP, alignItems: 'flex-start' }}>
            {cols.map((col, c) => (
              <View key={c} style={{ gap: GAP }}>
                {col.map((cell) => (
                  <Press
                    key={cell.i}
                    overlay={null}
                    disabled={cell.future}
                    onPress={() => setSel(cell.i)}
                    accessibilityLabel={cell.tip}
                    hitSlop={1.5}
                    style={{ width: CELL, height: CELL, borderRadius: 4, backgroundColor: cell.future ? 'transparent' : COLS[cell.lv] }}
                  >
                    {cell.isToday || sel === cell.i ? (
                      <View pointerEvents="none" style={{ position: 'absolute', top: -1.5, left: -1.5, width: CELL + 3, height: CELL + 3, borderRadius: 5.5, borderWidth: 1.5, borderColor: cell.isToday ? C.text : C.secondary }} />
                    ) : null}
                  </Press>
                ))}
              </View>
            ))}
          </Row>
        </View>
      </Row>
      <Row style={{ justifyContent: 'flex-end', gap: 4 }}>
        <Text style={m(11, undefined, 400, C.tertiary, { marginRight: 4 })}>less</Text>
        {COLS.map((bg) => <View key={bg} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: bg }} />)}
        <Text style={m(11, undefined, 400, C.tertiary, { marginLeft: 4 })}>more</Text>
      </Row>
      {empty ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: 64, bottom: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ maxWidth: 260, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'rgba(15,14,14,0.88)' }}>
            <Text style={t(13.5, 1.45, 400, C.strong2, { textAlign: 'center' })}>Your first square lights up when you finish today’s mission.</Text>
            <Inset color={C.border} radius={14} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
