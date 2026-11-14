// Code journal: a timeline of your code (exercise snapshots, projects, your first Hello, world!).
// Variants: (none) timeline · 'entry' (arg = entry id) read-only code · 'compare' first vs latest snapshot.
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row, SectionLabel } from '../ui/core';
import { Button } from '../ui/controls';
import { TopBar } from '../ui/bars';
import { CodeView } from '../ui/code';
import { navActions } from '../nav/store';
import { useJournal, type JournalEntry } from '../features/journal/store';
import { clock, dayLabel, shortDate } from '../features/journal/format';
import { listProjects, projectPath, read } from '../fs';
import type { ScreenProps } from './registry';

const lines = (code?: string) => (code ? code.replace(/\n$/, '').split('\n').length : 0);

function meta(e: JournalEntry) {
  switch (e.kind) {
    case 'pass': return { icon: 'check_circle', color: C.done, bg: C.doneTint, title: e.exercise, sub: e.late ? 'Passed · code saved when the journal started' : 'Passed' };
    case 'project': return { icon: 'folder_code', color: C.checkpoint, bg: C.checkpointTint, title: e.name, sub: e.before ? 'Project · already there when the journal started' : 'New project' };
    case 'hello': return { icon: 'waving_hand', color: C.rustLight, bg: C.rustTint, title: 'Hello, world!', sub: e.before ? 'Your first program · before the journal started' : 'Your first program ran' };
  }
}

function EntryRow({ e, last }: { e: JournalEntry; last: boolean }) {
  const x = meta(e);
  const n = lines(e.code);
  return (
    <Press onPress={() => navActions().nav('journal', { variant: 'entry', arg: e.id })} radius={14} overlay="rgba(255,255,255,0.04)"
      accessibilityRole="button" accessibilityLabel={`${x.title}, ${x.sub}`}
      style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14 }}>
      <View style={{ width: 32, alignItems: 'center' }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: x.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={x.icon} size={18} color={x.color} fill={e.kind === 'pass'} />
        </View>
        {!last ? <View style={{ position: 'absolute', top: 38, bottom: -16, width: 2, borderRadius: 1, backgroundColor: C.track }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3, paddingTop: 1 }}>
        <Text numberOfLines={1} style={e.kind === 'hello' ? t(14.5, 1.35, 600, C.text) : m(14, 20, 600, C.text)}>{x.title}</Text>
        <Text numberOfLines={2} style={t(12.5, 1.4, 400, C.secondary)}>
          {`${clock(e.at)} · ${x.sub}${n ? ` · ${n} ${n === 1 ? 'line' : 'lines'}` : ''}`}
        </Text>
      </View>
      <Icon name="chevron_right" size={20} color={C.disabled} style={{ alignSelf: 'center' }} />
    </Press>
  );
}

function ThenAndNow({ first, latest }: { first: Extract<JournalEntry, { kind: 'pass' }>; latest: Extract<JournalEntry, { kind: 'pass' }> }) {
  const side = (e: typeof first, label: string) => (
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Text style={m(10.5, undefined, 500, C.tertiary, { letterSpacing: 0.84 })}>{label}</Text>
      <Text numberOfLines={1} style={m(13.5, 19, 600, C.text)}>{e.exercise}</Text>
      <Text style={t(12.5, 1.35, 400, C.secondary)}>{`${shortDate(e.at)} · ${lines(e.code)} lines`}</Text>
    </View>
  );
  return (
    <View style={{ padding: 16, borderRadius: 24, backgroundColor: C.s2, gap: 14 }}>
      <SectionLabel>THEN AND NOW</SectionLabel>
      <Row style={{ gap: 12 }}>
        {side(first, 'FIRST')}
        <Icon name="arrow_forward" size={20} color={C.tertiary} />
        {side(latest, 'LATEST')}
      </Row>
      <Button variant="tonal" height={44} label="Compare side by side" icon="compare" onPress={() => navActions().nav('journal', { variant: 'compare' })} />
      <Inset radius={24} />
    </View>
  );
}

