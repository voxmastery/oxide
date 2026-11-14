// First run (design/project/Onboarding.dc.html, design/SPEC.md "First run").
// Welcome → Starting level → Daily goal (→ notification permission) → Setting up Rust →
// Save your progress (→ Email sign-in → Check your email) → Home on day 1.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { C } from '../theme/tokens';
import { ls, m, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, Row, TopLine } from '../ui/core';
import { Bar, IconButton, Switch } from '../ui/controls';
import { highlight } from '../rust/highlight';
import { ansi } from '../rust/ansi';
import { SYN, TC } from '../theme/tokens';
import { navActions } from '../nav/store';
import { useApp, type GoalMin } from '../state/app';
import { weeksForGoal } from '../state/selectors';
import { requestNotificationPermission, scheduleReminder } from '../state/reminders';
import { isValidEmail, sendMagicLink, signInWithGitHub, signInWithGoogle, type AuthResult } from '../state/auth';
import { useNet } from '../shell/net';
import { rustlings } from '../content';
import { bookEdition, FALLBACK, mb, pauseSetup, resumeOnWifi, startSetup, useSetup, type PkgView } from './onboarding/setup';
import { FootNote, OutlinePill, Primary, selStyle, StepHead, TextBtn } from './onboarding/parts';
import type { ScreenProps } from './registry';

// ---------- Steps ----------

const STEPS: Record<string, number> = { welcome: 0, level: 1, goal: 2, notify: 2, setup: 3, setupPaused: 3, account: 4, signin: 4, email: 5, sent: 5 };
const LEVELS: [string, string][] = [
  ['I’m new to programming', 'We’ll go slower and open hints sooner.'],
  ['I know another language', 'Start at chapter 1 at a steady pace.'],
  ['I’ve written some Rust', 'Pick the chapter you want to start from.'],
];
const GOALS: GoalMin[] = [10, 20, 30, 45];
const TIMES = ['08:00', '12:30', '20:30'];
const HELLO = 'fn main() {\n    println!("Hello, world!");\n}';

