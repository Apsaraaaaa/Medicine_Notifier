// Adherence maths for the History & insights screen.
//
// Nothing here is stored: every figure is derived from the medicines the user
// saved and the history entries the reminder wrote. Missed doses are inferred
// (a scheduled dose in the past with no record) because the app only ever
// records an answer the user actually gave.

import type { HistoryEntry, Medicine } from "../types";
import { expectedDoses, getTodaySlots } from "./schedule";
import { fromISO, monthLabel, shiftDays, shortDate, todayISO, weekdayNarrow } from "./date";

export type RangeKey = "week" | "month" | "all";

export interface DayStats {
  date: string; // ISO date
  taken: number;
  skipped: number;
  missed: number;
  expected: number;
}

export interface Bucket extends DayStats {
  label: string; // axis label
  days: number; // how many days rolled into this bucket
}

export interface Summary {
  taken: number;
  skipped: number;
  missed: number;
  expected: number;
  /** Percentage of scheduled doses that were taken, or null with nothing scheduled. */
  adherence: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366; // guard for the "All" range

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((fromISO(toDate).getTime() - fromISO(fromDate).getTime()) / DAY_MS);
}

/** Earliest date worth charting: the first medicine start or history entry. */
function earliestDate(medicines: Medicine[], history: HistoryEntry[]): string {
  const dates = [...medicines.map((m) => m.startDate), ...history.map((h) => h.date)];
  const today = todayISO();
  if (dates.length === 0) return today;
  const min = dates.reduce((a, b) => (a < b ? a : b));
  return min > today ? today : min;
}

/** How many days the range covers, ending today. */
export function rangeDays(
  range: RangeKey,
  medicines: Medicine[],
  history: HistoryEntry[]
): number {
  if (range === "week") return 7;
  if (range === "month") return 30;
  const span = daysBetween(earliestDate(medicines, history), todayISO()) + 1;
  return Math.min(Math.max(span, 1), MAX_DAYS);
}

/**
 * Per-day taken / skipped / missed for the `days` days ending on `endDate`.
 * Today is read from the live schedule so a dose still inside its grace period
 * is not counted as missed yet.
 */
export function buildDailyStats(
  medicines: Medicine[],
  history: HistoryEntry[],
  days: number,
  endDate = todayISO()
): DayStats[] {
  const byDate = new Map<string, HistoryEntry[]>();
  for (const h of history) {
    const bucket = byDate.get(h.date);
    if (bucket) bucket.push(h);
    else byDate.set(h.date, [h]);
  }

  const out: DayStats[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDays(endDate, -i);
    const entries = byDate.get(date) ?? [];
    const taken = entries.filter((h) => h.status === "taken").length;
    const skipped = entries.filter((h) => h.status === "skipped").length;
    const expected = expectedDoses(medicines, date);

    let missed: number;
    if (date === todayISO()) {
      missed = getTodaySlots(medicines, history, date).filter((s) => s.status === "missed").length;
    } else {
      missed = Math.max(0, expected - taken - skipped);
    }
    out.push({ date, taken, skipped, missed, expected });
  }
  return out;
}

export function summarize(days: DayStats[]): Summary {
  const taken = days.reduce((n, d) => n + d.taken, 0);
  const skipped = days.reduce((n, d) => n + d.skipped, 0);
  const missed = days.reduce((n, d) => n + d.missed, 0);
  const expected = days.reduce((n, d) => n + d.expected, 0);
  return {
    taken,
    skipped,
    missed,
    expected,
    adherence: expected > 0 ? Math.round((taken / expected) * 100) : null,
  };
}

/**
 * Adherence change against the equally long period before this one.
 * Returns null when the earlier period had nothing scheduled — there is no
 * honest comparison to show.
 */
export function trend(
  medicines: Medicine[],
  history: HistoryEntry[],
  days: number
): { delta: number; days: number } | null {
  const current = summarize(buildDailyStats(medicines, history, days));
  const priorEnd = shiftDays(todayISO(), -days);
  const previous = summarize(buildDailyStats(medicines, history, days, priorEnd));
  if (current.adherence === null || previous.adherence === null) return null;
  return { delta: current.adherence - previous.adherence, days };
}

/** Roll days into chart buckets: daily up to 10 days, then weekly, then monthly. */
export function bucketize(days: DayStats[]): Bucket[] {
  if (days.length <= 10) {
    return days.map((d) => ({ ...d, label: weekdayNarrow(d.date), days: 1 }));
  }

  const size = days.length <= 45 ? 7 : 0; // 0 = group by calendar month
  const groups: DayStats[][] = [];

  if (size > 0) {
    // walk backwards so the most recent bucket is always full-width
    for (let end = days.length; end > 0; end -= size) {
      groups.unshift(days.slice(Math.max(0, end - size), end));
    }
  } else {
    let key = "";
    for (const d of days) {
      const month = d.date.slice(0, 7);
      if (month !== key) {
        groups.push([]);
        key = month;
      }
      groups[groups.length - 1].push(d);
    }
  }

  return groups.map((group) => {
    const first = group[0];
    return {
      date: first.date,
      label: size > 0 ? shortDate(first.date) : monthLabel(first.date),
      days: group.length,
      taken: group.reduce((n, d) => n + d.taken, 0),
      skipped: group.reduce((n, d) => n + d.skipped, 0),
      missed: group.reduce((n, d) => n + d.missed, 0),
      expected: group.reduce((n, d) => n + d.expected, 0),
    };
  });
}

/** Wording for an adherence figure — never colour alone. */
export function adherenceVerdict(adherence: number | null): string {
  if (adherence === null) return "Nothing scheduled";
  if (adherence >= 90) return "Excellent";
  if (adherence >= 80) return "On track";
  if (adherence >= 50) return "Needs attention";
  return "Falling behind";
}

/** History filtered to the range, newest first, grouped by date. */
export function groupHistory(
  history: HistoryEntry[],
  days: number
): [string, HistoryEntry[]][] {
  const from = shiftDays(todayISO(), -(days - 1));
  const map = new Map<string, HistoryEntry[]>();
  for (const h of history) {
    if (h.date < from) continue;
    const bucket = map.get(h.date);
    if (bucket) bucket.push(h);
    else map.set(h.date, [h]);
  }
  for (const entries of map.values()) {
    entries.sort((a, b) => (a.time < b.time ? 1 : -1));
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}
