// Daily Bug Hunt (docs/FEATURES_BRIEF.md, agent 1). One puzzle a day: a short program that compiles
// but misbehaves. Find the line, pick the fix, then read why. `entry.arg` = puzzle number (archive),
// `entry.variant === 'archive'` = the list of past puzzles.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row, SectionLabel } from '../ui/core';
import { Button, IconButton, Radio } from '../ui/controls';
import { Rich } from '../ui/code';
import { TopBar } from '../ui/bars';
import { navActions } from '../nav/store';
import { sectionById, toc } from '../content';
import { dateOf, fixedCode, numberFor, puzzleFor, shortDate } from '../features/bughunt/daily';
import { useBugHuntToday, useToday } from '../features/bughunt/hooks';
import { BUGHUNT_XP, MAX_TRIES, shareText, streakOf, useBugHunt, type Play } from '../features/bughunt/store';
import { CodeLines, type LineState } from '../features/bughunt/CodeLines';
import { shareResult } from '../features/bughunt/share';
import { TryDots } from '../features/bughunt/ui';
import type { ScreenProps } from './registry';

const chapterTitle = (n: number) => toc.chapters.find((c) => c.n === n)?.title ?? '';
const ordinal = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

function Well({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={m(10.5, undefined, 500, C.tertiary, { letterSpacing: 0.84, textTransform: 'uppercase' })}>{label}</Text>
      <View style={{ borderRadius: 12, backgroundColor: C.well, paddingVertical: 10, paddingHorizontal: 12 }}>
        {children}
        <Inset radius={12} />
      </View>
    </View>
  );
}

const OutText = ({ text, color = C.text }: { text: string; color?: string }) => (
  <Text style={m(12.5, 19, 400, color)}>{text}</Text>
);

/** A short shake for a wrong guess. */
function useShake() {
  const a = useRef(new Animated.Value(0)).current;
  const run = () => {
    a.setValue(0);
    Animated.sequence([-1, 1, -1, 1, 0].map((v) => Animated.timing(a, { toValue: v, duration: 55, useNativeDriver: true }))).start();
  };
  return { style: { transform: [{ translateX: a.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }] }, run };
}