export default function OnboardingScreen({ entry }: ScreenProps) {
  const v = entry.variant ?? 'welcome';
  const email0 = useApp.getState().user.email ?? '';
  const [step, setStep] = useState(STEPS[v] ?? 0);
  const [signin, setSignin] = useState(v === 'signin');
  const [dlg, setDlg] = useState(v === 'notify' && Platform.OS === 'web');
  const [email, setEmail] = useState(v === 'sent' ? email0 : '');
  const [sent, setSent] = useState(v === 'sent' && isValidEmail(email0));
  const asking = useRef(false);

  const plan = useApp((s) => s.plan);
  const setPlan = useApp((s) => s.setPlan);

  const go = useCallback((n: number) => { setDlg(false); setStep(n); }, []);

  const back = useCallback(() => {
    setDlg(false);
    if (step === 4 && signin) { setSignin(false); setStep(0); return; }
    if (step !== 5) setSignin(false);
    setSent(false);
    setStep(Math.max(0, step - 1));
  }, [step, signin]);

  const finish = useCallback(() => {
    useApp.getState().finishOnboarding();
    navActions().reset('home');
  }, []);

  // Android back follows the in-flow back button. Registered after the Shell's handler so it runs first.
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    const id = setTimeout(() => {
      sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (dlg) { deny(); return true; }
        if (step === 0) { BackHandler.exitApp(); return true; }
        back();
        return true;
      });
    }, 0);
    return () => { clearTimeout(id); sub?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, dlg, back]);

  // ---- Notification permission ----
  const allow = useCallback(() => {
    setPlan({ notifAllowed: true, reminder: true });
    void scheduleReminder(useApp.getState().plan.reminderTime);
    go(3);
  }, [go, setPlan]);
  const deny = useCallback(() => {
    setPlan({ notifAllowed: false, reminder: false });
    void scheduleReminder(null);
    go(3);
  }, [go, setPlan]);

  // The `notify` variant on a device asks the system right away.
  useEffect(() => {
    if (v === 'notify' && Platform.OS !== 'web') void askPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function askPermission() {
    if (Platform.OS === 'web') { setDlg(true); return; }
    if (asking.current) return;
    asking.current = true;
    const ok = await requestNotificationPermission();
    asking.current = false;
    if (ok) allow(); else deny();
  }

  const goalContinue = () => {
    if (!plan.reminder) { void scheduleReminder(null); go(3); return; }
    void askPermission();
  };

  // ---- Setup: start the real download on entering the step; it keeps going after we leave. ----
  useEffect(() => {
    if (step !== 3) return;
    const s = useSetup.getState();
    if (!s.started) void startSetup({ allowMetered: false });
    if (v !== 'setupPaused') return;
    // `setupPaused` variant: pause the real download as soon as it is under way.
    const unsub = useSetup.subscribe((x) => {
      if (x.pkgs.rust.progress > 0 && x.running) { unsub(); pauseSetup(); }
    });
    return unsub;
  }, [step, v]);

  // Paused (metered network with Wi-Fi off, or an error) → "Download paused" dialog.
  const paused = useSetup((s) => s.paused);
  useEffect(() => {
    if (step !== 3 || !paused) return;
    const r = useSetup.getState().pkgs.rust;
    const remaining = r.bytesTotal ? Math.max(0, r.bytesTotal - r.bytesDone) / 1e6 : FALLBACK.rustMB * (1 - r.progress);
    navActions().pop('dlfail', {
      remainingMB: Math.max(1, Math.round(remaining)),
      onWait: () => { navActions().closePop(); resumeOnWifi(); },
      onMobile: () => { navActions().closePop(); void startSetup({ allowMetered: true }); },
    });
  }, [paused, step]);

  // ---- Account ----
  const provider = async (fn: () => Promise<AuthResult>) => {
    const r = await fn();
    if (r.ok) {
      useApp.getState().setUser({ email: r.user.email, signedIn: true, providers: { ...useApp.getState().user.providers, github: r.user.github, google: r.user.provider === 'google' } });
      finish();
    } else if (r.reason !== 'cancelled') navActions().showToast(r.message);
  };
  const sendLink = async () => {
    if (!isValidEmail(email)) return;
    const addr = email.trim();
    const r = await sendMagicLink(addr);
    if (!r.ok && r.reason === 'invalid-email') { navActions().showToast(r.message); return; }
    // No auth backend yet (state/auth.ts): keep the address on this phone and show the confirmation.
    useApp.getState().setUser({ email: addr });
    setSent(true);
  };

  const segsOn = step >= 1 && !signin;

  return (
    <View style={{ flex: 1, backgroundColor: C.ground, overflow: 'hidden' }}>
      {step === 0 ? <Welcome onStart={() => go(1)} onSignin={() => { setSignin(true); go(4); }} /> : null}

      {step > 0 ? (
        <Row style={{ height: 56, gap: 8, paddingLeft: 4, paddingRight: 20 }}>
          <IconButton name="arrow_back" onPress={back} label="Back" />
          {segsOn ? (
            <Row style={{ flex: 1, gap: 6 }}>
              {[1, 2, 3, 4].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? C.rust : C.track }} />)}
            </Row>
          ) : null}
        </Row>
      ) : null}

      {step === 1 ? <LevelStep level={plan.level} onPick={(level) => setPlan({ level })} /> : null}
      {step === 2 ? (
        <GoalStep
          goal={plan.goal}
          reminder={plan.reminder}
          time={plan.reminderTime}
          onGoal={(goal) => setPlan({ goal })}
          onReminder={(reminder) => setPlan({ reminder })}
          onTime={(reminderTime) => setPlan({ reminderTime })}
        />
      ) : null}
      {step === 3 ? <SetupStep /> : null}
      {step === 4 ? (
        <AccountStep
          signin={signin}
          onGitHub={() => void provider(signInWithGitHub)}
          onGoogle={() => void provider(signInWithGoogle)}
          onEmail={() => { setSent(false); go(5); }}
          onSkip={finish}
        />
      ) : null}
      {step === 5 ? (
        <EmailStep
          email={email}
          sent={sent}
          onEmail={setEmail}
          onSend={() => void sendLink()}
          onOpenMail={finish}
          onOther={() => setSent(false)}
        />
      ) : null}

      {step >= 1 && step <= 3 ? (
        <View style={{ paddingVertical: 16, paddingHorizontal: 20 }}>
          {step === 3 ? <SetupCta onPress={() => go(4)} /> : <Primary label="Continue" onPress={step === 1 ? () => go(2) : goalContinue} />}
        </View>
      ) : null}

      {dlg ? <PermissionDialog onAllow={allow} onDeny={deny} /> : null}
    </View>
  );
}

