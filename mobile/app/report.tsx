import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { ReportTrendChart } from "../components/ReportTrendChart";
import {
  AdherenceRing,
  AppHeader,
  Button,
  Card,
  EmptyState,
  SectionTitle,
  Segmented,
  StatusBadge,
  T,
} from "../components/ui";
import { LATE_AFTER_MINUTES, RADIUS } from "../constants/theme";
import { useApp, useTheme } from "../context/AppContext";
import * as api from "../services/api";
import type { Report, ReportRange } from "../types";
import { dateTime, prettyDate } from "../utils/date";
import { adherenceVerdict } from "../utils/insights";
import { exportReportCsv, exportReportPdf } from "../utils/report";

/**
 * The medicine report.
 *
 * Every figure comes from the server (`GET /api/reports/`) rather than being
 * recomputed here, for one reason: a caregiver looking at the same person sees
 * the same endpoint, and an exported PDF has to agree with both. One
 * calculation, three readers.
 */
export default function ReportScreen() {
  const { t } = useApp();
  const c = useTheme();
  const router = useRouter();

  const [range, setRange] = useState<ReportRange>("week");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(
    async (next: ReportRange, showSpinner = true) => {
      if (showSpinner) setLoading(true);
      setError("");
      try {
        setReport(await api.getReport(next));
      } catch {
        setError(t("report.loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    load(range);
  }, [range, load]);

  const doExport = async (kind: "pdf" | "csv") => {
    if (!report) return;
    setExporting(kind);
    setMessage("");
    try {
      const written =
        kind === "pdf" ? await exportReportPdf(report) : await exportReportCsv(report);
      setMessage(
        !written
          ? t("report.exportEmpty")
          : t(kind === "pdf" ? "report.exportedPdf" : "report.exportedCsv")
      );
    } catch {
      setMessage(t("report.exportFailed"));
    } finally {
      setExporting(null);
    }
  };

  const summary = report?.summary;
  const hasData = !!summary && summary.expected > 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader
        title={t("report.title")}
        subtitle={t("report.subtitle")}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => load(range, false)}
            tintColor={c.brand}
          />
        }
      >
        <Segmented
          label={t("history.range")}
          value={range}
          onChange={setRange}
          options={[
            { key: "week", label: t("history.week") },
            { key: "month", label: t("history.month") },
            { key: "all", label: t("common.all") },
          ]}
        />

        {loading && !report ? (
          <View style={{ paddingVertical: 48 }}>
            <ActivityIndicator color={c.brand} size="large" />
            <T tone="ink3" center style={{ marginTop: 12 }}>
              {t("common.loading")}
            </T>
          </View>
        ) : error && !report ? (
          <Card style={{ marginTop: 16 }}>
            <EmptyState
              icon="cloud-off"
              title={t("report.loadFailed")}
              action={
                <Button icon="refresh" onPress={() => load(range)}>
                  {t("common.retry")}
                </Button>
              }
            />
          </Card>
        ) : !hasData ? (
          <Card style={{ marginTop: 16 }}>
            <EmptyState
              icon="summarize"
              title={t("report.noData")}
              subtitle={t("report.noDataHint")}
            />
          </Card>
        ) : (
          <>
            {/* ---- headline ---- */}
            <Card style={{ marginTop: 16 }}>
              <View style={styles.summaryRow}>
                <AdherenceRing
                  size={84}
                  stroke={10}
                  value={summary.adherence === null ? null : summary.adherence / 100}
                  label={t("report.dosesTaken", {
                    taken: summary.taken,
                    expected: summary.expected,
                  })}
                >
                  <Text style={{ fontSize: 22, fontWeight: "800", color: c.ink }}>
                    {summary.adherence === null ? "—" : `${summary.adherence}%`}
                  </Text>
                </AdherenceRing>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={22} weight="800" numberOfLines={1}>
                    {t(adherenceVerdict(summary.adherence))}
                  </T>
                  <T size={15} tone="ink2">
                    {t("report.dosesTaken", {
                      taken: summary.taken,
                      expected: summary.expected,
                    })}
                  </T>
                  {report?.trend && (
                    <View style={styles.trendRow}>
                      <MaterialIcons
                        name={
                          report.trend.delta === 0
                            ? "trending-flat"
                            : report.trend.delta > 0
                              ? "trending-up"
                              : "trending-down"
                        }
                        size={18}
                        color={c.brandInk}
                      />
                      <T size={15} weight="700" tone="brandInk">
                        {t("history.trendVs", {
                          delta: `${report.trend.delta > 0 ? "+" : ""}${report.trend.delta}`,
                          days: report.trend.days,
                        })}
                      </T>
                    </View>
                  )}
                </View>
              </View>

              <T size={15} tone="ink3" style={{ marginTop: 14 }}>
                {t("report.period", {
                  from: prettyDate(report!.from),
                  to: prettyDate(report!.to),
                })}
              </T>
            </Card>

            {/* ---- the five counts ---- */}
            <View style={styles.counts}>
              <Count label={t("report.scheduled")} value={summary.expected} tone="ink" />
              <Count label={t("report.taken")} value={summary.taken} tone="okInk" />
              <Count label={t("report.late")} value={summary.late} tone="warnInk" />
              <Count label={t("report.missed")} value={summary.missed} tone="badInk" />
              <Count label={t("report.skipped")} value={summary.skipped} tone="ink3" />
            </View>

            {summary.late > 0 && (
              <View style={[styles.note, { backgroundColor: c.warnSoft }]}>
                <MaterialIcons name="schedule" size={20} color={c.warnInk} />
                <T size={15} weight="600" tone="warnInk" style={{ flex: 1 }}>
                  {t("report.lateNote", {
                    count: summary.late,
                    minutes: LATE_AFTER_MINUTES,
                  })}
                </T>
              </View>
            )}

            {/* ---- trends ---- */}
            <View style={{ marginTop: 24 }}>
              <SectionTitle>{t("report.trends")}</SectionTitle>
              <Card style={{ gap: 22 }}>
                <ReportTrendChart title={t("report.weekly")} buckets={report!.weekly} />
                <ReportTrendChart title={t("report.monthly")} buckets={report!.monthly} />
              </Card>
            </View>

            {/* ---- per medicine ---- */}
            {report!.medicines.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <SectionTitle>{t("report.byMedicine")}</SectionTitle>
                <Card padded={false}>
                  {report!.medicines.map((m, i) => (
                    <View
                      key={m.id}
                      style={[
                        styles.medRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: c.line },
                      ]}
                    >
                      <View style={[styles.swatch, { backgroundColor: m.color || c.brand }]} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.medTitle}>
                          <T size={17} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
                            {m.name}
                          </T>
                          {m.critical && (
                            <StatusBadge
                              icon="priority-high"
                              label={t("medicines.important")}
                              bg={c.warnSoft}
                              fg={c.warnInk}
                            />
                          )}
                        </View>
                        <T size={15} tone="ink3" numberOfLines={1}>
                          {m.dosage}
                        </T>
                        <T size={15} tone="ink2">
                          {t("report.dosesTaken", { taken: m.taken, expected: m.expected })}
                          {m.missed > 0 ? ` · ${m.missed} ${t("report.missed").toLowerCase()}` : ""}
                        </T>
                      </View>
                      <T
                        size={19}
                        weight="800"
                        tone={
                          m.adherence === null
                            ? "ink3"
                            : m.adherence >= 80
                              ? "okInk"
                              : m.adherence >= 50
                                ? "warnInk"
                                : "badInk"
                        }
                      >
                        {m.adherence === null ? "—" : `${m.adherence}%`}
                      </T>
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {/* ---- export ---- */}
            <View style={{ marginTop: 24 }}>
              <SectionTitle>{t("report.export")}</SectionTitle>
              <Card style={{ gap: 12 }}>
                <Button
                  icon="picture-as-pdf"
                  loading={exporting === "pdf"}
                  onPress={() => doExport("pdf")}
                >
                  {t("report.exportPdf")}
                </Button>
                <Button
                  variant="secondary"
                  icon="table-view"
                  loading={exporting === "csv"}
                  onPress={() => doExport("csv")}
                >
                  {t("report.exportCsv")}
                </Button>
                {message ? (
                  <T size={15} weight="600" tone="okInk" center>
                    {message}
                  </T>
                ) : null}
                <T size={15} tone="ink3" center>
                  {t("report.generated", { when: dateTime(report!.generatedAt) })}
                </T>
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** One number with its word underneath. Five of these are the whole summary. */
function Count({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ink" | "ink3" | "okInk" | "warnInk" | "badInk";
}) {
  const c = useTheme();
  return (
    <View style={[styles.count, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: c[tone] }}>{value}</Text>
      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: c.ink3 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  counts: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  count: {
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    gap: 2,
    borderRadius: RADIUS.field,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: RADIUS.field,
    padding: 14,
    marginTop: 12,
  },
  medRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  medTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 10, height: 44, borderRadius: 5 },
});
