// Weekly XP league (docs/FEATURES_BRIEF.md, agent 1). Local for now: you race your own previous weeks
// and practice rivals generated from the week number. Tiers move on Monday.
import React, { useEffect, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Row, SectionLabel } from '../ui/core';
import { TopBar } from '../ui/bars';
import { navActions } from '../nav/store';
import { useApp } from '../state/app';
import { initialOf } from './home/format';
import { useLeague, useUnseenResult } from '../features/league/hooks';
import { TIERS, type Entry, type WeekResult } from '../features/league/model';
import { useLeagueStore } from '../features/league/store';
import { daysLeft, fmtWeek } from '../features/league/week';
import { TierEmblem, leagueDaysLeft } from '../features/league/ui';
import type { ScreenProps } from './registry';

function Stat({ big, label }: { big: string; label: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={m(20, 24, 600, C.text)}>{big}</Text>
      <Text style={t(12, undefined, 400, C.secondary)}>{label}</Text>
    </View>
  );
}

function ZoneLabel({ up }: { up: boolean }) {
  const color = up ? C.done : C.errorText;
  return (
    <Row style={{ gap: 6, height: 32, paddingHorizontal: 16 }}>
      <Icon name={up ? 'arrow_upward' : 'arrow_downward'} size={14} color={color} />
      <Text style={m(10.5, undefined, 500, color, { letterSpacing: 0.84, textTransform: 'uppercase' })}>{up ? 'Moves up' : 'Moves down'}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: up ? C.doneTint22 : C.errorTint14 }} />
    </Row>
  );
}

function EntryRow({ e, initial }: { e: Entry; initial: string }) {
  const me = e.kind === 'you';
  return (
    <Row style={{ minHeight: 56, gap: 12, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: me ? C.rustTint08 : undefined }}>
      <Text style={m(13, undefined, 600, me ? C.rustLight : C.secondary, { width: 22, textAlign: 'right' })}>{e.rank}</Text>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: me ? C.rust : C.s3 }}>
        {me ? (initial ? <Text style={t(15, undefined, 600, C.onRust)}>{initial}</Text> : <Icon name="person" size={20} color={C.onRust} />)
          : <Icon name={e.kind === 'past' ? 'history' : 'smart_toy'} size={20} color={e.kind === 'past' ? C.rustLight : C.tertiary} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={t(14.5, undefined, me ? 600 : 500, me ? C.text : e.kind === 'past' ? C.strong2 : C.mutedHi)}>{e.name}</Text>
        <Text numberOfLines={1} style={t(12, undefined, 400, C.tertiary)}>{e.sub}</Text>
      </View>
      <Text style={m(13.5, undefined, 600, me ? C.text : C.secondary)}>{`${e.xp} XP`}</Text>
    </Row>
  );
}

function resultLine(r: WeekResult) {
  const t2 = TIERS[r.next].name;
  if (r.move === 'up') return `You finished #${r.rank} in ${TIERS[r.tier].name} and moved up to ${t2}.`;
  if (r.move === 'down') return r.xp === 0 ? `No XP last week, so you moved down to ${t2}. One exercise is enough to get back in the race.` : `You finished #${r.rank} in ${TIERS[r.tier].name} and moved down to ${t2}.`;
  return `You finished #${r.rank} and stayed in ${t2}.`;
}

