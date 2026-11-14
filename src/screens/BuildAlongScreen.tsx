// Build-along projects (docs/FEATURES_BRIEF.md, agent 4). No prototype: built in the language of
// Practice and Project. entry.arg = project name → that project's milestones; no arg → the list.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { m, sectionLabel, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Press, Row, TopLine } from '../ui/core';
import { Bar, Button, IconButton, Spinner } from '../ui/controls';
import { AnsiLines, Rich } from '../ui/code';
import { TopBar } from '../ui/bars';
import { navActions } from '../nav/store';
import { useApp } from '../state/app';
import { useActiveMinutes } from '../state/useActiveMinutes';
import { sectionById } from '../content';
import { listProjects, useFsVersion, type ProjectInfo } from '../fs';
import { getToolchain } from '../toolchain';
import {
  PROJECTS,
  XP_PER_MILESTONE,
  checkCommand,
  checkMilestone,
  completeMilestone,
  projectByName,
  projectRoot,
  projectStatus,
  startProject,
  useBuildAlong,
  type BuildAlongMilestone,
  type BuildAlongProject,
  type CheckHandle,
  type CheckOutcome,
} from '../features/buildalong';
import type { ScreenProps } from './registry';

const fileIcon = (f: string) => (f.endsWith('.rs') ? 'description' : f.endsWith('.toml') ? 'settings' : 'draft');
const secLabel = (id: string) => {
  const s = sectionById(id);
  return s ? `§${s.id} ${s.title}` : `§${id}`;
};

export default function BuildAlongScreen({ entry }: ScreenProps) {
  useActiveMinutes();
  const p = projectByName(entry.arg);
  return p ? <ProjectDetail p={p} /> : <ProjectList />;
}

// ---------------------------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------------------------

