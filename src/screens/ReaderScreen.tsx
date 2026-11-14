// Book reader (design/project/Reader.dc.html, SPEC "Reader"). `entry.arg` = section id;
// `entry.variant === 'resume'` scrolls to the YOU LEFT OFF HERE marker; `entry.params.anchor` to a heading.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, type ScrollViewInstance, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { chapterOf, exercisesForSection, loadSection, nextSection, sectionById, topicByTopicName, type Block, type BookSectionMeta } from '../content';
import { navActions } from '../nav/store';
import { useApp } from '../state/app';
import { useActiveMinutes } from '../state/useActiveMinutes';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Press, Row } from '../ui/core';
import { IconButton } from '../ui/controls';
import { CodeBlock, Heading, Hr, ImageBlock, ListBlock, NoteBlock, QuoteBlock, TableBlock, type Prose } from './reader/blocks';
import { InlineText } from './reader/Inline';
import { QuickCheck } from './reader/Quiz';
import { EndGeneric, EndHello, EndRules, LeftOffMarker, OxideTip, PracticeCard } from './reader/cards';
import { buildItems, drillsText, type RItem } from './reader/plan';
import type { ScreenProps } from './registry';

const pageLabel = (meta: BookSectionMeta) => {
  const ch = chapterOf(meta.id);
  if (!meta.id.includes('.')) return ch?.n === 'A' ? 'Appendix' : meta.title;
  return ch?.n === 'A' ? meta.title : `${meta.id} ${meta.title}`;
};
const upNextLabel = (meta: BookSectionMeta) => {
  const ch = chapterOf(meta.id);
  if (meta.id.includes('.')) return `Up next: ${pageLabel(meta)}`;
  return ch?.n === 'A' ? 'Up next: Appendix' : `Up next: Chapter ${meta.id} · ${meta.title}`;
};

function renderBlock(b: Block, p: Prose, k: number | string): React.ReactNode {
  switch (b.type) {
    case 'p': return <InlineText key={k} nodes={b.text} style={t(p.size, p.line, 400, C.reading)} onAnchor={p.onAnchor} />;
    case 'h2': case 'h3': case 'h4': return <Heading key={k} b={b} />;
    case 'ul': case 'ol': return <ListBlock key={k} b={b} p={p} />;
    case 'note': return <NoteBlock key={k} b={b} p={p} render={renderBlock} />;
    case 'quote': return <QuoteBlock key={k} b={b} p={p} render={renderBlock} />;
    case 'code': return <CodeBlock key={k} b={b} />;
    case 'table': return <TableBlock key={k} b={b} />;
    case 'img': return <ImageBlock key={k} b={b} />;
    case 'hr': return <Hr key={k} />;
    case 'quiz': return null;
  }
  return null;
}

type BodyProps = {
  id: string;
  meta: BookSectionMeta;
  items: RItem[];
  markerAt: number | null;
  prose: Prose;
  onItemLayout: (i: number, y: number) => void;
  onMarkerLayout: (y: number) => void;
};