export default function LeagueScreen(_: ScreenProps) {
  const { back } = navActions();
  const { standings, history, local } = useLeague();
  const name = useApp((s) => s.user.name);
  const unseen = useUnseenResult();
  // Keep showing the banner for this visit, then count it as seen.
  const banner = useRef<WeekResult | null>(null);
  if (unseen && !banner.current) banner.current = unseen;
  useEffect(() => { if (unseen) useLeagueStore.getState().markSeen(unseen.week); }, [unseen]);

  if (!standings) return <View style={{ flex: 1, backgroundColor: C.ground }}><TopBar title="League" onBack={back} /></View>;

  const tier = TIERS[standings.tier];
  const up = TIERS[standings.tier + 1];
  const down = TIERS[standings.tier - 1];
  const rules = up && down ? `Top ${standings.upTo} move up to ${up.name} and the bottom 3 move down to ${down.name} on Monday.`
    : up ? `Top ${standings.upTo} move up to ${up.name} on Monday.`
    : `The top tier. The bottom 3 move down to ${down?.name ?? ''} on Monday.`;
  const left = daysLeft();
  const initial = initialOf(name);
  const entries = standings.entries;
  const b = banner.current;

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title="League" subtitle={`Week of ${fmtWeek(standings.week)} · ${leagueDaysLeft()}`} onBack={back} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {b ? (
          <Row style={{ gap: 12, padding: 14, borderRadius: 18, backgroundColor: b.move === 'up' ? C.doneTint07 : C.s1 }}>
            <Icon name={b.move === 'up' ? 'trending_up' : b.move === 'down' ? 'trending_down' : 'remove'} size={24} color={b.move === 'up' ? C.done : b.move === 'down' ? C.errorText : C.secondary} />
            <Text style={t(14, 1.45, 400, C.reading, { flex: 1 })}>{resultLine(b)}</Text>
            <Inset radius={18} color={b.move === 'up' ? C.doneTint22 : C.hairline} />
          </Row>
        ) : null}

        <View style={{ gap: 16, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, borderRadius: 24, backgroundColor: C.s2 }}>
          <Row style={{ gap: 14 }}>
            <TierEmblem tier={standings.tier} size={56} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={t(22, 1.25, 650, C.text, { letterSpacing: -0.33 })}>{`${tier.name} league`}</Text>
              <Text style={t(13, 1.4, 400, C.secondary)}>{rules}</Text>
            </View>
          </Row>
          <Row style={{ gap: 8 }}>
            <Stat big={`#${standings.you.rank}`} label={`of ${entries.length}`} />
            <Stat big={String(standings.you.xp)} label="XP this week" />
            <Stat big={String(left)} label={left === 1 ? 'day left' : 'days left'} />
          </Row>
          <Row style={{ gap: 6 }}>
            {TIERS.map((x, i) => (
              <View key={x.id} style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 8, borderRadius: 12, backgroundColor: i === standings.tier ? x.tint : 'transparent' }}>
                <TierEmblem tier={i} size={24} dim={i > standings.tier} />
                <Text style={t(11.5, undefined, i === standings.tier ? 600 : 400, i === standings.tier ? C.text : i < standings.tier ? C.secondary : C.disabled)}>{x.name}</Text>
              </View>
            ))}
          </Row>
          <Inset radius={24} />
        </View>

        <View style={{ paddingHorizontal: 4, paddingTop: 6 }}>
          <SectionLabel right="XP this week">Standings</SectionLabel>
        </View>
        <View style={{ borderRadius: 20, backgroundColor: C.s1, overflow: 'hidden', paddingVertical: 4 }}>
          {entries.map((e) => (
            <React.Fragment key={e.id}>
              {standings.upTo && e.rank === 1 ? <ZoneLabel up /> : null}
              {standings.downFrom && e.rank === standings.downFrom ? <ZoneLabel up={false} /> : null}
              {standings.upTo && e.rank === standings.upTo + 1 ? <View style={{ height: 1, marginHorizontal: 16, backgroundColor: C.hairline }} /> : null}
              <EntryRow e={e} initial={initial} />
            </React.Fragment>
          ))}
        </View>

        <Row style={{ gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 18, backgroundColor: C.s1 }}>
          <Icon name="info" size={20} color={C.secondary} />
          <Text style={t(13, 1.5, 400, C.secondary, { flex: 1 })}>
            {local
              ? 'Leagues run on this phone for now. Practice rivals aren’t people: their pace is generated from the week number so there’s always someone to race, and your own last two weeks join in. XP from anything you do in Oxide counts.'
              : 'XP from anything you do in Oxide counts.'}
          </Text>
        </Row>

        {history.length ? (
          <>
            <View style={{ paddingHorizontal: 4, paddingTop: 6 }}><SectionLabel>Past weeks</SectionLabel></View>
            <View style={{ borderRadius: 20, backgroundColor: C.s1, overflow: 'hidden' }}>
              {history.map((r, i) => (
                <Row key={r.week} style={{ minHeight: 60, gap: 12, paddingVertical: 10, paddingHorizontal: 16 }}>
                  {i > 0 ? <View style={{ position: 'absolute', top: 0, left: 16, right: 0, height: 1, backgroundColor: C.hairline }} /> : null}
                  <TierEmblem tier={r.tier} size={26} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={t(14.5, undefined, 500, C.text)}>{`Week of ${fmtWeek(r.week)}`}</Text>
                    <Text style={t(12.5, undefined, 400, C.tertiary)}>{`${TIERS[r.tier].name} · #${r.rank} of ${r.size} · ${r.xp} XP`}</Text>
                  </View>
                  <Text style={t(12.5, undefined, 600, r.move === 'up' ? C.done : r.move === 'down' ? C.errorText : C.secondary)}>
                    {r.move === 'up' ? 'Moved up' : r.move === 'down' ? 'Moved down' : 'Stayed'}
                  </Text>
                </Row>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
