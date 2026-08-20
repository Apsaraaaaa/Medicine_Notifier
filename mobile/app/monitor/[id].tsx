import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ReportTrendChart } from "../../components/ReportTrendChart";
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
  type IconName,
} from "../../components/ui";
import { RADIUS, STATUS_META } from "../../constants/theme";
import { useApp, useTheme } from "../../context/AppContext";
import * as api from "../../services/api";
import type { PatientReport, ReportRange, ReportSlot } from "../../types";
import { dateTime, formatTime12, prettyDate } from "../../utils/date";
import { adherenceVerdict } from "../../utils/insights";
import { exportReportCsv, exportReportPdf } from "../../utils/report";

const STATUS_ICON: Record<ReportSlot["status"], IconName> = {
  taken: "check-circle",
  due: "notifications-active",
  upcoming: "radio-button-unchecked",
  skipped: "remove-circle-outline",
  missed: "warning-amber",
};

/**
 * One patient, as their caregiver sees them.
 *
 * Read-only by construction, not by convention: this screen only ever calls
 * `GET /api/caregivers/patients/<id>/`, and the API grants nothing else. There
 * is no action here that could change the patient's medicines or answer a dose
 * on their behalf — a caregiver watching over someone must not be able to
 * record that a tablet was taken when they did not see it happen.
 */
