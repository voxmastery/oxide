// Practice tab: Rustlings path, checkpoint quizzes and the Book's projects (design/project/Practice.dc.html).
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { m, sectionLabel, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Card, Press, Row } from '../ui/core';
import { Button, IconButton, Ring, SegBar } from '../ui/controls';
import { RootHeader } from '../ui/bars';
import { navActions } from '../nav/store';
import { useApp, type AppData } from '../state/app';
import { rustlingsProgress } from '../state/selectors';
import { projects, rustlings, toc, type RustlingsPathNode } from '../content';
import { listProjects, useFsVersion } from '../fs';
import type { ScreenProps } from './registry';
import { CURATED } from './workspace/curated';
import { BuildAlongCard } from '../features/buildalong';

type BookState = 'read' | 'reading' | 'partly' | 'unread';
const BS: Record<BookState, [string, string, string]> = {
  read: ['rgba(87,214,200,0.12)', C.done, 'read'],
  reading: ['rgba(247,76,0,0.14)', C.rustLight, 'reading now'],
  partly: [C.s4, C.mutedHi2, 'partly read'],
  unread: [C.s4, C.mutedHi2, 'not read yet'],
};

function bookState(secs: string[], book: AppData['book']): BookState {
  if (secs.every((id) => book.read[id])) return 'read';
  if (secs.includes(book.current)) return 'reading';
  return secs.some((id) => book.read[id]) ? 'partly' : 'unread';
}

/** A chapter counts as read when its intro (chapter 2) or all its numbered sections are read. */
export function chapterRead(n: number, book: AppData['book']) {
  const ch = toc.chapters.find((c) => c.n === n);
  if (!ch) return false;
  const ids = ch.sections.length ? ch.sections.map((s) => s.id) : [ch.intro.id];
  return ids.every((id) => book.read[id]);
}

/** Folder names of projects in ~/projects (re-read when the file system changes). */
export function useProjectNames() {
  const v = useFsVersion();
  const [names, setNames] = useState<Set<string> | null>(null);
  useEffect(() => {
    let live = true;
    listProjects().then((ps) => { if (live) setNames(new Set(ps.map((p) => p.name))); }).catch(() => { if (live) setNames(new Set()); });
    return () => { live = false; };
  }, [v]);
  return names;
}

const nodeExercises = (p: RustlingsPathNode) => (p.t === 'topic' ? p.exercises : [p.exercise]);

