import type { HistoryEntry, Medicine } from "../types";
import { MISSED_AFTER_MINUTES, type DoseState } from "../constants/theme";
import { timeToMinutes, todayISO } from "./date";

/** Shared empty set, so the default argument allocates nothing per call. */
const EMPTY: ReadonlySet<string> = new Set();

export interface DoseSlot {
  medicine: Medicine;
  time: string;
  status: DoseState;
}

export function isActiveOn(med: Medicine, date = todayISO()): boolean {
  return date >= med.startDate && date <= med.endDate;
}

/**
 * The identity of one dose slot: medicine, day and time.
 *
 * Exported because the snooze map in AppContext is keyed by it, and a slot can
 * only be shown as snoozed if both sides spell the key the same way.
 */
export function slotKey(medicineId: string, date: string, time: string): string {
  return `${medicineId}|${date}|${time}`;
}

/**
 * All dose slots for a day with their computed status.
 *
 * `snoozed` is the set of slot keys the user has pushed back and that have not
 * come round again yet. It is optional and defaults to empty, so every existing
 * caller — the adherence maths included — keeps the behaviour it had.
 */
export function getTodaySlots(
  medicines: Medicine[],
  history: HistoryEntry[],
  date = todayISO(),
  snoozed: ReadonlySet<string> = EMPTY
): DoseSlot[] {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const slots: DoseSlot[] = [];

  for (const med of medicines) {
    if (!isActiveOn(med, date)) continue;
    for (const time of med.times) {
      const hist = history.find(
        (h) => h.medicineId === med.id && h.date === date && h.time === time
      );
      let status: DoseState;
      if (hist) {
        status = hist.status;
      } else if (snoozed.has(slotKey(med.id, date, time))) {
        // Pushed back on purpose. Checked before the overdue test below, or a
        // dose snoozed past its grace period would read as missed while the
        // app is in fact still waiting to ask again.
        status = "snoozed";
      } else if (timeToMinutes(time) <= nowMin) {
        // late by more than the grace period without a record = missed, else due
        status = nowMin - timeToMinutes(time) > MISSED_AFTER_MINUTES ? "missed" : "due";
      } else {
        status = "upcoming";
      }
      slots.push({ medicine: med, time, status });
    }
  }
  slots.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  return slots;
}

/** Doses scheduled on a given date, regardless of whether they were answered. */
export function expectedDoses(medicines: Medicine[], date: string): number {
  let n = 0;
  for (const med of medicines) {
    if (isActiveOn(med, date)) n += med.times.length;
  }
  return n;
}

/** "In 2h 18m" / "18m ago" — relative to right now. */
export function relativeTime(time: string, now = new Date()): string {
  const diff = timeToMinutes(time) - (now.getHours() * 60 + now.getMinutes());
  const mins = Math.abs(diff);
  const text = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  if (diff === 0) return "Right now";
  return diff > 0 ? `In ${text}` : `${text} ago`;
}