export default function MonitorPatientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, markAlertRead, refreshCaregiving } = useApp();
  const c = useTheme();
  const router = useRouter();

  const [range, setRange] = useState<ReportRange>("week");
  const [report, setReport] = useState<PatientReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);

  const load = useCallback(
    async (next: ReportRange, spinner = true) => {
      if (spinner) setLoading(true);
      setError(false);
      try {
        setReport(await api.getPatientReport(String(id), next));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load(range);
  }, [range, load]);

  const reload = async () => {
    setRefreshing(true);
    await load(range, false);
    await refreshCaregiving();
    setRefreshing(false);
  };

  const doExport = async (kind: "pdf" | "csv") => {
    if (!report) return;
    setExporting(kind);
    try {
      if (kind === "pdf") await exportReportPdf(report);
      else await exportReportCsv(report);
    } catch {
      // Sharing was dismissed or the file could not be written; nothing to undo.
    } finally {
      setExporting(null);
    }
  };

  const summary = report?.summary;
  const unread = (report?.alerts ?? []).filter((a) => !a.readAt);

  if (loading && !report) {
    return (
      <View style={{ flex: 1, backgroundColor: c.canvas }}>
        <AppHeader title={t("care.viewPatient")} onBack={() => router.back()} />
        <View style={{ paddingVertical: 60 }}>
          <ActivityIndicator color={c.brand} size="large" />
        </View>
      </View>
    );
  }

  if (error && !report) {
    return (
      <View style={{ flex: 1, backgroundColor: c.canvas }}>
        <AppHeader title={t("care.viewPatient")} onBack={() => router.back()} />
        <View style={{ padding: 16 }}>
          <Card>
            <EmptyState
              icon="cloud-off"
              title={t("care.loadFailed")}
              action={
                <Button icon="refresh" onPress={() => load(range)}>
                  {t("common.retry")}
                </Button>
              }
            />
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader
        title={t("care.patientTitle", { name: report?.patient.name ?? "" })}
        subtitle={report?.patient.email}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={c.brand} />
        }
      >
        {/* Stated up front, because a screen full of someone else's medical
            data should say what it is before it says anything else. */}
        <View style={[styles.readOnly, { backgroundColor: c.brandSoft }]}>
          <MaterialIcons name="visibility" size={20} color={c.brandInk} />
          <T size={15} weight="600" tone="brandInk" style={{ flex: 1 }}>
            {t("care.readOnly")}
          </T>
        </View>

        {/* ---- alerts first: they are why you opened this ---- */}
        {unread.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <SectionTitle>{t("care.alerts")}</SectionTitle>
            <View style={{ gap: 10 }}>
              {unread.map((alert) => (
                <Pressable
                  key={alert.id}
                  accessibilityRole="button"
                  accessibilityLabel={alert.message}
                  onPress={() => markAlertRead(alert.id)}
                  style={({ pressed }) => [
                    styles.alert,
                    { backgroundColor: pressed ? c.surface2 : c.badSoft },
                  ]}
                >
                  <MaterialIcons name="warning-amber" size={24} color={c.badInk} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T size={16} weight="700" tone="badInk">
                      {alert.message}
                    </T>
                    <T size={15} tone="badInk">
                      {prettyDate(alert.date)} · {formatTime12(alert.time)}
                    </T>
                  </View>
                  <MaterialIcons name="check" size={22} color={c.badInk} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={{ marginTop: 16 }}>
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
        </View>

        {/* ---- adherence ---- */}
        {summary && summary.expected > 0 ? (
          <>
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
                  <T size={15} tone="ink3">
                    {summary.missed} {t("report.missed").toLowerCase()} ·{" "}
                    {summary.late} {t("report.late").toLowerCase()}
                  </T>
                </View>
              </View>
            </Card>

            <View style={{ marginTop: 20 }}>
              <SectionTitle>{t("report.trends")}</SectionTitle>
              <Card style={{ gap: 22 }}>
                <ReportTrendChart title={t("report.weekly")} buckets={report!.weekly} />
                <ReportTrendChart title={t("report.monthly")} buckets={report!.monthly} />
              </Card>
            </View>
          </>
        ) : (
          <Card style={{ marginTop: 16 }}>
            <EmptyState
              icon="summarize"
              title={t("report.noData")}
              subtitle={t("report.noDataHint")}
            />
          </Card>
        )}

        {/* ---- today ---- */}
        <View style={{ marginTop: 24 }}>
          <SectionTitle>{t("care.todaysDoses")}</SectionTitle>
          {(report?.today ?? []).length === 0 ? (
            <Card>
              <T tone="ink2" center style={{ paddingVertical: 16 }}>
                {t("care.nothingToday")}
              </T>
            </Card>
          ) : (
            <Card padded={false}>
              {report!.today.map((slot, i) => {
                const meta = STATUS_META[slot.status];
                return (
                  <View
                    key={`${slot.medicineId}-${slot.time}`}
                    style={[
                      styles.slot,
                      i > 0 && { borderTopWidth: 1, borderTopColor: c.line },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T size={15} weight="700" tone="ink2">
                        {formatTime12(slot.time)}
                      </T>
                      <View style={styles.slotTitle}>
                        <T size={17} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
                          {slot.medicineName}
                        </T>
                        {slot.critical && (
                          <MaterialIcons name="priority-high" size={18} color={c.warnInk} />
                        )}
                      </View>
                      <T size={15} tone="ink3" numberOfLines={1}>
                        {[
                          slot.dosage,
                          slot.mealRelation === "none" ? "" : t(`meal.${slot.mealRelation}`),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </T>
                    </View>
                    <StatusBadge
                      icon={STATUS_ICON[slot.status]}
                      label={slot.late ? t("status.late") : t(meta.label)}
                      bg={slot.late ? c.warnSoft : c[meta.soft]}
                      fg={slot.late ? c.warnInk : c[meta.ink]}
                    />
                  </View>
                );
              })}
            </Card>
          )}
        </View>

        {/* ---- per medicine ---- */}
        {(report?.medicines ?? []).length > 0 && (
          <View style={{ marginTop: 24 }}>
            <SectionTitle>{t("report.byMedicine")}</SectionTitle>
            <Card padded={false}>
              {report!.medicines.map((m, i) => (
                <View
                  key={m.id}
                  style={[styles.slot, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}
                >
                  <View style={[styles.swatch, { backgroundColor: m.color || c.brand }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T size={17} weight="700" numberOfLines={1}>
                      {m.name}
                    </T>
                    <T size={15} tone="ink3" numberOfLines={1}>
                      {m.dosage}
                    </T>
                    <T size={15} tone="ink2">
                      {t("report.dosesTaken", { taken: m.taken, expected: m.expected })}
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

        {/* A caregiver is usually the person who takes the report to the
            doctor, so the same export lives here too. */}
        {summary && summary.expected > 0 && (
          <View style={{ marginTop: 24, gap: 12 }}>
            <SectionTitle>{t("report.export")}</SectionTitle>
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
            {report && (
              <T size={15} tone="ink3" center>
                {t("report.generated", { when: dateTime(report.generatedAt) })}
              </T>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  readOnly: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: RADIUS.field,
    padding: 14,
  },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: RADIUS.field,
    padding: 14,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  slot: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  slotTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 44, borderRadius: 5 },
});
