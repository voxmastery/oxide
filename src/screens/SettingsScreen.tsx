// Settings (design/project/Settings.dc.html). Every row is bound to useApp (user / plan / prefs).
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { C } from '../theme/tokens';
import { m, sectionLabel, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row, TopLine } from '../ui/core';
import { Button, Switch } from '../ui/controls';
import { TopBar } from '../ui/bars';
import { navActions } from '../nav/store';
import { useApp, type SolutionPolicy, type ThemePref } from '../state/app';
import { weeksForGoal } from '../state/selectors';
import { scheduleReminder } from '../state/reminders';
import { highlight, synColor } from '../rust/highlight';
import { getToolchain } from '../toolchain';
import type { ToolchainInfo } from '../toolchain/types';
import { loadLicenses, rustlings, toc, type ContentLicense } from '../content';
import { ago, initialOf } from './home/format';
import { useProjects } from './profile/useProjects';
import type { ScreenProps } from './registry';

export const SOLUTION_LABEL: Record<SolutionPolicy, string> = { after3: 'After 3 failed checks', afterPass: 'Only after you pass', never: 'Never' };
const THEMES: { id: ThemePref; label: string }[] = [{ id: 'dark', label: 'Dark' }, { id: 'paper', label: 'Paper' }, { id: 'system', label: 'System' }];
const PREVIEW = highlight('let len = calculate_length(&s1);')[0].toks;
const MB = (bytes: number) => `${Math.max(1, Math.round(bytes / 1e6))} MB`;

function GroupLabel({ children }: { children: string }) {
  return <Text style={[sectionLabel, { paddingTop: 16, paddingHorizontal: 8, paddingBottom: 4 }]}>{children}</Text>;
}

function Group({ children }: { children: React.ReactNode }) {
  return <View style={{ borderRadius: 20, backgroundColor: C.s1, overflow: 'hidden' }}>{children}</View>;
}