export default function PracticeScreen(_: ScreenProps) {
  const { nav } = navActions();
  const ex = useApp((s) => s.ex);
  const book = useApp((s) => s.book);
  const made = useProjectNames();
  const prog = rustlingsProgress({ ex });
  const isDone = (n: string) => ex[n]?.status === 'done';
  const nextNode = useMemo(() => rustlings.path.find((p) => nodeExercises(p).includes(prog.next ?? '')), [prog.next]);
  const [open, setOpen] = useState<string | null>(nextNode?.name ?? null);
  const fresh = prog.done === 0;
  const topics = rustlings.path.filter((p) => p.t === 'topic').length;
  const quizN = rustlings.path.length - topics;
  const go = (name: string) => nav('workspace', { arg: name });

  const segs = rustlings.path.map((p) => {
    const names = nodeExercises(p);
    const d = names.filter(isDone).length;
    const all = d >= names.length;
    return all
      ? { weight: names.length, fill: 1, color: p.t === 'quiz' ? C.checkpoint : C.done }
      : d > 0 ? { weight: names.length, fill: d / names.length, color: C.rust, track: C.outline }
      : { weight: names.length, fill: 0, color: C.track };
  });

  const projMade = projects.filter((p) => made?.has(p.name)).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.ground }} contentContainerStyle={{ gap: 14, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <RootHeader
        title="Practice"
        subtitle="Rustlings, plus the Book’s projects"
        style={{ paddingTop: 4, gap: 4 }}
        right={<IconButton name="search" color={C.strong2} onPress={() => nav('search')} label="Search exercises" />}
      />

      <Card hero style={{ marginHorizontal: 16, padding: 16, gap: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={sectionLabel}>RUSTLINGS</Text>
          <Text style={m(12, undefined, 500, C.secondary)}>{Math.round(prog.frac * 100)}%</Text>
        </Row>
        <Row style={{ alignItems: 'baseline', gap: 8 }}>
          <Text style={m(36, 36, 600, C.text, { letterSpacing: -0.72 })}>{prog.done}</Text>
          <Text style={t(15, undefined, 400, C.secondary)}>of {prog.total} exercises</Text>
        </Row>
        <SegBar segs={segs} height={8} gap={2} />
        <Row style={{ flexWrap: 'wrap', columnGap: 14, rowGap: 6 }}>
          {[[C.done, 'Done'], [C.rust, 'In progress'], [C.checkpoint, 'Checkpoint quiz']].map(([c, l]) => (
            <Row key={l} style={{ gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c }} />
              <Text style={t(12, undefined, 400, C.secondary)}>{l}</Text>
            </Row>
          ))}
        </Row>
        {prog.next ? (
          <Button onPress={() => go(prog.next!)} trailingIcon="arrow_forward" style={{ gap: 8 }}
            label={
              <Row style={{ gap: 8 }}>
                <Text style={t(15.5, undefined, 650, C.onRust)}>{fresh ? 'Start:' : 'Continue:'}</Text>
                <Text style={m(14.5, undefined, 500, C.onRust)}>{prog.next}</Text>
              </Row>
            }
          />
        ) : (
          <Button label="All exercises done" disabled />
        )}
      </Card>

      <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, paddingHorizontal: 20 }}>
        <Text style={sectionLabel}>THE PATH</Text>
        <Text style={m(12, undefined, 500, C.tertiary)}>{topics} topics · {quizN} quizzes</Text>
      </Row>

      <View style={{ paddingHorizontal: 8 }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 39, top: 32, bottom: 32, width: 2, backgroundColor: C.lineDark }} />
        {rustlings.path.map((p) => {
          const names = nodeExercises(p);
          const done = names.filter(isDone).length;
          const n = names.length;
          const quiz = p.t === 'quiz';
          const isOpen = open === p.name;
          const containsNext = names.includes(prog.next ?? '');
          const stt = done >= n ? 'done' : done > 0 || containsNext ? 'cur' : 'todo';
          const rowBg = isOpen ? C.s1 : C.ground;
          const bs = p.t === 'topic' && p.secs.length ? BS[bookState(p.secs, book)] : null;
          const sub = p.t === 'quiz' ? 'Checkpoint · ' + p.covers : bs ? bs[2] : p.name === 'intro' ? 'How Rustlings works' : 'Not tied to a chapter';
          const count = quiz ? (stt === 'done' ? 'passed' : '+100') : `${done}/${n}`;
          const cc = stt === 'done' ? (quiz ? C.checkpoint : C.done) : stt === 'cur' ? C.rustLight : C.tertiary;
          const firstTodo = names.find((x) => !isDone(x));
          return (
            <View key={p.name} style={{ borderRadius: 18, backgroundColor: isOpen ? C.s1 : 'transparent' }}>
              <Press onPress={() => setOpen(isOpen ? null : p.name)} radius={18} overlay="rgba(255,255,255,0.03)" accessibilityState={{ expanded: isOpen }}
                style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingLeft: 14, paddingRight: 12 }}>
                <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  {quiz ? (
                    <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: stt === 'done' ? C.checkpoint : C.outline, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: stt === 'done' ? C.checkpoint : rowBg, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ transform: [{ rotate: '-45deg' }] }}>
                          <Icon name="flag" size={17} fill={stt === 'done'} color={stt === 'done' ? C.onCheckpoint : C.tertiary} />
                        </View>
                      </View>
                    </View>
                  ) : stt === 'done' ? (
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.done, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="check" size={17} color={C.onCheckpoint} />
                    </View>
                  ) : (
                    <Ring value={stt === 'cur' ? done / n : 0} track={stt === 'cur' ? C.outline : C.track} bg={rowBg}>
                      <Text style={m(10.5, undefined, 600, stt === 'cur' ? C.rustLight : C.tertiary)}>{stt === 'cur' ? `${done}/${n}` : p.num.slice(0, 2)}</Text>
                    </Ring>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                  <Text style={m(15, undefined, 500, stt === 'todo' ? C.strong2 : C.text)} numberOfLines={1}>{p.name}</Text>
                  <Row style={{ gap: 8, minWidth: 0 }}>
                    {bs && p.t === 'topic' ? (
                      <View style={{ height: 20, paddingHorizontal: 6, borderRadius: 5, backgroundColor: bs[0], justifyContent: 'center' }}>
                        <Text style={m(11, 20, 500, bs[1])}>{p.book}</Text>
                      </View>
                    ) : null}
                    <Text style={t(12.5, undefined, 400, C.tertiary, { flexShrink: 1 })} numberOfLines={1}>{sub}</Text>
                  </Row>
                </View>
                <Text style={m(12.5, undefined, 500, cc)}>{count}</Text>
                <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={22} color={C.tertiary} />
              </Press>
              {isOpen ? (
                <View style={{ paddingHorizontal: 6, paddingBottom: 8 }}>
                  {names.map((nm) => {
                    const e = rustlings.exercises[nm];
                    const d = isDone(nm);
                    const nx = !d && nm === firstTodo && stt !== 'todo';
                    const desc = CURATED[nm]?.subtitle ?? e?.summary.replace(/`/g, '');
                    return (
                      <Press key={nm} onPress={() => go(nm)} radius={12} overlay="rgba(255,255,255,0.04)"
                        style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6, paddingLeft: 14, paddingRight: 10, borderRadius: 12, backgroundColor: nx ? C.rustTint08 : 'transparent' }}>
                        <Icon name={d ? 'check_circle' : nx ? 'play_circle' : 'radio_button_unchecked'} size={22} fill={d || nx} color={d ? C.done : nx ? C.rustLight : C.iconOff} />
                        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                          <Text style={m(14.5, undefined, 500, C.text)}>{nm}</Text>
                          {desc ? <Text style={t(13, 1.35, 400, C.secondary)} numberOfLines={2}>{desc}</Text> : null}
                        </View>
                        <Text style={m(12, undefined, 500, C.tertiary, { minWidth: 34, textAlign: 'right' })}>+{e?.xp ?? 40}</Text>
                      </Press>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12, paddingHorizontal: 20 }}>
        <Text style={sectionLabel}>PROJECTS FROM THE BOOK</Text>
        <Text style={m(12, undefined, 500, C.tertiary)}>{projMade} of {projects.length}</Text>
      </Row>
      <View style={{ paddingHorizontal: 8 }}>
        {projects.map((p) => {
          const d = !!made?.has(p.name);
          const ready = chapterRead(p.chapter, book);
          const status = d ? 'Done' : ready ? 'Not started' : `After Ch ${p.chapter}`;
          return (
            <Press key={p.name} onPress={() => nav('project', { arg: p.name })} radius={14} overlay="rgba(255,255,255,0.03)"
              style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingLeft: 14, paddingRight: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={d ? 'check' : 'folder_code'} size={20} color={d ? C.done : C.secondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={m(15, undefined, 500, d ? C.text : C.strong2)}>{p.name}</Text>
                <Text style={t(12.5, undefined, 400, C.tertiary)} numberOfLines={1}>Ch {p.chapter} · {p.title}</Text>
              </View>
              <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: d ? 'rgba(87,214,200,0.14)' : C.s4, justifyContent: 'center' }}>
                <Text style={t(11.5, 24 / 11.5, 600, d ? C.done : C.secondary)}>{status}</Text>
              </View>
            </Press>
          );
        })}
      </View>

      <BuildAlongCard />

      <Text style={t(12.5, 1.55, 400, C.tertiary, { marginTop: 4, marginHorizontal: 24 })}>
        Exercises, hints and solutions from Rustlings (MIT), in Rustlings’ order. The § tags come from its exercise-to-chapter map.
      </Text>
    </ScrollView>
  );
}
