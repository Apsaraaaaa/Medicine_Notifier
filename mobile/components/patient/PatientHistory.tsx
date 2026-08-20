import { MaterialIcons } from "@expo/vector-icons";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PATIENT_SIZES, PATIENT_TYPE, RADIUS } from "../../constants/theme";
import { useApp, useTheme } from "../../context/AppContext";
import { prettyDate, todayISO, weekdayShort } from "../../utils/date";
import { buildDailyStats, type DayStats } from "../../utils/insights";
import type { IconName } from "../ui";

/**
 * History in Patient Mode: what was taken, and what was missed.
 *
 * The full History screen answers "how am I doing?" with an adherence ring, a
 * trend against the previous period, a chart and three range options. That is
 * the right screen for somebody deciding whether to change a prescription, and
 * the wrong one for somebody who just wants to know whether they took
 * yesterday's tablet.
 *
 * So this shows two things and stops: the week as one line, and each of the
 * last seven days as a row you can read at a glance. No percentages, no
 * verdicts, no ranges to choose between. The numbers come from
 * `buildDailyStats` — the same maths the full screen and the report use, so
 * these two screens can never disagree about the same day.
 */
export function PatientHistory() {
  const { medicines, history, refresh, refreshing, t } = useApp();
  const c = useTheme();
  const insets = useSafeAreaInsets();

  const days = buildDailyStats(medicines, history, 7);
  // Only days that actually had doses can be kept to, so a day off the
  // medicine never counts against the week.
  const scheduled = days.filter((d) => d.expected > 0);
  const taken = scheduled.reduce((n, d) => n + d.taken, 0);
  const expected = scheduled.reduce((n, d) => n + d.expected, 0);
  const missed = scheduled.reduce((n, d) => n + d.missed, 0);

  // Newest first: "did I take it yesterday?" is the question being asked, and
  // the answer should not be at the bottom of the screen.
  const rows = [...days].reverse();

  return (
    <ScrollView
      style={{ backgroundColor: c.canvas }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} />
      }
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: c.ink }]}>{t("nav.history")}</Text>
      </View>

      {expected === 0 ? (
        <View style={{ paddingHorizontal: 16 }}>
          <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.line }]}>
            <MaterialIcons name="history" size={72} color={c.ink3} />
            <Text style={[styles.emptyTitle, { color: c.ink }]}>{t("patient.noHistory")}</Text>
            <Text style={[styles.emptyBody, { color: c.ink2 }]}>{t("patient.noHistoryHint")}</Text>
          </View>
        </View>
      ) : (
        <>
          {/* ---- the week, in one sentence ---- */}
          <View style={{ paddingHorizontal: 16 }}>
            <View style={[styles.weekCard, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[styles.weekLabel, { color: c.ink2 }]}>
                {t("patient.thisWeek")}
              </Text>
              <Text style={[styles.weekBig, { color: c.ink }]}>
                {t("patient.takenOf", { taken, total: expected })}
              </Text>
              {missed > 0 ? (
                <View style={styles.weekMissedRow}>
                  <MaterialIcons name="cancel" size={PATIENT_SIZES.icon} color={c.badInk} />
                  <Text style={[styles.weekMissed, { color: c.badInk }]}>
                    {t("patient.missedCount", { count: missed })}
                  </Text>
                </View>
              ) : (
                <View style={styles.weekMissedRow}>
                  <MaterialIcons name="check-circle" size={PATIENT_SIZES.icon} color={c.okInk} />
                  <Text style={[styles.weekMissed, { color: c.okInk }]}>
                    {t("patient.noneMissed")}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ---- day by day ---- */}
          <Text style={[styles.section, { color: c.ink2 }]}>{t("patient.dayByDay")}</Text>
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {rows.map((day) => (
              <DayRow key={day.date} day={day} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** One day: a big mark, the day's name, and how many doses went to plan. */
function DayRow({ day }: { day: DayStats }) {
  const c = useTheme();
  const { t } = useApp();

  const isToday = day.date === todayISO();
  const nothing = day.expected === 0;
  const perfect = !nothing && day.taken === day.expected;
  const anyMissed = day.missed > 0;

  const icon: IconName = nothing
    ? "remove"
    : perfect
      ? "check-circle"
      : anyMissed
        ? "cancel"
        : "schedule";
  const soft = nothing ? "surface2" : perfect ? "okSoft" : anyMissed ? "badSoft" : "warnSoft";
  const ink = nothing ? "ink3" : perfect ? "okInk" : anyMissed ? "badInk" : "warnInk";

  const summary = nothing
    ? t("patient.nothingThatDay")
    : t("patient.takenOf", { taken: day.taken, total: day.expected });

  return (
    <View
      accessible
      accessibilityLabel={`${isToday ? t("common.today") : prettyDate(day.date)}. ${summary}`}
      style={[styles.dayRow, { backgroundColor: c.surface, borderColor: c.line }]}
    >
      <View style={[styles.dayMark, { backgroundColor: c[soft] }]}>
        <MaterialIcons name={icon} size={PATIENT_SIZES.statusIcon} color={c[ink]} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.dayName, { color: c.ink }]} numberOfLines={1}>
          {isToday ? t("common.today") : weekdayShort(day.date)}
        </Text>
        <Text style={[styles.dayDate, { color: c.ink3 }]} numberOfLines={1}>
          {prettyDate(day.date)}
        </Text>
        <Text style={[styles.daySummary, { color: c[ink] }]} numberOfLines={1}>
          {summary}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  title: { fontSize: PATIENT_TYPE.headline, fontWeight: "800" },

  weekCard: { borderRadius: RADIUS.card, borderWidth: 1, padding: 22, alignItems: "center" },
  weekLabel: { fontSize: PATIENT_TYPE.small, fontWeight: "800", letterSpacing: 1.5 },
  weekBig: { fontSize: PATIENT_TYPE.title, fontWeight: "800", marginTop: 8, textAlign: "center" },
  weekMissedRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  weekMissed: { fontSize: PATIENT_TYPE.body, fontWeight: "800" },

  section: {
    fontSize: PATIENT_TYPE.small,
    fontWeight: "800",
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    marginTop: 28,
    marginBottom: 12,
  },

  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 100,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 16,
  },
  dayMark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  dayName: { fontSize: PATIENT_TYPE.bodyLg, fontWeight: "800" },
  dayDate: { fontSize: PATIENT_TYPE.small, marginTop: 2 },
  daySummary: { fontSize: PATIENT_TYPE.body, fontWeight: "700", marginTop: 6 },

  empty: {
    alignItems: "center",
    borderRadius: RADIUS.card,
    borderWidth: 1,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: PATIENT_TYPE.title,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 16,
  },
  emptyBody: { fontSize: PATIENT_TYPE.body, textAlign: "center", marginTop: 8 },
});