function SRow({ title, sub, line, onPress, icon, right, disabled }: { title: string; sub?: string; line?: boolean; onPress?: () => void; icon?: string; right?: React.ReactNode; disabled?: boolean }) {
  const body = (
    <>
      {line ? <TopLine /> : null}
      {icon ? <Icon name={icon} size={22} color={C.strong2} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={t(15, undefined, 500, C.text)}>{title}</Text>
        {sub ? <Text style={t(13, 1.4, 400, C.secondary)}>{sub}</Text> : null}
      </View>
      {right}
    </>
  );
  const style = { minHeight: 64, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, paddingVertical: 10, paddingHorizontal: 16 };
  if (!onPress) return <View style={style}>{body}</View>;
  return <Press onPress={onPress} disabled={disabled} overlay="rgba(255,255,255,0.03)" accessibilityRole="button" accessibilityLabel={title} style={style}>{body}</Press>;
}

const Val = ({ children, color = C.rustLight, size = 13 }: { children: string; color?: string; size?: number }) => (
  <Text style={m(size, undefined, 500, color, { flexShrink: 0 })} numberOfLines={1}>{children}</Text>
);

function useToolchainInfo() {
  const [info, setInfo] = useState<ToolchainInfo | null>(null);
  useEffect(() => {
    let live = true;
    getToolchain().info().then((i) => { if (live) setInfo(i); }).catch((e) => {
      if (live) setInfo({ installed: false, rustVersion: null, rustcVersionLine: null, cargoVersionLine: null, sizeBytes: 0, unavailableReason: String(e?.message ?? e) });
    });
    return () => { live = false; };
  }, []);
  return info;
}

function Licenses() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ContentLicense[] | null>(null);
  const toggle = () => {
    if (!list) { try { setList(loadLicenses()); } catch { setList([]); } }
    setOpen((o) => !o);
  };
  const groups: { name: string; license: string; files: ContentLicense[] }[] = [];
  (list ?? []).forEach((l) => {
    let g = groups.find((x) => x.name === l.name);
    if (!g) groups.push((g = { name: l.name, license: l.license, files: [] }));
    g.files.push(l);
  });
  return (
    <View>
      <Press onPress={toggle} overlay="rgba(255,255,255,0.03)" accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel="Content licenses"
        style={{ gap: 4, paddingVertical: 14, paddingHorizontal: 16 }}>
        <Row style={{ gap: 8 }}>
          <Text style={t(15, undefined, 500, C.text, { flex: 1 })}>Content licenses</Text>
          <Icon name={open ? 'expand_less' : 'expand_more'} size={20} color={C.disabled} />
        </Row>
        <Text style={t(13, 1.5, 400, C.secondary)}>The Rust Programming Language and Brown’s interactive edition: MIT or Apache-2.0. Rustlings: MIT. Compiler error explanations from the Rust project: MIT or Apache-2.0.</Text>
      </Press>
      {open ? (
        <View style={{ gap: 14, paddingHorizontal: 16, paddingBottom: 16 }}>
          {groups.length === 0 ? (
            ['The Rust Programming Language · MIT OR Apache-2.0', 'Rust Book, Brown University interactive edition · MIT OR Apache-2.0', 'Rustlings · MIT', 'rustc error code index · MIT OR Apache-2.0'].map((x) => (
              <Text key={x} style={t(13, 1.5, 400, C.mutedHi)}>{x}</Text>
            ))
          ) : groups.map((g) => (
            <View key={g.name} style={{ gap: 8 }}>
              <Text style={t(14, 1.4, 600, C.text)}>{g.name}</Text>
              <Text style={m(12, undefined, 500, C.secondary)}>{g.license}</Text>
              {g.files.map((f) => (
                <View key={f.file} style={{ gap: 4 }}>
                  <Text style={m(11, undefined, 500, C.tertiary)}>{f.file}</Text>
                  <View style={{ borderRadius: 12, backgroundColor: C.ground, paddingVertical: 10, paddingHorizontal: 12 }}>
                    <Text selectable style={m(11, 17, 400, C.mutedHi2)}>{f.text.trim()}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function SettingsScreen(_: ScreenProps) {
  const user = useApp((s) => s.user);
  const plan = useApp((s) => s.plan);
  const prefs = useApp((s) => s.prefs);
  const setPrefs = useApp((s) => s.setPrefs);
  const setPlan = useApp((s) => s.setPlan);
  const { nav, back, pop } = navActions();
  const info = useToolchainInfo();
  const projects = useProjects();
  const [chk, setChk] = useState<{ state: 0 | 1 | 2; text: string; ok: boolean }>({ state: 0, text: 'Check', ok: false });
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const provider = user.providers.github ? 'GitHub' : user.providers.google ? 'Google' : user.providers.email ? 'email' : null;
  const accountSub = user.signedIn && provider
    ? `Signed in with ${provider} · ${user.lastSync ? `synced ${ago(user.lastSync)}` : 'not synced yet'}`
    : 'Not signed in · progress stays on this phone';

  const toggleReminder = (on: boolean) => {
    setPlan({ reminder: on });
    void scheduleReminder(on && plan.notifAllowed !== false ? plan.reminderTime : null);
  };

  const check = () => {
    if (chk.state === 1) return;
    setChk({ state: 1, text: 'Checking…', ok: false });
    getToolchain().checkForUpdate()
      .then((r) => { if (live.current) setChk({ state: 2, text: r.upToDate ? 'Up to date' : `${r.latest} available`, ok: r.upToDate }); })
      .catch(() => { if (live.current) setChk({ state: 2, text: 'Can’t check', ok: false }); });
  };

  const rustTitle = info?.rustVersion ? `Rust ${info.rustVersion}` : 'Rust toolchain';
  const rustSub = !info ? '…' : info.installed ? `rustc, cargo, clippy, rustfmt · ${MB(info.sizeBytes)}` : info.unavailableReason ?? 'Not installed';
  const projSub = projects === null ? '…' : projects.length === 0 ? 'None yet' : `${projects.map((p) => p.name).join(', ')} · ${MB(projects.reduce((a, p) => a + p.bytes, 0))}`;
  const initial = initialOf(user.name);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title="Settings" onBack={back} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Press onPress={() => nav('account')} overlay={null} pressedStyle={{ backgroundColor: C.sheet }} accessibilityRole="button" accessibilityLabel="Account"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingVertical: 12, paddingRight: 12, paddingLeft: 16, borderRadius: 20, backgroundColor: C.s1 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' }}>
            {initial ? <Text style={t(16, undefined, 600, C.text)}>{initial}</Text> : <Icon name="person" size={22} color={C.text} />}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={1} style={t(15.5, undefined, 600, C.text)}>{user.name.trim() || 'Account'}</Text>
            <Text style={t(13, undefined, 400, C.secondary)}>{accountSub}</Text>
          </View>
          <Icon name="chevron_right" size={22} color={C.disabled} />
        </Press>

        <GroupLabel>LEARNING</GroupLabel>
        <Group>
          <SRow title="Daily goal" sub={`About ${weeksForGoal[plan.goal]} weeks to finish the Book and Rustlings`} onPress={() => pop('goal')} right={<Val>{`${plan.goal} min`}</Val>} />
          <SRow line title="Reminder" sub={plan.reminder ? `Every day at ${plan.reminderTime}, if you haven’t practised yet` : 'Off'} onPress={() => pop('reminder')}
            right={<Switch value={plan.reminder} onChange={toggleReminder} />} />
          <SRow line title="Show the official solution" sub={SOLUTION_LABEL[prefs.solution]} onPress={() => pop('solution-setting')} />
          <SRow line title="Quizzes from Brown’s edition" sub="Questions inside Book sections" onPress={() => setPrefs({ quizzes: !prefs.quizzes })}
            right={<Switch value={prefs.quizzes} onChange={(v) => setPrefs({ quizzes: v })} />} />
        </Group>

        <GroupLabel>EDITOR AND TERMINAL</GroupLabel>
        <Group>
          <Row style={{ gap: 14, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 10 }}>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text style={t(15, undefined, 500, C.text)}>Code size</Text>
              <Text style={t(13, undefined, 400, C.secondary)}>Editor, Book listings and Terminal</Text>
            </View>
            <Row style={{ gap: 2, height: 44, borderRadius: 22, backgroundColor: C.s4, paddingHorizontal: 2 }}>
              <Press onPress={() => setPrefs({ codeSize: Math.max(11, prefs.codeSize - 1) })} disabled={prefs.codeSize <= 11} radius={20} accessibilityLabel="Smaller"
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="remove" size={20} color={prefs.codeSize <= 11 ? C.disabled : C.text} />
              </Press>
              <Text style={m(14, undefined, 600, C.text, { minWidth: 28, textAlign: 'center' })}>{prefs.codeSize}</Text>
              <Press onPress={() => setPrefs({ codeSize: Math.min(20, prefs.codeSize + 1) })} disabled={prefs.codeSize >= 20} radius={20} accessibilityLabel="Larger"
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="add" size={20} color={prefs.codeSize >= 20 ? C.disabled : C.text} />
              </Press>
            </Row>
          </Row>
          <View style={{ marginHorizontal: 16, marginBottom: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.ground, overflow: 'hidden' }}>
            <Text numberOfLines={1} style={m(prefs.codeSize, Math.round(prefs.codeSize * 1.6), 400, C.text)}>
              {PREVIEW.map((tk, i) => <Text key={i} style={{ color: synColor(tk.k) }}>{tk.t}</Text>)}
            </Text>
          </View>
          <Row style={{ gap: 14, paddingVertical: 12, paddingHorizontal: 16 }}>
            <TopLine />
            <Text style={t(15, undefined, 500, C.text, { flex: 1 })}>Theme</Text>
            <Row style={{ height: 40, borderRadius: 20, overflow: 'hidden' }}>
              {THEMES.map((th) => {
                const on = prefs.theme === th.id;
                return (
                  <Press key={th.id} onPress={() => setPrefs({ theme: th.id })} overlay="rgba(255,255,255,0.04)" accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={{ height: 40, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: on ? C.rustTint : 'transparent' }}>
                    <Text style={t(13, undefined, 600, on ? C.rustLight : C.strong2)}>{th.label}</Text>
                  </Press>
                );
              })}
              <Inset color={C.outline} radius={20} />
            </Row>
          </Row>
          <SRow line title="Symbol row above the keyboard" sub="{ } ( ) ; : & < > ! one tap away" onPress={() => setPrefs({ symbolRow: !prefs.symbolRow })}
            right={<Switch value={prefs.symbolRow} onChange={(v) => setPrefs({ symbolRow: v })} />} />
          <SRow line title="Close brackets and quotes" sub="Typing ( adds the matching )" onPress={() => setPrefs({ autoClose: !prefs.autoClose })}
            right={<Switch value={prefs.autoClose} onChange={(v) => setPrefs({ autoClose: v })} />} />
        </Group>

        <GroupLabel>OFFLINE</GroupLabel>
        <Group>
          <SRow icon="terminal" title={rustTitle} sub={rustSub} onPress={check}
            right={<Val size={12.5} color={chk.state === 2 && chk.ok ? C.done : chk.state === 2 ? C.secondary : C.rustLight}>{chk.text}</Val>} />
          <SRow line icon="menu_book" title="The Book" sub={`${toc.edition} edition`} right={<Val size={12.5} color={C.tertiary}>Saved</Val>} />
          <SRow line icon="data_object" title="Rustlings" sub={`${rustlings.total} exercises`} right={<Val size={12.5} color={C.tertiary}>Saved</Val>} />
          <SRow line icon="folder" title="Projects" sub={projSub} />
        </Group>

        <GroupLabel>ABOUT</GroupLabel>
        <Group>
          <Licenses />
          <Row style={{ minHeight: 56, paddingHorizontal: 16 }}>
            <TopLine />
            <Text style={t(15, undefined, 500, C.text, { flex: 1 })}>Version</Text>
            <Val size={12.5} color={C.secondary}>{version}</Val>
          </Row>
        </Group>

        <Button variant="danger-outlined" label="Sign out" height={52} fontSize={15} onPress={() => pop('signout')} style={{ marginTop: 12 }} />
      </ScrollView>
    </View>
  );
}
