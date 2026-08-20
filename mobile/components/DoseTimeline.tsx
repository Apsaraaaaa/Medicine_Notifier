import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { STATUS_META, type DoseState } from "../constants/theme";
import { useT, useTheme } from "../context/AppContext";
import type { DoseSlot } from "../utils/schedule";
import { formatTime12 } from "../utils/date";
import { StatusBadge, T, type IconName } from "./ui";

/** Icon per dose state — status is always icon + word, never colour alone. */
export const STATUS_ICON: Record<DoseState, IconName> = {
  taken: "check-circle",
  due: "notifications-active",
  upcoming: "radio-button-unchecked",
  skipped: "remove-circle-outline",
  missed: "warning-amber",
  snoozed: "snooze",
};

/**
 * One dose in the day on a connected rail. The row opens the medicine; a dose
 * still waiting for an answer gets its own action button beside it.
 */
function DoseRow({
  slot,
  onOpen,
  onAnswer,
  last,
}: {
  slot: DoseSlot;
  onOpen: () => void;
  onAnswer: () => void;
  last: boolean;
}) {
  const c = useTheme();
  const t = useT();
  const meta = STATUS_META[slot.status];
  const label = t(meta.label);
  const needsAnswer =
    slot.status === "due" || slot.status === "missed" || slot.status === "snoozed";

  return (
    <View style={styles.row}>
      {/* rail */}
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: c[meta.soft] }]}>
          <MaterialIcons name={STATUS_ICON[slot.status]} size={17} color={c[meta.ink]} />
        </View>
        {!last && <View style={[styles.railLine, { backgroundColor: c.line }]} />}
      </View>

      <View
        style={[styles.rowBody, !last && { borderBottomWidth: 1, borderBottomColor: c.line }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${slot.medicine.name} · ${formatTime12(slot.time)} · ${label}`}
          onPress={onOpen}
          style={styles.rowMain}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: c.ink2, fontSize: 15, fontWeight: "700" }}>
              {formatTime12(slot.time)}
            </Text>
            <T size={17} weight="600" numberOfLines={1}>
              {slot.medicine.name}
            </T>
            <T size={15} tone="ink3" numberOfLines={1}>
              {slot.medicine.dosage}
            </T>
          </View>
          {!needsAnswer && (
            <StatusBadge
              icon={STATUS_ICON[slot.status]}
              label={label}
              bg={c[meta.soft]}
              fg={c[meta.ink]}
            />
          )}
          <MaterialIcons name="chevron-right" size={22} color={c.ink3} />
        </Pressable>

        {needsAnswer && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Answer ${slot.medicine.name} at ${formatTime12(slot.time)}`}
            onPress={onAnswer}
            style={({ pressed }) => [
              styles.answer,
              { backgroundColor: c.brandSolid, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <MaterialIcons name="notifications-active" size={17} color={c.onBrand} />
            <Text style={{ color: c.onBrand, fontSize: 15, fontWeight: "700" }}>
              {t(slot.status === "missed" ? "dose.log" : "dose.take")}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function DoseTimeline({
  slots,
  onOpen,
  onAnswer,
}: {
  slots: DoseSlot[];
  onOpen: (slot: DoseSlot) => void;
  onAnswer: (slot: DoseSlot) => void;
}) {
  return (
    <View>
      {slots.map((s, i) => (
        <DoseRow
          key={s.medicine.id + s.time}
          slot={s}
          last={i === slots.length - 1}
          onOpen={() => onOpen(s)}
          onAnswer={() => onAnswer(s)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  rail: { width: 30, alignItems: "center", paddingTop: 16 },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  railLine: { width: 1, flex: 1, marginTop: 4 },
  rowBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  answer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 52,
    borderRadius: 999,
    paddingHorizontal: 16,
  },
});
