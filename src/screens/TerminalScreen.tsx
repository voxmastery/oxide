// Terminal (design/project/Terminal.dc.html, SPEC "Terminal").
// A shell over the sandbox file system (src/fs) with the real toolchain for cargo/rustc.
// entry.params = { cwd?, run? }: start in that folder and run that command once.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row, TopLine } from '../ui/core';
import { PulseDot } from '../ui/controls';
import { navActions, useNav } from '../nav/store';
import { today, useApp } from '../state/app';
import { buildMission } from '../state/selectors';
import { useActiveMinutes } from '../state/useActiveMinutes';
import * as fs from '../fs';
import type { ScreenProps } from './registry';
import { useTerm, type Block } from './terminal/store';
import { applyParams, complete, interrupt, startSession, submit } from './terminal/shell';
import { BlockView } from './terminal/BlockView';
import { ProjectsSheet, useProjects } from './terminal/ProjectsSheet';

const KEYS = ['Tab', '⌃C', '↑', '↓', '~', '/', '-', '_', '|', '.'];

// ---------------------------------------------------------------------------
// Day-1 mission
// ---------------------------------------------------------------------------

function useDay1() {
  const day1 = useApp((s) => !!(s.missions[today()] ?? buildMission(s)).day1);
  const stepInfo = useApp((s) => {
    const mi = s.missions[today()] ?? buildMission(s);
    const i = mi.steps.findIndex((x) => x.kind === 'term');
    return `${i < 0 ? mi.steps.length : i + 1}/${mi.steps.length}`;
  });
  const helloRan = useApp((s) => s.helloRan);
  const mis = useTerm((s) => s.mission);
  const on = day1 && (!helloRan || mis.doneHere);
  const done = on && mis.run;
  return { on, done, mis, step: stepInfo.split('/') };
}

