import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../context/AppContext";
import type { Bucket } from "../utils/insights";
import { prettyDate } from "../utils/date";
import { T } from "./ui";

const PLOT_HEIGHT = 156;
const MAX_BAR = 44;

/**
 * Adherence per day (or per week/month over longer ranges), as one bar each.
 *
 * Deliberately a single series in the brand colour rather than a taken /
 * skipped / missed stack: the stack needed a legend, a caption and a data
 * table to be readable, and three saturated colours fought everything else on
 * the screen. Each bar is the share of that period's doses that were taken,
 * drawn against a faint track of what was scheduled — so a short bar reads as
 * "behind" without a second colour having to say it.
 */
export function HistoryChart({ buckets }: { buckets: Bucket[] }) {
  const c = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const active = selected !== null ? buckets[selected] : null;

  return (
    <View>
      <View style={styles.plot}>
        {buckets.map((b, i) => {
          const share = b.expected === 0 ? 0 : b.taken / b.expected;
          const isSelected = selected === i;
          const label = b.days > 1 ? b.label : prettyDate(b.date);
          const summary =
            b.expected === 0
              ? `${label}: nothing scheduled`
              : `${label}: ${b.taken} of ${b.expected} doses taken`;

          return (
            <Pressable
              key={b.date}
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
                  { color: isSelected ? c.brandInk : c.ink3, fontWeight: isSelected ? "800" : "600" },
                ]}
              >
                {b.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* One readout line, only where a legend used to be. */}
      <T size={15} tone="ink2" style={{ marginTop: 10, minHeight: 22 }}>
        {active
          ? active.expected === 0
            ? `${active.days > 1 ? active.label : prettyDate(active.date)} · nothing scheduled`
            : `${active.days > 1 ? active.label : prettyDate(active.date)} · ${active.taken} of ${active.expected} taken${active.missed > 0 ? `, ${active.missed} missed` : ""}`
          : "Tap a bar for that day's detail"}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: PLOT_HEIGHT + 28 },
  // maxWidth keeps a single bucket (the "All" range early on) looking like a
  // bar rather than a slab across the whole card.
  column: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  track: {
    width: "100%",
    maxWidth: MAX_BAR,
    height: PLOT_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  fill: { width: "100%", borderRadius: 12 },
  label: { fontSize: 14, textAlign: "center" },
});
