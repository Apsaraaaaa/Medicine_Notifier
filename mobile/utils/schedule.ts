import type { HistoryEntry, Medicine } from "../types";
import { MISSED_AFTER_MINUTES, type DoseState } from "../constants/theme";
import { timeToMinutes, todayISO } from "./date";

export interface DoseSlot {
  medicine: Medicine;
  time: string;
  status: DoseState;
}

export function isActiveOn(med: Medicine, date = todayISO()): boolean {
  return date >= med.startDate && date <= med.endDate;
}

/** All dose slots for a day with their computed status. */
export function getTodaySlots(
  medicines: Medicine[],
  history: HistoryEntry[],
  date = todayISO()
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
