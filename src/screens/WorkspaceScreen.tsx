// Exercise screen (design/project/Workspace.dc.html + CodeEditor.dc.html). entry.arg = exercise name.
// Check/Run go through the real toolchain; when it's unavailable its message is shown as is.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, PanResponder, ScrollView, Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Press, Row } from '../ui/core';
import { IconButton, IndeterminateBar, Spinner } from '../ui/controls';
import { CodeEditor, type CodeEditorHandle } from '../ui/CodeEditor';
import { navActions } from '../nav/store';
import { useApp } from '../state/app';
import { buildMission, rustlingsProgress, streak, todayLog } from '../state/selectors';
import { useActiveMinutes } from '../state/useActiveMinutes';
import { nextExercise, rustlings, sectionById, topicOf } from '../content';
import { getToolchain } from '../toolchain';
import type { CheckResult } from '../toolchain/types';
import { plain } from '../rust/ansi';
import { changedLines } from '../rust/diff';
import { buildExplanation, marksFrom, primaryError, solutionFix, type Explanation, type ExplainFix } from '../rust/explain';
import type { ScreenProps } from './registry';
import { exerciseMeta, fmtDuration, hintsFor, solutionUnlocked } from './workspace/model';
import { ExplainPanel, HintsPanel, OutputPanel, SolutionPanel } from './workspace/panels';
import { Tour } from './workspace/Tour';
import { Success, type SuccessInfo } from './workspace/Success';

type Tab = 'out' | 'explain' | 'hints' | 'solution';
type Status = 'idle' | 'compiling' | 'pass' | 'error' | 'panic' | 'unavailable' | 'ran' | 'runfail';

const REF_H = 857; // content height at the 412 × 915 reference (minus status and gesture bars)
const BAR_H = 80;

export default function WorkspaceScreen({ entry }: ScreenProps) {
  const name = entry.arg ?? rustlingsProgress(useApp.getState()).next ?? rustlings.order[0];
  const meta = useMemo(() => exerciseMeta(name), [name]);
  if (!meta) {
    return (
      <View style={{ flex: 1, backgroundColor: C.ground }}>
        <Row style={{ height: 56, paddingHorizontal: 4 }}><IconButton name="arrow_back" onPress={navActions().back} label="Back" /></Row>
        <Text style={t(15, 1.5, 400, C.secondary, { padding: 24 })}>There’s no Rustlings exercise called “{name}”.</Text>
      </View>
    );
  }
  return <Workspace key={name} meta={meta} entry={entry} />;
}

