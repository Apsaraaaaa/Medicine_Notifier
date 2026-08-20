/**
 * Turning a report into something you can hand to somebody.
 *
 * Both exports are built from the same `Report` the screen is rendering, so a
 * PDF and the figures on screen can never disagree — there is no second
 * calculation anywhere.
 *
 * A note on language: the CSV and the PDF are written in English whatever the
 * app is set to. A CSV goes into a spreadsheet and a PDF goes to a doctor or a
 * pharmacy, and both are far more useful with stable column names; the PDF
 * additionally cannot render Devanagari without an embedded font (see utils/pdf).
 *
 * That is why every date here goes through `enDate` / `enMonth` rather than
 * `prettyDate`. `prettyDate` follows the reader's language, which is right on
 * screen and wrong here: in Nepali it returns Devanagari, and the PDF writer
 * would strip it to bare punctuation on the way into the file.
 */

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { LATE_AFTER_MINUTES } from "../constants/theme";
import type { Report, ReportBucket } from "../types";
import { enDate, enMonth, formatTime12 } from "./date";
import { buildPdf, type PdfBlock } from "./pdf";

const RANGE_TITLE: Record<string, string> = {
  week: "Last 7 days",
  month: "Last 30 days",
  all: "All time",
};

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function percent(value: number | null): string {
  return value === null ? "-" : `${value}%`;
}

function bucketLabel(bucket: ReportBucket): string {
  // A month bucket's label is "2026-08"; anything else is a real date.
  if (bucket.label.length === 7) return enMonth(`${bucket.label}-01`);
  return enDate(bucket.date);
}

async function writeAndShare(name: string, body: string, mimeType: string, uti: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(body);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: "Medicine report", UTI: uti });
  }
  return file.uri;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Three sections in one file — summary, per-medicine, per-day — separated by
 * blank lines. A spreadsheet opens it as one sheet and every figure on the
 * report screen is in there, which is what somebody exporting it actually wants.
 */
export function reportToCsv(report: Report): string {
  const s = report.summary;
  const rows: string[] = [];

  rows.push(["Medicine report"].map(csvCell).join(","));
  rows.push(["Patient", report.patient?.name ?? ""].map(csvCell).join(","));
  rows.push(["Period", `${report.from} to ${report.to}`].map(csvCell).join(","));
  rows.push(["Range", RANGE_TITLE[report.range] ?? report.range].map(csvCell).join(","));
  rows.push(["Generated", new Date(report.generatedAt).toISOString()].map(csvCell).join(","));
  rows.push("");

  rows.push(["Summary", "Count"].map(csvCell).join(","));
  rows.push(["Scheduled doses", s.expected].map(csvCell).join(","));
  rows.push(["Taken", s.taken].map(csvCell).join(","));
  rows.push(["Taken on time", s.onTime].map(csvCell).join(","));
  rows.push([`Taken late (over ${LATE_AFTER_MINUTES} min)`, s.late].map(csvCell).join(","));
  rows.push(["Missed", s.missed].map(csvCell).join(","));
  rows.push(["Skipped", s.skipped].map(csvCell).join(","));
  rows.push(["Still pending", s.pending].map(csvCell).join(","));
  rows.push(["Adherence", percent(s.adherence)].map(csvCell).join(","));
  if (report.trend) {
    rows.push(
      ["Change vs previous period", `${report.trend.delta > 0 ? "+" : ""}${report.trend.delta}%`]
        .map(csvCell)
        .join(",")
    );
  }
  rows.push("");

  rows.push(
    ["Medicine", "Dosage", "Important", "Scheduled", "Taken", "Late", "Missed", "Skipped", "Adherence"]
      .map(csvCell)
      .join(",")
  );
  for (const m of report.medicines) {
    rows.push(
      [m.name, m.dosage, m.critical ? "yes" : "no", m.expected, m.taken, m.late, m.missed, m.skipped, percent(m.adherence)]
        .map(csvCell)
        .join(",")
    );
  }
  rows.push("");

  rows.push(["Date", "Scheduled", "Taken", "Late", "Missed", "Skipped", "Pending"].map(csvCell).join(","));
  for (const d of report.daily) {
    rows.push(
      [d.date, d.expected, d.taken, d.late, d.missed, d.skipped, d.pending].map(csvCell).join(",")
    );
  }

  return rows.join("\r\n");
}

