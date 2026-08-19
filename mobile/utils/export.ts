import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { HistoryEntry } from "../types";
import { todayISO } from "./date";

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Writes the dose history to a CSV file in the cache and hands it to the
 * system share sheet, which is how a phone "downloads" a file. Returns how
 * many rows were written so the caller can report the result (0 = nothing to
 * export).
 */
export async function exportHistoryCsv(history: HistoryEntry[]): Promise<number> {
  if (history.length === 0) return 0;

  const header = ["Date", "Time", "Medicine", "Dosage", "Status", "Recorded at", "Note"];
  const rows = [...history]
    .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))
    .map((h) =>
      [h.date, h.time, h.medicineName, h.dosage, h.status, h.recordedAt, h.note ?? ""]
        .map(csvCell)
        .join(",")
    );

  const file = new File(Paths.cache, `medicine-history-${todayISO()}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write([header.join(","), ...rows].join("\r\n"));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/csv",
      dialogTitle: "Export dose history",
      UTI: "public.comma-separated-values-text",
    });
  }

  return rows.length;
}
