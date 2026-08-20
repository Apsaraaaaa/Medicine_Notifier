import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { HistoryChart } from "../../components/HistoryChart";
import { PatientHistory } from "../../components/patient/PatientHistory";
import { WeekStrip } from "../../components/WeekStrip";
import {
  AdherenceRing,
  AppHeader,
  Button,
  Card,
  EmptyState,
  SectionTitle,
  Segmented,
  Sheet,
  StatusBadge,
  T,
  type IconName,
} from "../../components/ui";
import { STATUS_META } from "../../constants/theme";
import { useApp, useTheme } from "../../context/AppContext";
import type { HistoryEntry, HistoryStatus } from "../../types";
import { dateTime, formatTime12, prettyDate, todayISO } from "../../utils/date";
import {
  adherenceVerdict,
  bucketize,
  buildDailyStats,
  groupHistory,
  rangeDays,
  summarize,
  trend,
  type RangeKey,
} from "../../utils/insights";

const STATUS_ICON: Record<HistoryStatus, IconName> = {
  taken: "check-circle",
  skipped: "remove-circle-outline",
  missed: "warning-amber",
};

export default function HistoryScreen() {
  const { history, medicines, refresh, refreshing, patientMode, t } = useApp();
  const c = useTheme();
  const router = useRouter();

  const [range, setRange] = useState<RangeKey>("week");
  const [detail, setDetail] = useState<HistoryEntry | null>(null);
  const [day, setDay] = useState<string | null>(null);

  const days = rangeDays(range, medicines, history);
  const weekDays = buildDailyStats(medicines, history, 7);
  const daily = buildDailyStats(medicines, history, days);
  const summary = summarize(daily);
  const buckets = bucketize(daily);
  const movement = trend(medicines, history, range === "all" ? 30 : days);
  const groups = groupHistory(history, days).filter(
    ([date, entries]) => entries.length > 0 && (day === null || date === day)
  );

  const trendIcon: IconName =
    !movement || movement.delta === 0
      ? "trending-flat"
      : movement.delta > 0
        ? "trending-up"
        : "trending-down";

  // Patient Mode replaces the insights screen with "what did I take, what did
  // I miss" — same maths, none of the interpretation.
  if (patientMode) return <PatientHistory />;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader title={t("history.title")} subtitle={t("history.subtitle")} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} />
        }
      >
        {medicines.length > 0 && range === "week" && (
          <Card style={{ marginBottom: 16 }}>
            <SectionTitle>{t("history.thisWeek")}</SectionTitle>
            <WeekStrip days={weekDays} selected={day} onSelect={setDay} />
          </Card>
        )}

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

        {summary.expected === 0 ? (
          <EmptyState
            icon="history"
            title={t("history.empty")}
            subtitle={t("history.emptyHint")}
          />
        ) : (
          <>
            {/* One summary card. The figure, the trend and the three counts
                used to be three stacked cards saying the same thing. */}
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
                  {movement && (
                    <View style={styles.trendRow}>
                      <MaterialIcons name={trendIcon} size={18} color={c.brandInk} />
                      <T size={15} weight="700" tone="brandInk">
                        {t("history.trendVs", {
                          delta: `${movement.delta > 0 ? "+" : ""}${movement.delta}`,
                          days: movement.days,
                        })}
                      </T>
                    </View>
                  )}
                </View>
              </View>

              {/* The week strip above already covers a single week, and one
                  lone bar compares nothing — so the chart appears only when
                  there are periods to compare. */}
              {range !== "week" && buckets.length > 1 && (
                <View style={{ marginTop: 20 }}>
                  <HistoryChart buckets={buckets} />
                </View>
              )}
            </Card>

            {/* daily history */}
            <View style={{ marginTop: 20 }}>
              <SectionTitle>{t("history.doseHistory")}</SectionTitle>

              {day && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDay(null)}
                  style={[styles.clearFilter, { backgroundColor: c.brandSoft }]}
                >
                  <Text style={{ color: c.brandInk, fontWeight: "700", fontSize: 15 }}>
                    {t("history.showingDay", {
                      date: day === todayISO() ? t("common.today") : prettyDate(day),
                    })}
                  </Text>
                  <MaterialIcons name="close" size={18} color={c.brandInk} />
                </Pressable>
              )}

              {groups.length === 0 ? (
                <Card>
                  <T tone="ink2" center style={{ paddingVertical: 16 }}>
                    {day
                      ? t("history.noneOnDay", { date: prettyDate(day) })
                      : t("history.noneInRange")}
                  </T>
                </Card>
              ) : (
                <View style={{ gap: 16 }}>
                  {groups.map(([date, entries]) => (
                    <View key={date}>
                      <T size={15} weight="700" tone="ink3" style={{ marginBottom: 6 }}>
                        {date === todayISO() ? t("common.today") : prettyDate(date)}
                      </T>
                      <Card padded={false}>
                        {entries.map((h, i) => {
                          const meta = STATUS_META[h.status];
                          return (
                            <Pressable
                              key={h.id}
                              accessibilityRole="button"
                              accessibilityLabel={`${h.medicineName} · ${formatTime12(h.time)} · ${t(meta.label)}`}
                              onPress={() => setDetail(h)}
                              style={({ pressed }) => [
                                styles.entry,
                                i > 0 && { borderTopWidth: 1, borderTopColor: c.line },
                                { backgroundColor: pressed ? c.surface2 : "transparent" },
                              ]}
                            >
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <T size={15} weight="700" tone="ink2">
                                  {formatTime12(h.time)}
                                </T>
                                <T size={17} weight="600" numberOfLines={1}>
                                  {h.medicineName}
                                </T>
                                <T size={15} tone="ink3" numberOfLines={1}>
                                  {h.dosage}
                                </T>
                                {h.note ? (
                                  <View style={[styles.note, { borderLeftColor: c.line }]}>
                                    <T size={15} tone="ink2">
                                      {h.note}
                                    </T>
                                  </View>
                                ) : null}
                              </View>

                              <StatusBadge
                                icon={STATUS_ICON[h.status]}
                                label={t(meta.label)}
                                bg={c[meta.soft]}
                                fg={c[meta.ink]}
                              />
                              <MaterialIcons name="chevron-right" size={20} color={c.ink3} />
                            </Pressable>
                          );
                        })}
                      </Card>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {detail && (
        <Sheet title={detail.medicineName} onClose={() => setDetail(null)}>
          <View style={{ gap: 12, paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <StatusBadge
                icon={STATUS_ICON[detail.status]}
                label={t(STATUS_META[detail.status].label)}
                bg={c[STATUS_META[detail.status].soft]}
                fg={c[STATUS_META[detail.status].ink]}
              />
              <T size={15} tone="ink2">
                {prettyDate(detail.date)} · {formatTime12(detail.time)}
              </T>
            </View>

            <T tone="ink2">
              <T weight="700">{t("history.dose")}</T>
              {detail.dosage}
            </T>
            <T size={15} tone="ink3">
              {t("history.answeredAt", { when: dateTime(detail.recordedAt) })}
            </T>

            {detail.note ? (
              <View style={[styles.detailNote, { backgroundColor: c.surface2 }]}>
                <T tone="ink2">{detail.note}</T>
              </View>
            ) : null}

            {medicines.some((m) => m.id === detail.medicineId) && (
              <Button
                variant="secondary"
                icon="medication"
                onPress={() => {
                  const id = detail.medicineId;
                  setDetail(null);
                  router.push(`/medicine/${id}`);
                }}
              >
                {t("history.viewMedicine")}
              </Button>
            )}
          </View>
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  tiles: { flexDirection: "row", gap: 8, marginTop: 16 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  trendIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  clearFilter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    minHeight: 52,
    borderRadius: 999,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  entry: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  note: { marginTop: 4, borderLeftWidth: 2, paddingLeft: 8 },
  detailNote: { borderRadius: 14, padding: 14 },
});