// ---------- 1. Welcome ----------

function Welcome({ onStart, onSignin }: { onStart: () => void; onSignin: () => void }) {
  const lines = highlight(HELLO);
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
        <Row style={{ height: 32, gap: 10 }}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: C.rust }} />
          <Text style={m(17, undefined, 600, C.text, { letterSpacing: ls(-0.01, 17) })}>oxide</Text>
        </Row>
        <View style={{ marginVertical: 36, borderRadius: 24, backgroundColor: C.s1, overflow: 'hidden' }}>
          <View style={{ paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16 }}>
            {lines.map((ln) => (
              <Text key={ln.n} style={m(14, 23, 400, SYN.dark.id, { minHeight: 23 })}>
                {ln.toks.map((tk, i) => <Text key={i} style={{ color: SYN.dark[tk.k] }}>{tk.t}</Text>)}
              </Text>
            ))}
          </View>
          <View style={{ paddingTop: 14, paddingHorizontal: 18, paddingBottom: 18, backgroundColor: C.well, gap: 6 }}>
            <Text style={m(13, 20, 400, C.text)}><Text style={{ color: C.rustLight }}>$</Text> cargo run</Text>
            <Text style={m(13, 20, 600, C.done)}>Hello, world!</Text>
          </View>
          <Inset radius={24} />
        </View>
        <Text accessibilityRole="header" style={t(34, 1.1, 650, C.text, { letterSpacing: ls(-0.03, 34) })}>{"Learn Rust, one\nday at a time."}</Text>
        <Text style={t(16, 1.55, 400, C.secondary, { marginTop: 14 })}>Read the Rust Book, fix Rustlings exercises and run real code in a terminal on your phone. All of it works offline.</Text>
      </ScrollView>
      <View style={{ gap: 6, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Primary label="Get started" size={17} onPress={onStart} />
        <TextBtn label="I already have an account" onPress={onSignin} />
        <FootNote style={{ paddingTop: 8, paddingHorizontal: 8 }}>Built on The Rust Programming Language and Rustlings. Both are open source.</FootNote>
      </View>
    </>
  );
}

// ---------- 2. Starting level ----------

