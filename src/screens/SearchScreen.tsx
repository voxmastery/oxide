// Search across the Book, Rustlings and the compiler's error index (design/project/Search.dc.html).
// `entry.arg` = initial query.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { topicByTopicName } from '../content';
import { navActions } from '../nav/store';
import { useApp } from '../state/app';
import { C } from '../theme/tokens';
import { m, mono, sans, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row } from '../ui/core';
import { IconButton } from '../ui/controls';
import { highlightParts, search, type Group, type Hit } from './search/model';
import { useRecentSearches } from './search/recent';
import type { ScreenProps } from './registry';

type Filter = 'all' | Group;
const GROUPS: { g: Group; title: string }[] = [
  { g: 'book', title: 'THE BOOK' },
  { g: 'rl', title: 'RUSTLINGS' },
  { g: 'err', title: 'COMPILER ERRORS' },
];
const FILTERS: { f: Filter; label: string }[] = [
  { f: 'all', label: 'All' }, { f: 'book', label: 'Book' }, { f: 'rl', label: 'Rustlings' }, { f: 'err', label: 'Errors' },
];

/** Query and filter per stack entry, so Back from a result returns to the same results. */
const kept = new Map<string, { q: string; filter: Filter }>();

type Item = { k: 'head'; g: Group; title: string; n: number } | { k: 'row'; hit: Hit };

function go(hit: Hit) {
  const { nav } = navActions();
  const s = useApp.getState();
  switch (hit.target.k) {
    case 'reader': {
      const id = hit.target.id;
      const resume = !s.book.read[id] && (s.book.scroll[id] ?? 0) > 0;
      nav('reader', { arg: id, variant: resume ? 'resume' : undefined });
      return;
    }
    case 'workspace': nav('workspace', { arg: hit.target.name }); return;
    case 'topic': {
      const ex = topicByTopicName(hit.target.name)?.exercises ?? [];
      const next = ex.find((n) => s.ex[n]?.status !== 'done') ?? ex[0];
      if (next) nav('workspace', { arg: next });
      return;
    }
    case 'explain': nav('terminal', { params: { run: `rustc --explain ${hit.target.code}` } }); return;
  }
}

const ResultRow = React.memo(function ResultRow({ hit, q, onGo }: { hit: Hit; q: string; onGo: (h: Hit) => void }) {
  const isMono = hit.group === 'rl';
  const base = isMono ? m(14.5, 19.6, 500, C.text) : t(15, 1.35, 500, C.text);
  const on = isMono ? mono(600) : sans(650);
  return (
    <Press onPress={() => onGo(hit)} overlay="rgba(255,255,255,0.04)" radius={14} accessibilityRole="button"
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, marginHorizontal: 8 }}>
      {hit.code ? (
        <View style={{ height: 24, paddingHorizontal: 7, borderRadius: 6, backgroundColor: C.errorTint, justifyContent: 'center' }}>
          <Text style={m(12, 24, 600, C.errorText)}>{hit.code}</Text>
        </View>
      ) : (
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={hit.group === 'book' ? 'menu_book' : 'data_object'} size={20} color={hit.group === 'book' ? C.rustLight : C.done} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={base} numberOfLines={2}>
          {highlightParts(hit.title, q).map((p, i) => (p.on ? <Text key={i} style={[on, { color: C.rustLight }]}>{p.t}</Text> : p.t))}
        </Text>
        <Text style={t(12.5, 1.35, 400, C.tertiary)} numberOfLines={1}>{hit.sub}</Text>
      </View>
      <Icon name="chevron_right" size={20} color={C.disabled} />
    </Press>
  );
});

