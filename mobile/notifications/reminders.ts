// Expo Notifications wiring: OS-level dose reminders.
//
// Two things fire a reminder, and they are deliberately separate:
//
//   * While the app is open, AppContext's ticker opens the reminder sheet and
//     starts the alarm. The banner is suppressed in the foreground handler so
//     the same dose isn't announced twice.
//   * While the app is backgrounded or closed, the notifications scheduled here
//     are the reminder. Tapping one carries {medicineId, time} back into the
//     app, which reopens the same sheet.
//
// Every schedule is rebuilt from the medicine list rather than patched, so the
// device can never drift out of step with the server's data.
//
// Expo Go caveat: since SDK 53 the notifications native module is not part of
// Expo Go on Android, and merely importing expo-notifications there throws. So
// the module is loaded lazily behind `NOTIFICATIONS_AVAILABLE` and every export
// below is a no-op in Expo Go — the app still runs, and the in-app reminder
// sheet still fires while it is open. Real OS reminders need a development
// build: `npx expo run:android`.
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import { translate, type Language } from "../i18n";
import type { CaregiverAlert, Medicine } from "../types";
import { formatTime12, todayISO } from "../utils/date";
import { mealOf } from "../utils/meal";
import { isActiveOn } from "../utils/schedule";

type NotificationsModule = typeof import("expo-notifications");

export const REMINDER_CHANNEL = "medicine-reminders";

/**
 * False inside Expo Go, where the native module does not exist, and on web,
 * where scheduled local notifications and Android channels have no meaning.
 */
export const NOTIFICATIONS_AVAILABLE =
  Platform.OS !== "web" &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export interface ReminderPayload {
  medicineId: string;
  time: string;
}

let cached: NotificationsModule | null = null;

/** The native module, or null when it isn't available (Expo Go). */
function notifications(): NotificationsModule | null {
  if (!NOTIFICATIONS_AVAILABLE) return null;
  if (!cached) {
    try {
      // Required lazily: a static import is evaluated before this guard runs.
      cached = require("expo-notifications") as NotificationsModule;
    } catch {
      return null;
    }
  }
  return cached;
}

let handlerInstalled = false;

/**
 * Foreground policy: no banner, no sound. The in-app sheet is louder and it
 * can actually record the answer. Called once from the root layout.
 */
export function installForegroundHandler() {
  const N = notifications();
  if (!N || handlerInstalled) return;
  handlerInstalled = true;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * The line under a reminder: the medicine, its dose, when it is due, and — when
 * the medicine names one — how it sits around food. "after breakfast" is what
 * makes a reminder actionable without opening the app.
 */
function reminderBody(medicine: Medicine, time: string, language: Language): string {
  const key = medicine.dosage ? "notify.bodyWithDose" : "notify.body";
  const base = translate(language, key, {
    name: medicine.name,
    dosage: medicine.dosage,
    time: formatTime12(time),
  });

  const meal = mealOf(medicine);
  return meal === "none" ? base : `${base} · ${translate(language, `meal.${meal}`)}`;
}

export async function ensureChannel(language: Language = "en") {
  const N = notifications();
  if (!N || Platform.OS !== "android") return;
  await N.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: translate(language, "notify.channel"),
    importance: N.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
    // No `sound` key: on a channel this field names a bundled sound *file*, so
    // passing "default" makes Android look for default.wav and warn that it is
    // missing. Omitting it gives the channel the system default sound, which is
    // what we want. ("default" is only valid on notification content.)
    enableVibrate: true,
  });
}

/**
 * Asks once; returns whether the app may post notifications.
 *
 * Note there is no `Device.isDevice` guard: an Android emulator delivers local
 * notifications exactly like a phone, and gating on it meant the app never
 * asked for permission and therefore never scheduled a single reminder.
 */
