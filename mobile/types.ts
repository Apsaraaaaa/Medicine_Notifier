import type { Language } from "./i18n";

export type { Language };

export interface User {
  id: string;
  name: string;
  email: string;
  /** The language the account reads in; the server composes alerts with it. */
  language?: Language;
}

/** Where the dose sits relative to a meal. */
export type MealRelation = "none" | "before" | "with" | "after";

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  notes: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  frequency: string;
  times: string[]; // ["08:00", "20:00"]
  color: string;
  /** Set when the medicine was chosen from the shared catalog. */
  catalogId?: string | null;
  mealRelation?: MealRelation;
  /** A dose that must not be quietly missed — only these alert a caregiver. */
  critical?: boolean;
}

/**
 * An entry in the shared medicine catalog (backend `catalog` app). Reference
 * data: the app reads it for autocomplete and never writes to it.
 */
export interface CatalogMedicine {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  form: string;
  formLabel: string;
  category: string;
  usage: string;
  /** "Paracetamol 500 mg" — the suggestion row's title. */
  label: string;
  /** "1 tablet (500 mg)" — prefilled into the user's dosage field. */
  defaultDosage: string;
}

export type HistoryStatus = "taken" | "missed" | "skipped";

export interface HistoryEntry {
  id: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  time: string; // scheduled "HH:MM"
  date: string; // ISO date
  status: HistoryStatus;
  recordedAt: string; // ISO datetime
  note?: string; // optional note captured from the reminder
}

export interface Settings {
  notifications: boolean;
  alarmSound: boolean;
  volume: number; // 0..1
  darkMode: boolean;
  language: Language;
  /**
   * Patient Mode: a much larger, much simpler face on the same app.
   *
   * A presentation choice, not a permission — nothing is hidden from the
   * server and turning it off restores the full interface untouched.
   */
  patientMode: boolean;
  /**
   * Read the reminder out loud when a dose is due.
   *
   * An addition on top of the reminder, never a replacement for it: the screen,
   * the alarm tone and the notification are unchanged whether this is on or off.
   */
  voiceReminder: boolean;
}

// ---------------------------------------------------------------------------
// Report  (GET /api/reports/ — also the shape a caregiver reads)
// ---------------------------------------------------------------------------

export type ReportRange = "week" | "month" | "all";

export interface ReportSummary {
  expected: number;
  taken: number;
  /** Taken, but well after the reminder. A subset of `taken`, never added. */
  late: number;
  onTime: number;
  skipped: number;
  missed: number;
  pending: number;
  /** Percentage of scheduled doses taken, or null with nothing scheduled. */
  adherence: number | null;
}

export interface ReportDay {
  date: string;
  expected: number;
  taken: number;
  late: number;
  skipped: number;
  missed: number;
  pending: number;
}

export interface ReportBucket extends ReportDay {
  label: string;
  /** How many days rolled into this column. */
  days: number;
}

export interface ReportMedicine {
  id: string;
  name: string;
  dosage: string;
  color: string;
  critical: boolean;
  times: string[];
  expected: number;
  taken: number;
  late: number;
  skipped: number;
  missed: number;
  adherence: number | null;
}

export interface ReportSlot {
  medicineId: string;
  medicineName: string;
  dosage: string;
  color: string;
  mealRelation: MealRelation;
  critical: boolean;
  time: string;
  date: string;
  status: "taken" | "skipped" | "missed" | "due" | "upcoming";
  late: boolean;
}

export interface Report {
  range: ReportRange;
  days: number;
  from: string;
  to: string;
  generatedAt: string;
  summary: ReportSummary;
  trend: { delta: number; days: number; previous: number } | null;
  daily: ReportDay[];
  buckets: ReportBucket[];
  weekly: ReportBucket[];
  monthly: ReportBucket[];
  medicines: ReportMedicine[];
  today: ReportSlot[];
  patient: { id: string; name: string; email: string };
}

// ---------------------------------------------------------------------------
// Caregivers
// ---------------------------------------------------------------------------

export type CaregiverStatus = "pending" | "active" | "revoked";

/** A link as the patient sees it: someone they gave access to. */
export interface CaregiverLink {
  id: string;
  caregiverEmail: string;
  caregiverName: string;
  displayName: string;
  relationship: string;
  status: CaregiverStatus;
  alertOnMissed: boolean;
  /** Only present while the invitation is still pending. */
  inviteCode: string | null;
  hasAccount: boolean;
  createdAt: string;
  acceptedAt: string | null;
}

/** The same link as the caregiver sees it: someone they watch over. */
export interface PatientLink {
  id: string;
  patientName: string;
  patientEmail: string;
  relationship: string;
  status: CaregiverStatus;
  unreadAlerts: number;
  createdAt: string;
}

export interface CaregiverAlert {
  id: string;
  linkId: string;
  patientName: string;
  medicineName: string;
  dosage: string;
  date: string;
  time: string;
  kind: "missed" | "unconfirmed";
  message: string;
  createdAt: string;
  readAt: string | null;
}

/** The caregiver's view of one patient: their report plus the alerts raised. */
export interface PatientReport extends Report {
  link: PatientLink;
  alerts: CaregiverAlert[];
}

// ---------------------------------------------------------------------------
// Scanner  (POST /api/catalog/scan/)
// ---------------------------------------------------------------------------

/** One medicine read off a box or prescription — a suggestion, never a save. */
export interface ScannedMedicine {
  line: string;
  name: string;
  strength: string;
  form: string;
  dosage: string;
  frequency: string;
  times: string[];
  mealRelation: MealRelation;
  durationDays: number | null;
  catalogId: string | null;
  /** 0..1 — how much of the line was understood. */
  confidence: number;
}

export interface ScanResult {
  text: string;
  medicines: ScannedMedicine[];
  count: number;
  /** Whether this server can read a photograph, or only typed-out text. */
  imageSupported: boolean;
}