export default function SearchScreen({ entry }: ScreenProps) {
  const { back } = navActions();
  const [q, setQ] = useState(() => kept.get(entry.key)?.q ?? entry.arg ?? '');
  const [filter, setFilter] = useState<Filter>(() => kept.get(entry.key)?.filter ?? 'all');
  useEffect(() => { kept.set(entry.key, { q, filter }); }, [entry.key, q, filter]);
  const input = useRef<TextInputInstance>(null);
  const recent = useRecentSearches((s) => s.recent);
  const remember = useRecentSearches((s) => s.remember);

  useEffect(() => {
    if (entry.arg || kept.get(entry.key)?.q) return;
    const id = setTimeout(() => input.current?.focus(), Platform.OS === 'web' ? 150 : 250);
    return () => clearTimeout(id);
  }, [entry.arg]);

  const query = q.trim();
  const res = useMemo(() => search(query), [query]);
  const total = res.book.length + res.rl.length + res.err.length;
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const { g, title } of GROUPS) {
      if (filter !== 'all' && filter !== g) continue;
      const rows = res[g];
      if (!rows.length) continue;
      out.push({ k: 'head', g, title, n: rows.length });
      rows.forEach((hit) => out.push({ k: 'row', hit }));
    }
    return out;
  }, [res, filter]);

  const onGo = useCallback((hit: Hit) => { remember(query); go(hit); }, [query, remember]);
  // Leaving with a query that found something counts as a search worth remembering.
  const lastGood = useRef('');
  if (query && total) lastGood.current = query;
  useEffect(() => () => { if (lastGood.current) useRecentSearches.getState().remember(lastGood.current); }, []);
  const count = (f: Filter) => (f === 'all' ? total : res[f].length);

  const renderItem = useCallback(({ item }: { item: Item }) => item.k === 'head' ? (
    <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 16, paddingBottom: 6, paddingHorizontal: 20 }}>
      <Text style={m(11, undefined, 500, C.secondary, { letterSpacing: 0.99 })}>{item.title}</Text>
      <Text style={m(12, undefined, 500, C.tertiary)}>{item.n}</Text>
    </Row>
  ) : <ResultRow hit={item.hit} q={query} onGo={onGo} />, [query, onGo]);

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <Row style={{ height: 64, gap: 4, paddingTop: 4, paddingRight: 12, paddingLeft: 4 }}>
        <IconButton name="arrow_back" label="Back" onPress={back} />
        <Row style={{ flex: 1, minWidth: 0, height: 48, borderRadius: 24, backgroundColor: C.s3, gap: 8, paddingLeft: 14, paddingRight: 4 }}>
          <Icon name="search" size={20} color={C.secondary} />
          <TextInput
            ref={input}
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => remember(query)}
            placeholder="The Book, Rustlings, errors"
            placeholderTextColor={C.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
            selectionColor={C.rust}
            cursorColor={C.rust}
            style={[{ ...sans(400), fontSize: 15.5, color: C.text, flex: 1, minWidth: 0, height: 48, padding: 0 }, Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : null]}
          />
          {q.length ? <IconButton name="close" size={20} color={C.secondary} label="Clear" style={{ width: 40, height: 40 }} onPress={() => { if (total) remember(query); setQ(''); setTimeout(() => input.current?.focus(), 0); }} /> : null}
        </Row>
      </Row>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingTop: 4, paddingBottom: 6, paddingHorizontal: 16 }}>
          {FILTERS.map(({ f, label }) => {
            const on = filter === f;
            return (
              <Press key={f} onPress={() => setFilter(f)} overlay={null} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ height: 44, paddingVertical: 4 }}>
                <Row style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: on ? C.rustTint : 'transparent', gap: 6 }}>
                  <Inset color={on ? C.rustTint50 : C.outline} radius={17} />
                  <Text style={t(13, undefined, 600, on ? C.rustLight : C.strong2)}>{label}</Text>
                  {query ? <Text style={m(11.5, undefined, 500, on ? C.rustLight : C.tertiary)}>{count(f)}</Text> : null}
                </Row>
              </Press>
            );
          })}
        </ScrollView>
      </View>
      {!query ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 14, paddingHorizontal: 20, gap: 12, paddingBottom: 38 }}>
          {recent.length ? (
            <>
              <Text style={m(11, undefined, 500, C.secondary, { letterSpacing: 0.99 })}>RECENT</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {recent.map((r) => (
                  <Press key={r} onPress={() => setQ(r)} overlay={null} pressedStyle={{ backgroundColor: C.s4 }} accessibilityRole="button"
                    style={{ height: 44, paddingLeft: 10, paddingRight: 14, borderRadius: 12, backgroundColor: C.s2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="history" size={18} color={C.tertiary} />
                    <Text style={m(13.5, undefined, 500, C.strong2)}>{r}</Text>
                  </Press>
                ))}
              </View>
            </>
          ) : null}
          <Text style={t(14, 1.5, 400, C.tertiary, { marginTop: recent.length ? 8 : 0 })}>Search section titles in the Book, Rustlings exercises and the compiler’s error index.</Text>
        </ScrollView>
      ) : items.length === 0 ? (
        <View style={{ paddingVertical: 56, paddingHorizontal: 32, alignItems: 'center', gap: 8 }}>
          <Icon name="search_off" size={32} color={C.disabled} />
          <Text style={t(15.5, 1.35, 600, C.text, { textAlign: 'center' })}>No matches for “{query}”</Text>
          <Text style={t(13.5, 1.5, 400, C.secondary, { maxWidth: 260, textAlign: 'center' })}>Try a word from a section title, an exercise name or an error code like E0382.</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          data={items}
          keyExtractor={(it) => (it.k === 'head' ? 'h' + it.g : it.hit.key)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={14}
          windowSize={9}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
