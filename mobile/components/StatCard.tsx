import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../context/AppContext";
import { RADIUS, type Palette } from "../constants/theme";
import type { IconName } from "./ui";

/**
 * Compact count tile. On the home screen it filters the schedule below;
 * elsewhere it navigates. `selected` shows the filter is on.
 */
export function StatCard({
  icon,
  label,
  value,
  tone,
  onPress,
  selected = false,
  hint,
}: {
  icon: IconName;
  label: string;
  value: number;
  /** palette key for the icon colour, e.g. "okInk" */
  tone: keyof Palette;
  onPress?: () => void;
  selected?: boolean;
  /** accessible description of what tapping does */
  hint?: string;
}) {
  const c = useTheme();

  const body = (
    <>
      <MaterialIcons name={icon} size={20} color={c[tone]} />
      <Text style={[styles.value, { color: c.ink }]}>{value}</Text>
      <Text style={[styles.label, { color: c.ink3 }]}>{label}</Text>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.tile, { backgroundColor: c.surface, borderColor: c.line }]}>{body}</View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={hint ? `${label}: ${value}. ${hint}` : `${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: selected ? c.brandSoft : pressed ? c.surface2 : c.surface,
          borderColor: selected ? c.brand : c.line,
        },
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    borderRadius: RADIUS.field,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  value: { fontSize: 20, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "600" },
});
