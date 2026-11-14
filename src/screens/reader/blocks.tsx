// Book block renderers for the Reader (every `Block` type in src/content/types.ts).
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Block, Inline } from '../../content';
import { C, SYN } from '../../theme/tokens';
import { m, t } from '../../theme/fonts';
import { Icon } from '../../theme/Icon';
import { highlightAny } from '../../rust/highlight';
import { AnsiLines } from '../../ui/code';
import { Press, Row } from '../../ui/core';
import { Spinner } from '../../ui/controls';
import { getToolchain } from '../../toolchain';
import type { Proc } from '../../toolchain/types';
import { InlineText, plainText } from './Inline';
import { BOOK_IMAGES } from './bookImages';

export type Prose = { size: number; line: number; onAnchor?: (a: string) => void };

const proseStyle = (p: Prose, color: string = C.reading) => t(p.size, p.line, 400, color);

// ---------- Headings ----------

export function Heading({ b }: { b: Extract<Block, { type: 'h2' | 'h3' | 'h4' }> }) {
  const st = b.type === 'h2' ? t(21, 1.25, 650, C.text, { letterSpacing: -0.315, marginTop: 12 })
    : b.type === 'h3' ? t(18, 1.3, 650, C.text, { letterSpacing: -0.18, marginTop: 8 })
    : t(16, 1.4, 600, C.text, { marginTop: 4 });
  return <InlineText nodes={b.text} style={st} />;
}

// ---------- Lists ----------

export function ListBlock({ b, p }: { b: Extract<Block, { type: 'ul' | 'ol' }>; p: Prose }) {
  const start = (b as { start?: number }).start ?? 1;
  return (
    <View style={{ gap: 8 }}>
      {b.items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          <Text style={b.type === 'ul' ? t(p.size, p.line, 400, C.rustLight) : m(p.size * 0.86, p.size * p.line, 500, C.rustLight)}>
            {b.type === 'ul' ? '•' : `${start + i}.`}
          </Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <InlineText nodes={it} style={proseStyle(p)} onAnchor={p.onAnchor} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- Note / quote ----------

export function NoteBlock({ b, p, render }: { b: Extract<Block, { type: 'note' }>; p: Prose; render: (b: Block, p: Prose, k: number) => React.ReactNode }) {
  const inner: Prose = { ...p, size: 15, line: 1.6 };
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.s1, gap: 6 }}>
      <Text style={m(11, undefined, 500, b.kind === 'warning' ? C.checkpoint : C.secondary, { letterSpacing: 0.99 })}>{b.kind === 'warning' ? 'WARNING' : 'NOTE'}</Text>
      <View style={{ gap: 10 }}>{b.blocks.map((x, i) => render(x, inner, i))}</View>
    </View>
  );
}

export function QuoteBlock({ b, p, render }: { b: Extract<Block, { type: 'quote' }>; p: Prose; render: (b: Block, p: Prose, k: number) => React.ReactNode }) {
  return (
    <View style={{ paddingLeft: 16, gap: 10 }}>
      <View style={{ position: 'absolute', left: 0, top: 2, bottom: 2, width: 3, borderRadius: 2, backgroundColor: C.border }} />
      {b.blocks.map((x, i) => render(x, { ...p }, i))}
    </View>
  );
}

// ---------- Code listing ----------

function ConsoleLines({ code }: { code: string }) {
  return (
    <>
      {code.split('\n').map((l, i) => {
        const prompt = l.startsWith('$ ') || l.startsWith('> ');
        return (
          <Text key={i} style={m(12.5, 20, 400, prompt ? C.text : C.secondary, { paddingHorizontal: 14 })}>
            {prompt ? <Text style={{ color: C.rustLight }}>{l.slice(0, 2)}</Text> : null}
            {(prompt ? l.slice(2) : l) || ' '}
          </Text>
        );
      })}
    </>
  );
}

