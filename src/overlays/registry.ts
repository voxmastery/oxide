// Popup registry: kind → component. Implementations live in src/overlays/*.tsx
// (see design/project/Overlays.dc.html and design/SPEC.md "Popups").
// 'notify' (Onboarding) and 'projects' (Terminal) are drawn inside their own screens.
import type React from 'react';
import type { PopupKind } from '../nav/store';
import {
  DeleteAccountDialog, DeleteProjectDialog, DownloadPausedDialog, GoalDialog, SignOutDialog, SolutionEarlyDialog, SolutionSettingDialog,
} from './dialogs';
import { ReminderDialog } from './TimePicker';
import { CommandSheet, DisplaySheet, ExerciseMenuSheet, ReportSheet, StreakSheet, XpSheet } from './sheets';
import { LevelUpMoment, MissionMoment, PushNotice } from './moments';

export type OverlayProps = { opts: Record<string, any> };

export const OVERLAYS: Partial<Record<PopupKind, React.ComponentType<OverlayProps>>> = {
  goal: GoalDialog,
  reminder: ReminderDialog,
  'solution-setting': SolutionSettingDialog,
  'solution-early': SolutionEarlyDialog,
  dlfail: DownloadPausedDialog,
  delproj: DeleteProjectDialog,
  signout: SignOutDialog,
  delacct: DeleteAccountDialog,
  exmenu: ExerciseMenuSheet,
  cmd: CommandSheet,
  display: DisplaySheet,
  streak: StreakSheet,
  xp: XpSheet,
  report: ReportSheet,
  mission: MissionMoment,
  levelup: LevelUpMoment,
  push: PushNotice,
};

// Dev only (web): lets design checks open popups from Playwright, e.g. `__oxide.nav.getState().pop('xp')`.
declare const __DEV__: boolean;
if (__DEV__ && typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (window as unknown as { __oxide: unknown }).__oxide = { nav: require('../nav/store').useNav, app: require('../state/app').useApp };
}
