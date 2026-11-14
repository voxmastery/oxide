// Learn tab: the Book (design/project/Book.dc.html, SPEC "Learn: the Book").
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { chapterOf, sectionById, toc } from '../content';
import { navActions } from '../nav/store';
import { useApp } from '../state/app';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row } from '../ui/core';
import { Bar, Button, IconButton, Ring, SegBar } from '../ui/controls';
import { chapterRows, continueId, contentsStats, readFrac, topicDone, type ChapterRow, type SecRow } from './book/model';
import type { ScreenProps } from './registry';

type Item =
  | { k: 'head' }
  | { k: 'cont' }
  | { k: 'contents' }
  | { k: 'ch'; row: ChapterRow }
  | { k: 'foot' };

const openReader = (id: string, resume: boolean) => navActions().nav('reader', { arg: id, variant: resume ? 'resume' : undefined });

function Header() {
  return (
    <Row style={{ height: 64, gap: 4, paddingTop: 4, paddingRight: 8, paddingLeft: 20 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={t(24, 1.2, 650, C.text, { letterSpacing: -0.48 })} numberOfLines={1}>The Book</Text>
        <Text style={t(12.5, 1.3, 400, C.secondary)} numberOfLines={1}>The Rust Programming Language</Text>
      </View>
      <IconButton name="search" color={C.strong2} label="Search the Book" onPress={() => navActions().nav('search')} />
    </Row>
  );
}

function ContinueCard() {
  const book = useApp((s) => s.book);
  const ex = useApp((s) => s.ex);
  const id = continueId(book);
  const meta = sectionById(id);
  const ch = chapterOf(id);
  if (!meta || !ch) return null;
  const frac = readFrac(book, id);
  const started = frac > 0 && frac < 1;
  const left = Math.max(1, Math.round(meta.mins * (1 - frac)));
  const numbered = id.includes('.');
  const title = numbered && ch.n !== 'A' ? `${id} ${meta.title}` : meta.title;
  const sub = `${ch.n === 'A' ? 'Appendix' : ch.title} · ${started ? `${left} min left` : `${meta.mins} min`}`;
  const day1 = id === '1.2';
  const topic = meta.rustlings[0];
  let link: { icon: string; color: string; a: string; b: string; c: string; go: () => void } | null = null;
  if (day1) link = { icon: 'terminal', color: C.rustLight, a: 'Then run it in the Terminal: ', b: 'hello_world', c: '', go: () => navActions().tab('terminal') };
  else if (topic) {
    const d = topicDone(ex, topic);
    link = { icon: 'data_object', color: C.done, a: 'Drill it in Rustlings: ', b: topic, c: ` · ${d.done} of ${d.of}`, go: () => navActions().tab('practice') };
  }
  return (
    <View style={{ marginHorizontal: 16, padding: 16, borderRadius: 24, backgroundColor: C.s2, gap: 14 }}>
      <Inset radius={24} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={m(11, undefined, 500, C.secondary, { letterSpacing: 0.99 })}>CONTINUE READING</Text>
        <Text style={m(12, undefined, 500, C.rustLight)}>{Math.round(frac * 100)}%</Text>
      </Row>
      <View style={{ gap: 4 }}>
        <Text style={t(20, 1.25, 650, C.text, { letterSpacing: -0.2 })}>{title}</Text>
        <Text style={t(13, 1.3, 400, C.secondary)}>{sub}</Text>
      </View>
      <Bar value={frac} height={4} radius={2} />
      {link ? (
        <Press onPress={link.go} overlay={null} pressedStyle={{ backgroundColor: '#262422' }} accessibilityRole="button"
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 12, paddingRight: 8, borderRadius: 14, backgroundColor: C.s4 }}>
          <Icon name={link.icon} size={20} color={link.color} />
          <Text style={t(13.5, 1.35, 400, C.strong2, { flex: 1, minWidth: 0 })}>
            {link.a}<Text style={m(12.5, undefined, 400, C.text)}>{link.b}</Text>{link.c}
          </Text>
          <Icon name="chevron_right" size={20} color={C.tertiary} />
        </Press>
      ) : null}
      <Button label={started ? 'Resume reading' : 'Start reading'} onPress={() => openReader(id, true)}>
        <Icon name="arrow_forward" size={22} color={C.onRust} />
      </Button>
    </View>
  );
}