export async function requestPermission(): Promise<boolean> {
  const N = notifications();
  if (!N) return false;
  await ensureChannel();
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await N.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Rebuilds the daily reminder for every time of every medicine still running.
 * Called after login, after any medicine changes, and when notifications are
 * switched on or off. Returns how many were scheduled.
 */
export async function syncScheduledReminders(
  medicines: Medicine[],
  enabled: boolean,
  language: Language = "en"
): Promise<number> {
  const N = notifications();
  if (!N) return 0;

  await N.cancelAllScheduledNotificationsAsync();
  if (!enabled) return 0;

  const allowed = await requestPermission();
  if (!allowed) return 0;

  const today = todayISO();
  let scheduled = 0;

  for (const med of medicines) {
    // A course that has already ended needs no reminders; one starting later
    // still repeats daily, so it is scheduled and simply not due yet.
    if (med.endDate < today) continue;

    for (const time of med.times) {
      const [hour, minute] = time.split(":").map(Number);
      if (Number.isNaN(hour) || Number.isNaN(minute)) continue;

      await N.scheduleNotificationAsync({
        content: {
          title: translate(language, "notify.title"),
          body: reminderBody(med, time, language),
          data: { medicineId: med.id, time } satisfies ReminderPayload,
          sound: "default",
          ...(Platform.OS === "android" ? { channelId: REMINDER_CHANNEL } : {}),
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          ...(Platform.OS === "android" ? { channelId: REMINDER_CHANNEL } : {}),
        },
      });
      scheduled += 1;
    }
  }
  return scheduled;
}

/**
 * How many reminders the phone is currently holding, and whether it is allowed
 * to show them. Settings displays this so "are my reminders actually set?" has
 * an answer inside the app rather than requiring adb.
 */
export async function reminderStatus(): Promise<{ scheduled: number; allowed: boolean }> {
  const N = notifications();
  if (!N) return { scheduled: 0, allowed: false };
  const permission = await N.getPermissionsAsync();
  const list = await N.getAllScheduledNotificationsAsync();
  return { scheduled: list.length, allowed: permission.granted };
}

export async function cancelAllReminders() {
  const N = notifications();
  if (!N) return;
  await N.cancelAllScheduledNotificationsAsync();
}

/** A dose the user snoozed: one-shot, minutes from now. */
export async function scheduleSnooze(
  medicine: Medicine,
  time: string,
  minutes: number,
  language: Language = "en"
) {
  const N = notifications();
  if (!N) return;
  const allowed = await requestPermission();
  if (!allowed) return;
  await N.scheduleNotificationAsync({
    content: {
      title: translate(language, "notify.snoozedTitle"),
      body: reminderBody(medicine, time, language),
      data: { medicineId: medicine.id, time } satisfies ReminderPayload,
      sound: "default",
      ...(Platform.OS === "android" ? { channelId: REMINDER_CHANNEL } : {}),
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, minutes * 60),
      repeats: false,
      ...(Platform.OS === "android" ? { channelId: REMINDER_CHANNEL } : {}),
    },
  });
}

function payloadOf(data: unknown): ReminderPayload | null {
  const record = data as Partial<ReminderPayload> | undefined;
  if (!record?.medicineId || !record.time) return null;
  return { medicineId: String(record.medicineId), time: String(record.time) };
}

/**
 * Calls `open` with the dose behind a notification the user tapped — including
 * one tapped while the app was closed. Returns an unsubscribe function.
 */
export function addReminderResponseListener(
  open: (payload: ReminderPayload) => void
): () => void {
  const N = notifications();
  if (!N) return () => {};

  N.getLastNotificationResponseAsync().then((response) => {
    const payload = payloadOf(response?.notification.request.content.data);
    if (payload) open(payload);
  });

  const sub = N.addNotificationResponseReceivedListener((response) => {
    const payload = payloadOf(response.notification.request.content.data);
    if (payload) open(payload);
  });
  return () => sub.remove();
}

/**
 * Announces a caregiver alert on this phone, right now.
 *
 * There is no push service in this stack, so an alert reaches a caregiver when
 * their app next syncs — and this is what makes it land as a notification they
 * can see on the lock screen rather than a badge they have to go looking for.
 * The caller is responsible for only ever passing an alert once (AppContext
 * keeps the ids it has already announced).
 */
export async function presentCaregiverAlert(alert: CaregiverAlert, language: Language = "en") {
  const N = notifications();
  if (!N) return;
  const allowed = await requestPermission();
  if (!allowed) return;
  await N.scheduleNotificationAsync({
    content: {
      title: translate(language, "notify.alertTitle", { name: alert.patientName }),
      body: alert.message,
      data: { alertId: alert.id, linkId: alert.linkId },
      sound: "default",
      ...(Platform.OS === "android" ? { channelId: REMINDER_CHANNEL } : {}),
    },
    // Immediate: the check that produced it already established it is overdue.
    trigger: null,
  });
}

/** True when the medicine still has a dose to give on the given date. */
export function runsOn(medicine: Medicine, date = todayISO()): boolean {
  return isActiveOn(medicine, date);
}
