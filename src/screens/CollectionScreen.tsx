// Error collection: every rustc error code, grouped by family. Met codes (ones you've fixed) show how
// often and since when, and open `rustc --explain` in the Terminal; the rest are dimmed.
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row } from '../ui/core';
import { Bar, ErrorBadge } from '../ui/controls';
import { TopBar } from '../ui/bars';
import { navActions } from '../nav/store';
import { useApp } from '../state/app';
import { BY_FAMILY, FAMILIES, type FamilyId } from '../features/collection/families';
import { useCollection, type FirstMet } from '../features/collection/store';
import { shortDate } from '../features/journal/format';
import type { ErrorCodeDoc } from '../content';
import type { ScreenProps } from './registry';

/** Cards shown per family before "Show all". */
const PREVIEW = 6;

function MetCard({ e, n, first }: { e: ErrorCodeDoc; n: number; first?: FirstMet }) {
  return (
    <Press onPress={() => navActions().nav('terminal', { params: { run: `rustc --explain ${e.code}` } })}
      overlay={null} pressedStyle={{ backgroundColor: C.s3 }} accessibilityRole="button"
      accessibilityLabel={`${e.code}, ${e.title}, fixed ${n} ${n === 1 ? 'time' : 'times'}. Opens rustc --explain`}
      style={{ flex: 1, minHeight: 124, padding: 12, borderRadius: 16, backgroundColor: C.s2, gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <ErrorBadge code={e.code} />
        <Text style={m(12.5, undefined, 600, C.mutedHi)}>×{n}</Text>
      </Row>
      <Text numberOfLines={3} style={t(13, 1.35, 500, C.text, { flex: 1 })}>{e.title}</Text>
      {first ? (
        <Text numberOfLines={1} style={m(11, undefined, 500, C.tertiary)}>{`${first.before ? 'Met by' : 'First met'} ${shortDate(first.at)}`}</Text>
      ) : null}
      <Inset radius={16} />
    </Press>
  );
}

function UnmetCard({ e }: { e: ErrorCodeDoc }) {
  return (
    <View accessible accessibilityLabel={`${e.code}, not met yet`}
      style={{ flex: 1, minHeight: 124, padding: 12, borderRadius: 16, backgroundColor: C.s1, gap: 8 }}>
      <Row>
        <View style={{ height: 24, borderRadius: 6, backgroundColor: C.s3, paddingHorizontal: 7, justifyContent: 'center' }}>
          <Text style={m(12, undefined, 600, C.disabled)}>{e.code}</Text>
        </View>
      </Row>
      <Text numberOfLines={3} style={t(13, 1.35, 400, C.disabled)}>{e.title}</Text>
    </View>
  );
}

function Family({ id, title, icon, fixed, firstMet }: { id: FamilyId; title: string; icon: string; fixed: Record<string, number>; firstMet: Record<string, FirstMet> }) {
  const [all, setAll] = useState(false);
  const list = BY_FAMILY[id];
  if (!list.length) return null;
  const met = list.filter((e) => (fixed[e.code] ?? 0) > 0)
    .sort((a, b) => (firstMet[a.code]?.at ?? 0) - (firstMet[b.code]?.at ?? 0) || a.code.localeCompare(b.code));
  const unmet = list.filter((e) => !((fixed[e.code] ?? 0) > 0));
  const cards = [...met, ...unmet];
  const shown = all ? cards : cards.slice(0, Math.max(PREVIEW, met.length + (met.length % 2)));
  const rows: ErrorCodeDoc[][] = [];
  for (let i = 0; i < shown.length; i += 2) rows.push(shown.slice(i, i + 2));
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 8, paddingHorizontal: 4 }}>
        <Row style={{ gap: 10 }}>
          <Icon name={icon} size={20} color={met.length ? C.errorText : C.tertiary} />
          <Text style={t(15.5, 1.3, 600, C.text, { flex: 1 })}>{title}</Text>
          <Text style={m(12, undefined, 500, C.secondary)}>{`met ${met.length} of ${list.length}`}</Text>
        </Row>
        <Bar value={met.length / list.length} height={4} color={C.error} />
      </View>
      {rows.map((r) => (
        <Row key={r[0].code} style={{ gap: 8, alignItems: 'stretch' }}>
          {r.map((e) => ((fixed[e.code] ?? 0) > 0
            ? <MetCard key={e.code} e={e} n={fixed[e.code]} first={firstMet[e.code]} />
            : <UnmetCard key={e.code} e={e} />))}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </Row>
      ))}
      {cards.length > shown.length || all ? (
        <Press onPress={() => setAll(!all)} radius={20} accessibilityRole="button"
          style={{ alignSelf: 'flex-start', height: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={t(14, undefined, 600, C.rustLight)}>{all ? 'Show fewer' : `Show all ${list.length}`}</Text>
          <Icon name={all ? 'expand_less' : 'expand_more'} size={20} color={C.rustLight} />
        </Press>
      ) : null}
    </View>
  );
}

export default function CollectionScreen(_: ScreenProps) {
  const fixed = useApp((s) => s.fixed);
  const firstMet = useCollection((s) => s.firstMet);
  const { back } = navActions();
  const total = FAMILIES.reduce((a, f) => a + BY_FAMILY[f.id].length, 0);
  const met = FAMILIES.reduce((a, f) => a + BY_FAMILY[f.id].filter((e) => (fixed[e.code] ?? 0) > 0).length, 0);
  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title="Error collection" subtitle={`Met ${met} of ${total} errors`} onBack={back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 28 }} showsVerticalScrollIndicator={false}>
        <Text style={t(14, 1.5, 400, C.secondary, { paddingHorizontal: 4 })}>
          {met === 0
            ? 'Every compiler error you fix is added here. Most Rust programmers meet the same few dozen, and each one teaches you something about how Rust thinks.'
            : 'Every compiler error you’ve fixed, grouped by what it’s about. Tap one to read rustc’s full explanation.'}
        </Text>
        {FAMILIES.map((f) => <Family key={f.id} id={f.id} title={f.title} icon={f.icon} fixed={fixed} firstMet={firstMet} />)}
      </ScrollView>
    </View>
  );
}