function LevelStep({ level, onPick }: { level: 0 | 1 | 2; onPick: (l: 0 | 1 | 2) => void }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 24, paddingTop: 20, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
      <StepHead title="How much have you programmed before?" sub="This sets where you start and how fast the plan moves. You can change it later." />
      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        {LEVELS.map(([title, sub], i) => {
          const on = i === level;
          const s = selStyle(on);
          return (
            <Press
              key={i}
              onPress={() => onPick(i as 0 | 1 | 2)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              radius={18}
              style={{ minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 18, paddingRight: 16, borderRadius: 18, backgroundColor: s.bg }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={t(16, undefined, 600, C.text)}>{title}</Text>
                <Text style={t(13.5, 1.4, 400, C.secondary)}>{sub}</Text>
              </View>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? C.rust : C.iconOff, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.rust }} /> : null}
              </View>
              <Inset color={s.bd} width={s.bw} radius={18} />
            </Press>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ---------- 3. Daily goal ----------

function GoalStep({ goal, reminder, time, onGoal, onReminder, onTime }: {
  goal: GoalMin; reminder: boolean; time: string;
  onGoal: (g: GoalMin) => void; onReminder: (on: boolean) => void; onTime: (t: string) => void;
}) {
  const card = (g: GoalMin) => {
    const on = g === goal;
    const s = selStyle(on);
    return (
      <Press
        key={g}
        onPress={() => onGoal(g)}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        radius={18}
        style={{ flex: 1, minHeight: 96, alignItems: 'flex-start', justifyContent: 'center', gap: 6, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 18, backgroundColor: s.bg }}
      >
        <Row style={{ alignItems: 'baseline', gap: 6 }}>
          <Text style={m(28, 28, 600, C.text, { letterSpacing: ls(-0.02, 28) })}>{g}</Text>
          <Text style={t(14, undefined, 400, C.secondary)}>min a day</Text>
        </Row>
        <Text style={t(13, undefined, 400, on ? C.rustLight : C.tertiary)}>≈ {weeksForGoal[g]} weeks</Text>
        <Inset color={s.bd} width={s.bw} radius={18} />
      </Press>
    );
  };
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 20, paddingTop: 20, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
      <StepHead title="How much time a day?" sub="Pick what you can keep up on a busy day. You can change it in Settings." />
      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        <Row style={{ gap: 10, alignItems: 'stretch' }}>{GOALS.slice(0, 2).map(card)}</Row>
        <Row style={{ gap: 10, alignItems: 'stretch' }}>{GOALS.slice(2).map(card)}</Row>
      </View>
      <Text style={t(14.5, 1.5, 400, C.strong2, { paddingHorizontal: 4 })}>
        At {goal} minutes a day, you’ll finish the Book and all {rustlings.total} Rustlings exercises in about {weeksForGoal[goal]} weeks.
      </Text>
      <View style={{ borderRadius: 18, backgroundColor: C.s1 }}>
        <Press
          onPress={() => onReminder(!reminder)}
          overlay={null}
          accessibilityRole="switch"
          accessibilityState={{ checked: reminder }}
          style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingLeft: 18, paddingRight: 16 }}
        >
          <Icon name="notifications" size={22} color={C.strong2} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={t(15.5, undefined, 600, C.text)}>Daily reminder</Text>
            <Text style={t(13, 1.4, 400, C.secondary)}>{reminder ? `Every day at ${time}, if you haven’t practised yet` : 'Off'}</Text>
          </View>
          <Switch value={reminder} onChange={onReminder} />
        </Press>
        {reminder ? (
          <Row style={{ gap: 8, paddingLeft: 54, paddingRight: 16, paddingBottom: 16 }}>
            {TIMES.map((x) => {
              const on = x === time;
              return (
                <Press
                  key={x}
                  onPress={() => onTime(x)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  radius={12}
                  style={{ height: 44, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: on ? C.rustTint : C.s4 }}
                >
                  <Text style={m(14, undefined, 500, on ? C.rustLight : C.strong2)}>{x}</Text>
                  <Inset color={on ? C.rustTint50 : C.border} radius={12} />
                </Press>
              );
            })}
          </Row>
        ) : null}
      </View>
    </ScrollView>
  );
}

// ---------- 4. Setting up Rust ----------

type RowView = { key: string; icon: string; title: string; sub: string; size: string; stat: string; sc: string; bar: string; ic: string; pct: number };

function pkgRow(key: string, icon: string, title: string, sub: string, size: string, p: PkgView, paused: boolean, unavailable?: string): RowView {
  const done = p.state === 'done';
  const pct = done ? 1 : p.progress;
  if (unavailable) return { key, icon, title, sub, size, stat: unavailable, sc: C.tertiary, bar: C.rust, ic: C.strong2, pct: 0 };
  const started = pct > 0 || p.state === 'downloading' || p.state === 'installing';
  const isPaused = paused && !done && (started || p.state === 'paused' || p.state === 'error');
  return {
    key, icon, title, sub, size, pct,
    stat: done ? 'Done' : isPaused ? 'Paused' : started ? `${Math.round(pct * 100)}%` : 'Waiting',
    sc: done ? C.done : isPaused ? C.checkpoint : started ? C.rustLight : C.tertiary,
    bar: done ? C.done : paused ? C.tertiary : C.rust,
    ic: done ? C.done : C.strong2,
  };
}

function SetupStep() {
  const s = useSetup();
  const wifi = useNet((n) => n.wifi);
  const offline = useNet((n) => n.offline);
  const { rust, book, rustlings: rl } = s.pkgs;
  const rustMB = rust.bytesTotal ?? FALLBACK.rustMB * 1e6;
  const bookMB = book.bytesTotal ?? FALLBACK.bookMB * 1e6;
  const rlMB = rl.bytesTotal ?? FALLBACK.rustlingsMB * 1e6;
  const rows = [
    pkgRow('t', 'terminal', `Rust ${s.rustVersion ?? FALLBACK.rustVersion}`, 'rustc, cargo, clippy, rustfmt', s.unavailable ? '' : mb(rustMB), rust, s.paused, s.unavailable ? 'Android only' : undefined),
    pkgRow('b', 'menu_book', 'The Book', bookEdition(), mb(bookMB), book, s.paused),
    pkgRow('r', 'data_object', 'Rustlings', `${rustlings.total} exercises`, mb(rlMB), rl, s.paused),
  ];
  const total = mb(rustMB + bookMB + rlMB);
  const net = s.unavailable
    ? { icon: 'install_mobile', note: s.unavailable }
    : s.paused
      ? s.error && !s.waitingForWifi ? { icon: 'error', note: `Paused. ${s.error}` } : { icon: 'wifi_off', note: 'Paused. Waiting for Wi-Fi.' }
      : offline ? { icon: 'wifi_off', note: `Offline · ${total} in total` }
      : wifi ? { icon: 'wifi', note: `On Wi-Fi · ${total} in total` }
      : { icon: 'signal_cellular_alt', note: `On mobile data · ${total} in total` };
  const log = s.log.slice(-8);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 18, paddingTop: 20, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
      <StepHead title="Setting up Rust" sub="Oxide downloads the Rust toolchain, the Book and Rustlings so everything works offline." />
      <View style={{ borderRadius: 18, backgroundColor: C.s1 }}>
        {rows.map((r, i) => (
          <View key={r.key} style={{ gap: 10, paddingVertical: 14, paddingHorizontal: 16 }}>
            {i ? <TopLine /> : null}
            <Row style={{ gap: 12 }}>
              <Icon name={r.icon} size={22} color={r.ic} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={t(15, undefined, 600, C.text)}>{r.title}</Text>
                <Text style={t(12.5, undefined, 400, C.tertiary)}>{r.size ? `${r.sub} · ${r.size}` : r.sub}</Text>
              </View>
              <Text style={m(12, undefined, 500, r.sc)}>{r.stat}</Text>
            </Row>
            <Bar value={r.pct} height={4} color={r.bar} track={C.track} />
          </View>
        ))}
      </View>
      <View style={{ height: 150, borderRadius: 14, backgroundColor: C.well, paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'flex-end', overflow: 'hidden' }}>
        {log.map((l, i) => (
          <Text key={s.log.length - log.length + i} numberOfLines={1} ellipsizeMode="tail" style={m(11, 17, 400, TC.n)}>
            {ansi(l).map((sg, j) => <Text key={j} style={{ color: TC[sg.c], fontFamily: sg.bold ? 'JetBrainsMono_700Bold' : 'JetBrainsMono_400Regular' }}>{sg.t}</Text>)}
          </Text>
        ))}
      </View>
      <View style={{ gap: 12, paddingHorizontal: 4, paddingBottom: 4 }}>
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <Icon name="check_circle" size={18} fill color={C.done} />
          <Text style={t(13.5, 1.45, 400, C.strong2, { flex: 1 })}>1.1 Installation is done for you. It’s checked off in the Book.</Text>
        </Row>
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <Icon name={net.icon} size={18} color={C.secondary} />
          <Text style={t(13.5, 1.45, 400, C.secondary, { flex: 1 })}>{net.note}</Text>
        </Row>
      </View>
    </ScrollView>
  );
}

function SetupCta({ onPress }: { onPress: () => void }) {
  const allDone = useSetup((s) => s.pkgs.book.state === 'done' && s.pkgs.rustlings.state === 'done' && (s.pkgs.rust.state === 'done' || !!s.unavailable));
  return <Primary label={allDone ? 'Continue' : 'Continue while it downloads'} onPress={onPress} />;
}

// ---------- 5. Save your progress / Welcome back ----------

function AccountStep({ signin, onGitHub, onGoogle, onEmail, onSkip }: { signin: boolean; onGitHub: () => void; onGoogle: () => void; onEmail: () => void; onSkip: () => void }) {
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 28, paddingTop: 20, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        {signin
          ? <StepHead title="Welcome back" sub="Sign in to pick up where you left off." />
          : <StepHead title="Save your progress" sub="Sign in to keep your streak, XP and code in sync across devices. You can do this later." />}
        <View style={{ gap: 10 }}>
          <OutlinePill label="Continue with GitHub" onPress={onGitHub} />
          <OutlinePill label="Continue with Google" onPress={onGoogle} />
          <OutlinePill label="Continue with email" onPress={onEmail} />
        </View>
      </ScrollView>
      <View style={{ gap: 6, paddingVertical: 16, paddingHorizontal: 20 }}>
        {!signin ? <TextBtn label="Not now" onPress={onSkip} /> : null}
        <FootNote style={{ paddingTop: 4, paddingHorizontal: 12 }}>By continuing you agree to the Terms of Service and Privacy Policy.</FootNote>
      </View>
    </>
  );
}