function Workspace({ meta, entry }: { meta: NonNullable<ReturnType<typeof exerciseMeta>>; entry: ScreenProps['entry'] }) {
  useActiveMinutes();
  const { ex } = meta;
  const name = ex.name;
  const { nav, replace, back, pop, showToast } = navActions();
  const st = useApp((s) => s.ex[name]);
  const policy = useApp((s) => s.prefs.solution);
  const wrap = useApp((s) => s.prefs.wrapOutput);
  const tourSeen = useApp((s) => s.tourSeen);
  const attempts = st?.attempts ?? 0;
  const hintsShown = st?.hints ?? 0;

  const [code, setCode] = useState(() => useApp.getState().ex[name]?.code ?? ex.code);
  const [status, setStatus] = useState<Status>('idle');
  const [mode, setMode] = useState<'check' | 'run'>('check');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [command, setCommand] = useState(ex.test ? `cargo test --bin ${name}` : `cargo run --bin ${name}`);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>('out');
  const [kbd, setKbd] = useState(false);
  const [size, setSize] = useState({ w: 412, h: REF_H });
  const [tour, setTour] = useState(tourSeen ? -1 : 0);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [beforeApply, setBeforeApply] = useState<string | null>(null);
  const editor = useRef<CodeEditorHandle>(null);
  const started = useRef(Date.now());
  const seenCodes = useRef(new Set<string>());
  const proc = useRef<{ kill: () => void } | null>(null);

  // ---- Persist code (debounced) ----
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(code);
  latest.current = code;
  useEffect(() => () => {
    clearTimeout(saveTimer.current);
    const cur = useApp.getState().ex[name]?.code ?? ex.code;
    if (latest.current !== cur) useApp.getState().exPatch(name, { code: latest.current });
    proc.current?.kill();
  }, [name, ex.code]);
  const onCode = useCallback((v: string) => {
    setCode(v);
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => useApp.getState().exPatch(name, { code: v }), 500);
  }, [name]);
  const setCodeNow = (v: string) => { setCode(v); setDirty(true); clearTimeout(saveTimer.current); useApp.getState().exPatch(name, { code: v }); };

  // ---- Sheet ----
  const scale = Math.min(1, size.h / REF_H);
  const snaps = useMemo(() => [76, Math.round(380 * scale), Math.round(Math.min(700 * scale, size.h - BAR_H - 56))], [scale, size.h]);
  const sheetA = useRef(new Animated.Value(76)).current;
  const sheetH = useRef(76);
  const [sheetUp, setSheetUp] = useState(false);
  const animateTo = useCallback((h: number) => {
    sheetH.current = h;
    setSheetUp(h > 100);
    Animated.timing(sheetA, { toValue: h, duration: 280, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start();
  }, [sheetA]);
  const atLeastHalf = useCallback(() => { if (sheetH.current < snaps[1]) animateTo(snaps[1]); }, [animateTo, snaps]);
  const toggleSheet = () => animateTo(sheetH.current > 100 ? snaps[0] : snaps[1]);
  const pan = useMemo(() => {
    let h0 = 76;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => { h0 = sheetH.current; sheetA.stopAnimation(); },
      onPanResponderMove: (_, g) => { const h = Math.max(snaps[0], Math.min(snaps[2], h0 - g.dy)); sheetH.current = h; sheetA.setValue(h); },
      onPanResponderRelease: () => {
        const h = sheetH.current;
        animateTo(snaps.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a)));
      },
      onPanResponderTerminate: () => animateTo(snaps.reduce((a, b) => (Math.abs(b - sheetH.current) < Math.abs(a - sheetH.current) ? b : a))),
    });
  }, [snaps, sheetA, animateTo]);
  const openTab = (id: Tab) => { setTab(id); atLeastHalf(); };

  // ---- Derived ----
  const unlocked = solutionUnlocked(policy, st);
  const solDiff = useMemo(() => (ex.solution ? changedLines(ex.code, ex.solution) : []), [ex.code, ex.solution]);
  const failed = status === 'error' || status === 'panic';
  const exp: Explanation | null = useMemo(() => {
    if (!result || !failed) return null;
    const solution = unlocked ? solutionFix(ex.code, ex.solution, ex.xp) : null;
    const base = buildExplanation({ result, exercise: name, code, topicSection: meta.section, solution });
    if (!base) return null;
    const cur = base.code ? meta.curated?.explain[base.code] : undefined;
    if (!cur) return base;
    return {
      ...base,
      lead: cur.lead,
      steps: cur.steps.map((s) => ({ line: Number(s.n), text: s.t, ok: s.ok })),
      fixes: [...cur.fixes.map((f): ExplainFix => ({ label: f.label, code: f.code, note: f.note, apply: f.apply })), ...(solution ? [solution] : [])],
      read: cur.read,
    };
    // `code` is read for suggestion previews only when the result arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, failed, unlocked, name, meta]);
  const marks = useMemo(() => (dirty || status === 'compiling' ? [] : marksFrom(result, name, code)), [dirty, status, result, name, code]);
  const scrollLine = marks.find((x) => x.kind !== 'warn')?.line ?? marks[0]?.line;
  const hints = useMemo(() => hintsFor(ex), [ex]);
  const readId = exp?.read ?? meta.section;
  const readMeta = readId ? sectionById(readId) : undefined;

  // ---- Check / Run ----
  const busy = status === 'compiling';
  const toolchainInfo = async () => {
    try {
      const info = await getToolchain().info();
      if (!info.installed || info.unavailableReason) return info.unavailableReason ?? 'The Rust toolchain isn’t installed yet.';
      return null;
    } catch (e) { return e instanceof Error ? e.message : String(e); }
  };

  const check = async () => {
    if (busy) return;
    setTour(-1);
    setMode('check');
    setTab('out');
    setStatus('compiling');
    setLines([]);
    setDirty(false);
    const why = await toolchainInfo();
    if (why) { setResult(null); setLines([why]); setStatus('unavailable'); atLeastHalf(); return; }
    const src = latest.current;
    let r: CheckResult;
    try { r = await getToolchain().checkExercise(name, src); } catch (e) {
      setResult(null); setLines([e instanceof Error ? e.message : String(e)]); setStatus('unavailable'); atLeastHalf(); return;
    }
    applyResult(r);
  };

  const applyResult = (r: CheckResult) => {
    setMode('check');
    setDirty(false);
    setResult(r);
    setCommand(r.command);
    setLines(r.lines);
    if (r.outcome === 'pass') {
      setStatus('pass');
      const s0 = useApp.getState();
      const xpBefore = s0.xp;
      const earned = s0.passExercise(name, ex.xp, [...seenCodes.current]);
      const s1 = useApp.getState();
      const passed = r.lines.map(plain).join('\n').match(/(\d+) passed/);
      setTimeout(() => setSuccess(successInfo(s1, { xpBefore, earned, passed: passed ? Number(passed[1]) : meta.tests })), 850);
    } else {
      const d = primaryError(r, name);
      const codes = r.diagnostics.filter((x) => x.level === 'error' && x.code).map((x) => x.code as string);
      codes.forEach((c) => seenCodes.current.add(c));
      useApp.getState().failedCheck(name, codes);
      setStatus(r.outcome === 'compile-error' || (d && !r.panic) ? 'error' : 'panic');
      atLeastHalf();
    }
  };

  const run = async () => {
    if (busy) return;
    setTour(-1);
    setMode('run');
    setTab('out');
    setStatus('compiling');
    setLines([]);
    setResult(null);
    setDirty(false);
    setCommand(`cargo run --bin ${name}`);
    const why = await toolchainInfo();
    if (why) { setLines([why]); setStatus('unavailable'); atLeastHalf(); return; }
    atLeastHalf();
    try {
      const p = getToolchain().runExercise(name, latest.current, (e) => {
        if (e.type === 'exit') { proc.current = null; setStatus(e.code === 0 ? 'ran' : 'runfail'); }
        else setLines((ls) => [...ls, e.line]);
      });
      proc.current = p;
    } catch (e) { setLines([e instanceof Error ? e.message : String(e)]); setStatus('unavailable'); }
  };

  function successInfo(s: ReturnType<typeof useApp.getState>, o: { xpBefore: number; earned: number; passed: number }): SuccessInfo {
    const rl = rustlingsProgress(s);
    const node = topicOf(name);
    const topicNames = node ? (node.t === 'topic' ? node.exercises : [node.exercise]) : [name];
    const topicDone = topicNames.filter((n) => s.ex[n]?.status === 'done').length;
    const att = s.ex[name]?.attempts ?? 0;
    const hn = s.ex[name]?.hints ?? 0;
    const sk = streak(s).current;
    const tl = todayLog(s);
    const mission = buildMission(s);
    const exSteps = mission.steps.filter((x) => x.kind === 'ex');
    const exDone = exSteps.filter((x) => s.ex[x.id]?.status === 'done').length;
    const left = Math.max(0, s.plan.goal - tl.minutes);
    return {
      name,
      kicker: o.passed ? (o.passed === 1 ? 'TEST PASSED' : `ALL ${o.passed} TESTS PASSED`) : 'RAN CLEAN',
      meta: `${att} ${att === 1 ? 'attempt' : 'attempts'} · ${hn} ${hn === 1 ? 'hint' : 'hints'} · ${fmtDuration(Date.now() - started.current)}`,
      xpBefore: o.xpBefore,
      earned: o.earned,
      rlDone: rl.done,
      rlTotal: rl.total,
      topicLabel: `${node?.name ?? ex.topic} ${topicDone}/${topicNames.length}`,
      streakTitle: tl.goalMet ? `${sk}-day streak kept` : sk > 0 ? `${sk}-day streak · ${left} min to keep it` : `${left} min to today’s goal`,
      streakSub: exSteps.length ? `Today’s mission: ${exDone} of ${exSteps.length} exercise${exSteps.length === 1 ? '' : 's'} done` : 'Today’s mission is about the Book',
      next: nextExercise(name)?.name ?? null,
    };
  }

  // Dev-only: show the success state without the compiler (for design checks on web).
  useEffect(() => {
    if (!__DEV__) return;
    const g = globalThis as unknown as { __oxWorkspace?: object };
    g.__oxWorkspace = {
      success: () => setSuccess(successInfo(useApp.getState(), { xpBefore: useApp.getState().xp, earned: ex.xp, passed: meta.tests })),
      tour: (n = 0) => setTour(n),
      result: (r: CheckResult) => applyResult(r),
    };
    return () => { delete g.__oxWorkspace; };
  });

  // ---- Actions ----
  const reset = () => {
    const prev = latest.current;
    setCodeNow(ex.code);
    setStatus('idle'); setResult(null); setLines([]); setDirty(false);
    showToast('Reset to the original file', 'Undo', () => setCodeNow(prev));
  };
  const applyFix = (f: ExplainFix) => {
    if (!f.apply) return;
    const prev = latest.current;
    setCodeNow(f.apply(prev));
    if (f.isSolution) { useApp.getState().exPatch(name, { solutionApplied: true }); setBeforeApply(prev); }
    showToast(f.isSolution ? 'Solution applied. Check to finish.' : 'Fix applied. Check to see if it worked.', 'Undo', () => {
      setCodeNow(prev);
      if (f.isSolution) { useApp.getState().exPatch(name, { solutionApplied: false }); setBeforeApply(null); }
    });
  };
  const applySolution = () => { const f = solutionFix(ex.code, ex.solution, ex.xp); if (f) applyFix(f); else if (ex.solution) { setBeforeApply(latest.current); setCodeNow(ex.solution); useApp.getState().exPatch(name, { solutionApplied: true }); } };
  const undoSolution = () => {
    if (beforeApply !== null) setCodeNow(beforeApply);
    setBeforeApply(null);
    useApp.getState().exPatch(name, { solutionApplied: false });
  };
  const openBook = () => nav('reader', { arg: meta.section ?? useApp.getState().book.current });
  const openRead = () => nav('reader', { arg: readId });
  const openMore = () => pop('exmenu', { exercise: name, onReset: reset });
  const peek = () => pop('solution-early', { exercise: name, attempts, onShow: () => { useApp.getState().exPatch(name, { solutionViewed: true }); openTab('solution'); } });
  const revealHint = () => useApp.getState().exPatch(name, { hints: Math.min(3, hintsShown + 1) });
  const hideKbd = () => { editor.current?.blur(); Keyboard.dismiss(); setKbd(false); };
  const endTour = () => { setTour(-1); useApp.getState().set({ tourSeen: true }); };
  const tourNext = () => { if (tour >= 3) endTour(); else setTour(tour + 1); };

  // ---- Sheet header ----
  const d = result ? primaryError(result, name) : null;
  let head: { icon?: string; c: string; title: string; sub: string; explain?: boolean };
  if (busy) head = { c: C.text, title: mode === 'run' ? `Running ${name}…` : `Compiling ${name}…`, sub: command };
  else if (status === 'unavailable') head = { icon: 'info', c: C.secondary, title: 'Can’t compile here', sub: lines[0] ?? '' };
  else if (status === 'panic') head = { icon: 'bolt', c: C.running, title: result?.panic ? `panicked at line ${result.panic.line}` : 'test failed', sub: dirty ? 'Code changed. Check again.' : result?.panic?.message ?? 'A test failed.', explain: !!exp };
  else if (status === 'error') head = { icon: 'cancel', c: C.error, title: d?.code ? `error[${d.code}]` : 'error', sub: dirty ? 'Code changed. Check again.' : d?.message ?? 'Compile error', explain: !!exp };
  else if (status === 'pass') {
    const tl = result?.lines.map(plain).find((l) => l.startsWith('test result:'));
    const m2 = tl?.match(/(\d+) passed; (\d+) failed/);
    head = m2 ? { icon: 'check_circle', c: C.done, title: `${m2[1]} passed · ${m2[2]} failed`, sub: tl ?? '' } : { icon: 'check_circle', c: C.done, title: 'Finished, exit status 0', sub: 'main() ran without panicking' };
  } else if (status === 'ran') head = { icon: 'check_circle', c: C.done, title: 'Finished, exit status 0', sub: 'main() ran without panicking' };
  else if (status === 'runfail') head = { icon: 'bolt', c: C.running, title: 'Exited with an error', sub: 'See the output for details' };
  else head = { icon: 'radio_button_unchecked', c: C.secondary, title: 'Not checked yet', sub: meta.tests ? `Check compiles and runs ${meta.testsLabel}` : 'Check compiles and runs main()' };

  const tabs: { id: Tab; label: string; dis?: boolean; lock?: boolean }[] = [
    { id: 'out', label: 'Output' },
    { id: 'explain', label: 'Explain', dis: !exp },
    { id: 'hints', label: `Hints ${hintsShown}/3` },
    { id: 'solution', label: 'Solution', lock: !unlocked },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.ground, overflow: 'hidden' }} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {/* Top bar */}
      <Row style={{ height: 56, gap: 2, paddingHorizontal: 4 }}>
        <IconButton name="arrow_back" onPress={back} label="Back" />
        <View style={{ flex: 1, minWidth: 0, gap: 3, paddingLeft: 2 }}>
          <Text style={m(17, 19.5, 600, C.text, { letterSpacing: -0.17 })} numberOfLines={1}>{name}</Text>
          <Text style={t(13, 15.6 / 13, 400, C.secondary)} numberOfLines={1}>{meta.subtitle}</Text>
        </View>
        <IconButton name="menu_book" color={C.strong2} onPress={openBook} label="Related reading" />
        <IconButton name="more_vert" color={C.strong2} onPress={openMore} label="More" />
      </Row>
      {/* Chips */}
      <Row style={{ height: 44, gap: 8, paddingLeft: 16, paddingRight: 8, paddingBottom: 4 }}>
        <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#36332F', justifyContent: 'center', flexShrink: 1 }}>
          <Text style={t(13, undefined, 400, C.strong2)} numberOfLines={1}>{meta.topicLabel}</Text>
        </View>
        <Row style={{ height: 28, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#36332F', gap: 7 }}>
          <Row style={{ gap: 3 }}>
            {[1, 2, 3].map((i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i <= meta.diff ? C.text : 'transparent', borderWidth: 1.5, borderColor: i <= meta.diff ? C.text : C.disabled }} />)}
          </Row>
          <Text style={t(13, undefined, 400, C.strong2)}>{meta.diffLabel}</Text>
        </Row>
        <Text style={m(13, undefined, 600, C.rustLight)} numberOfLines={1}>+{ex.xp} XP</Text>
        <View style={{ flex: 1 }} />
        {kbd ? (
          <Press onPress={hideKbd} radius={20} accessibilityLabel="Hide keyboard" style={{ width: 44, height: 40, borderRadius: 20, backgroundColor: C.s4, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="keyboard_hide" size={22} />
          </Press>
        ) : (
          <Text style={m(12, undefined, 400, C.tertiary, { paddingRight: 8 })}>{meta.testsLabel}</Text>
        )}
      </Row>
      {/* Editor */}
      <View style={{ flex: 1, minHeight: 0, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
        <CodeEditor
          ref={editor}
          value={code}
          onChange={onCode}
          marks={marks}
          scrollToLine={scrollLine}
          padBottom={kbd ? 24 : 96}
          hideKey={false}
          onFocusChange={setKbd}
        />
      </View>

      {!kbd ? (
        <>
          {/* Exercise sheet */}
          <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: BAR_H, height: sheetA, backgroundColor: C.s2, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', zIndex: 2, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 30, shadowOffset: { width: 0, height: -10 }, elevation: 12 }}>
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} />
            {busy ? <View style={{ position: 'absolute', top: 0, left: 24, right: 24, zIndex: 3 }}><IndeterminateBar height={2} track="transparent" /></View> : null}
            <View {...pan.panHandlers}>
              <Press onPress={toggleSheet} overlay={null} accessibilityLabel={sheetUp ? 'Collapse' : 'Expand'}>
                <View style={{ height: 18, alignItems: 'center', justifyContent: 'flex-end' }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.handle }} /></View>
                <Row style={{ height: 56, gap: 12, paddingLeft: 18, paddingRight: 8 }}>
                  <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                    {busy ? <Spinner size={20} width={2.5} color={C.text} /> : <Icon name={head.icon ?? 'info'} size={24} color={head.c} fill />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={m(13.5, 16.2, 600, head.c)} numberOfLines={1}>{head.title}</Text>
                    <Text style={t(13, 15.6 / 13, 400, C.mutedHi2)} numberOfLines={1}>{head.sub}</Text>
                  </View>
                  {head.explain ? (
                    <Press onPress={() => openTab('explain')} radius={18} style={{ height: 36, paddingLeft: 10, paddingRight: 14, borderRadius: 18, backgroundColor: '#2E2B29', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="school" size={18} color={C.textNav} />
                      <Text style={t(13, undefined, 600, C.textNav)}>Explain</Text>
                    </Press>
                  ) : null}
                  <Press onPress={toggleSheet} radius={22} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={sheetUp ? 'Collapse' : 'Expand'}>
                    <Icon name={sheetUp ? 'expand_more' : 'expand_less'} size={24} color={C.mutedHi2} />
                  </Press>
                </Row>
              </Press>
            </View>
            <Row style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 6 }}>
              {tabs.map((x) => {
                const on = tab === x.id;
                return (
                  <Press key={x.id} onPress={() => openTab(x.id)} disabled={x.dis} overlay={null} accessibilityRole="tab" accessibilityState={{ selected: on, disabled: x.dis }}
                    style={{ flex: 1, minWidth: 0, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    {x.lock ? <Icon name="lock" size={16} color={on ? '#F4F0EB' : '#ABA49D'} /> : null}
                    <Text style={t(13.5, undefined, 500, on ? '#F4F0EB' : x.dis ? '#625C57' : '#ABA49D')} numberOfLines={1}>{x.label}</Text>
                    <View style={{ position: 'absolute', left: 16, right: 16, bottom: 0, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: on ? C.rust : 'transparent' }} />
                  </Press>
                );
              })}
            </Row>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {tab === 'out' ? <OutputPanel command={command} lines={lines} wrap={wrap || status === 'unavailable'} onWrap={() => useApp.getState().setPrefs({ wrapOutput: !wrap })} /> : null}
              {tab === 'explain' ? (
                <ExplainPanel exp={exp} readLabel={readMeta ? `${readMeta.id} ${readMeta.title}` : null} onRead={openRead}
                  onRustc={() => exp?.rustc && nav('terminal', { params: { run: `rustc --explain ${exp.rustc}` } })} onApply={applyFix} />
              ) : null}
              {tab === 'hints' ? <HintsPanel hints={hints} shown={hintsShown} onReveal={revealHint} /> : null}
              {tab === 'solution' ? (
                <SolutionPanel locked={!unlocked} policy={policy} attempts={attempts} xp={ex.xp} diff={solDiff} applied={!!st?.solutionApplied && beforeApply !== null}
                  onPeek={peek} onHints={() => openTab('hints')} onApply={applySolution} onUndo={undoSolution} />
              ) : null}
            </ScrollView>
          </Animated.View>

          {/* Action bar */}
          <Row style={{ height: BAR_H, paddingHorizontal: 8, backgroundColor: C.bar, zIndex: 3 }}>
            <Tool icon="lightbulb" label="Hint" onPress={() => openTab('hints')} />
            <Tool icon="restart_alt" label="Reset" onPress={reset} />
            <Tool icon={unlocked ? 'key' : 'lock'} label="Solution" dim={!unlocked} onPress={() => openTab('solution')} />
            <View style={{ flex: 1 }} />
            <Press onPress={run} radius={24} overlay={null} pressedStyle={{ backgroundColor: C.raisedHover }} accessibilityRole="button"
              style={{ height: 48, paddingLeft: 12, paddingRight: 16, borderRadius: 24, backgroundColor: C.raised, flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 }}>
              <Icon name="play_arrow" size={22} fill />
              <Text style={t(14.5, undefined, 600, C.text)}>Run</Text>
            </Press>
            <Press onPress={check} radius={16} overlay={null} pressedStyle={{ backgroundColor: C.rustPressed }} accessibilityRole="button" accessibilityLabel="Check"
              style={{ height: 56, paddingLeft: 16, paddingRight: 20, borderRadius: 16, backgroundColor: C.rust, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: C.rust, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
              {busy && mode === 'check' ? <Spinner size={20} width={2.5} color={C.onRust} /> : <Icon name="task_alt" size={22} color={C.onRust} />}
              <Text style={t(15, undefined, 650, C.onRust)}>{busy && mode === 'check' ? 'Checking' : 'Check'}</Text>
            </Press>
          </Row>
        </>
      ) : null}

      {tour >= 0 && !kbd ? <Tour step={tour} width={size.w} height={size.h} onNext={tourNext} onSkip={endTour} /> : null}
      {success ? (
        <Success
          info={success}
          onClose={() => setSuccess(null)}
          onNext={() => { const n = success.next; setSuccess(null); if (n) replace('workspace', { arg: n }); else back(); }}
          onCompare={() => { setSuccess(null); openTab('solution'); }}
        />
      ) : null}
    </View>
  );
}

function Tool({ icon, label, onPress, dim }: { icon: string; label: string; onPress: () => void; dim?: boolean }) {
  const c = dim ? C.tertiary : '#E4DFD9';
  return (
    <Press onPress={onPress} radius={16} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 52, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Icon name={icon} size={24} color={c} />
      <Text style={t(11.5, undefined, 500, c)}>{label}</Text>
    </Press>
  );
}

