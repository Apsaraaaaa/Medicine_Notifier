import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../context/AppContext";
import type { Medicine } from "../types";
import { withAlpha } from "../utils/color";
import { formatTime12, prettyDate, todayISO } from "../utils/date";
import { Card, IconButton, StatusBadge, T, TimeChip } from "./ui";

export function isActive(medicine: Medicine, date = todayISO()) {
  return date >= medicine.startDate && date <= medicine.endDate;
}

/**
 * The card body opens the medicine for editing; the overflow menu is a sibling
 * button so the two actions never nest.
 */
export function MedicineCard({
  medicine,
  onOpen,
  onOpenMenu,
}: {
  medicine: Medicine;
  onOpen: () => void;
  onOpenMenu: () => void;
}) {
  const c = useTheme();
  const active = isActive(medicine);

  return (
    <Card padded={false}>
      <View style={styles.shell}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${medicine.name}`}
          onPress={onOpen}
          style={({ pressed }) => [
            styles.body,
            { backgroundColor: pressed ? c.surface2 : "transparent" },
          ]}
        >
          <View style={styles.head}>
            <View style={[styles.icon, { backgroundColor: withAlpha(medicine.color, 0.2) }]}>
              <MaterialIcons name="medication" size={22} color={medicine.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.titleRow}>
                <T size={18} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {medicine.name}
                </T>
                <StatusBadge
                  label={active ? "Active" : "Inactive"}
                  bg={active ? c.okSoft : c.surface2}
                  fg={active ? c.okInk : c.ink3}
                />
              </View>
              <T size={15} tone="ink2" numberOfLines={1}>
                {medicine.dosage} · {medicine.frequency}
              </T>
            </View>
          </View>

          <View style={styles.times}>
            {medicine.times.length === 0 ? (
              <T size={15} tone="ink3">
                No reminders set
              </T>
            ) : (
              medicine.times.map((t) => <TimeChip key={t}>{formatTime12(t)}</TimeChip>)
            )}
          </View>

          <View style={styles.dates}>
            <MaterialIcons name="event-repeat" size={16} color={c.ink3} />
            <T size={15} tone="ink3">
              {prettyDate(medicine.startDate)} → {prettyDate(medicine.endDate)}
            </T>
          </View>

          {medicine.notes ? (
            <View style={[styles.notes, { borderLeftColor: c.line }]}>
              <T size={15} tone="ink2">
                {medicine.notes}
              </T>
            </View>
          ) : null}
        </Pressable>

        <View style={styles.side}>
          <IconButton
            icon="more-vert"
            label={`Actions for ${medicine.name}`}
            onPress={onOpenMenu}
          />
          <MaterialIcons name="chevron-right" size={22} color={c.ink3} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  shell: { flexDirection: "row", alignItems: "flex-start" },
  body: { flex: 1, minWidth: 0, padding: 16, borderRadius: 20 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  times: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12, paddingLeft: 56 },
  dates: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingLeft: 56 },
  notes: { marginTop: 8, marginLeft: 56, borderLeftWidth: 2, paddingLeft: 10 },
  side: { alignItems: "center", gap: 4, paddingVertical: 12, paddingRight: 6 },
});