// ---------- 6. Email sign-in / 7. Check your email ----------

function EmailStep({ email, sent, onEmail, onSend, onOpenMail, onOther }: {
  email: string; sent: boolean; onEmail: (s: string) => void; onSend: () => void; onOpenMail: () => void; onOther: () => void;
}) {
  const ok = isValidEmail(email);
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 28, paddingTop: 20, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!sent ? (
          <>
            <StepHead title="Continue with email" sub="We’ll email you a link to sign in. There’s no password to remember." />
            <View>
              <TextInput
                value={email}
                onChangeText={onEmail}
                onSubmitEditing={onSend}
                placeholder="you@example.com"
                placeholderTextColor={C.disabled}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={Platform.OS !== 'web'}
                returnKeyType="send"
                cursorColor={C.rust}
                selectionColor={C.rust}
                accessibilityLabel="Email"
                style={[t(16, undefined, 400, C.text), { height: 56, borderRadius: 8, paddingHorizontal: 16, backgroundColor: 'transparent' }, Platform.OS === 'web' ? ({ outlineStyle: 'none', caretColor: C.rust } as object) : null]}
              />
              <Inset color={C.rust} width={2} radius={8} />
              <View pointerEvents="none" style={{ position: 'absolute', left: 12, top: -8, paddingHorizontal: 4, backgroundColor: C.ground }}>
                <Text style={t(12, undefined, 400, C.rustLight)}>Email</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 16, paddingTop: 40, paddingHorizontal: 8 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.doneTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="mark_email_read" size={36} color={C.done} />
            </View>
            <Text accessibilityRole="header" style={t(28, 1.18, 650, C.text, { letterSpacing: ls(-0.025, 28), textAlign: 'center' })}>Check your email</Text>
            <Text style={t(15, 1.55, 400, C.secondary, { textAlign: 'center' })}>
              We sent a sign-in link to <Text style={t(15, 1.55, 600, C.text)}>{email}</Text>. Open it on this phone to continue.
            </Text>
          </View>
        )}
      </ScrollView>
      <View style={{ gap: 6, paddingVertical: 16, paddingHorizontal: 20 }}>
        {!sent ? (
          <Primary label="Send sign-in link" disabled={!ok} onPress={onSend} />
        ) : (
          <>
            <Primary label="Open email app" onPress={onOpenMail} />
            <TextBtn label="Use a different email" onPress={onOther} />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------- Notification permission (web drawing of the Android system dialog) ----------

function PermissionDialog({ onAllow, onDeny }: { onAllow: () => void; onDeny: () => void }) {
  const btn = (label: string, onPress: () => void) => (
    <Press onPress={onPress} accessibilityRole="button" overlay="rgba(255,138,85,0.08)" radius={24} style={{ height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={t(15, undefined, 600, C.rustLight)}>{label}</Text>
    </Press>
  );
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 20 }}>
      <View accessibilityRole="alert" style={{ width: '100%', maxWidth: 312, borderRadius: 28, backgroundColor: C.dialog, paddingTop: 24, paddingBottom: 8, alignItems: 'center', gap: 16 }}>
        <Icon name="notifications" size={26} color={C.rustLight} />
        <Text style={t(20, 1.35, 400, C.text, { paddingHorizontal: 24, textAlign: 'center' })}>
          Allow <Text style={t(20, 1.35, 650, C.text)}>Oxide</Text> to send you notifications?
        </Text>
        <View style={{ alignSelf: 'stretch', gap: 2, paddingTop: 8, paddingHorizontal: 8 }}>
          {btn('Allow', onAllow)}
          {btn('Don’t allow', onDeny)}
        </View>
      </View>
    </View>
  );
}
