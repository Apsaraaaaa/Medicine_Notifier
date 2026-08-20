import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DoseTimeline } from "../../components/DoseTimeline";
import { NextDoseCard } from "../../components/NextDoseCard";
import { PatientHome } from "../../components/patient/PatientHome";
import { StatCard } from "../../components/StatCard";
import {
  AdherenceRing,
  Button,
  Card,
  EmptyState,
  LinkAction,
  SectionTitle,
  T,
} from "../../components/ui";
import { useApp, useTheme, useTodaySlots } from "../../context/AppContext";
import type { TranslationKey } from "../../i18n";
import { longDate } from "../../utils/date";
import { adherenceVerdict } from "../../utils/insights";
import type { DoseSlot } from "../../utils/schedule";

type Filter = "all" | "taken" | "upcoming" | "missed";

const FILTER_LABEL: Record<Exclude<Filter, "all">, TranslationKey> = {
  taken: "status.taken",
  upcoming: "status.upcoming",
  missed: "status.missed",
};

export default function DashboardScreen() {
  const { user, medicines, triggerReminder, refresh, refreshing, patientMode, t } = useApp();
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("all");

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("home.morning");
    if (h < 18) return t("home.afternoon");
    return t("home.evening");
  };

  const slots = useTodaySlots();
  const taken = slots.filter((s) => s.status === "taken").length;
  const upcoming = slots.filter((s) => s.status === "upcoming" || s.status === "due").length;
  const missed = slots.filter((s) => s.status === "missed").length;
  const needsAnswer = slots.filter((s) => s.status === "due" || s.status === "missed");

  const adherence = slots.length > 0 ? Math.round((taken / slots.length) * 100) : null;
  const next =
    slots.find((s) => s.status === "due") ??
    slots.find((s) => s.status === "upcoming") ??
    slots.find((s) => s.status === "missed");
  const allDone = slots.length > 0 && upcoming === 0 && missed === 0;

  const matches = (s: DoseSlot) =>
    filter === "all" ||
    (filter === "taken" && s.status === "taken") ||
    (filter === "upcoming" && (s.status === "upcoming" || s.status === "due")) ||
    (filter === "missed" && s.status === "missed");

  const filtered = slots.filter(matches);

  const answer = (slot: DoseSlot) => triggerReminder(slot.medicine, slot.time);
  const openMedicine = (id: string) => router.push(`/medicine/${id}`);
  const toggle = (key: Filter) => setFilter((f) => (f === key ? "all" : key));
  const filterWord = filter === "all" ? "" : t(FILTER_LABEL[filter]).toLowerCase();

  // Patient Mode replaces this screen wholesale. Everything above still runs
  // and costs nothing — the hooks have to be called unconditionally, and the
  // work is a few array passes over one day of doses.
  if (patientMode) return <PatientHome />;

  return (
    <ScrollView
      style={{ backgroundColor: c.canvas }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} />
      }
    >
      {/* header — a coloured band so the screen opens on something, and so the
          white cards below have an edge to sit against */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.kicker, { color: c.ink3 }]}>{longDate().toUpperCase()}</Text>
          <Text style={[styles.greeting, { color: c.ink2 }]}>{greeting()},</Text>
          <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>
            {user?.name || t("home.friend")}
          </Text>
        </View>

        {needsAnswer.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("home.needsAnswer", { count: needsAnswer.length })}
            onPress={() => answer(needsAnswer[0])}
            style={[styles.bell, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <MaterialIcons name="notifications-active" size={26} color={c.brandInk} />
            <View style={[styles.badge, { backgroundColor: c.badSolid }]}>
              <Text style={{ color: c.onBad, fontSize: 13, fontWeight: "700" }}>
                {needsAnswer.length}
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      {medicines.length === 0 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Card>
            <EmptyState
              icon="event-available"
              title={t("home.noMedicines")}
              subtitle={t("home.noMedicinesHint")}
              action={
                <Button icon="add" onPress={() => router.push("/medicine/new")}>
                  {t("nav.addMedicine")}
                </Button>
              }
            />
          </Card>
        </View>
      ) : (
        <>
          {/* the anchor: what to take next */}
          <View style={{ paddingHorizontal: 16 }}>
            {next ? (
              <NextDoseCard
                slot={next}
                onOpen={() => openMedicine(next.medicine.id)}
                onAnswer={() => answer(next)}
              />
            ) : (
              <Card style={{ backgroundColor: c.okSoft, borderColor: "transparent" }}>
                <View style={styles.doneRow}>
                  <MaterialIcons
                    name={allDone ? "celebration" : "event-available"}
                    size={26}
                    color={allDone ? c.okInk : c.ink3}
                  />
                  <T
                    size={17}
                    weight={allDone ? "600" : "400"}
                    tone={allDone ? "okInk" : "ink2"}
                    style={{ flex: 1 }}
                  >
                    {allDone ? t("home.allDone") : t("home.nothingToday")}
                  </T>
                </View>
              </Card>
            )}
          </View>

          {/* adherence: the ring opens insights, the tiles filter the schedule */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Card style={{ padding: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.openConsistency")}
                onPress={() => router.push("/history")}
                style={styles.ringRow}
              >
                <AdherenceRing
                  size={56}
                  stroke={7}
                  value={adherence === null ? null : adherence / 100}
                  label={
                    adherence === null
                      ? t("home.nothingScheduled")
                      : t("home.dosesTaken", { taken, total: slots.length })
                  }
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: c.ink }}>
                    {adherence === null ? "—" : `${adherence}%`}
                  </Text>
                </AdherenceRing>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={18} weight="700">
                    {t("home.consistency")}
                  </T>
                  <T size={15} tone="ink2" numberOfLines={1}>
                    {adherence === null
                      ? t("home.nothingScheduled")
                      : `${t(adherenceVerdict(adherence))} · ${t("home.dosesTaken", { taken, total: slots.length })}`}
                  </T>
                </View>

                <MaterialIcons name="chevron-right" size={22} color={c.ink3} />
              </Pressable>

              <View style={styles.tiles}>
                <StatCard
                  icon="check-circle"
                  label={t("status.taken")}
                  value={taken}
                  tone="okInk"
                  selected={filter === "taken"}
                  onPress={() => toggle("taken")}
                />
                <StatCard
                  icon="schedule"
                  label={t("status.upcoming")}
                  value={upcoming}
                  tone="brandInk"
                  selected={filter === "upcoming"}
                  onPress={() => toggle("upcoming")}
                />
                <StatCard
                  icon="warning-amber"
                  label={t("status.missed")}
                  value={missed}
                  tone="badInk"
                  selected={filter === "missed"}
                  onPress={() => toggle("missed")}
                />
              </View>
            </Card>
          </View>

          {/* today's schedule */}
          {slots.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <SectionTitle
                action={
                  <LinkAction onPress={() => router.push("/history")}>
                    {t("nav.history")}
                  </LinkAction>
                }
              >
                {t("home.schedule")}
              </SectionTitle>

              {filter !== "all" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("common.clearFilter")}
                  onPress={() => setFilter("all")}
                  style={[styles.clearFilter, { backgroundColor: c.brandSoft }]}
                >
                  <Text style={{ color: c.brandInk, fontWeight: "700", fontSize: 15 }}>
                    {t("home.showingOnly", { filter: filterWord })}
                  </Text>
                  <MaterialIcons name="close" size={18} color={c.brandInk} />
                </Pressable>
              )}

              {filtered.length === 0 ? (
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  <T tone="ink2" center style={{ paddingVertical: 24 }}>
                    {t("home.noneToday", { filter: filterWord })}
                  </T>
                </Card>
              ) : (
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  <DoseTimeline
                    slots={filtered}
                    onOpen={(s) => openMedicine(s.medicine.id)}
                    onAnswer={answer}
                  />
                </Card>
              )}
            </View>
          )}

          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
            <Button variant="secondary" icon="add" onPress={() => router.push("/medicine/new")}>
              {t("nav.addMedicine")}
            </Button>
            <Button variant="secondary" icon="summarize" onPress={() => router.push("/report")}>
              {t("report.open")}
            </Button>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  kicker: { fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  greeting: { fontSize: 17, marginTop: 6 },
  name: { fontSize: 30, fontWeight: "800" },
  bell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ringRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 4 },
  tiles: { flexDirection: "row", gap: 8, marginTop: 10 },
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
});
