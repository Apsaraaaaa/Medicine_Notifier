import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { RADIUS, TYPE } from "../constants/theme";
import { useT, useTheme } from "../context/AppContext";
import { searchCatalog } from "../services/api";
import type { CatalogMedicine } from "../types";
import { Field, T } from "./ui";

/** How long to wait after the last keystroke before asking the server. */
const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

/**
 * The medicine name field, with suggestions from the shared catalog.
 *
 * Every suggestion comes from `GET /api/catalog/?q=…` — there is no local list
 * to drift out of date. Typing is never blocked by the network: the field is a
 * plain text input, so a user can save a medicine the catalog has never heard
 * of, and picking a suggestion is only ever a shortcut that also fills in the
 * dosage.
 */
export function CatalogSearchField({
  value,
  error,
  onChangeText,
  onPick,
}: {
  value: string;
  error?: string;
  onChangeText: (text: string) => void;
  onPick: (item: CatalogMedicine) => void;
}) {
  const c = useTheme();
  const t = useT();
  const [results, setResults] = useState<CatalogMedicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [open, setOpen] = useState(false);
  // A pick sets the field text, which would otherwise trigger a fresh search
  // and reopen the list underneath the user.
  const justPicked = useRef(false);
  // Editing an existing medicine starts with a name already in the field.
  // Suggestions are for typing, so nothing is searched until a key is pressed.
  const typed = useRef(false);

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    if (!typed.current) return;

    const query = value.trim();
    if (query.length < MIN_CHARS) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const found = await searchCatalog(query, 8, controller.signal);
        if (cancelled) return;
        setResults(found);
        setOffline(false);
        setOpen(true);
      } catch {
        // An aborted request lands here too, which is why nothing is shown
        // unless this effect is still the current one.
        if (cancelled) return;
        setResults([]);
        setOffline(true);
        setOpen(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  const pick = (item: CatalogMedicine) => {
    justPicked.current = true;
    setOpen(false);
    setResults([]);
    onPick(item);
  };

  return (
    <View>
      <Field
        label={t("form.name")}
        icon="search"
        placeholder={t("form.namePlaceholder")}
        autoCorrect={false}
        value={value}
        error={error}
        onChangeText={(text) => {
          typed.current = true;
          onChangeText(text);
        }}
        right={
          loading ? (
            <ActivityIndicator color={c.ink3} />
          ) : value.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("form.clearName")}
              onPress={() => {
                typed.current = true;
                onChangeText("");
                setOpen(false);
              }}
              hitSlop={8}
            >
              <MaterialIcons name="close" size={24} color={c.ink3} />
            </Pressable>
          ) : null
        }
      />

      {open && (
        <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.line }]}>
          {offline ? (
            <View style={styles.message}>
              <MaterialIcons name="cloud-off" size={22} color={c.ink3} />
              <T size={TYPE.small} tone="ink3" style={{ flex: 1 }}>
                {t("form.suggestOffline")}
              </T>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.message}>
              <MaterialIcons name="info-outline" size={22} color={c.ink3} />
              <T size={TYPE.small} tone="ink3" style={{ flex: 1 }}>
                {t("form.suggestNone")}
              </T>
            </View>
          ) : (
            results.map((item, i) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}, ${item.formLabel}. ${item.usage}`}
                onPress={() => pick(item)}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: 1, borderTopColor: c.line },
                  { backgroundColor: pressed ? c.surface2 : "transparent" },
                ]}
              >
                <View style={[styles.pill, { backgroundColor: c.brandSoft }]}>
                  <MaterialIcons name="medication" size={22} color={c.brandInk} />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={TYPE.bodyLg} weight="700" numberOfLines={1}>
                    {item.label}
                  </T>
                  <T size={TYPE.small} tone="ink3" numberOfLines={1}>
                    {[item.formLabel, item.genericName].filter(Boolean).join(" · ")}
                  </T>
                  {item.usage ? (
                    <T size={TYPE.small} tone="ink2" numberOfLines={1}>
                      {item.usage}
                    </T>
                  ) : null}
                </View>

                <MaterialIcons name="north-west" size={22} color={c.ink3} />
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: RADIUS.field,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 72 },
  pill: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  message: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
});