function HighlightedLines({ code, lang }: { code: string; lang: string }) {
  const P = SYN.dark;
  const lines = highlightAny(code, lang);
  return (
    <>
      {lines.map((ln) => (
        <Text key={ln.n} style={m(12.5, 20, 400, P.id, { paddingHorizontal: 14 })}>
          {ln.toks.length === 0 ? ' ' : ln.toks.map((tk, i) => (
            <Text key={i} style={[{ color: P[tk.k] }, tk.k === 'com' ? { fontFamily: 'JetBrainsMono_400Regular_Italic' } : null]}>{tk.t}</Text>
          ))}
        </Text>
      ))}
    </>
  );
}

type RunState =
  | { s: 'idle' }
  | { s: 'running'; lines: string[] }
  | { s: 'done'; lines: string[] }
  | { s: 'unavailable'; message: string };

/** Rust listings run, including ones that don't compile (to see the error); other `ignore`d ones don't. */
const isRunnable = (b: Extract<Block, { type: 'code' }>) => (b.lang === 'rust' || b.lang === 'rs') && (!b.ignore || !!b.fails);

export function CodeBlock({ b }: { b: Extract<Block, { type: 'code' }> }) {
  const [run, setRun] = useState<RunState>({ s: 'idle' });
  const proc = useRef<Proc | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; proc.current?.kill(); }, []);
  const consoleish = b.lang === 'console';
  const label = consoleish ? (b.file ?? 'Terminal') : [b.listing ? `Listing ${b.listing}` : '', b.file ?? ''].filter(Boolean).join(' · ');
  const canRun = isRunnable(b);

  const start = async () => {
    proc.current?.kill();
    setRun({ s: 'running', lines: [] });
    const tc = getToolchain();
    let reason: string | undefined;
    try {
      const info = await tc.info();
      if (!info.installed || info.unavailableReason) reason = info.unavailableReason ?? 'The Rust toolchain isn’t installed yet. Finish the download in Settings to run listings.';
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e);
    }
    if (!alive.current) return;
    if (reason) { setRun({ s: 'unavailable', message: reason }); return; }
    const lines: string[] = [];
    let raf: ReturnType<typeof setTimeout> | null = null;
    const flush = () => { raf = null; if (alive.current) setRun((r) => (r.s === 'running' ? { s: 'running', lines: lines.slice() } : r)); };
    try {
      proc.current = tc.runSnippet(b.runnable ?? b.code, (e) => {
        if (e.type === 'exit') {
          if (raf) clearTimeout(raf);
          if (alive.current) setRun({ s: 'done', lines: lines.slice() });
          proc.current = null;
          return;
        }
        lines.push(e.line);
        if (!raf) raf = setTimeout(flush, 50);
      });
    } catch (e) {
      setRun({ s: 'unavailable', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const showHeader = !!label || !!b.fails || canRun;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ borderRadius: 16, backgroundColor: C.s1, overflow: 'hidden' }}>
        {showHeader ? (
          <Row style={{ minHeight: 44, gap: 8, paddingLeft: 14, paddingRight: 6 }}>
            {label ? <Text numberOfLines={1} style={m(12, undefined, 400, C.tertiary, { flexShrink: 1 })}>{label}</Text> : null}
            {b.fails ? (
              <View style={{ height: 22, paddingHorizontal: 7, borderRadius: 6, backgroundColor: C.errorTint14, justifyContent: 'center' }}>
                <Text style={m(11, 22, 600, C.errorText)} numberOfLines={1}>doesn’t compile</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }} />
            {canRun ? (
              <Press onPress={start} overlay={null} pressedStyle={{ backgroundColor: C.raisedHover }} accessibilityRole="button" accessibilityLabel={run.s === 'idle' ? 'Run' : 'Run again'} hitSlop={5}
                style={{ height: 34, paddingLeft: 8, paddingRight: 12, borderRadius: 17, backgroundColor: C.raised, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="play_arrow" size={20} color={C.text} fill />
                <Text style={t(13, undefined, 600, C.text)}>{run.s === 'idle' ? 'Run' : 'Run again'}</Text>
              </Press>
            ) : null}
          </Row>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: showHeader ? 0 : 14, paddingBottom: 14, flexDirection: 'column' }}>
          {consoleish ? <ConsoleLines code={b.code} /> : <HighlightedLines code={b.code} lang={b.lang} />}
        </ScrollView>
        {run.s !== 'idle' ? <OutputWell run={run} recorded={b.output} /> : null}
      </View>
      {b.caption ? (
        <Text style={t(13, 1.45, 400, C.tertiary, { paddingHorizontal: 2 })}>
          {b.listing ? <Text style={t(13, 1.45, 600, C.secondary)}>Listing {b.listing}: </Text> : null}{b.caption}
        </Text>
      ) : null}
    </View>
  );
}

function OutputWell({ run, recorded }: { run: Exclude<RunState, { s: 'idle' }>; recorded?: string }) {
  return (
    <View style={{ backgroundColor: C.well, paddingTop: 10, paddingBottom: 12 }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
      {run.s === 'unavailable' ? (
        <View style={{ gap: 10 }}>
          <Text style={m(11, 17, 400, C.secondary, { paddingHorizontal: 14 })}>{run.message}</Text>
          {recorded ? (
            <View style={{ gap: 4 }}>
              <Text style={m(10.5, undefined, 500, C.tertiary, { letterSpacing: 0.84, paddingHorizontal: 14 })}>FROM THE BOOK</Text>
              <AnsiLines lines={recorded.replace(/\n$/, '').split('\n')} fontSize={11} lineHeight={17} textStyle={{ paddingHorizontal: 14 }} />
            </View>
          ) : null}
        </View>
      ) : (
        <>
          {run.s === 'running' ? (
            <Row style={{ gap: 8, paddingHorizontal: 14, minHeight: 17 }}>
              <Spinner size={14} color={C.secondary} width={2} />
              <Text style={m(11, 17, 400, C.secondary)}>Compiling…</Text>
            </Row>
          ) : null}
          {run.lines.length ? <AnsiLines lines={run.lines} fontSize={11} lineHeight={17} textStyle={{ paddingHorizontal: 14 }} /> : null}
          {run.s === 'done' && !run.lines.length ? <Text style={m(11, 17, 400, C.tertiary, { paddingHorizontal: 14 })}>(no output)</Text> : null}
        </>
      )}
    </View>
  );
}

// ---------- Table ----------

export function TableBlock({ b }: { b: Extract<Block, { type: 'table' }> }) {
  const cols = Math.max(b.head.length, ...b.rows.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, c) => {
    const len = Math.max(plainText(b.head[c] ?? []).length, ...b.rows.map((r) => plainText(r[c] ?? []).length));
    return Math.max(72, Math.min(240, Math.round(len * 7.6 + 24)));
  });
  const cell = (nodes: Inline[], c: number, head: boolean, k: string) => (
    <View key={k} style={{ width: widths[c], paddingVertical: 10, paddingHorizontal: 12 }}>
      <InlineText nodes={nodes} style={head ? t(12.5, 1.4, 600, C.secondary) : t(14, 1.45, 400, C.reading)} />
    </View>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderRadius: 14, backgroundColor: C.s1 }}>
      <View>
        <View style={{ flexDirection: 'row', backgroundColor: C.s3 }}>{Array.from({ length: cols }, (_, c) => cell(b.head[c] ?? [], c, true, 'h' + c))}</View>
        {b.rows.map((r, ri) => (
          <View key={ri} style={{ flexDirection: 'row', borderTopWidth: ri ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.05)' }}>
            {Array.from({ length: cols }, (_, c) => cell(r[c] ?? [], c, false, `${ri}.${c}`))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ---------- Image ----------

export function ImageBlock({ b }: { b: Extract<Block, { type: 'img' }> }) {
  const img = BOOK_IMAGES[b.src];
  if (!img) return <Text style={t(13, 1.45, 400, C.tertiary)}>{b.alt}</Text>;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={b.alt}
      style={{ borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFFFFF', aspectRatio: img.w / img.h, width: '100%' }}>
      {img.kind === 'svg'
        ? <SvgXml xml={img.xml} width="100%" height="100%" />
        : <Image source={img.src} style={{ width: '100%', height: '100%' }} resizeMode="contain" />}
    </View>
  );
}

export function Hr() {
  return <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 4 }} />;
}

export const onLayoutY = (cb: (y: number) => void) => (e: LayoutChangeEvent) => cb(e.nativeEvent.layout.y);
