import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../context/AppContext";
import type { IconName } from "./ui";

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: "index", label: "Home", icon: "home" },
  { name: "medicines", label: "Medicines", icon: "medication" },
  { name: "history", label: "History", icon: "history" },
  { name: "profile", label: "Profile", icon: "person" },
];

/**
 * Four tabs with the add-medicine action raised in the middle. The add button
 * is not a tab: it pushes the form, so returning to it lands back on whichever
 * tab was open.
 */
export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route.name);
  };

  const item = (tab: (typeof TABS)[number]) => {
    const active = activeName === tab.name;
    return (
      <Pressable
        key={tab.name}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={tab.label}
        onPress={() => go(tab.name)}
        style={styles.tab}
      >
        <View style={[styles.iconPill, active && { backgroundColor: c.brandSoft }]}>
          <MaterialIcons name={tab.icon} size={24} color={active ? c.brandInk : c.ink3} />
        </View>
        <Text style={[styles.label, { color: active ? c.brandInk : c.ink3 }]}>{tab.label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: c.surface,
          borderTopColor: c.line,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {TABS.slice(0, 2).map(item)}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add medicine"
        onPress={() => router.push("/medicine/new")}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: c.brandSolid, borderColor: c.surface, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <MaterialIcons name="add" size={34} color={c.onBrand} />
      </Pressable>

      {TABS.slice(2).map(item)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 4 },
  iconPill: {
    width: 58,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 13, fontWeight: "700" },
  fab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -32,
    marginHorizontal: 4,
  },
});
