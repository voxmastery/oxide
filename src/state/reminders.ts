// Daily practice reminder (spec: "Every day at 20:30, if you haven’t practised yet").
// One local notification, repeating daily at HH:MM, built from the user's real streak/progress.
// Called by Onboarding (goal step), the Reminder time dialog and Settings.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useApp, type AppData } from './app';
import { rustlingsProgress, streak } from './selectors';
import { sectionById } from '../content';
import { rescueReminderText } from '../features/streak/rescue';

const ID = 'oxide-daily-reminder';
const CHANNEL = 'reminders';
const supported = Platform.OS === 'android' || Platform.OS === 'ios';

/** Notification body from the user's state: the streak at risk, else where to pick up. */
export function reminderBody(s: Pick<AppData, 'days' | 'bestStreak' | 'ex' | 'book'>): string {
  const n = streak(s).current;
  if (n > 0) return rescueReminderText(s, useApp.getState().plan.reminderTime) ?? `Your ${n}-day streak ends at midnight`;
  const rl = rustlingsProgress(s);
  if (rl.done > 0 && rl.next) return `Pick up at ${rl.next}`;
  const sec = sectionById(s.book.current);
  return sec ? `Pick up at ${sec.id} ${sec.title}` : rl.next ? `Pick up at ${rl.next}` : 'Time for today’s Rust';
}

/** Parses "20:30" → { hour: 20, minute: 30 }. */
export function parseTime(time: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

async function cancelOxideReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((r) => r.identifier === ID || (r.content.data as Record<string, unknown> | undefined)?.oxide === 'reminder')
      .map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)),
  );
}

/**
 * Cancel any previous Oxide reminder and, when `time` is given, schedule a daily one at HH:MM.
 * `null` just cancels. No-op on web (no local scheduling there). Never throws.
 */
export async function scheduleReminder(time: string | null): Promise<void> {
  if (!supported) return;
  try {
    await cancelOxideReminders();
    if (time === null) return;
    const at = parseTime(time);
    if (!at) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Daily reminder',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: { title: 'Oxide', body: reminderBody(useApp.getState()), data: { oxide: 'reminder' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: at.hour, minute: at.minute, channelId: CHANNEL },
    });
  } catch (e) {
    if (__DEV__) console.warn('scheduleReminder failed', e);
  }
}

/** Re-schedule from the current plan (refreshes the body text, e.g. after the streak changes). */
export function refreshReminder(): Promise<void> {
  const { plan } = useApp.getState();
  return scheduleReminder(plan.reminder && plan.notifAllowed !== false ? plan.reminderTime : null);
}

/** Ask for notification permission with the real system dialog (Android 13+ / iOS). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const res = await Notifications.requestPermissionsAsync();
    return res.granted || res.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}
