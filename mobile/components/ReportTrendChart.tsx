import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useT, useTheme } from "../context/AppContext";
import type { ReportBucket } from "../types";
import { monthLabel, shortDate } from "../utils/date";
import { T } from "./ui";

const PLOT_HEIGHT = 108;
const MAX_BAR = 40;

/**
 * A trend series from the report — one bar per week or per month.
 *
 * Same visual language as the history chart: a single brand-coloured fill
 * against a faint track of what was scheduled, so a short bar reads as "behind"
 * without a second colour or a legend. Periods with nothing scheduled are kept
 * in place rather than dropped, because a gap in the row is itself information.
 */
export function ReportTrendChart({
  title,
  buckets,
}: {
  title: string;
  buckets: ReportBucket[];
}) {
  const c = useTheme();
  const t = useT();
  const [selected, setSelected] = useState<number | null>(null);

  const scheduled = buckets.filter((b) => b.expected > 0);
  if (scheduled.length === 0) return null;

  const active = selected !== null ? buckets[selected] : null;
  // A month bucket's label is "2026-08"; anything shorter is a real date.
  const label = (b: ReportBucket) =>
    b.label.length === 7 ? monthLabel(`${b.label}-01`) : shortDate(b.date);

  return (
    <View>
      <T size={17} weight="700" style={{ marginBottom: 10 }}>
        {title}
      </T>

      <View style={styles.plot}>
        {buckets.map((b, i) => {
          const share = b.expected === 0 ? 0 : b.taken / b.expected;
          const isSelected = selected === i;
          const summary =
            b.expected === 0
              ? t("history.barNothing", { label: label(b) })
              : t("history.barDetail", {
                  label: label(b),
                  taken: b.taken,
                  expected: b.expected,
                });

          return (
            <Pressable
              key={`${b.date}-${i}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={summary}
              onPress={() => setSelected(isSelected ? null : i)}
              style={styles.column}
            >
              <View style={[styles.track, { backgroundColor: c.surface2 }]}>
                {b.expected > 0 && (
                  <View
                    style={[
                      styles.fill,
                      {
                        height: `${Math.max(share * 100, share > 0 ? 6 : 0)}%`,
                        backgroundColor: isSelected ? c.brandStrong : c.brand,
                      },
                    ]}
                  />
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  {
                    color: isSelected ? c.brandInk : c.ink3,
                    fontWeight: isSelected ? "800" : "600",
                  },
                ]}
              >
                {label(b)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <T size={15} tone="ink2" style={{ marginTop: 8, minHeight: 22 }}>
        {active
          ? active.expected === 0
            ? t("history.barNothing", { label: label(active) })
            : t("history.barDetail", {
                label: label(active),
                taken: active.taken,
                expected: active.expected,
              }) + (active.missed > 0 ? t("history.barMissed", { missed: active.missed }) : "")
          : t("history.tapBar")}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: PLOT_HEIGHT + 26 },
  column: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  track: {
    width: "100%",
    maxWidth: MAX_BAR,
    height: PLOT_HEIGHT,
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  fill: { width: "100%", borderRadius: 10 },
  label: { fontSize: 13, textAlign: "center" },
});