/** The page body. Memoized so scroll-driven top-bar updates don't re-render the text. */
const Body = React.memo(function Body({ id, meta, items, markerAt, prose, onItemLayout, onMarkerLayout }: BodyProps) {
  const { nav, replace, tab } = navActions();
  const ch = chapterOf(id);
  const ex = useApp((s) => s.ex);
  const sectionEx = useMemo(() => exercisesForSection(id), [id]);
  const nextEx = sectionEx.find((e) => ex[e.name]?.status !== 'done') ?? sectionEx[0];
  const nxt = nextSection(id);
  const next = nxt ? { text: upNextLabel(nxt), go: () => replace('reader', { arg: nxt.id }) } : { text: 'Back to contents', go: () => tab('learn') };
  const topic = meta.rustlings[0];
  const topicNext = topic ? (topicByTopicName(topic)?.exercises ?? []).find((n) => ex[n]?.status !== 'done') ?? topicByTopicName(topic)?.exercises[0] : undefined;
  const chip = id === '1.2'
    ? { label: 'Try it in the Terminal', icon: 'terminal', color: C.rustLight, go: () => tab('terminal') }
    : topic && topicNext ? { label: `Rustlings: ${topic}`, icon: 'data_object', color: C.done, go: () => nav('workspace', { arg: topicNext }) } : null;
  const kicker = ch ? (ch.n === 'A' ? 'APPENDIX' : `CHAPTER ${ch.n} · ${ch.title.toUpperCase()}`) : '';

  const renderItem = (it: RItem) => {
    switch (it.k) {
      case 'b': return renderBlock(it.b, prose, it.key);
      case 'quiz': return <QuickCheck key={it.key} quiz={it.quiz} />;
      case 'practice': return <PracticeCard key={it.key} ex={it.ex} onTry={() => nav('workspace', { arg: it.ex.name })} />;
      case 'tip': return <OxideTip key={it.key} />;
      case 'end': {
        const practice = nextEx ? { name: nextEx.name, go: () => nav('workspace', { arg: nextEx.name }) } : undefined;
        if (id === '1.2') return <EndHello key={it.key} onTerminal={() => tab('terminal')} next={next} />;
        if (id === '4.2') return <EndRules key={it.key} practice={practice} next={next} />;
        return <EndGeneric key={it.key} sectionLabel={`END OF ${id.includes('.') ? id : pageLabel(meta).toUpperCase()}`} drills={drillsText(sectionEx)} practice={practice} next={next} />;
      }
    }
  };

  return (
    <View style={{ gap: 18, paddingTop: 24, paddingHorizontal: 22, paddingBottom: 44 }}>
      <View style={{ gap: 10 }}>
        <Text style={m(11, undefined, 500, C.secondary, { letterSpacing: 0.99 })}>{kicker}</Text>
        <Text style={t(30, 1.15, 650, C.text, { letterSpacing: -0.75 })}>{meta.title}</Text>
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <Text style={t(13, 1.3, 400, C.secondary)}>{meta.mins} min read</Text>
          {chip ? (
            <Press onPress={chip.go} radius={8} hitSlop={8} accessibilityRole="button"
              style={{ height: 28, paddingLeft: 8, paddingRight: 10, borderRadius: 8, backgroundColor: C.s3, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name={chip.icon} size={16} color={chip.color} />
              <Text style={m(12, undefined, 500, chip.color)}>{chip.label}</Text>
            </Press>
          ) : null}
        </Row>
      </View>
      {items.map((it, i) => (
        <React.Fragment key={it.key}>
          {markerAt === i ? <View onLayout={(e) => onMarkerLayout(e.nativeEvent.layout.y)}><LeftOffMarker /></View> : null}
          <View onLayout={(e) => onItemLayout(i, e.nativeEvent.layout.y)}>{renderItem(it)}</View>
        </React.Fragment>
      ))}
    </View>
  );
});

export default function ReaderScreen({ entry }: ScreenProps) {
  useActiveMinutes();
  const { back, pop, tab } = navActions();
  const id = entry.arg && sectionById(entry.arg) ? entry.arg : useApp.getState().book.current;
  const meta = sectionById(id)!;
  const ch = chapterOf(id);
  const page = useMemo(() => loadSection(id), [id]);
  const readerSize = useApp((s) => s.prefs.readerSize);
  const readerLine = useApp((s) => s.prefs.readerLine);
  const quizzesOn = useApp((s) => s.prefs.quizzes);

  // Practice cards: the section's Rustlings exercises still to do (first four), fixed for this visit.
  const practice = useMemo(() => {
    const ex = useApp.getState().ex;
    return exercisesForSection(id).filter((e) => ex[e.name]?.status !== 'done').slice(0, 4);
  }, [id]);
  const items = useMemo(() => buildItems(id, page.blocks, { quizzes: quizzesOn, practice }), [id, page, quizzesOn, practice]);

  // Resume: saved position, captured once on open.
  const saved = useRef(useApp.getState().book.scroll[id] ?? 0).current;
  const wasRead = useRef(!!useApp.getState().book.read[id]).current;
  const anchor = typeof entry.params?.anchor === 'string' ? (entry.params.anchor as string) : null;
  const wantResume = entry.variant === 'resume' && saved > 0.01 && saved < 0.9 && !wasRead;
  const [markerAt, setMarkerAt] = useState<number | null>(null);
  const [ready, setReady] = useState(!wantResume && !anchor);

  const scroller = useRef<ScrollViewInstance>(null);
  const ys = useRef<number[]>([]);
  const viewH = useRef(0);
  const contentH = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positioned = useRef(false);

  const [prog, setProg] = useState(0);
  const lastSaved = useRef(0);
  const lastSaveAt = useRef(0);

  const prose = useMemo<Prose>(() => ({
    size: readerSize, line: readerLine,
    onAnchor: (a: string) => {
      const idx = items.findIndex((it) => it.k === 'b' && 'anchor' in it.b && it.b.anchor === a);
      if (idx >= 0) scroller.current?.scrollTo({ y: Math.max(0, (ys.current[idx] ?? 0) - 8), animated: true });
    },
  }), [readerSize, readerLine, items]);

  // Once the page has laid out, place the marker (resume) or jump to the anchor.
  const tryPosition = useCallback(() => {
    if (positioned.current) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (positioned.current) return;
      if (anchor) {
        const idx = items.findIndex((it) => it.k === 'b' && 'anchor' in it.b && it.b.anchor === anchor);
        positioned.current = true;
        if (idx >= 0) scroller.current?.scrollTo({ y: Math.max(0, (ys.current[idx] ?? 0) - 8), animated: false });
        setReady(true);
        return;
      }
      if (wantResume) {
        const target = saved * Math.max(0, contentH.current - viewH.current);
        let idx = items.findIndex((_, i) => (ys.current[i] ?? 0) >= target);
        if (idx < 0) idx = items.length - 1;
        // Never inside the end card.
        if (items[idx]?.k === 'end') idx = Math.max(0, idx - 1);
        setMarkerAt(idx);
        return; // continues in onMarkerLayout
      }
      positioned.current = true;
    }, 80);
  }, [anchor, items, saved, wantResume]);

  useEffect(() => {
    const fallback = setTimeout(() => setReady(true), 1500);
    return () => { clearTimeout(fallback); if (settle.current) clearTimeout(settle.current); };
  }, []);

  const onItemLayout = useCallback((i: number, y: number) => { ys.current[i] = y; tryPosition(); }, [tryPosition]);
  const onMarkerLayout = useCallback((y: number) => {
    if (positioned.current) return;
    positioned.current = true;
    scroller.current?.scrollTo({ y: Math.max(0, y - 64), animated: false });
    setTimeout(() => setReady(true), 30);
  }, []);

  const report = useCallback((frac: number, force = false) => {
    const now = Date.now();
    const crossed = frac >= 0.9 && lastSaved.current < 0.9;
    if (!force && !crossed && (now - lastSaveAt.current < 400 || Math.abs(frac - lastSaved.current) < 0.01)) return;
    lastSaveAt.current = now;
    lastSaved.current = Math.max(lastSaved.current, frac);
    useApp.getState().setScroll(id, frac);
  }, [id]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = contentSize.height - layoutMeasurement.height;
    const p = max > 0 ? Math.min(1, Math.max(0, contentOffset.y / max)) : 1;
    setProg((old) => (Math.abs(old - p) > 0.004 ? p : old));
    if (ready) report(p);
  }, [ready, report]);

  // A page that fits on one screen is read as soon as it's shown.
  const onContent = useCallback((_w: number, h: number) => {
    contentH.current = h;
    tryPosition();
    if (viewH.current > 0 && h > 0 && h <= viewH.current + 1) { setProg(1); report(1, true); }
  }, [report, tryPosition]);

  const left = Math.max(1, Math.round(meta.mins * (1 - prog)));
  const chName = ch?.n === 'A' ? 'Appendix' : ch?.title ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <Row style={{ height: 56, gap: 2, paddingHorizontal: 4 }}>
        <IconButton name="arrow_back" label="Back" onPress={back} />
        <View style={{ flex: 1, minWidth: 0, gap: 3, paddingLeft: 2 }}>
          <Text numberOfLines={1} style={t(15.5, 1.25, 600, C.text)}>{pageLabel(meta)}</Text>
          <Row>
            <Text numberOfLines={1} style={t(12.5, 1.25, 400, C.secondary, { flexShrink: 1 })}>{chName}</Text>
            <Text numberOfLines={1} style={t(12.5, 1.25, 400, C.secondary)}> · {left} min left</Text>
          </Row>
        </View>
        <IconButton name="text_fields" color={C.strong2} label="Text settings" onPress={() => pop('display')} />
        <IconButton name="toc" color={C.strong2} label="Contents" onPress={() => tab('learn')} />
      </Row>
      <View style={{ height: 3, backgroundColor: C.s3 }}>
        <View style={{ height: 3, width: `${Math.round(prog * 1000) / 10}%`, backgroundColor: C.rust }} />
      </View>
      <ScrollView
        ref={scroller}
        style={{ flex: 1, opacity: ready ? 1 : 0 }}
        onLayout={(e: LayoutChangeEvent) => { viewH.current = e.nativeEvent.layout.height; }}
        onContentSizeChange={onContent}
        onScroll={onScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
      >
        <Body id={id} meta={meta} items={items} markerAt={markerAt} prose={prose} onItemLayout={onItemLayout} onMarkerLayout={onMarkerLayout} />
      </ScrollView>
    </View>
  );
}