function Timeline() {
  const entries = useJournal((s) => s.entries);
  const { back } = navActions();
  const passes = entries.filter((e): e is Extract<JournalEntry, { kind: 'pass' }> => e.kind === 'pass');
  const days: { label: string; items: JournalEntry[] }[] = [];
  [...entries].reverse().forEach((e) => {
    const label = dayLabel(e.at);
    if (days[days.length - 1]?.label === label) days[days.length - 1].items.push(e);
    else days.push({ label, items: [e] });
  });
  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title="Code journal" subtitle={passes.length ? `${passes.length} ${passes.length === 1 ? 'snapshot' : 'snapshots'} of your code` : undefined} onBack={back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 20 }} showsVerticalScrollIndicator={false}>
        {passes.length >= 2 ? <ThenAndNow first={passes[0]} latest={passes[passes.length - 1]} /> : null}
        {entries.length === 0 ? (
          <View style={{ padding: 20, borderRadius: 18, backgroundColor: C.s1, gap: 10, alignItems: 'flex-start' }}>
            <Icon name="history" size={28} color={C.tertiary} />
            <Text style={t(16, 1.35, 600, C.text)}>Your code, over time</Text>
            <Text style={t(14, 1.5, 400, C.secondary)}>Each time an exercise passes, Oxide keeps a copy of your code here, along with the projects you create. Later you can look back at how you wrote Rust at the start.</Text>
          </View>
        ) : passes.length === 1 ? (
          <Text style={t(13.5, 1.5, 400, C.secondary, { paddingHorizontal: 4 })}>Pass one more exercise to compare your first and latest code side by side.</Text>
        ) : null}
        {days.map((d) => (
          <View key={d.label} style={{ gap: 2 }}>
            <SectionLabel style={{ paddingHorizontal: 8, paddingBottom: 4 }}>{d.label.toUpperCase()}</SectionLabel>
            {d.items.map((e, i) => <EntryRow key={e.id} e={e} last={i === d.items.length - 1} />)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Live files of a project (falls back to the snapshot if the project is gone). */
function useProjectFiles(name: string | null) {
  const [files, setFiles] = useState<string[] | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!name) return;
    let live = true;
    listProjects().then((l) => {
      if (!live) return;
      const p = l.find((x) => x.name === name);
      const fs = p ? p.files.filter((f) => f.endsWith('.rs') || f === 'Cargo.toml') : [];
      setFiles(fs);
      setFile(fs[0] ?? null);
    }).catch(() => { if (live) setFiles([]); });
    return () => { live = false; };
  }, [name]);
  useEffect(() => {
    if (!name || !file) return;
    let live = true;
    read(`${projectPath(name)}/${file}`).then((x) => { if (live) setText(x); }).catch(() => { if (live) setText(null); });
    return () => { live = false; };
  }, [name, file]);
  return { files, file, setFile, text };
}

function EntryView({ id }: { id?: string }) {
  const e = useJournal((s) => s.entries.find((x) => x.id === id));
  const { back } = navActions();
  const proj = useProjectFiles(e?.kind === 'project' ? e.name : null);
  if (!e) {
    return (
      <View style={{ flex: 1, backgroundColor: C.ground }}>
        <TopBar title="Code journal" onBack={back} />
        <Text style={t(14, 1.5, 400, C.secondary, { padding: 20 })}>This entry is no longer in your journal.</Text>
      </View>
    );
  }
  const x = meta(e);
  let code = e.code;
  let lang = 'rust';
  let note: string | null = null;
  if (e.kind === 'project') {
    if (proj.files && proj.files.length === 0) note = 'This project is no longer in ~/projects. This is its src/main.rs from when it was first seen.';
    else if (proj.text !== null) { code = proj.text; lang = proj.file === 'Cargo.toml' ? 'toml' : 'rust'; }
  }
  if (e.kind === 'pass' && e.late) note = 'Saved when the journal started, so it may include edits made after the exercise passed.';
  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title={x.title} subtitle={`${x.sub} · ${shortDate(e.at)}, ${clock(e.at)}`} onBack={back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 12 }} showsVerticalScrollIndicator={false}>
        {e.kind === 'project' && proj.files && proj.files.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {proj.files.map((f) => (
              <Press key={f} onPress={() => proj.setFile(f)} radius={10} accessibilityRole="button" accessibilityState={{ selected: f === proj.file }}
                style={{ height: 36, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', backgroundColor: f === proj.file ? C.rustTint : C.s1 }}>
                <Text style={m(12, undefined, 500, f === proj.file ? C.rustLight : C.secondary)}>{f}</Text>
              </Press>
            ))}
          </ScrollView>
        ) : null}
        {note ? <Text style={t(13, 1.45, 400, C.tertiary)}>{note}</Text> : null}
        {code ? (
          <View style={{ borderRadius: 16, backgroundColor: C.well, overflow: 'hidden' }}>
            <CodeView code={code.replace(/\n+$/, '')} lang={lang} gutter />
            <Inset radius={16} />
          </View>
        ) : (
          <Text style={t(14, 1.5, 400, C.secondary)}>{e.kind === 'hello' ? 'You ran Hello, world! before the journal could keep a copy of the code.' : 'No code was saved for this entry.'}</Text>
        )}
        {e.kind === 'project' ? (
          <Button variant="outlined" label="Open in Terminal" icon="terminal" onPress={() => navActions().nav('terminal', { params: { cwd: projectPath(e.name) } })} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Compare() {
  const passes = useJournal((s) => s.entries).filter((e): e is Extract<JournalEntry, { kind: 'pass' }> => e.kind === 'pass');
  const { back } = navActions();
  const first = passes[0];
  const latest = passes[passes.length - 1];
  const col = (e: typeof first, label: string) => (
    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <Text style={m(10.5, undefined, 500, C.tertiary, { letterSpacing: 0.84 })}>{label}</Text>
        <Text numberOfLines={1} style={m(13, 18, 600, C.text)}>{e.exercise}</Text>
        <Text style={t(12, 1.35, 400, C.secondary)}>{`${shortDate(e.at)} · ${lines(e.code)} lines`}</Text>
      </View>
      <View style={{ borderRadius: 14, backgroundColor: C.well, overflow: 'hidden' }}>
        <CodeView code={e.code.replace(/\n+$/, '')} fontSize={10.5} lineHeight={16} padding={10} />
        <Inset radius={14} />
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title="Then and now" subtitle="Your first and latest snapshots" onBack={back} />
      {first && latest && first !== latest ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <Row style={{ gap: 8, alignItems: 'flex-start' }}>
            {col(first, 'THEN')}
            {col(latest, 'NOW')}
          </Row>
        </ScrollView>
      ) : (
        <Text style={t(14, 1.5, 400, C.secondary, { padding: 20 })}>Pass two exercises to compare your first and latest code.</Text>
      )}
    </View>
  );
}

export default function JournalScreen({ entry }: ScreenProps) {
  if (entry.variant === 'entry') return <EntryView id={entry.arg} />;
  if (entry.variant === 'compare') return <Compare />;
  return <Timeline />;
}
