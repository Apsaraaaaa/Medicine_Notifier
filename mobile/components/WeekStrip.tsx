import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useT, useTheme } from "../context/AppContext";
import type { Palette } from "../constants/theme";
import type { DayStats } from "../utils/insights";
import { prettyDate, todayISO, weekdayShort } from "../utils/date";
import { T, type IconName } from "./ui";

/**
 * The week as seven tick-boxes plus a progress bar.
 *
 * "Did I keep to it that day?" is a yes/no question, so each day is a filled
 * tile with a mark in it rather than a ring to interpret, and the bar counts
 * the days that went to plan. Colour is never the only signal: every tile
 * carries an icon, and the bar is spelled out as "6/7 days".
 */

type DayState = "none" | "complete" | "partial" | "missed" | "today";

const STATE_META: Record<DayState, { fill: keyof Palette; on: keyof Palette; icon: IconName }> = {
  complete: { fill: "brand", on: "onBrand", icon: "check" },
  partial: { fill: "warnSolid", on: "onWarn", icon: "remove" },
  missed: { fill: "badSolid", on: "onBad", icon: "priority-high" },
  today: { fill: "brandSoft", on: "brandInk", icon: "schedule" },
  none: { fill: "brandSoft", on: "ink3", icon: "remove" },
};

function dayState(d: DayStats, isToday: boolean): DayState {
  if (d.expected === 0) return "none";
  if (d.missed > 0) return "missed";
  if (d.taken === d.expected) return "complete";
  if (isToday) return "today";
  return "partial";
}

export function WeekStrip({
  days,
  selected,
  onSelect,
}: {
  /** Oldest first, ending today. */
  days: DayStats[];
  selected: string | null;
  onSelect: (date: string | null) => void;
}) {
  const c = useTheme();
  const t = useT();
  const today = todayISO();

  // Only days that actually had doses can be kept to, so they are the
  // denominator — a day off the medicine shouldn't count against the week.
  const scheduled = days.filter((d) => d.expected > 0);
  const kept = scheduled.filter((d) => d.taken === d.expected && d.missed === 0).length;
  const progress = scheduled.length === 0 ? 0 : kept / scheduled.length;
  const perfect = scheduled.length > 0 && kept === scheduled.length;

  return (
    <View>
      <View style={styles.row} accessibilityLabel={t("history.thisWeek")}>
        {days.map((d) => {
          const isToday = d.date === today;
          const meta = STATE_META[dayState(d, isToday)];
          const isSelected = selected === d.date;
          const summary =
            d.expected === 0
              ? t("history.barNothing", { label: prettyDate(d.date) })
              : t("history.barDetail", {
                  label: prettyDate(d.date),
                  taken: d.taken,
                  expected: d.expected,
                }) + (d.missed > 0 ? t("history.barMissed", { missed: d.missed }) : "");

          return (
            <Pressable
              key={d.date}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${summary}. ${isSelected ? t("common.clearFilter") : ""}`}
              onPress={() => onSelect(isSelected ? null : d.date)}
              style={styles.day}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.weekday,
                  { color: isToday ? c.brandInk : c.ink3, fontWeight: isToday ? "800" : "700" },
                ]}
              >
                {weekdayShort(d.date)}
              </Text>

              <View
                style={[
                  styles.tile,
                  {
                    backgroundColor: c[meta.fill],
                    borderColor: isSelected ? c.ink : isToday ? c.brand : "transparent",
                  },
                ]}
              >
                <MaterialIcons name={meta.icon} size={30} color={c[meta.on]} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.progressHead}>
        <T size={15} weight="700" tone="ink2">
          {t("history.weeklyProgress")}
        </T>
        <T size={15} weight="700" tone={perfect ? "okInk" : "ink2"}>
          {scheduled.length === 0
            ? t("history.noDosesThisWeek")
            : t("history.daysKept", { kept, total: scheduled.length })}
        </T>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: scheduled.length, now: kept }}
        style={[styles.track, { backgroundColor: c.brandSoft }]}
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: perfect ? c.okSolid : c.brand,
              width: `${Math.round(progress * 100)}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6 },
  day: { flex: 1, alignItems: "center", gap: 6 },
  weekday: { fontSize: 14 },
  tile: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 60,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  progressHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 8,
  },
  track: { height: 14, borderRadius: 7, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 7 },
});