function MissionCard({ done, mis, step }: ReturnType<typeof useDay1>) {
  const steps: [string, boolean][] = [[`cargo new ${mis.name}`, mis.new], [`cd ${mis.name}`, mis.cd], ['cargo run', mis.run]];
  return (
    <View style={{ marginTop: 2, marginHorizontal: 12, marginBottom: 10, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14, borderRadius: 18, backgroundColor: C.s2, gap: 8 }}>
      <Row style={{ gap: 8, minHeight: 20 }}>
        <Text style={m(10.5, undefined, 500, done ? C.done : C.secondary, { flex: 1, letterSpacing: 0.84 })}>
          {done ? 'MISSION COMPLETE · +60 XP' : `TODAY’S MISSION · STEP ${step[0]} OF ${step[1]}`}
        </Text>
        {done ? (
          <Press onPress={() => navActions().tab('home')} radius={20} style={{ height: 40, marginVertical: -10, marginRight: -6, paddingLeft: 12, paddingRight: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={t(13.5, undefined, 600, C.done)}>Home</Text>
            <Icon name="chevron_right" size={18} color={C.done} />
          </Press>
        ) : null}
      </Row>
      <Text style={t(15.5, 1.3, 600, C.text)}>{done ? 'You ran your first Rust program.' : 'Make a Cargo project and run it'}</Text>
      <Text style={t(13, 1.45, 400, C.secondary)}>
        {done ? 'Tomorrow, 1.3 Hello, Cargo! explains what Cargo just did.' : 'Cargo is Rust’s build tool. It makes a project with a Hello, world! program already in it.'}
      </Text>
      <Row style={{ gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
        {steps.map(([label, ok]) => (
          <Row key={label} style={{ height: 26, paddingLeft: 6, paddingRight: 9, borderRadius: 8, backgroundColor: ok ? 'rgba(87,214,200,0.1)' : C.s4, gap: 5 }}>
            <Icon name={ok ? 'check_circle' : 'radio_button_unchecked'} size={16} fill={ok} color={ok ? C.done : C.mutedHi2} />
            <Text style={m(11.5, undefined, 500, ok ? C.done : C.mutedHi2)} numberOfLines={1}>{label}</Text>
          </Row>
        ))}
      </Row>
      <Inset color={done ? 'rgba(87,214,200,0.32)' : C.hairline} radius={18} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function TerminalScreen({ entry }: ScreenProps) {
  useActiveMinutes();
  const cwd = useTerm((s) => s.cwd);
  const blocks = useTerm((s) => s.blocks);
  const proc = useTerm((s) => s.proc);
  const root = useTerm((s) => s.root);
  const history = useTerm((s) => s.history);
  const started = useTerm((s) => s.started);
  const depth = useNav((s) => s.stack.length);
  const mission = useDay1();
  const projects = useProjects();

  const [input, setInput] = useState('');
  const [focus, setFocus] = useState(false);
  const [hi, setHi] = useState(-1);
  const [sheet, setSheet] = useState(entry.variant === 'projects');
  const [width, setWidth] = useState(380);
  const inRef = useRef<TextInputInstance | null>(null);
  const listRef = useRef<FlatList<Block> | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Start the session, then apply entry.params once.
  useEffect(() => {
    let live = true;
    (async () => {
      await startSession();
      if (!live) return;
      const p = entry.params as { cwd?: string; run?: string } | undefined;
      await applyParams(entry.key, p);
    })();
    return () => { live = false; };
  }, [entry.key, entry.params]);

  const focusIn = () => { clearTimeout(blurTimer.current); inRef.current?.focus(); };
  const run = (line: string) => { setInput(''); setHi(-1); submit(line); };

  // ----- auto scroll: show the newest block from its top; follow the tail while a program runs -----
  const heights = useRef(new Map<number, number>());
  const contentH = useRef(0);
  const viewH = useRef(0);
  const pending = useRef(true);
  const lastId = blocks[blocks.length - 1]?.id;
  const lastLen = blocks[blocks.length - 1]?.lines.length;
  useEffect(() => { pending.current = true; }, [lastId, lastLen, proc]);
  const scrollNow = useCallback(() => {
    const l = listRef.current;
    const s = useTerm.getState();
    const last = s.blocks[s.blocks.length - 1];
    if (!l || !last) return;
    const max = Math.max(0, contentH.current - viewH.current);
    const h = heights.current.get(last.id);
    const y = s.proc || h === undefined ? max : Math.min(max, Math.max(0, contentH.current - h - 4));
    l.scrollToOffset({ offset: y, animated: false });
  }, []);
  const onContent = (_w: number, h: number) => {
    contentH.current = h;
    if (pending.current) { pending.current = false; requestAnimationFrame(scrollNow); }
  };
  const onBlockH = useCallback((id: number, h: number) => {
    const prev = heights.current.get(id);
    heights.current.set(id, h);
    const s = useTerm.getState();
    if (prev !== h && s.blocks[s.blocks.length - 1]?.id === id) requestAnimationFrame(scrollNow);
  }, [scrollNow]);

  // ----- keys -----
  const histNav = (dir: number) => {
    if (!history.length || proc) return;
    const i = Math.max(0, Math.min(history.length, (hi < 0 ? history.length : hi) + dir));
    setHi(i === history.length ? -1 : i);
    setInput(i === history.length ? '' : history[i]);
  };
  const tab = async () => { const v = await complete(input); if (v !== input) setInput(v); };
  const ctrlC = () => { if (!interrupt()) { setInput(''); setHi(-1); } };
  const key = (k: string) => {
    if (k === 'Tab') tab();
    else if (k === '⌃C') ctrlC();
    else if (k === '↑') histNav(-1);
    else if (k === '↓') histNav(1);
    else setInput((s) => s + k);
    focusIn();
  };
  const onKeyPress = (e: { nativeEvent: { key: string; ctrlKey?: boolean }; preventDefault?: () => void }) => {
    const k = e.nativeEvent.key;
    const ctrl = !!e.nativeEvent.ctrlKey;
    if (k === 'ArrowUp') { e.preventDefault?.(); histNav(-1); }
    else if (k === 'ArrowDown') { e.preventDefault?.(); histNav(1); }
    else if (k === 'Tab') { e.preventDefault?.(); tab(); }
    else if (ctrl && (k === 'c' || k === 'C')) { e.preventDefault?.(); ctrlC(); }
    else if (ctrl && (k === 'l' || k === 'L')) { e.preventDefault?.(); useTerm.setState({ blocks: [] }); }
  };

  // ----- suggestion chips -----
  const chips = useMemo(() => {
    const mi = mission.mis;
    let pri = '';
    if (mission.on && !mission.done) {
      const proj = fs.projectPath(mi.name);
      pri = !mi.new ? `cargo new ${mi.name}` : cwd !== proj ? (cwd === fs.PROJECTS ? `cd ${mi.name}` : `cd ${proj}`) : 'cargo run';
    }
    let list: string[];
    if (root.kind === 'rustlings') list = ['rustlings run', 'rustlings hint', 'ls exercises', 'cd ~/projects'];
    else if (root.kind === 'project') list = ['cargo run', 'edit src/main.rs', 'cat src/main.rs', 'cargo build', 'cargo check', 'cargo test', 'cargo clippy', 'ls'];
    else if (cwd === fs.PROJECTS) list = ['ls', ...projects.map((p) => `cd ${p.name}`), 'cargo new '];
    else list = ['ls', 'cd ~/projects', 'cd ~/rustlings', 'help'];
    if (pri) list = [pri, ...list.filter((x) => x !== pri)];
    return list.map((x) => ({ x, pri: x === pri, open: x.endsWith(' ') }));
  }, [mission.on, mission.done, mission.mis, cwd, root.kind, projects]);

  // ----- top bar -----
  const name = cwd === fs.HOME ? '~' : fs.basename(cwd);
  const path = cwd === fs.HOME ? fs.HOME_ABS : cwd;
  const icon = cwd === fs.RUSTLINGS || cwd.startsWith(fs.RUSTLINGS + '/') ? 'data_object' : root.kind === 'project' ? 'folder_open' : 'terminal';

  const has = input.trim().length > 0 || !!proc;
  const program = !!proc?.program;

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      {/* Top bar */}
      <Row style={{ height: 64, gap: 2, paddingTop: 4, paddingHorizontal: 6 }}>
        {depth > 1 ? (
          <Press onPress={() => navActions().back()} radius={24} accessibilityLabel="Back" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow_back" size={24} color={C.text} />
          </Press>
        ) : null}
        <Press onPress={() => setSheet(true)} overlay="rgba(255,255,255,0.04)" radius={16} accessibilityLabel="Projects"
          style={{ flex: 1, minWidth: 0, height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderRadius: 16 }}>
          <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={20} color={C.rustLight} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Row style={{ gap: 2, minWidth: 0 }}>
              <Text style={m(16, undefined, 600, C.text, { flexShrink: 1 })} numberOfLines={1}>{name}</Text>
              <Icon name="expand_more" size={20} color={C.tertiary} />
            </Row>
            <Text style={m(11.5, undefined, 400, C.tertiary)} numberOfLines={1}>{path}</Text>
          </View>
        </Press>
        <Press onPress={() => useTerm.setState({ blocks: [] })} radius={24} accessibilityLabel="Clear the screen" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="clear_all" size={24} color={C.strong2} />
        </Press>
      </Row>

      {mission.on ? <MissionCard {...mission} /> : null}

      {/* Session */}
      <View style={{ flex: 1, minHeight: 0 }} onLayout={(e) => { viewH.current = e.nativeEvent.layout.height; setWidth(Math.max(200, e.nativeEvent.layout.width - 32)); }}>
        <FlatList
          ref={listRef}
          data={blocks}
          keyExtractor={(b) => String(b.id)}
          renderItem={({ item }) => <BlockView b={item} running={proc?.blockId === item.id} program={proc?.blockId === item.id && program} width={width} onLayoutH={onBlockH} />}
          extraData={proc}
          onContentSizeChange={onContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          windowSize={9}
          ListEmptyComponent={started ? (
            <Text style={m(12.5, 20, 400, C.disabled, { paddingVertical: 32, paddingHorizontal: 24, textAlign: 'center' })}>Screen cleared. Your history is still on ↑.</Text>
          ) : undefined}
        />
        <TopLine color={C.divider} />
      </View>

      {/* Input area */}
      <View style={{ backgroundColor: C.inputBar, paddingTop: 4, paddingBottom: 10, gap: 4 }}>
        <TopLine color={C.lineDark} />
        {proc ? (
          <Row style={{ height: 44, gap: 10, paddingLeft: 18, paddingRight: 8 }}>
            <PulseDot size={8} color={C.done} />
            <Text style={m(12.5, undefined, 500, C.strong2, { flex: 1, minWidth: 0 })} numberOfLines={1}>
              {program ? `${proc.name} is waiting for input` : `${proc.name} is running`}
            </Text>
            <Press onPress={() => { interrupt(); focusIn(); }} overlay={null} accessibilityLabel="Stop" pressedStyle={{ backgroundColor: C.raisedHover }}
              style={{ height: 36, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.raised, justifyContent: 'center' }}>
              <Text style={m(12.5, undefined, 600, C.text)}>Stop ⌃C</Text>
            </Press>
          </Row>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
            {chips.map((c) => (
              <Press key={c.x} overlay={null} hitSlop={{ top: 4, bottom: 4 }} onPress={() => { if (c.open) { setInput(c.x); focusIn(); } else run(c.x); }}
                pressedStyle={{ backgroundColor: c.pri ? C.rustPressed : '#292725' }}
                style={{ marginVertical: 4, height: 36, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c.pri ? C.rust : C.s4, justifyContent: 'center' }}>
                <Text style={m(12.5, undefined, 500, c.pri ? C.onRust : '#E4DFD9')} numberOfLines={1}>{c.open ? `${c.x.trim()} …` : c.x}</Text>
                <Inset color={c.pri ? C.rust : C.border} radius={10} />
              </Press>
            ))}
          </ScrollView>
        )}
        <Row style={{ marginHorizontal: 12, height: 52, borderRadius: 14, backgroundColor: C.s3, gap: 10, paddingLeft: 14, paddingRight: 6 }}>
          <Text style={m(15, undefined, 600, program ? C.done : C.rustLight)}>{program ? '›' : '$'}</Text>
          <TextInput
            ref={inRef}
            value={input}
            onChangeText={(v) => { setInput(v); }}
            onSubmitEditing={() => { run(input); focusIn(); }}
            onKeyPress={onKeyPress as never}
            onFocus={() => { clearTimeout(blurTimer.current); setFocus(true); }}
            onBlur={() => { clearTimeout(blurTimer.current); blurTimer.current = setTimeout(() => setFocus(false), 180); }}
            placeholder={program ? (proc?.numeric ? 'Type a number, then Enter' : 'Type input, then Enter') : 'Type a command'}
            placeholderTextColor={C.disabled}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
            submitBehavior="submit"
            {...({ blurOnSubmit: false } as object)}
            returnKeyType="send"
            selectionColor={C.rust}
            cursorColor={C.rust}
            style={[m(15, undefined, 400, C.text), { flex: 1, minWidth: 0, height: '100%', padding: 0 }, Platform.OS === 'web' ? ({ outlineStyle: 'none', caretColor: C.rust } as object) : null]}
          />
          <Press onPress={() => { run(input); focusIn(); }} overlay={null} accessibilityLabel="Run"
            style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: has ? C.rust : '#262422', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="keyboard_return" size={22} color={has ? C.onRust : C.disabled} />
          </Press>
          <Inset color={focus ? C.rust : C.border} width={focus ? 1.5 : 1} radius={14} />
        </Row>
        {focus ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 4, paddingTop: 2, paddingHorizontal: 10 }}>
            {KEYS.map((k) => (
              <Press key={k} onPress={() => key(k)} overlay={null} pressedStyle={{ backgroundColor: '#262422' }}
                style={{ minWidth: 44, height: 44, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={m(14, undefined, 500, C.strong2)}>{k}</Text>
              </Press>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {sheet ? (
        <ProjectsSheet
          cwd={cwd}
          onClose={() => setSheet(false)}
          onCd={(p) => { if (!useTerm.getState().proc) run(`cd ${p}`); }}
          onPrefill={(x) => { setSheet(false); setInput(x); setTimeout(focusIn, 50); }}
        />
      ) : null}
    </View>
  );
}