function Contents({ rows }: { rows: ChapterRow[] }) {
  const book = useApp((s) => s.book);
  const st = contentsStats(rows, book);
  const segs = rows.filter((r) => !r.appendix).map((r) =>
    r.state === 'done' ? { weight: r.weight, fill: 1, color: C.done }
    : r.state === 'cur' ? { weight: r.weight, fill: r.frac, color: C.rust, track: C.outline }
    : { weight: r.weight, fill: 0, color: C.track, track: C.track });
  return (
    <View style={{ gap: 10, paddingTop: 8, paddingHorizontal: 20 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={m(11, undefined, 500, C.secondary, { letterSpacing: 0.99 })}>CONTENTS</Text>
        <Text style={m(12, undefined, 500, C.tertiary)}>{st.read} of {st.total} sections</Text>
      </Row>
      <SegBar segs={segs} height={6} gap={2} />
    </View>
  );
}

const SEC_ICON = { done: ['check_circle', C.done], cur: ['timelapse', C.rustLight], todo: ['radio_button_unchecked', C.iconOff] } as const;

function SectionRowView({ s }: { s: SecRow }) {
  const [icon, ic] = SEC_ICON[s.state];
  return (
    <Press onPress={() => openReader(s.id, s.state === 'cur')} overlay="rgba(255,255,255,0.04)" radius={12} accessibilityRole="button"
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingLeft: 14, paddingRight: 10, borderRadius: 12, backgroundColor: s.isCurrent ? C.rustTint08 : 'transparent' }}>
      <Icon name={icon} size={22} color={ic} fill={s.state === 'done'} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={t(14.5, 1.35, 400, s.state === 'todo' ? C.mutedHi : C.text)}>
          {s.num ? <Text style={m(12.5, undefined, 500, C.tertiary)}>{s.num} </Text> : null}{s.title}
        </Text>
        {s.rl ? <Text style={m(11.5, undefined, 400, C.done)} numberOfLines={1}>{s.rl}</Text> : null}
      </View>
      {s.meta ? <Text style={m(12, undefined, 500, C.rustLight)}>{s.meta}</Text> : null}
    </Press>
  );
}

const ChapterView = React.memo(function ChapterView({ row, open, onToggle }: { row: ChapterRow; open: boolean; onToggle: (k: string) => void }) {
  const rowBg = open ? C.s1 : C.ground;
  const label = (color: string) => <Text style={m(11.5, undefined, 600, color)}>{row.label}</Text>;
  return (
    <View style={{ borderRadius: 18, backgroundColor: open ? C.s1 : 'transparent', marginBottom: 2, marginHorizontal: 8 }}>
      <Press onPress={() => onToggle(row.key)} overlay="rgba(255,255,255,0.03)" radius={18} accessibilityRole="button" accessibilityState={{ expanded: open }}
        style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingLeft: 14, paddingRight: 12, borderRadius: 18 }}>
        {row.state === 'done' ? <Ring done>{label(C.onDone)}</Ring>
          : row.state === 'cur' ? <Ring value={row.frac} bg={rowBg}>{label(C.rustLight)}</Ring>
          : <Ring value={0} track={C.track} bg={rowBg}>{label(C.tertiary)}</Ring>}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={t(15, 1.3, 600, row.state === 'todo' ? C.strong2 : C.text)}>{row.title}</Text>
          <Text numberOfLines={1} style={m(11.5, undefined, 400, row.subKind === 'project' ? C.strong2 : row.subKind === 'rustlings' ? C.secondary : C.disabled)}>{row.sub}</Text>
        </View>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={22} color={C.tertiary} />
      </Press>
      {open ? (
        <View style={{ paddingHorizontal: 6, paddingBottom: 8 }}>
          {row.secs.map((s) => <SectionRowView key={s.id} s={s} />)}
        </View>
      ) : null}
    </View>
  );
});

export default function BookScreen(_: ScreenProps) {
  const book = useApp((s) => s.book);
  const ex = useApp((s) => s.ex);
  const rows = useMemo(() => chapterRows(book, ex), [book, ex]);
  const [open, setOpen] = useState<string | null>(() => String(chapterOf(continueId(useApp.getState().book))?.n ?? toc.chapters[0].n));
  const onToggle = useCallback((k: string) => setOpen((o) => (o === k ? null : k)), []);
  const data = useMemo<Item[]>(() => [{ k: 'head' }, { k: 'cont' }, { k: 'contents' }, ...rows.map((row) => ({ k: 'ch' as const, row })), { k: 'foot' }], [rows]);
  const render = useCallback(({ item, index }: { item: Item; index: number }) => {
    switch (item.k) {
      case 'head': return <Header />;
      case 'cont': return <View style={{ marginTop: 14 }}><ContinueCard /></View>;
      case 'contents': return <View style={{ marginTop: 14, marginBottom: 14 }}><Contents rows={rows} /></View>;
      case 'ch': return <ChapterView row={item.row} open={open === item.row.key} onToggle={onToggle} />;
      case 'foot': return (
        <Text style={t(12.5, 1.55, 400, C.tertiary, { marginTop: 20, marginHorizontal: 24 })}>
          The Rust Programming Language, from the Rust project, MIT or Apache-2.0. Rustlings links follow Rustlings’ own exercise-to-chapter map.
        </Text>
      );
    }
    void index;
    return null;
  }, [rows, open, onToggle]);
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: C.ground }}
      contentContainerStyle={{ paddingBottom: 28 }}
      data={data}
      extraData={open}
      keyExtractor={(it) => (it.k === 'ch' ? 'ch' + it.row.key : it.k)}
      renderItem={render}
      showsVerticalScrollIndicator={false}
      initialNumToRender={12}
      windowSize={9}
    />
  );
}
