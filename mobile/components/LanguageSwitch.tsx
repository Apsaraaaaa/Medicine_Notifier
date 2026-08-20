import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SIZES, TYPE } from "../constants/theme";
import { LANGUAGES } from "../i18n";
import { useApp, useTheme } from "../context/AppContext";

/**
 * The language switcher.
 *
 * Each option is written in its own script — "English" and "नेपाली" — because
 * somebody who cannot read the current language has to be able to find their
 * own. That also means the labels are never translated: they are the same two
 * words whichever language the app is in.
 */
export function LanguageSwitch() {
  const { language, setLanguage } = useApp();
  const c = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.row, { backgroundColor: c.surface2, borderColor: c.line }]}
    >
      {LANGUAGES.map((option) => {
        const active = option.key === language;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => setLanguage(option.key)}
            style={[
              styles.option,
              active && { backgroundColor: c.surface, borderColor: c.brand },
            ]}
          >
            {active && <MaterialIcons name="check" size={20} color={c.brandInk} />}
            <Text
              numberOfLines={1}
              style={{
                color: active ? c.brandInk : c.ink2,
                fontSize: TYPE.body,
                fontWeight: "800",
              }}
            >
              {option.native}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, padding: 5, borderRadius: 999, borderWidth: 1 },
  option: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: SIZES.tap,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 10,
  },
});