function Puzzle({ n }: { n: number }) {
  const { nav, back } = navActions();
  const date = useToday();
  const todayN = numberFor(date);
  const p = puzzleFor(n);
  const stored = useBugHunt((s) => s.plays[n]);
  const plays = useBugHunt((s) => s.plays);
  const tapLine = useBugHunt((s) => s.tapLine);
  const pickFix = useBugHunt((s) => s.pickFix);
  const play: Play = stored ?? { n, puzzle: p.id, marks: [], found: false, wrongLines: [], wrongOptions: [], status: 'playing', archive: n !== todayN, xp: 0, startedAt: 0 };
  const [sel, setSel] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const shake = useShake();
  const scroll = useRef<ScrollViewInstance>(null);
  const done = play.status !== 'playing';
  const left = MAX_TRIES - play.marks.length;
  const isArchive = play.archive;
  const sec = sectionById(p.section);

  useEffect(() => { setSel(null); setNote(null); }, [n]);
  useEffect(() => { if (done) setTimeout(() => scroll.current?.scrollTo({ y: 0, animated: true }), 50); }, [done]);

  const onTap = (line: number) => {
    const r = tapLine(n, line);
    if (r === 'miss') {
      shake.run();
      const remaining = MAX_TRIES - (useBugHunt.getState().plays[n]?.marks.length ?? 0);
      setNote(remaining > 0 ? `Line ${line} does what it says. ${remaining} ${remaining === 1 ? 'try' : 'tries'} left.` : null);
    } else if (r === 'found') {
      setNote(null);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    }
  };
  const onApply = () => {
    if (sel === null) return;
    const r = pickFix(n, sel);
    if (r === 'near') {
      shake.run();
      const remaining = MAX_TRIES - (useBugHunt.getState().plays[n]?.marks.length ?? 0);
      setNote(remaining > 0 ? `Right line, but that change doesn’t fix it. ${remaining} ${remaining === 1 ? 'try' : 'tries'} left.` : null);
      setSel(null);
    } else if (r === 'hit') setNote(null);
  };

  const states: Record<number, LineState> = {};
  play.wrongLines.forEach((l) => { states[l] = 'miss'; });
  if (play.found && !done) states[p.line] = 'found';

  const fixed = useMemo(() => fixedCode(p), [p]);
  const streak = streakOf(plays, date).current;

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title="Daily Bug Hunt" subtitle={`#${n} · ${shortDate(dateOf(n))}${isArchive ? ' · archive' : ''}`} onBack={back}
        right={<IconButton name="history" label="Past puzzles" onPress={() => nav('bughunt', { variant: 'archive' })} />} />
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {done ? <Result n={n} play={play} streak={streak} todayN={todayN} /> : null}

        {/* The brief */}
        <View style={{ gap: 14, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, borderRadius: 24, backgroundColor: C.s2 }}>
          <SectionLabel right={<TryDots marks={play.marks} />}>{`CH ${p.chapter} · ${chapterTitle(p.chapter)}`}</SectionLabel>
          <Text style={t(22, 1.25, 650, C.text, { letterSpacing: -0.33 })}>{p.title}</Text>
          <Rich text={p.intent} style={t(15, 1.5, 400, C.reading)} />
          <Well label="Should print"><OutText text={p.output} /></Well>
          <Well label={p.varies ? 'Prints · the order changes between runs' : p.panic ? 'Does instead' : 'Prints'}>
            {p.actual ? <OutText text={p.actual} color={C.mutedHi} /> : null}
            {p.panic ? <OutText text={`thread 'main' panicked:\n${p.panic}`} color={C.errorText} /> : null}
          </Well>
          <Inset radius={24} />
        </View>

        {/* Step 1 / 2 */}
        {!done ? (
          <View style={{ gap: 4, paddingHorizontal: 4, paddingTop: 6 }}>
            <SectionLabel right={`${left} ${left === 1 ? 'try' : 'tries'} left`}>{play.found ? '2 · Pick the fix' : '1 · Find the line'}</SectionLabel>
            <Text style={t(13.5, 1.45, 400, C.secondary)}>
              {play.found ? `Line ${p.line} is the culprit. Which change makes it print the right thing?` : 'Tap the line that makes it misbehave. A wrong line costs a try.'}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 4, paddingTop: 6 }}><SectionLabel>The program you were given</SectionLabel></View>
        )}

        {note ? (
          <Row style={{ gap: 8, paddingHorizontal: 4 }}>
            <Icon name="info" size={18} color={C.errorText} />
            <Text style={t(13.5, 1.4, 400, C.errorText, { flex: 1 })}>{note}</Text>
          </Row>
        ) : null}

        <Animated.View style={shake.style}>
          <View style={{ borderRadius: 18, backgroundColor: C.s1, overflow: 'hidden' }}>
            <CodeLines code={p.code} states={done ? { [p.line]: 'was' } : states} onTap={!done && !play.found ? onTap : undefined}
              rowHeight={!done && !play.found ? 40 : 22} fontSize={13} />
          </View>
        </Animated.View>


        {play.found && !done ? (
          <View style={{ gap: 8 }}>
            {p.options.map((o, i) => {
              const wrong = play.wrongOptions.includes(i);
              const on = sel === i;
              return (
                <Press key={i} onPress={() => !wrong && setSel(i)} disabled={wrong} overlay="rgba(255,255,255,0.04)" radius={14}
                  accessibilityRole="radio" accessibilityState={{ selected: on, disabled: wrong }} accessibilityLabel={o}
                  style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: on ? C.rustTint08 : C.s1, opacity: wrong ? 0.5 : 1 }}>
                  {wrong ? <Icon name="close" size={22} color={C.errorText} /> : <Radio selected={on} />}
                  <Text style={m(13, 19, 500, wrong ? C.tertiary : C.text, { flex: 1, textDecorationLine: wrong ? 'line-through' : 'none' })}>{o}</Text>
                  <Inset color={on ? C.rust : C.border} radius={14} />
                </Press>
              );
            })}
            <Button label="Apply fix" onPress={onApply} disabled={sel === null} style={{ marginTop: 4 }} />
          </View>
        ) : null}

        {done ? (
          <>
            <View style={{ gap: 6, paddingHorizontal: 4, paddingTop: 10 }}>
              <SectionLabel>Why</SectionLabel>
              <Rich text={p.explain} style={t(15, 1.55, 400, C.reading)} />
            </View>
            <View style={{ paddingHorizontal: 4, paddingTop: 10 }}><SectionLabel>Fixed</SectionLabel></View>
            <View style={{ borderRadius: 18, backgroundColor: C.s1, overflow: 'hidden' }}>
              <CodeLines code={fixed} states={{ [p.line]: 'fixed' }} rowHeight={22} fontSize={13} />
            </View>
            <Well label="Output"><OutText text={p.output} /></Well>
            {sec ? (
              <Press onPress={() => nav('reader', { arg: p.section })} overlay="rgba(255,255,255,0.03)" radius={14} accessibilityRole="button"
                style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.s1, marginTop: 4 }}>
                <Icon name="menu_book" size={22} color={C.rustLight} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={1} style={t(14.5, undefined, 500, C.text)}>{`${sec.id} ${sec.title}`}</Text>
                  <Text style={t(12.5, undefined, 400, C.tertiary)}>Read more in the Book</Text>
                </View>
                <Icon name="chevron_right" size={20} color={C.disabled} />
              </Press>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Result({ n, play, streak, todayN }: { n: number; play: Play; streak: number; todayN: number }) {
  const { nav } = navActions();
  const solved = play.status === 'solved';
  const tries = play.marks.length;
  const title = solved ? (tries === 1 ? 'Fixed on the first try' : `Fixed on the ${ordinal(tries)} try`) : 'This one got away';
  const sub = play.archive
    ? 'Archive puzzle · no XP, no streak'
    : solved
      ? `+${play.xp} XP${streak > 0 ? ` · ${streak}-day streak` : ''}`
      : 'No XP today. The fix and the reason are below.';
  return (
    <View style={{ gap: 14, padding: 16, borderRadius: 24, backgroundColor: solved ? C.doneTint07 : C.s2 }}>
      <Row style={{ gap: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: solved ? C.done : C.raised, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={solved ? 'check' : 'bug_report'} size={28} color={solved ? C.onDone : C.secondary} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={t(19, 1.25, 650, C.text)}>{title}</Text>
          <Text style={t(13.5, 1.35, 400, solved && !play.archive ? C.done : C.secondary)}>{sub}</Text>
        </View>
      </Row>
      <Row style={{ gap: 10, justifyContent: 'space-between' }}>
        <Text style={m(13, undefined, 500, C.mutedHi, { flex: 1 })} numberOfLines={1}>{shareText(play)}</Text>
      </Row>
      <Row style={{ gap: 8 }}>
        <Button variant="tonal" icon="share" label="Share" height={44} onPress={() => shareResult(shareText(play))} style={{ flex: 1 }} />
        {n !== todayN ? (
          <Button variant="tonal" icon="today" label="Today’s puzzle" height={44} onPress={() => navActions().replace('bughunt')} style={{ flex: 1 }} />
        ) : (
          <Button variant="tonal" icon="history" label="Past puzzles" height={44} onPress={() => nav('bughunt', { variant: 'archive' })} style={{ flex: 1 }} />
        )}
      </Row>
      {n === todayN ? <Text style={t(12.5, 1.4, 400, C.tertiary)}>A new puzzle arrives tomorrow.</Text> : null}
      <Inset radius={24} color={solved ? C.doneTint22 : C.hairline} />
    </View>
  );
}

function Archive() {
  const { nav, back } = navActions();
  const { n: todayN, streak, best } = useBugHuntToday();
  const plays = useBugHunt((s) => s.plays);
  const nums = Array.from({ length: todayN }, (_, i) => todayN - i);
  const solved = nums.filter((k) => plays[k]?.status === 'solved').length;
  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title="Past puzzles" onBack={back} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Row style={{ gap: 8, alignItems: 'stretch' }}>
          {[
            { big: String(streak), label: streak === 1 ? 'day streak' : 'day streak', icon: 'local_fire_department', color: streak > 0 ? C.flame : C.disabled },
            { big: String(best), label: 'best streak', icon: 'emoji_events', color: C.checkpoint },
            { big: `${solved}`, label: `of ${todayN} solved`, icon: 'bug_report', color: C.done },
          ].map((x) => (
            <View key={x.label} style={{ flex: 1, gap: 8, padding: 14, borderRadius: 18, backgroundColor: C.s1 }}>
              <Icon name={x.icon} size={20} color={x.color} fill={x.icon === 'local_fire_department'} />
              <Text style={m(22, 24, 600, C.text)}>{x.big}</Text>
              <Text numberOfLines={1} style={t(12, undefined, 400, C.secondary)}>{x.label}</Text>
            </View>
          ))}
        </Row>
        <Text style={t(13, 1.45, 400, C.tertiary, { paddingHorizontal: 4 })}>
          {`Past puzzles are free practice: no XP, and they don’t count for your streak. Solving today’s gives ${BUGHUNT_XP.join(' / ')} XP on the first, second or third try.`}
        </Text>
        <View style={{ borderRadius: 20, backgroundColor: C.s1, overflow: 'hidden' }}>
          {nums.map((k, i) => {
            const pz = puzzleFor(k);
            const pl = plays[k];
            const status = pl?.status;
            const right = status === 'solved' ? `${pl!.marks.length}/${MAX_TRIES}` : status === 'failed' ? `X/${MAX_TRIES}` : pl ? 'Started' : k === todayN ? 'Today' : 'Play';
            return (
              <Press key={k} onPress={() => (k === todayN ? navActions().replace('bughunt') : nav('bughunt', { arg: String(k) }))} overlay="rgba(255,255,255,0.03)" accessibilityRole="button"
                accessibilityLabel={`Puzzle ${k}, ${pz.title}, ${right}`}
                style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 16 }}>
                {i > 0 ? <View style={{ position: 'absolute', top: 0, left: 16, right: 0, height: 1, backgroundColor: C.hairline }} /> : null}
                <View style={{ width: 44 }}>
                  <Text style={m(13, undefined, 600, C.text)}>#{k}</Text>
                  <Text style={t(11.5, undefined, 400, C.tertiary)}>{shortDate(dateOf(k))}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={1} style={t(14.5, undefined, 500, status ? C.text : C.mutedHi)}>{pz.title}</Text>
                  <Text numberOfLines={1} style={t(12.5, undefined, 400, C.tertiary)}>{`Ch ${pz.chapter} · ${chapterTitle(pz.chapter)}`}</Text>
                </View>
                {pl && status !== 'playing' ? <TryDots marks={pl.marks} size={8} /> : null}
                <Text style={m(12, undefined, 500, status === 'solved' ? C.done : status === 'failed' ? C.errorText : k === todayN ? C.rustLight : C.tertiary)}>{right}</Text>
              </Press>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export default function BugHuntScreen({ entry }: ScreenProps) {
  const date = useToday();
  if (entry.variant === 'archive') return <Archive />;
  const todayN = numberFor(date);
  const asked = entry.arg ? parseInt(entry.arg, 10) : NaN;
  const n = Number.isFinite(asked) && asked >= 1 && asked <= todayN ? asked : todayN;
  return <Puzzle key={n} n={n} />;
}
