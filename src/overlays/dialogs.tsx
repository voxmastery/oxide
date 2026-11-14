// Dialogs from design/project/Overlays.dc.html ("Popups → Dialogs" in design/SPEC.md).
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { C } from '../theme/tokens';
import { t } from '../theme/fonts';
import { Press, Row } from '../ui/core';
import { navActions } from '../nav/store';
import { useApp, type GoalMin, type SolutionPolicy } from '../state/app';
import { weeksForGoal } from '../state/selectors';
import { scheduleReminder } from '../state/reminders';
import type { OverlayProps } from './registry';
import { ConfirmDialog, DialogFrame, OR, RED, RadioDot, TextAction } from './parts';

// ---------- Radio dialogs ----------

function RadioDialog({ title, sub, options, initial, onOk }: {
  title: string; sub?: string; options: { t: string; s?: string }[]; initial: number; onOk: (i: number) => void;
}) {
  const [sel, setSel] = useState(Math.max(0, initial));
  const { closePop } = navActions();
  return (
    <DialogFrame style={{ paddingTop: 24, paddingBottom: 14, gap: 14 }}>
      <View style={{ gap: 8, paddingHorizontal: 24 }}>
        <Text accessibilityRole="header" style={t(22, 1.3, 600, C.text)}>{title}</Text>
        {sub ? <Text style={t(14, 1.5, 400, C.mutedHi)}>{sub}</Text> : null}
      </View>
      <View accessibilityRole="radiogroup" style={{ paddingVertical: 4, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        {options.map((o, i) => (
          <Press
            key={o.t}
            onPress={() => setSel(i)}
            overlay="rgba(255,255,255,0.04)"
            accessibilityRole="radio"
            accessibilityState={{ checked: sel === i }}
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8, paddingHorizontal: 24 }}
          >
            <RadioDot on={sel === i} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={t(15.5, 1.3, 400, C.text)}>{o.t}</Text>
              {o.s ? <Text style={t(13, 1.3, 400, C.secondary)}>{o.s}</Text> : null}
            </View>
          </Press>
        ))}
      </View>
      <Row style={{ justifyContent: 'flex-end', gap: 4, paddingHorizontal: 14 }}>
        <TextAction label="Cancel" onPress={closePop} />
        <TextAction label="OK" onPress={() => { closePop(); onOk(sel); }} />
      </Row>
    </DialogFrame>
  );
}

const GOALS: GoalMin[] = [10, 20, 30, 45];

export function GoalDialog(_: OverlayProps) {
  const goal = useApp((s) => s.plan.goal);
  return (
    <RadioDialog
      title="Daily goal"
      sub="Pick what you can keep up on a busy day."
      options={GOALS.map((g) => ({ t: `${g} min a day`, s: `≈ ${weeksForGoal[g]} weeks to finish` }))}
      initial={GOALS.indexOf(goal)}
      onOk={(i) => useApp.getState().setPlan({ goal: GOALS[i] })}
    />
  );
}

const POLICIES: { v: SolutionPolicy; t: string }[] = [
  { v: 'after3', t: 'After 3 failed checks' },
  { v: 'afterPass', t: 'Only after you pass' },
  { v: 'never', t: 'Never' },
];

export function SolutionSettingDialog(_: OverlayProps) {
  const pol = useApp((s) => s.prefs.solution);
  return (
    <RadioDialog
      title="Show the official solution"
      options={POLICIES.map((p) => ({ t: p.t }))}
      initial={POLICIES.findIndex((p) => p.v === pol)}
      onOk={(i) => useApp.getState().setPrefs({ solution: POLICIES[i].v })}
    />
  );
}

// ---------- Confirmations ----------

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** opts: { exercise, attempts, onShow } */
export function SolutionEarlyDialog({ opts }: OverlayProps) {
  const pol = useApp((s) => s.prefs.solution);
  const { closePop } = navActions();
  const ex: string = opts.exercise ?? '';
  const n = Number(opts.attempts ?? 0);
  const checked = n === 0 ? `You haven’t checked ${ex} yet.` : `You’ve checked ${ex} ${times(n)}.`;
  const unlock = pol === 'afterPass' ? 'The solution unlocks once you pass.' : 'The solution unlocks after 3 failed checks.';
  return (
    <ConfirmDialog
      icon="key"
      title="See the solution now?"
      body={`${checked} ${unlock} If you open it before you pass, this exercise gives no XP.`}
      actions={[
        { label: 'Keep trying', onPress: closePop },
        { label: 'Show solution', onPress: () => { closePop(); opts.onShow?.(); } },
      ]}
    />
  );
}

/** opts: { remainingMB, onWait, onMobile } */
export function DownloadPausedDialog({ opts }: OverlayProps) {
  const { closePop } = navActions();
  const mb = Math.max(1, Math.round(Number(opts.remainingMB ?? 0)));
  return (
    <ConfirmDialog
      icon="wifi_off"
      title="Download paused"
      body={`Rust still needs ${mb} MB. Connect to Wi-Fi to finish, or continue on mobile data.`}
      actions={[
        { label: 'Wait for Wi-Fi', onPress: () => { closePop(); opts.onWait?.(); } },
        { label: 'Use mobile data', onPress: () => { closePop(); opts.onMobile?.(); } },
      ]}
    />
  );
}

/**
 * opts: { name, onDelete, onUndo? }. Shows "<name> deleted" (with Undo when `onUndo` is given)
 * before calling onDelete, so a snackbar the caller shows from onDelete replaces it.
 */
export function DeleteProjectDialog({ opts }: OverlayProps) {
  const { closePop, showToast } = navActions();
  const name: string = opts.name ?? '';
  return (
    <ConfirmDialog
      icon="folder_delete"
      iconColor={RED}
      title={`Delete ${name}?`}
      body={`This deletes ~/projects/${name} and every file in it from this phone. Your Book and Rustlings progress stays.`}
      actions={[
        { label: 'Cancel', onPress: closePop },
        {
          label: 'Delete', color: RED, onPress: () => {
            closePop();
            if (opts.onUndo) showToast(`${name} deleted`, 'Undo', opts.onUndo); else showToast(`${name} deleted`);
            opts.onDelete?.();
          },
        },
      ]}
    />
  );
}

/** Sign out keeps local progress (and the onboarded flag); the account link is cleared. */
export function SignOutDialog(_: OverlayProps) {
  const { closePop, reset } = navActions();
  return (
    <ConfirmDialog
      icon="logout"
      title="Sign out of Oxide?"
      body="Your progress is saved to your account. Projects in ~/projects stay on this phone."
      actions={[
        { label: 'Cancel', onPress: closePop },
        { label: 'Sign out', onPress: () => { useApp.getState().signOut(); reset('onboarding', { variant: 'welcome' }); } },
      ]}
    />
  );
}

export function DeleteAccountDialog(_: OverlayProps) {
  const { closePop, reset } = navActions();
  return (
    <ConfirmDialog
      icon="delete_forever"
      iconColor={RED}
      title="Delete your account?"
      body="This permanently deletes your progress, streak and synced code from Oxide. Projects stored on this phone are not deleted."
      actions={[
        { label: 'Cancel', onPress: closePop },
        {
          label: 'Delete account', color: RED, onPress: () => {
            scheduleReminder(null).catch(() => {});
            useApp.getState().deleteAccount();
            reset('onboarding', { variant: 'welcome' });
          },
        },
      ]}
    />
  );
}
