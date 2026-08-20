/**
 * The locale every date in this module is formatted with.
 *
 * Module state rather than a parameter on all nine helpers: the language is a
 * single app-wide choice, and threading it through every call site would touch
 * a hundred lines to say the same thing. AppProvider assigns it during render
 * whenever the language changes, and that render is what re-runs the formatters
 * — so the first paint after a switch is already in the new language.
 */
let dateLocale = "en-US";

export function setDateLocale(locale: string) {
  dateLocale = locale;
}

/**
 * Local calendar date as YYYY-MM-DD.
 *
 * Deliberately not `toISOString()`: that converts to UTC first, so east of
 * Greenwich every dose recorded before the offset (e.g. before 05:45 in
 * UTC+5:45) was filed under yesterday, and west of it every evening dose was
 * filed under tomorrow.
 */
export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toLocalISO(new Date());
}

/** The local calendar date `delta` days from `iso` (negative = earlier). */
export function shiftDays(iso: string, delta: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + delta);
  return toLocalISO(d);
}

/** Midnight local time on an ISO date — never parsed as UTC. */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** "HH:MM" -> minutes since midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** "Aug 17" — used where the weekday is already implied. */
export function shortDate(iso: string): string {
  return fromISO(iso).toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
}

export function prettyDate(iso: string): string {
  return fromISO(iso).toLocaleDateString(dateLocale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function weekdayNarrow(iso: string): string {
  return fromISO(iso).toLocaleDateString(dateLocale, { weekday: "narrow" });
}

export function weekdayShort(iso: string): string {
  return fromISO(iso).toLocaleDateString(dateLocale, { weekday: "short" });
}

export function monthLabel(iso: string): string {
  return fromISO(iso).toLocaleDateString(dateLocale, { month: "short" });
}

/** "Monday, 19 August" — the date the home screen opens with. */
export function longDate(date: Date = new Date()): string {
  return date.toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * A date in English, whatever language the app is set to.
 *
 * For output that leaves the app: the PDF report is written with the base-14
 * PDF fonts, which have no Devanagari glyphs, so a Nepali date would be
 * stripped to punctuation on its way into the file. Anything on screen should
 * use `prettyDate` instead and follow the reader's language.
 */
export function enDate(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The month of an ISO date, in English. See `enDate` for why. */
export function enMonth(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** A stored ISO timestamp, in the reader's own locale. */
export function dateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(dateLocale);
}