export async function exportReportCsv(report: Report): Promise<boolean> {
  if (report.summary.expected === 0) return false;
  await writeAndShare(
    `medicine-report-${report.to}.csv`,
    reportToCsv(report),
    "text/csv",
    "public.comma-separated-values-text"
  );
  return true;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export function reportToPdfBlocks(report: Report): PdfBlock[] {
  const s = report.summary;
  const blocks: PdfBlock[] = [
    { kind: "text", text: "MEDICINE NOTIFIER", size: 9, font: "bold" },
    { kind: "heading", text: "Medicine report", size: 22 },
  ];

  if (report.patient?.name) {
    blocks.push({ kind: "text", text: report.patient.name, size: 12, font: "bold" });
  }
  blocks.push({
    kind: "text",
    text: `${RANGE_TITLE[report.range] ?? report.range} — ${enDate(report.from)} to ${enDate(report.to)}`,
    size: 10,
  });
  blocks.push({
    kind: "text",
    text: `Generated ${new Date(report.generatedAt).toLocaleString("en-US")}`,
    size: 9,
  });
  blocks.push({ kind: "rule" });

  // --- headline ---
  blocks.push({ kind: "heading", text: "Adherence" });
  blocks.push({
    kind: "text",
    text: `${percent(s.adherence)} of scheduled doses were taken — ${s.taken} of ${s.expected}.`,
    size: 12,
  });
  if (report.trend) {
    const direction = report.trend.delta > 0 ? "up" : report.trend.delta < 0 ? "down" : "unchanged";
    blocks.push({
      kind: "text",
      text:
        report.trend.delta === 0
          ? `Unchanged against the previous ${report.trend.days} days (${report.trend.previous}%).`
          : `That is ${direction} ${Math.abs(report.trend.delta)} points against the previous ${report.trend.days} days (${report.trend.previous}%).`,
      size: 10,
    });
  }

  blocks.push({ kind: "gap", height: 6 });
  const cols = [0.34, 0.16, 0.16, 0.17, 0.17];
  blocks.push({
    kind: "row",
    cells: ["", "Taken", "Late", "Missed", "Skipped"],
    widths: cols,
    font: "bold",
  });
  blocks.push({
    kind: "row",
    cells: [
      `${s.expected} scheduled`,
      String(s.taken),
      String(s.late),
      String(s.missed),
      String(s.skipped),
    ],
    widths: cols,
  });
  if (s.late > 0) {
    blocks.push({ kind: "gap", height: 4 });
    blocks.push({
      kind: "text",
      text: `${s.late} of the taken doses were confirmed more than ${LATE_AFTER_MINUTES} minutes after their reminder.`,
      size: 9.5,
    });
  }

  // --- per medicine ---
  if (report.medicines.length) {
    blocks.push({ kind: "rule" });
    blocks.push({ kind: "heading", text: "By medicine" });
    const mcols = [0.36, 0.26, 0.12, 0.1, 0.16];
    blocks.push({
      kind: "row",
      cells: ["Medicine", "Dosage", "Taken", "Missed", "Adherence"],
      widths: mcols,
      font: "bold",
    });
    for (const m of report.medicines) {
      blocks.push({
        kind: "row",
        cells: [
          m.critical ? `${m.name} *` : m.name,
          m.dosage,
          `${m.taken}/${m.expected}`,
          String(m.missed),
          percent(m.adherence),
        ],
        widths: mcols,
      });
    }
    if (report.medicines.some((m) => m.critical)) {
      blocks.push({ kind: "gap", height: 4 });
      blocks.push({ kind: "text", text: "* Marked important — a caregiver is alerted if a dose goes unanswered.", size: 9 });
    }
  }

  // --- trends ---
  const trendSection = (title: string, buckets: ReportBucket[]) => {
    const active = buckets.filter((b) => b.expected > 0);
    if (active.length === 0) return;
    blocks.push({ kind: "heading", text: title, size: 13 });
    const tcols = [0.4, 0.2, 0.2, 0.2];
    blocks.push({
      kind: "row",
      cells: ["Period", "Scheduled", "Taken", "Adherence"],
      widths: tcols,
      font: "bold",
    });
    for (const b of active) {
      blocks.push({
        kind: "row",
        cells: [
          bucketLabel(b),
          String(b.expected),
          String(b.taken),
          percent(b.expected ? Math.round((b.taken / b.expected) * 100) : null),
        ],
        widths: tcols,
      });
    }
    blocks.push({ kind: "gap", height: 8 });
  };

  blocks.push({ kind: "rule" });
  blocks.push({ kind: "heading", text: "Trends" });
  trendSection("Weekly", report.weekly);
  trendSection("Monthly", report.monthly);

  // --- the day-by-day record ---
  const days = report.daily.filter((d) => d.expected > 0);
  if (days.length) {
    blocks.push({ kind: "pageBreak" });
    blocks.push({ kind: "heading", text: "Day by day" });
    const dcols = [0.28, 0.16, 0.14, 0.14, 0.14, 0.14];
    blocks.push({
      kind: "row",
      cells: ["Date", "Scheduled", "Taken", "Late", "Missed", "Skipped"],
      widths: dcols,
      font: "bold",
    });
    for (const d of days) {
      blocks.push({
        kind: "row",
        cells: [
          enDate(d.date),
          String(d.expected),
          String(d.taken),
          String(d.late),
          String(d.missed),
          String(d.skipped),
        ],
        widths: dcols,
      });
    }
  }

  // --- today's plan, so the sheet is useful on its own ---
  if (report.today.length) {
    blocks.push({ kind: "rule" });
    blocks.push({ kind: "heading", text: "Today's schedule" });
    const scols = [0.18, 0.36, 0.26, 0.2];
    blocks.push({
      kind: "row",
      cells: ["Time", "Medicine", "Dosage", "Status"],
      widths: scols,
      font: "bold",
    });
    for (const slot of report.today) {
      blocks.push({
        kind: "row",
        cells: [
          formatTime12(slot.time),
          slot.medicineName,
          slot.dosage,
          slot.late ? "taken (late)" : slot.status,
        ],
        widths: scols,
      });
    }
  }

  blocks.push({ kind: "gap", height: 14 });
  blocks.push({
    kind: "text",
    text: "Adherence counts a dose as taken only when it was confirmed. A skipped dose is a deliberate decision and is reported separately; a dose left unanswered for more than an hour is counted as missed.",
    size: 8.5,
  });

  return blocks;
}

export async function exportReportPdf(report: Report): Promise<boolean> {
  if (report.summary.expected === 0) return false;
  const title = report.patient?.name
    ? `Medicine report - ${report.patient.name}`
    : "Medicine report";
  await writeAndShare(
    `medicine-report-${report.to}.pdf`,
    buildPdf(reportToPdfBlocks(report), title),
    "application/pdf",
    "com.adobe.pdf"
  );
  return true;
}
