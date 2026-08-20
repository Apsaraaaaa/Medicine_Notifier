import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RADIUS } from "../constants/theme";
import { useT, useTheme } from "../context/AppContext";
import { formatTime12 } from "../utils/date";
import { relativeTime, type DoseSlot } from "../utils/schedule";

/**
 * The anchor of the home screen: what to take next, when, and the one action
 * that answers it. The card body opens the medicine; the action button is a
 * sibling rather than nested, so both stay reachable.
 */
export function NextDoseCard({
  slot,
  onOpen,
  onAnswer,
}: {
  slot: DoseSlot;
  onOpen: () => void;
  onAnswer: () => void;
}) {
  const c = useTheme();
  const t = useT();
  const overdue = slot.status === "due" || slot.status === "missed";
  const { medicine } = slot;
  const kicker = t(overdue ? "home.doseDue" : "home.nextDose");

  return (
    <LinearGradient
      colors={[c.heroFrom, "#6C4FD0", c.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${kicker}: ${medicine.name} · ${formatTime12(slot.time)}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.9 : 1 }]}
      >
        <View style={styles.pill}>
          <MaterialIcons name="medication" size={22} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.topRow}>
            <Text style={styles.kicker} numberOfLines={1}>
              {kicker.toUpperCase()}
            </Text>
            <View style={styles.relative}>
              <Text style={styles.relativeText}>{relativeTime(slot.time)}</Text>
            </View>
          </View>

          <Text style={styles.name} numberOfLines={2}>
            {medicine.name}
          </Text>
          <Text style={styles.dosage} numberOfLines={1}>
            {medicine.dosage}
          </Text>
          <Text style={styles.time}>{formatTime12(slot.time)}</Text>
        </View>

        <MaterialIcons name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
      </Pressable>

      <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        <Pressable
          accessibilityRole="button"
          onPress={onAnswer}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.9 : 1 }]}
        >
          {/* The gradient is the same in both themes, so this pairing is fixed:
              palette colours here would invert in dark mode and lose contrast. */}
          <MaterialIcons
            name={overdue ? "check-circle" : "notifications-active"}
            size={22}
            color="#4C319E"
          />
          <Text style={styles.actionText}>
            {t(overdue ? "home.answerDose" : "home.takeItNow")}
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  body: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, paddingBottom: 12 },
  pill: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  topRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  kicker: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "800", letterSpacing: 1, flexShrink: 1 },
  relative: {
    marginLeft: "auto",
    flexShrink: 0,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  relativeText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  name: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", marginTop: 4 },
  dosage: { color: "rgba(255,255,255,0.85)", fontSize: 15 },
  time: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", marginTop: 6 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 58,
    borderRadius: RADIUS.btn,
    backgroundColor: "#FFFFFF",
  },
  actionText: { color: "#4C319E", fontSize: 18, fontWeight: "700" },
});