function ProjectList() {
  const { nav, back } = navActions();
  const progress = useBuildAlong((s) => s.projects);
  const read = useApp((s) => s.book.read);
  const total = PROJECTS.reduce((n, p) => n + p.milestones.length, 0);
  const done = PROJECTS.reduce((n, p) => n + projectStatus(p, progress[p.name]).doneCount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title="Build-along projects" subtitle={`${done} of ${total} milestones`} onBack={back} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingTop: 4, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <Text style={t(15, 1.55, 400, C.mutedHi, { paddingHorizontal: 20 })}>
          Small programs to build on your own, one milestone at a time. Each milestone comes with tests: when they pass, that step works.
        </Text>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {PROJECTS.map((p) => {
            const st = projectStatus(p, progress[p.name]);
            const ready = !!read[p.after];
            const [label, bg, fg] = st.finished
              ? ['Done', 'rgba(87,214,200,0.14)', C.done]
              : st.started
                ? [`${st.doneCount} of ${st.total}`, C.rustTint14, C.rustLight]
                : ready
                  ? ['Not started', C.s4, C.secondary]
                  : [`After §${p.after}`, C.s4, C.secondary];
            return (
              <Press key={p.name} onPress={() => nav('buildalong', { arg: p.name })} radius={18} overlay="rgba(255,255,255,0.03)"
                style={{ borderRadius: 18, backgroundColor: C.s1, paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}>
                <Row style={{ gap: 14 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: st.finished ? C.doneTint : st.started ? C.rustTint14 : C.s3, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={st.finished ? 'check' : 'construction'} size={20} color={st.finished ? C.done : st.started ? C.rustLight : C.secondary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={m(15, undefined, 500, C.text)}>{p.name}</Text>
                    <Text style={t(12.5, undefined, 400, C.tertiary)} numberOfLines={1}>{p.title}</Text>
                  </View>
                  <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: bg, justifyContent: 'center' }}>
                    <Text style={t(11.5, 24 / 11.5, 600, fg)}>{label}</Text>
                  </View>
                </Row>
                <Text style={t(13.5, 1.5, 400, C.secondary)} numberOfLines={3}>{p.summary}</Text>
                {st.started && !st.finished ? <Bar value={st.doneCount / st.total} height={4} /> : null}
              </Press>
            );
          })}
        </View>
        <Text style={t(12.5, 1.55, 400, C.tertiary, { marginHorizontal: 24 })}>
          +{XP_PER_MILESTONE} XP for each milestone the first time its tests pass, and a badge for every finished project. Projects live in ~/projects, so the Terminal and the editor work on them too.
        </Text>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------------------------

type Run = { milestone: string; status: 'running' | 'done'; lines: string[]; outcome?: CheckOutcome };

function ProjectDetail({ p }: { p: BuildAlongProject }) {
  const { nav, back, showToast } = navActions();
  const prog = useBuildAlong((s) => s.projects[p.name]);
  const read = useApp((s) => s.book.read);
  const current = useApp((s) => s.book.current);
  const st = projectStatus(p, prog);
  const v = useFsVersion();
  const [info, setInfo] = useState<ProjectInfo | null | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(st.next?.id ?? null);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const handle = useRef<CheckHandle | null>(null);
  const root = projectRoot(p.name);

  useEffect(() => {
    let live = true;
    listProjects().then((ps) => { if (live) setInfo(ps.find((x) => x.name === p.name) ?? null); }).catch(() => { if (live) setInfo(null); });
    return () => { live = false; };
  }, [v, p.name]);

  useEffect(() => {
    let live = true;
    getToolchain().info().then((i) => { if (live) setUnavailable(i.installed ? null : i.unavailableReason ?? null); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const made = !!info;
  const ready = made && st.started;
  const sel = p.milestones.find((x) => x.id === selected);
  const selIndex = sel ? p.milestones.indexOf(sel) : -1;
  const running = run?.status === 'running';
  const after = sectionById(p.after);
  const pre = !read[p.after] && after
    ? `Best after §${after.id} ${after.title}.${current && current !== p.after ? ` You’re reading §${current} now.` : ''}`
    : '';
  const files = useMemo(() => {
    const fs = (info?.files ?? []).filter((f) => f !== 'Cargo.lock' && !f.startsWith('target/') && /\.(rs|toml|md|txt)$/.test(f));
    const order = ['src/lib.rs', 'src/main.rs', p.testFile, 'Cargo.toml'];
    return [...order.filter((f) => fs.includes(f)), ...fs.filter((f) => !order.includes(f))];
  }, [info, p.testFile]);

  const onStart = async () => {
    setBusy(true);
    try {
      const r = await startProject(p);
      setSelected(st.next?.id ?? p.milestones[0].id);
      showToast(r.created ? `Created ~/projects/${p.name}` : r.kept.length ? `Added the missing files; kept your ${r.kept.length} existing ones` : `Restored ~/projects/${p.name}`);
    } catch (e) {
      showToast(`Couldn’t create ${p.name}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const onCheck = async (ms: BuildAlongMilestone) => {
    if (running) return;
    setSelected(ms.id);
    const h = checkMilestone(p, ms, (lines) => setRun((r) => (r && r.milestone === ms.id && r.status === 'running' ? { ...r, lines } : r)));
    handle.current = h;
    setRun({ milestone: ms.id, status: 'running', lines: [] });
    let out: CheckOutcome;
    try {
      out = await h.done;
    } catch (e) {
      out = { ok: false, code: 1, passed: 0, failed: 0, lines: [e instanceof Error ? e.message : String(e)], command: checkCommand(ms) };
    }
    handle.current = null;
    setRun({ milestone: ms.id, status: 'done', lines: out.lines, outcome: out });
    if (out.ok) {
      const r = completeMilestone(p, ms);
      // The project badge brings its own toast.
      if (r.first && !r.finished) showToast(`Milestone ${p.milestones.indexOf(ms) + 1} done · +${r.xp} XP`);
    }
  };

  const onStop = () => handle.current?.kill();

  // Bottom action
  let action: { label: string; icon: string; onPress: () => void; disabled?: boolean };
  if (!ready) {
    action = { label: st.started ? `Create ${p.name} again` : `Start ${p.name}`, icon: 'construction', onPress: onStart, disabled: busy || info === undefined };
  } else if (running) {
    action = { label: 'Stop', icon: 'stop', onPress: onStop };
  } else if (sel && !prog?.done[sel.id]) {
    action = { label: `Check milestone ${selIndex + 1}`, icon: 'fact_check', onPress: () => onCheck(sel) };
  } else if (st.next) {
    const next = st.next;
    action = { label: `Next: ${next.title}`, icon: 'arrow_forward', onPress: () => { setSelected(next.id); setRun(null); } };
  } else {
    action = { label: 'Run it in the Terminal', icon: 'terminal', onPress: () => nav('terminal', { params: { cwd: root, run: p.run } }) };
  }

  const [status, sbg, sc] = st.finished
    ? ['Done', 'rgba(87,214,200,0.14)', C.done]
    : st.started ? ['In progress', C.rustTint14, C.rustLight] : ['Not started', C.s3, C.mutedHi];

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <Row style={{ height: 56, gap: 2, paddingHorizontal: 4 }}>
        <IconButton name="arrow_back" onPress={back} label="Back" />
        <View style={{ flex: 1 }} />
        {made ? <IconButton name="terminal" color={C.strong2} onPress={() => nav('terminal', { params: { cwd: root } })} label="Open in the Terminal" /> : null}
      </Row>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 10, paddingHorizontal: 4 }}>
          <Text style={sectionLabel}>BUILD-ALONG · {p.milestones.length} MILESTONES</Text>
          <Text style={m(30, 33, 600, C.text, { letterSpacing: -0.6 })}>{p.name}</Text>
          <Text style={t(17, 1.35, 600, C.strong2)}>{p.title}</Text>
          <Text style={t(15.5, 1.55, 400, C.mutedHi)}>{p.summary}</Text>
          <Row style={{ gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
            <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: sbg, justifyContent: 'center' }}>
              <Text style={t(12.5, undefined, 600, sc)}>{status}</Text>
            </View>
            <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.s3, justifyContent: 'center' }}>
              <Text style={t(12.5, undefined, 500, C.mutedHi)}>{st.doneCount} of {st.total} milestones</Text>
            </View>
            <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.s3, justifyContent: 'center' }}>
              <Text style={m(12, undefined, 500, C.mutedHi)}>+{XP_PER_MILESTONE} XP each</Text>
            </View>
          </Row>
          {st.started ? <Bar value={st.doneCount / st.total} height={4} style={{ marginTop: 4 }} /> : null}
        </View>

        {pre ? (
          <Row style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: C.s1, gap: 12, alignItems: 'flex-start' }}>
            <Icon name="info" size={20} color={C.checkpoint} />
            <Rich text={pre} style={t(14, 1.5, 400, C.strong2, { flex: 1 })} />
          </Row>
        ) : null}
        {ready && unavailable ? (
          <Row style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: C.s1, gap: 12, alignItems: 'flex-start' }}>
            <Icon name="info" size={20} color={C.secondary} />
            <Text style={t(14, 1.5, 400, C.strong2, { flex: 1 })}>{unavailable}</Text>
          </Row>
        ) : null}
        {!ready && st.started && info === null ? (
          <Row style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: C.s1, gap: 12, alignItems: 'flex-start' }}>
            <Icon name="info" size={20} color={C.checkpoint} />
            <Text style={t(14, 1.5, 400, C.strong2, { flex: 1 })}>
              ~/projects/{p.name} isn’t there any more. Creating it again brings back the starter files; your finished milestones stay finished.
            </Text>
          </Row>
        ) : null}

        <View style={{ borderRadius: 20, backgroundColor: C.s1, paddingVertical: 8 }}>
          <Text style={[sectionLabel, { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 6 }]}>MILESTONES</Text>
          {p.milestones.map((ms, i) => {
            const isDone = !!prog?.done[ms.id];
            const isNext = st.next?.id === ms.id && st.started;
            const isOpen = selected === ms.id;
            return (
              <View key={ms.id} style={{ marginHorizontal: 6, borderRadius: 14, backgroundColor: isOpen ? C.s3 : 'transparent' }}>
                <Press onPress={() => setSelected(isOpen ? null : ms.id)} radius={14} overlay="rgba(255,255,255,0.03)" accessibilityState={{ expanded: isOpen }}
                  style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingLeft: 10, paddingRight: 8 }}>
                  <View style={{
                    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isDone ? C.done : 'transparent', borderWidth: isDone ? 0 : 1.5, borderColor: isNext ? C.rust : C.outline,
                  }}>
                    {isDone ? <Icon name="check" size={16} color={C.onDone} /> : <Text style={m(12, undefined, 600, isNext ? C.rustLight : C.secondary)}>{i + 1}</Text>}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text style={t(15, 1.35, 500, isDone || isNext ? C.text : C.strong2)}>{ms.title}</Text>
                    <Text style={m(12, undefined, 400, C.tertiary)} numberOfLines={1}>§{ms.section} · {ms.tests.length} test{ms.tests.length === 1 ? '' : 's'}</Text>
                  </View>
                  <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={22} color={C.tertiary} />
                </Press>
                {isOpen ? (
                  <MilestoneBody
                    ms={ms} ready={ready} done={isDone} run={run?.milestone === ms.id ? run : null} disabled={running}
                    onCheck={() => onCheck(ms)}
                    onFile={(f) => nav('editor', { arg: p.name, params: { file: f } })}
                    onSection={() => nav('reader', { arg: ms.section })}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        {made ? (
          <View style={{ borderRadius: 20, backgroundColor: C.s1, paddingVertical: 8 }}>
            <Text style={[sectionLabel, { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 6 }]}>FILES</Text>
            {files.map((f) => (
              <Press key={f} onPress={() => nav('editor', { arg: p.name, params: { file: f } })} overlay="rgba(255,255,255,0.03)"
                style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6, paddingHorizontal: 16 }}>
                <Icon name={fileIcon(f)} size={22} color={C.secondary} />
                <Text style={m(14.5, undefined, 500, C.text, { flex: 1 })} numberOfLines={1}>{f}</Text>
                <Text style={t(13.5, undefined, 600, C.rustLight)}>{f === p.testFile ? 'View' : 'Edit'}</Text>
              </Press>
            ))}
          </View>
        ) : null}

        <Text style={t(12.5, 1.55, 400, C.tertiary, { marginHorizontal: 8 })}>
          “Check milestone” runs that milestone’s tests with cargo in ~/projects/{p.name}. Before each check, Oxide puts {p.testFile} back as it came, so write your own tests in another file.
        </Text>
      </ScrollView>
      <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 14 }}>
        <TopLine color={C.divider} />
        <Button height={56} fontSize={16.5} icon={action.icon} label={action.label} onPress={action.onPress} disabled={action.disabled}
          variant={running ? 'outlined' : 'primary'} />
      </View>
    </View>
  );
}

function MilestoneBody({
  ms, ready, done, run, disabled, onCheck, onFile, onSection,
}: {
  ms: BuildAlongMilestone; ready: boolean; done: boolean; run: Run | null; disabled: boolean;
  onCheck: () => void; onFile: (f: string) => void; onSection: () => void;
}) {
  const out = run?.outcome;
  const total = out ? out.passed + out.failed : 0;
  const verdict = !out
    ? null
    : out.ok
      ? { icon: 'check_circle', color: C.done, text: `All ${out.passed} test${out.passed === 1 ? '' : 's'} pass.` }
      : total > 0
        ? { icon: 'error', color: C.errorText, text: `${out.passed} of ${total} tests pass. The failures are below.` }
        : out.code === 127
          ? { icon: 'info', color: C.secondary, text: 'The check couldn’t run here.' }
          : { icon: 'error', color: C.errorText, text: 'It doesn’t compile yet. Here’s what cargo said.' };

  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 14, gap: 12 }}>
      <Rich text={ms.build} style={t(14.5, 1.55, 400, C.reading)} />
      <Press onPress={onSection} radius={12} overlay="rgba(255,255,255,0.04)"
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 12, backgroundColor: C.s4 }}>
        <Icon name="menu_book" size={18} color={C.rustLight} />
        <Rich text={secLabel(ms.section)} style={t(13.5, 1.35, 500, C.strong2, { flex: 1 })} />
        <Icon name="chevron_right" size={20} color={C.tertiary} />
      </Press>
      {ready ? (
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          {ms.files.map((f) => (
            <Press key={f} onPress={() => onFile(f)} radius={10} overlay="rgba(255,255,255,0.05)"
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.raised }}>
              <Icon name="edit" size={16} color={C.mutedHi} />
              <Text style={m(13, undefined, 500, C.text)}>{f}</Text>
            </Press>
          ))}
        </Row>
      ) : null}
      <View style={{ gap: 4 }}>
        <Text style={m(12, 18, 400, C.tertiary)}>$ {checkCommand(ms)}</Text>
        <Text style={m(12, 18, 400, C.tertiary)} numberOfLines={3}>{ms.tests.join(' · ')}</Text>
      </View>
      {run ? (
        <View style={{ gap: 10 }}>
          {run.status === 'running' ? (
            <Row style={{ gap: 10 }}>
              <Spinner size={16} />
              <Text style={t(13.5, undefined, 500, C.running)}>Running the tests…</Text>
            </Row>
          ) : verdict ? (
            <Row style={{ gap: 8, alignItems: 'flex-start' }}>
              <Icon name={verdict.icon} size={20} fill color={verdict.color} />
              <Text style={t(14, 1.45, 600, verdict.color, { flex: 1 })}>{verdict.text}</Text>
            </Row>
          ) : null}
          {run.lines.length ? (
            <View style={{ borderRadius: 14, backgroundColor: C.well, paddingVertical: 10, paddingHorizontal: 12 }}>
              <AnsiLines lines={run.lines} fontSize={11.5} lineHeight={17} wrap />
            </View>
          ) : null}
        </View>
      ) : null}
      {ready && done && !run ? (
        <Row style={{ gap: 8 }}>
          <Icon name="check_circle" size={20} fill color={C.done} />
          <Text style={t(14, 1.45, 600, C.done, { flex: 1 })}>Passed</Text>
          <Button variant="text" height={44} label="Check again" onPress={onCheck} disabled={disabled} />
        </Row>
      ) : null}
      {ready && done && run && run.status === 'done' ? (
        <Row style={{ justifyContent: 'flex-end' }}>
          <Button variant="text" height={44} label="Check again" onPress={onCheck} disabled={disabled} />
        </Row>
      ) : null}
    </View>
  );
}
