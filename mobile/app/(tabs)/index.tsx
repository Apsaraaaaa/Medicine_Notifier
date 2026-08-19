import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DoseTimeline } from "../../components/DoseTimeline";
import { NextDoseCard } from "../../components/NextDoseCard";
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
import { useApp, useTheme } from "../../context/AppContext";
import { adherenceVerdict } from "../../utils/insights";
import { getTodaySlots, type DoseSlot } from "../../utils/schedule";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const todayLabel = () =>
  new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

type Filter = "all" | "taken" | "upcoming" | "missed";

const FILTER_LABEL: Record<Exclude<Filter, "all">, string> = {
  taken: "taken",
  upcoming: "upcoming",
  missed: "missed",
};

export default function DashboardScreen() {
  const { user, medicines, history, triggerReminder, refresh, refreshing } = useApp();
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("all");

  const slots = getTodaySlots(medicines, history);
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
          <Text style={[styles.kicker, { color: c.ink3 }]}>{todayLabel().toUpperCase()}</Text>
          <Text style={[styles.greeting, { color: c.ink2 }]}>{greeting()},</Text>
          <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>
            {user?.name || "Friend"}
          </Text>
        </View>

        {needsAnswer.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${needsAnswer.length} dose${needsAnswer.length > 1 ? "s" : ""} need an answer`}
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
              title="No medicines yet"
              subtitle="Add your first medicine and we'll remind you at the right time, every time."
              action={
                <Button icon="add" onPress={() => router.push("/medicine/new")}>
                  Add medicine
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
                  <T size={17} weight={allDone ? "600" : "400"} tone={allDone ? "okInk" : "ink2"} style={{ flex: 1 }}>
                    {allDone
                      ? "All done for today — nice work staying on track."
                      : "You're all set for today — no doses scheduled."}
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
                accessibilityLabel="Today's consistency. Open history and insights"
                onPress={() => router.push("/history")}
                style={styles.ringRow}
              >
                <AdherenceRing
                  size={56}
                  stroke={7}
                  value={adherence === null ? null : adherence / 100}
                  label={
                    adherence === null
                      ? "No doses scheduled today"
                      : `${adherence}% of today's doses taken`
                  }
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: c.ink }}>
                    {adherence === null ? "—" : `${adherence}%`}
                  </Text>
                </AdherenceRing>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={18} weight="700">
                    Today&apos;s consistency
                  </T>
                  <T size={15} tone="ink2" numberOfLines={1}>
                    {adherence === null
                      ? "Nothing scheduled"
                      : `${adherenceVerdict(adherence)} · ${taken} of ${slots.length} doses`}
                  </T>
                </View>

                <MaterialIcons name="chevron-right" size={22} color={c.ink3} />
              </Pressable>

              <View style={styles.tiles}>
                <StatCard
                  icon="check-circle"
                  label="Taken"
                  value={taken}
                  tone="okInk"
                  selected={filter === "taken"}
                  hint="Show only taken doses"
                  onPress={() => toggle("taken")}
                />
                <StatCard
                  icon="schedule"
                  label="Upcoming"
                  value={upcoming}
                  tone="brandInk"
                  selected={filter === "upcoming"}
                  hint="Show only upcoming doses"
                  onPress={() => toggle("upcoming")}
                />
                <StatCard
                  icon="warning-amber"
                  label="Missed"
                  value={missed}
                  tone="badInk"
                  selected={filter === "missed"}
                  hint="Show only missed doses"
                  onPress={() => toggle("missed")}
                />
              </View>
            </Card>
          </View>

          {/* today's schedule */}
          {slots.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <SectionTitle
                action={<LinkAction onPress={() => router.push("/history")}>History</LinkAction>}
              >
                Today&apos;s schedule
              </SectionTitle>

              {filter !== "all" && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFilter("all")}
                  style={[styles.clearFilter, { backgroundColor: c.brandSoft }]}
                >
                  <Text style={{ color: c.brandInk, fontWeight: "700", fontSize: 15 }}>
                    Showing {FILTER_LABEL[filter]} only
                  </Text>
                  <MaterialIcons name="close" size={18} color={c.brandInk} />
                </Pressable>
              )}

              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {filtered.length === 0 ? (
                  <T tone="ink2" center style={{ paddingVertical: 24 }}>
                    No {FILTER_LABEL[filter as Exclude<Filter, "all">]} doses today.
                  </T>
                ) : (
                  <DoseTimeline
                    slots={filtered}
                    onOpen={(s) => openMedicine(s.medicine.id)}
                    onAnswer={answer}
                  />
                )}
              </Card>
            </View>
          )}

          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Button variant="secondary" icon="add" onPress={() => router.push("/medicine/new")}>
              Add medicine
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
