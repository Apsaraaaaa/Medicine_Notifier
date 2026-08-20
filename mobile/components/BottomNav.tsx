import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PATIENT_SIZES, PATIENT_TYPE } from "../constants/theme";
import { useApp, useTheme } from "../context/AppContext";
import type { TranslationKey } from "../i18n";
import type { IconName } from "./ui";

/**
 * The four tabs, and what each is called in either mode.
 *
 * Patient Mode renames two of them rather than reorganising the app: the same
 * routes, said more plainly. "Medicines" becomes "My Medicines" because whose
 * they are is the question being answered, and "Profile" becomes "Settings"
 * because that is what somebody looking for the text size will go hunting for.
 */
const TABS: {
  name: string;
  label: TranslationKey;
  patientLabel: TranslationKey;
  icon: IconName;
}[] = [
  { name: "index", label: "nav.home", patientLabel: "nav.home", icon: "home" },
  {
    name: "medicines",
    label: "nav.medicines",
    patientLabel: "nav.myMedicines",
    icon: "medication",
  },
  { name: "history", label: "nav.history", patientLabel: "nav.history", icon: "history" },
  { name: "profile", label: "nav.profile", patientLabel: "nav.settings", icon: "person" },
];

/**
 * Four tabs with the add-medicine action raised in the middle. The add button
 * is not a tab: it pushes the form, so returning to it lands back on whichever
 * tab was open.
 *
 * In Patient Mode the raised button is gone and the four tabs grow to fill the
 * bar. Adding a medicine is not something the person taking them does mid-day,
 * and the action is still one tap away in the My Medicines header — so nothing
 * is lost, and the bar becomes four large targets instead of five mixed ones.
 */
export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const c = useTheme();
  const { patientMode, t } = useApp();
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
    const label = t(patientMode ? tab.patientLabel : tab.label);
    return (
      <Pressable
        key={tab.name}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        onPress={() => go(tab.name)}
        style={[styles.tab, patientMode && styles.tabPatient]}
      >
        <View
          style={[
            styles.iconPill,
            patientMode && styles.iconPillPatient,
            active && { backgroundColor: c.brandSoft },
          ]}
        >
          <MaterialIcons
            name={tab.icon}
            size={patientMode ? PATIENT_SIZES.icon : 24}
            color={active ? c.brandInk : c.ink3}
          />
        </View>
        {/* Two lines in Patient Mode: "My Medicines" does not fit across a
            quarter of the screen at this size, and a truncated label is the
            one thing a large-type mode must not produce. */}
        <Text
          numberOfLines={patientMode ? 2 : 1}
          style={[
            styles.label,
            patientMode && styles.labelPatient,
            { color: active ? c.brandInk : c.ink3 },
          ]}
        >
          {label}
        </Text>
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
      {patientMode ? (
        TABS.map(item)
      ) : (
        <>
          {TABS.slice(0, 2).map(item)}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("nav.addMedicine")}
            onPress={() => router.push("/medicine/new")}
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: c.brandSolid, borderColor: c.surface, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <MaterialIcons name="add" size={34} color={c.onBrand} />
          </Pressable>

          {TABS.slice(2).map(item)}
        </>
      )}
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
  tabPatient: { gap: 4, paddingVertical: 6 },
  iconPill: {
    width: 58,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPillPatient: { width: 72, height: 48, borderRadius: 24 },
  label: { fontSize: 13, fontWeight: "700" },
  labelPatient: {
    fontSize: PATIENT_TYPE.small,
    fontWeight: "800",
    lineHeight: PATIENT_TYPE.small + 4,
    textAlign: "center",
  },
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
