// Bottom sheets from design/project/Overlays.dc.html ("Popups → Bottom sheets" in design/SPEC.md).
import React, { useState } from 'react';
import { Linking, Share, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { C } from '../theme/tokens';
import { m, sectionLabel, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row } from '../ui/core';
import { Bar, Switch } from '../ui/controls';
import { plain } from '../rust/ansi';
import { rustlings } from '../content';
import { navActions } from '../nav/store';
import { today, useApp, XP } from '../state/app';
import { buildMission, levelOf, streak, todayLog } from '../state/selectors';
import { BottomSheet } from './primitives';
import type { OverlayProps } from './registry';
import { MenuHeader, MenuRow, OR, RadioDot, SheetEnd, num, sectionTitle, sectionsForExercise } from './parts';

const copy = (text: string, msg: string) => {
  const { closePop, showToast } = navActions();
  closePop();
  Clipboard.setStringAsync(text).then(() => showToast(msg), () => showToast('Couldn’t copy to the clipboard'));
};

// ---------- Exercise menu ----------

/** The Book section to read for an exercise: the first one it drills that isn't read yet. */
function sectionFor(ex: string, read: Record<string, number>) {
  const secs = sectionsForExercise(ex);
  return secs.find((s) => !read[s]) ?? secs[secs.length - 1] ?? null;
}

/** opts: { exercise, onReset, code? } (code: the editor's current text, for Copy code and reports) */
export function ExerciseMenuSheet({ opts }: OverlayProps) {
  const ex: string = opts.exercise ?? '';
  const read = useApp((s) => s.book.read);
  const { closePop, nav, pop, showToast } = navActions();
  const info = rustlings.exercises[ex];
  const sec = sectionFor(ex, read);
  return (
    <BottomSheet maxHeight={0.9}>
      <MenuHeader title={ex} sub={info?.path} />
      <View style={{ paddingVertical: 8 }}>
        <MenuRow icon="restart_alt" label="Reset to the original file" onPress={() => { closePop(); showToast(`${ex} reset`); opts.onReset?.(); }} />
        <MenuRow icon="content_copy" label="Copy code" onPress={() => copy(opts.code ?? useApp.getState().ex[ex]?.code ?? info?.code ?? '', 'Code copied')} />
        <MenuRow icon="terminal" label="Run in the Terminal" onPress={() => nav('terminal', { params: { cwd: '~/rustlings', run: `rustlings run ${ex}` } })} />
        {sec ? <MenuRow icon="menu_book" label={`Read ${sec} ${sectionTitle(sec)}`} onPress={() => nav('reader', { arg: sec })} /> : null}
        <MenuRow icon="flag" label="Report a problem" onPress={() => pop('report', { exercise: ex, code: opts.code })} />
      </View>
      <SheetEnd />
    </BottomSheet>
  );
}

// ---------- Command actions ----------

/** opts: { command, meta, output: string[] } */
export function CommandSheet({ opts }: OverlayProps) {
  const { pop } = navActions();
  const cmd: string = opts.command ?? '';
  const out: string[] = Array.isArray(opts.output) ? opts.output : typeof opts.output === 'string' ? String(opts.output).split('\n') : [];
  const text = out.map(plain).join('\n');
  return (
    <BottomSheet maxHeight={0.9}>
      <MenuHeader title={`$ ${cmd}`} sub={opts.meta} />
      <View style={{ paddingVertical: 8 }}>
        <MenuRow icon="content_copy" label="Copy command" onPress={() => copy(cmd, 'Command copied')} />
        <MenuRow icon="notes" label="Copy output" onPress={() => copy(text, 'Output copied')} />
        <MenuRow icon="flag" label="Report a problem" onPress={() => pop('report', { command: cmd, meta: opts.meta, output: text })} />
      </View>
      <SheetEnd />
    </BottomSheet>
  );
}

// ---------- Text settings (Reader) ----------

const LINES: [string, number][] = [['Compact', 1.55], ['Normal', 1.7], ['Relaxed', 1.9]];
const fmtSize = (n: number) => String(Math.round(n * 10) / 10);

export function DisplaySheet(_: OverlayProps) {
  const size = useApp((s) => s.prefs.readerSize);
  const lh = useApp((s) => s.prefs.readerLine);
  const setPrefs = useApp((s) => s.setPrefs);
  const step = (d: number) => setPrefs({ readerSize: Math.max(14, Math.min(22.5, Math.round((size + d) * 10) / 10)) });
  return (
    <BottomSheet maxHeight={0.9}>
      <Text accessibilityRole="header" style={t(20, undefined, 650, C.text, { paddingHorizontal: 24, paddingBottom: 8 })}>Text</Text>
      <Row style={{ gap: 14, paddingVertical: 10, paddingHorizontal: 24 }}>
        <Text style={t(15, undefined, 500, C.text, { flex: 1 })}>Size</Text>
        <Row style={{ gap: 2, height: 44, borderRadius: 22, backgroundColor: C.raised, paddingHorizontal: 2 }}>
          <Press onPress={() => step(-1.5)} disabled={size <= 14} accessibilityRole="button" accessibilityLabel="Smaller" radius={20} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={t(13, undefined, 600, size <= 14 ? C.disabled : C.text)}>A−</Text>
          </Press>
          <Text style={m(14, undefined, 600, C.text, { minWidth: 44, textAlign: 'center' })}>{fmtSize(size)}</Text>
          <Press onPress={() => step(1.5)} disabled={size >= 22.5} accessibilityRole="button" accessibilityLabel="Larger" radius={20} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={t(17, undefined, 600, size >= 22.5 ? C.disabled : C.text)}>A+</Text>
          </Press>
        </Row>
      </Row>
      <Row style={{ gap: 14, paddingVertical: 10, paddingHorizontal: 24 }}>
        <Text style={t(15, undefined, 500, C.text, { flex: 1 })}>Line spacing</Text>
        <Row accessibilityRole="radiogroup" style={{ height: 40, borderRadius: 20, overflow: 'hidden' }}>
          {LINES.map(([label, v]) => {
            const on = Math.abs(lh - v) < 0.001;
            return (
              <Press key={label} onPress={() => setPrefs({ readerLine: v })} overlay="rgba(255,255,255,0.04)" accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={{ height: 40, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: on ? C.rustTint : 'transparent' }}>
                <Text style={t(13, undefined, 600, on ? OR : C.strong2)}>{label}</Text>
              </Press>
            );
          })}
          <Inset color={C.outline} radius={20} />
        </Row>
      </Row>
      <View style={{ marginTop: 10, marginHorizontal: 24, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.ground }}>
        <Text style={t(size, lh, 400, C.reading)}>We call the action of creating a reference borrowing.</Text>
      </View>
      <SheetEnd />
    </BottomSheet>
  );
}

// ---------- Streak ----------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function StreakSheet(_: OverlayProps) {
  const s = useApp();
  const st = streak(s);
  const log = todayLog(s);
  const goal = s.plan.goal;
  const none = st.current === 0;
  const fresh = none && Object.values(s.days).every((d) => !d.goalMet);

  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth(), td = now.getDate();
  const lead = (new Date(y, mo, 1).getDay() + 6) % 7; // Monday first
  const count = new Date(y, mo + 1, 0).getDate();
  const start = s.startDate ?? today();
  const cells: ({ d: number; key: string } | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => ({ d: i + 1, key: today(new Date(y, mo, i + 1)) }))];

  const mission = buildMission(s);
  const note = fresh
    ? `A day counts when you reach your daily goal. Today’s mission takes about ${mission.mins} minutes.`
    : `A day counts when you reach your ${goal}-minute goal. Today: ${Math.min(log.minutes, 999)} of ${goal} minutes.`;

  return (
    <BottomSheet maxHeight={0.9}>
      <Row style={{ gap: 14, paddingTop: 4, paddingHorizontal: 24, paddingBottom: 18 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: none ? C.s3 : 'rgba(255,122,61,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="local_fire_department" size={32} fill color={none ? C.disabled : C.flame} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={t(22, 1.2, 650, C.text, { letterSpacing: -0.22 })}>{none ? 'No streak yet' : `${st.current}-day streak`}</Text>
          <Text style={t(13.5, undefined, 400, C.secondary)}>{st.best > 0 ? `Best: ${st.best} ${st.best === 1 ? 'day' : 'days'}` : 'Reach today’s goal to start one'}</Text>
        </View>
      </Row>
      <View style={{ marginHorizontal: 16, padding: 16, borderRadius: 20, backgroundColor: C.inputBar, gap: 12 }}>
        <Text style={t(15, undefined, 600, C.text)}>{MONTHS[mo]} {y}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 }}>
          {WD.map((w, i) => (
            <View key={`w${i}`} style={{ width: `${100 / 7}%`, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={m(11.5, undefined, 500, C.tertiary)}>{w}</Text>
            </View>
          ))}
          {cells.map((c, i) => {
            if (!c) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 40 }} />;
            const done = !!s.days[c.key]?.goalMet;
            const isToday = c.d === td;
            const past = c.d < td && c.key >= start;
            const color = done ? C.onDone : isToday ? C.text : past ? C.tertiary : C.iconOff;
            return (
              <View key={c.key} style={{ width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' }}
                accessible accessibilityLabel={`${MONTHS[mo]} ${c.d}${done ? ', goal reached' : ''}${isToday ? ', today' : ''}`}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: done ? C.done : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={m(13, undefined, done || isToday ? 600 : 400, color)}>{c.d}</Text>
                  {isToday ? <Inset color={C.rust} width={2} radius={17} /> : null}
                </View>
              </View>
            );
          })}
        </View>
        <Row style={{ gap: 16, paddingTop: 2 }}>
          <Row style={{ gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.done }} /><Text style={t(12, undefined, 400, C.secondary)}>Goal reached</Text></Row>
          <Row style={{ gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5 }}><Inset color={C.rust} width={2} radius={5} /></View><Text style={t(12, undefined, 400, C.secondary)}>Today</Text></Row>
        </Row>
      </View>
      <Text style={t(14, 1.55, 400, C.mutedHi, { marginTop: 16, marginHorizontal: 24 })}>{note}</Text>
      <SheetEnd />
    </BottomSheet>
  );
}

// ---------- XP and levels ----------

const EARN: { icon: string; c: string; t: string; v: string }[] = [
  { icon: 'data_object', c: C.done, t: 'Rustlings exercise', v: `+${XP.easy} or +${XP.medium}` },
  { icon: 'flag', c: C.checkpoint, t: 'Checkpoint quiz', v: `+${XP.quiz}` },
  { icon: 'quiz', c: C.checkpoint, t: 'Quick check in the Book', v: `+${XP.quickCheck}` },
  { icon: 'task_alt', c: OR, t: 'Daily mission', v: `+${XP.mission}` },
];

export function XpSheet(_: OverlayProps) {
  const xp = useApp((s) => s.xp);
  const L = levelOf(xp);
  return (
    <BottomSheet maxHeight={0.9}>
      <View style={{ gap: 12, paddingTop: 4, paddingHorizontal: 24, paddingBottom: 22 }}>
        <Row style={{ gap: 10 }}>
          <View style={{ height: 26, paddingHorizontal: 9, borderRadius: 7, backgroundColor: C.rustTint, justifyContent: 'center' }}>
            <Text style={m(13, 26, 600, OR)}>Lv {L.level}</Text>
          </View>
          <Text style={t(18, 1.3, 650, C.text, { flex: 1 })}>{L.title}</Text>
        </Row>
        {/* As in the prototype: the bar shows total XP against the next level's threshold. */}
        <Bar value={xp / L.to} height={6} radius={3} />
        <Row style={{ justifyContent: 'space-between', gap: 8 }}>
          <Text style={m(12, undefined, 500, C.secondary)}>{num(xp)} / {num(L.to)} XP</Text>
          <Text style={m(12, undefined, 500, C.secondary)}>{num(L.toNext)} XP to Lv {L.nextLv}</Text>
        </Row>
      </View>
      <Text style={[sectionLabel, { paddingHorizontal: 24, paddingBottom: 6 }]}>How you earn XP</Text>
      {EARN.map((r) => (
        <Row key={r.t} style={{ minHeight: 60, gap: 16, paddingVertical: 4, paddingHorizontal: 24 }}>
          <Icon name={r.icon} size={22} color={r.c} />
          <Text style={t(15, undefined, 400, C.text, { flex: 1 })}>{r.t}</Text>
          <Text style={m(13, undefined, 600, C.text)}>{r.v}</Text>
        </Row>
      ))}
      <Text style={t(13.5, 1.55, 400, C.secondary, { marginTop: 10, marginHorizontal: 24 })}>Hints are free. If you open a solution before you pass, that exercise gives no XP.</Text>
      <SheetEnd />
    </BottomSheet>
  );
}

// ---------- Report a problem ----------

const REASONS = ['The instructions are unclear', 'My fix should pass', 'A hint is wrong or unhelpful', 'Something else'];
const ISSUES = 'https://github.com/rust-lang/rustlings/issues/new';
const fence = (s: string, lang = '') => '```' + lang + '\n' + s.replace(/```/g, '`​``') + '\n```';

/**
 * opts: { exercise?, code? } for exercises, or { command, meta?, output? } from the Terminal.
 * Oxide has no report backend. Exercise reports open a prefilled issue on rust-lang/rustlings,
 * where problems with the exercises are tracked; Terminal reports go to the system share sheet.
 */
export function ReportSheet({ opts }: OverlayProps) {
  const [reason, setReason] = useState(-1);
  const [text, setText] = useState('');
  const [attach, setAttach] = useState(true);
  const ex: string | undefined = opts.exercise;
  const cmd: string | undefined = opts.command;
  const sub = ex ? `${ex} · Rustlings` : cmd ? `$ ${cmd} · Terminal` : 'Oxide';
  const ok = reason >= 0;

  const send = () => {
    if (!ok) return;
    const { closePop, showToast } = navActions();
    const s = useApp.getState();
    const parts = [`**${REASONS[reason]}**`];
    if (text.trim()) parts.push(text.trim());
    let url: string | null = null;
    if (ex) {
      const info = rustlings.exercises[ex];
      parts.push(`Exercise: \`${info?.path ?? ex}\` (Rustlings ${rustlings.version})`);
      const code: string | undefined = opts.code ?? s.ex[ex]?.code ?? info?.code;
      if (attach && code) parts.push(fence(code.length > 5000 ? code.slice(0, 5000) + '\n// …' : code, 'rust'));
      parts.push('_Reported from the Oxide app._');
      url = `${ISSUES}?title=${encodeURIComponent(`${ex}: ${REASONS[reason]}`)}&body=${encodeURIComponent(parts.join('\n\n'))}`;
    } else {
      if (cmd) parts.push(`Command: \`${cmd}\`${opts.meta ? ` (${opts.meta})` : ''}`);
      if (attach && opts.output) parts.push(fence(String(opts.output).slice(0, 5000)));
    }
    closePop();
    const done = () => showToast('Report sent. Thank you.');
    const fail = () => showToast('Couldn’t open the report. Check your connection.');
    if (url) Linking.openURL(url).then(done, fail);
    else Share.share({ title: 'Oxide problem report', message: parts.join('\n\n') }).then((r) => { if (r.action !== Share.dismissedAction) done(); }, fail);
  };

  return (
    <BottomSheet maxHeight={0.92}>
      <View style={{ gap: 4, paddingHorizontal: 24, paddingBottom: 10 }}>
        <Text accessibilityRole="header" style={t(20, undefined, 650, C.text)}>Report a problem</Text>
        <Text numberOfLines={1} style={m(12.5, undefined, 400, C.tertiary)}>{sub}</Text>
      </View>
      <View accessibilityRole="radiogroup">
        {REASONS.map((r, i) => (
          <Press key={r} onPress={() => setReason(i)} overlay="rgba(255,255,255,0.04)" accessibilityRole="radio" accessibilityState={{ checked: reason === i }}
            style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4, paddingHorizontal: 24 }}>
            <RadioDot on={reason === i} />
            <Text style={t(15, 1.35, 400, C.text, { flex: 1 })}>{r}</Text>
          </Press>
        ))}
      </View>
      <View style={{ marginTop: 10, marginHorizontal: 24, borderRadius: 12, backgroundColor: C.raised }}>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="What happened? (optional)"
          placeholderTextColor={C.tertiary}
          selectionColor={C.rust}
          textAlignVertical="top"
          style={[t(15, 1.5, 400, C.text), { minHeight: 112, paddingVertical: 12, paddingHorizontal: 14, outlineStyle: 'none' } as object]}
        />
        <Inset color={C.outline} radius={12} />
      </View>
      <Press onPress={() => setAttach(!attach)} overlay={null} accessibilityRole="switch" accessibilityState={{ checked: attach }}
        style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6, paddingVertical: 6, paddingHorizontal: 24 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={t(15, undefined, 400, C.text)}>{ex || !cmd ? 'Include my code' : 'Include the output'}</Text>
          <Text style={t(12.5, undefined, 400, C.secondary)}>{ex || !cmd ? 'Attach the file as it is now' : 'Attach the command’s output'}</Text>
        </View>
        <Switch value={attach} onChange={setAttach} />
      </Press>
      <Press onPress={send} disabled={!ok} overlay={null} pressedStyle={{ backgroundColor: C.rustPressed }} accessibilityRole="button" accessibilityState={{ disabled: !ok }}
        style={{ marginTop: 10, marginHorizontal: 24, height: 52, borderRadius: 26, backgroundColor: ok ? C.rust : C.track, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={t(15.5, undefined, 650, ok ? C.onRust : C.disabled)}>Send report</Text>
      </Press>
      <SheetEnd />
    </BottomSheet>
  );
}
