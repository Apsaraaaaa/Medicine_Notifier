export interface User {
  id: string;
  name: string;
  email: string;
}

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
}
