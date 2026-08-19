/**
 * Design tokens for the React Native app.
 *
 * Every colour has a light and a dark value under the same key, so a component
 * reads `const c = useTheme()` once and never branches on the theme itself.
 *
 * Naming:
 *   <name>        solid accent
 *   <name>Soft    tinted surface behind an icon / chip
 *   <name>Ink     text colour, contrast-checked against the surface (AA)
 *   <name>Solid   button fill, paired with on<Name> for its label
 */

export const LIGHT = {
  brand: "#7B61D9",
  brandStrong: "#573BB0",
  brandSoft: "#F1ECFE",
  brandInk: "#5B3FB5",
  brandSolid: "#6C4FD0",
  onBrand: "#FFFFFF",

  ok: "#20BF6B",
  okSoft: "#E3F8EC",
  okInk: "#14875A",
  okSolid: "#14875A",
  onOk: "#FFFFFF",

  warn: "#E59A12",
  warnSoft: "#FDF1DD",
  warnInk: "#96620A",
  warnSolid: "#96620A",
  onWarn: "#FFFFFF",

  bad: "#E53935",
  badSoft: "#FDEAEA",
  badInk: "#C62828",
  badSolid: "#CF2F2B",
  onBad: "#FFFFFF",

  chartTaken: "#20BF6B",
  chartSkipped: "#E59A12",
  chartMissed: "#E53935",

  canvas: "#F6F4FC",
  surface: "#FFFFFF",
  surface2: "#F5F2FB",
  line: "#E5E0F2",
  ink: "#1B1730",
  ink2: "#565073",
  ink3: "#5E5880",
  scrim: "rgba(22, 16, 40, 0.5)",

  /** The hero gradient is the same in both themes, so its text stays white. */
  heroFrom: "#4C319E",
  heroTo: "#8B6FE8",
} as const;

export type Palette = { [K in keyof typeof LIGHT]: string };

export const DARK: Palette = {
  brand: "#A78BFA",
  brandStrong: "#8B6FE8",
  brandSoft: "#272049",
  brandInk: "#C9B8FB",
  brandSolid: "#A78BFA",
  onBrand: "#241A4D",

  ok: "#34D399",
  okSoft: "#12332A",
  okInk: "#6EE7B7",
  okSolid: "#34D399",
  onOk: "#04261A",

  warn: "#F0B429",
  warnSoft: "#372A12",
  warnInk: "#FCD34D",
  warnSolid: "#F0B429",
  onWarn: "#3A2408",

  bad: "#F4726E",
  badSoft: "#3A1C1C",
  badInk: "#FCA5A5",
  badSolid: "#F4726E",
  onBad: "#3B0F0F",

  chartTaken: "#22A46B",
  chartSkipped: "#C08A12",
  chartMissed: "#DC5555",

  canvas: "#100D1C",
  surface: "#181528",
  surface2: "#1F1B33",
  line: "#2E2947",
  ink: "#F2EFFA",
  ink2: "#BAB3D2",
  ink3: "#ABA2C8",
  scrim: "rgba(6, 4, 14, 0.66)",

  heroFrom: "#4C319E",
  heroTo: "#8B6FE8",
};

/** Corner radii, shared so cards, sheets and buttons stay in one family. */
export const RADIUS = { field: 16, btn: 18, card: 22, sheet: 30 } as const;

/**
 * Type scale, tuned for older eyes.
 *
 * `body` is 17pt rather than the 14–15 a phone UI usually uses: the people this
 * app is for read it without glasses, at arm's length, often in a hurry. Every
 * size below is a step in one scale so screens never invent their own.
 */
export const TYPE = {
  micro: 13, // legends and axis labels only
  small: 15, // secondary meta text
  body: 17, // default reading size
  bodyLg: 19, // emphasised body, list titles
  title: 22, // card and sheet titles
  headline: 26, // screen titles
  display: 34, // single big numbers (adherence, times)
} as const;

/**
 * Control sizing. 52dp minimum touch target — well above the 44dp floor,
 * because a shaky hand on a 6" screen misses small buttons.
 */
export const SIZES = {
  tap: 52,
  control: 60, // text fields, settings rows
  buttonMd: 56,
  buttonLg: 66,
  icon: 24,
  iconLg: 28,
} as const;

/** Palette offered in the medicine form. Kept as hex — the user picks these. */
export const MED_COLORS = [
  "#7B61D9",
  "#20BF6B",
  "#E53935",
  "#E59A12",
  "#DB4C8C",
  "#0E9594",
] as const;

export type DoseState = "taken" | "due" | "upcoming" | "skipped" | "missed";

/**
 * Dose / history status → the word and the colour roles every screen renders
 * it with. Status is never colour alone: each entry carries a label, and
 * callers pair it with the matching icon.
 */
export const STATUS_META: Record<
  DoseState,
  { label: string; soft: keyof Palette; ink: keyof Palette }
> = {
  taken: { label: "Taken", soft: "okSoft", ink: "okInk" },
  due: { label: "Due now", soft: "brandSoft", ink: "brandInk" },
  upcoming: { label: "Upcoming", soft: "surface2", ink: "ink3" },
  skipped: { label: "Skipped", soft: "warnSoft", ink: "warnInk" },
  missed: { label: "Missed", soft: "badSoft", ink: "badInk" },
};

export const FREQUENCIES = [
  "Once a day",
  "Twice a day",
  "Three times a day",
  "Every 6 hours",
  "Weekly",
  "As needed",
] as const;

/** Minutes a snoozed dose waits before it asks again. */
export const SNOOZE_MINUTES = 15;

/** A dose with no answer this many minutes after its time counts as missed. */
export const MISSED_AFTER_MINUTES = 60;

export const APP_VERSION = "1.0.0";

export const STORAGE_KEYS = {
  token: "mn_token",
  refresh: "mn_refresh_token",
  user: "mn_user",
  settings: "mn_settings",
};
