import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FREQUENCIES, MED_COLORS, RADIUS } from "../constants/theme";
import { useApp, useTheme } from "../context/AppContext";
import type { Medicine } from "../types";
import { withAlpha } from "../utils/color";
import { formatTime12, fromISO, prettyDate, toLocalISO, todayISO } from "../utils/date";
import { CatalogSearchField } from "./CatalogSearchField";
import { Button, Card, Field, FilterChip, T, TextArea, type IconName } from "./ui";

type Errors = Partial<Record<"name" | "dosage" | "times" | "dates" | "save", string>>;
type Picker = { kind: "time" } | { kind: "start" } | { kind: "end" } | null;

// The native date/time picker is Android-only. In a browser the same values
// are typed instead, so the form still works when the app is served on web.
const IS_WEB = Platform.OS === "web";
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The hours a dose is actually scheduled at, most often. Tapping one is a
 * single action; the picker below stays for anything else.
 */
const QUICK_TIMES = ["06:00", "08:00", "09:00", "12:00", "14:00", "18:00", "20:00", "22:00"];

/**
 * One form for both adding and editing: `editing` decides which API call the
 * save button makes and what the header says.
 */
export function MedicineForm({
  editing,
  onDone,
}: {
  editing: Medicine | null;
  onDone: () => void;
}) {
  const { addMedicine, editMedicine } = useApp();
  const c = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(editing?.name ?? "");
  const [dosage, setDosage] = useState(editing?.dosage ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [startDate, setStartDate] = useState(editing?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(editing?.endDate ?? todayISO());
  const [frequency, setFrequency] = useState<string>(editing?.frequency ?? FREQUENCIES[0]);
  // No default time: a suggested 08:00 gets saved unnoticed and then rings at
  // the wrong hour. An empty list makes the choice explicit, and save() already
  // refuses to continue without at least one.
  const [times, setTimes] = useState<string[]>(editing?.times ?? []);
  const [color, setColor] = useState<string>(editing?.color ?? MED_COLORS[0]);
  // Which catalog entry this came from, if any. Null for a freehand name.
  const [catalogId, setCatalogId] = useState<string | null>(editing?.catalogId ?? null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [picker, setPicker] = useState<Picker>(null);
  const [timeDraft, setTimeDraft] = useState(""); // web only
  // Why the last Save attempt did not go through, shown in the action bar.
  const [blocked, setBlocked] = useState("");

  const addTimeValue = (value: string) => {
    const [h, m] = value.split(":");
    const padded = `${h.padStart(2, "0")}:${m}`;
    setTimes((prev) => (prev.includes(padded) ? prev : [...prev, padded].sort()));
    setErrors((e) => ({ ...e, times: undefined }));
  };

  const addTime = (date: Date) => {
    addTimeValue(
      `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    );
  };

  const toggleTime = (value: string) => {
    if (times.includes(value)) setTimes(times.filter((t) => t !== value));
    else addTimeValue(value);
  };

  const addDraftTime = () => {
    const value = timeDraft.trim();
    if (!TIME_RE.test(value)) {
      return setErrors((e) => ({ ...e, times: "Enter a 24-hour time, e.g. 08:00." }));
    }
    addTimeValue(value);
    setTimeDraft("");
  };

  const onPicked = (event: DateTimePickerEvent, value?: Date) => {
    const current = picker;
    setPicker(null); // Android's picker is a one-shot dialog
    if (event.type !== "set" || !value || !current) return;
    if (current.kind === "time") addTime(value);
    if (current.kind === "start") {
      setStartDate(toLocalISO(value));
      setErrors((e) => ({ ...e, dates: undefined }));
    }
    if (current.kind === "end") {
      setEndDate(toLocalISO(value));
      setErrors((e) => ({ ...e, dates: undefined }));
    }
  };

  const save = async () => {
    const next: Errors = {};
    if (!name.trim()) next.name = "Medicine name required.";
    if (!dosage.trim()) next.dosage = "Dosage required.";
    if (times.length === 0) next.times = "Please select at least one reminder time.";
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      next.dates = "Dates must be written as YYYY-MM-DD.";
    } else if (endDate < startDate) {
      next.dates = "End date cannot be before the start date.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      // Report next to the button that was pressed. The field-level messages
      // are often scrolled out of sight, which made Save look broken.
      setBlocked(next.name ?? next.dosage ?? next.times ?? next.dates ?? "Please check the form.");
      return;
    }
    setBlocked("");

    if (saving) return; // guards against a double submit
    setSaving(true);
    const data = {
      name: name.trim(),
      dosage: dosage.trim(),
      notes: notes.trim(),
      startDate,
      endDate,
      frequency,
      times,
      color,
      catalogId,
    };
    try {
      if (editing) await editMedicine(editing.id, data);
      else await addMedicine(data);
      onDone();
    } catch (err) {
      setErrors({ save: (err as Error).message || "Unable to save medicine." });
    } finally {
      setSaving(false);
    }
  };

  const pickerValue =
    picker?.kind === "start"
      ? fromISO(startDate)
      : picker?.kind === "end"
        ? fromISO(endDate)
        : new Date();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* live preview of name, dose and colour */}
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <View style={[styles.preview, { backgroundColor: withAlpha(color, 0.2) }]}>
            <MaterialIcons name="medication" size={22} color={color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={18} weight="700" numberOfLines={1}>
              {name || "New medicine"}
            </T>
            <T size={15} tone="ink2" numberOfLines={1}>
              {dosage || "Dosage"} ·{" "}
              {times.length === 0
                ? "no reminder time yet"
                : `${times.length} ${times.length === 1 ? "reminder" : "reminders"}`}
            </T>
          </View>
        </Card>

        <T size={18} weight="700" style={{ marginBottom: 8 }}>
          Medicine details
        </T>
        <Card style={{ gap: 16, marginBottom: 16 }}>
          <CatalogSearchField
            value={name}
            error={errors.name}
            onChangeText={(text) => {
              setName(text);
              // Typing over a chosen suggestion makes this a freehand entry
              // again, so the catalog link must not survive.
              if (catalogId) setCatalogId(null);
              setErrors((e) => ({ ...e, name: undefined }));
            }}
            onPick={(item) => {
              setName(item.label);
              setCatalogId(item.id);
              setErrors((e) => ({ ...e, name: undefined, dosage: undefined }));
              // Only prefill an empty dosage — never overwrite what the user
              // has already typed for their own prescription.
              if (!dosage.trim()) setDosage(item.defaultDosage);
            }}
          />
          <Field
            label="Dosage"
            placeholder="e.g. 1 tablet (500 mg)"
            value={dosage}
            error={errors.dosage}
            onChangeText={setDosage}
          />

          <View>
            <T size={15} tone="ink2" weight="600" style={{ marginBottom: 8 }}>
              Label colour
            </T>
            <View style={styles.colorRow}>
              {MED_COLORS.map((swatch) => (
                <Pressable
                  key={swatch}
                  accessibilityRole="button"
                  accessibilityLabel={`Use colour ${swatch}`}
                  accessibilityState={{ selected: color === swatch }}
                  onPress={() => setColor(swatch)}
                  style={[
                    styles.swatch,
                    { backgroundColor: swatch },
                    color === swatch && { borderColor: c.ink, borderWidth: 3 },
                  ]}
                >
                  {color === swatch && <MaterialIcons name="check" size={22} color="#FFFFFF" />}
                </Pressable>
              ))}
            </View>
          </View>
        </Card>

        <T size={18} weight="700" style={{ marginBottom: 8 }}>
          Frequency
        </T>
        <Card style={{ marginBottom: 16 }}>
          <View style={styles.wrapRow}>
            {FREQUENCIES.map((f) => (
              <FilterChip key={f} selected={frequency === f} onPress={() => setFrequency(f)}>
                {f}
              </FilterChip>
            ))}
          </View>
        </Card>

        <T size={18} weight="700" style={{ marginBottom: 8 }}>
          Reminder times
        </T>
        <Card style={{ marginBottom: 16 }}>
          {/* One tap per time. The picker below covers anything unusual. */}
          <View style={styles.wrapRow}>
            {QUICK_TIMES.map((time) => {
              const on = times.includes(time);
              return (
                <Pressable
                  key={time}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={formatTime12(time)}
                  onPress={() => toggleTime(time)}
                  style={[
                    styles.quickTime,
                    {
                      backgroundColor: on ? c.brandSoft : c.surface,
                      borderColor: on ? c.brand : c.line,
                    },
                  ]}
                >
                  {on && <MaterialIcons name="check" size={20} color={c.brandInk} />}
                  <Text
                    style={{
                      color: on ? c.brandInk : c.ink,
                      fontSize: 17,
                      fontWeight: "700",
                    }}
                  >
                    {formatTime12(time)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Anything the quick times don't cover. */}
          {IS_WEB ? (
            <View style={styles.webTimeRow}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Another time (24-hour)"
                  placeholder="e.g. 14:30"
                  value={timeDraft}
                  onChangeText={setTimeDraft}
                  onSubmitEditing={addDraftTime}
                />
              </View>
              <Button icon="add" onPress={addDraftTime} style={{ marginTop: 30 }}>
                Add
              </Button>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose another time"
              onPress={() => setPicker({ kind: "time" })}
              style={[styles.addTime, { borderColor: c.brand }]}
            >
              <MaterialIcons name="schedule" size={22} color={c.brandInk} />
              <Text style={{ color: c.brandInk, fontWeight: "700", fontSize: 17 }}>
                Another time…
              </Text>
            </Pressable>
          )}

          {/* Everything chosen so far, presets and custom alike. */}
          {times.length > 0 && (
            <View style={[styles.chosen, { borderTopColor: c.line }]}>
              <T size={15} tone="ink2" weight="700" style={{ marginBottom: 8 }}>
                {times.length === 1 ? "Reminder at" : `${times.length} reminders a day`}
              </T>
              <View style={styles.wrapRow}>
                {times.map((t) => (
                  <View key={t} style={[styles.timePill, { backgroundColor: c.brandSoft }]}>
                    <Text style={{ color: c.brandInk, fontWeight: "700", fontSize: 17 }}>
                      {formatTime12(t)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${formatTime12(t)}`}
                      onPress={() => setTimes(times.filter((x) => x !== t))}
                      style={[styles.timeRemove, { backgroundColor: withAlpha(c.brand, 0.2) }]}
                    >
                      <MaterialIcons name="close" size={18} color={c.brandInk} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {errors.times ? (
            <View style={styles.errorRow}>
              <MaterialIcons name="error-outline" size={18} color={c.badInk} />
              <T size={15} weight="600" tone="badInk">
                {errors.times}
              </T>
            </View>
          ) : times.length === 0 ? (
            <T size={15} tone="ink3" style={{ marginTop: 10 }}>
              Choose the time or times of day this medicine should be taken.
            </T>
          ) : null}
        </Card>

        <T size={18} weight="700" style={{ marginBottom: 8 }}>
          Duration
        </T>
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {IS_WEB ? (
              <>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Start date"
                    placeholder="YYYY-MM-DD"
                    value={startDate}
                    onChangeText={(v) => {
                      setStartDate(v);
                      setErrors((e) => ({ ...e, dates: undefined }));
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="End date"
                    placeholder="YYYY-MM-DD"
                    value={endDate}
                    onChangeText={(v) => {
                      setEndDate(v);
                      setErrors((e) => ({ ...e, dates: undefined }));
                    }}
                  />
                </View>
              </>
            ) : (
              <>
                <DateButton
                  label="Start date"
                  value={startDate}
                  onPress={() => setPicker({ kind: "start" })}
                />
                <DateButton
                  label="End date"
                  value={endDate}
                  onPress={() => setPicker({ kind: "end" })}
                />
              </>
            )}
          </View>
          {errors.dates ? (
            <View style={styles.errorRow}>
              <MaterialIcons name="error-outline" size={18} color={c.badInk} />
              <T size={15} weight="600" tone="badInk">
                {errors.dates}
              </T>
            </View>
          ) : null}
        </Card>

        <T size={18} weight="700" style={{ marginBottom: 8 }}>
          Notes
        </T>
        <Card>
          <TextArea
            label="Anything to remember (optional)"
            rows={3}
            placeholder="e.g. Take after meals"
            value={notes}
            onChangeText={setNotes}
          />
        </Card>

        {errors.save ? (
          <View style={[styles.saveError, { backgroundColor: c.badSoft }]}>
            <MaterialIcons name="error-outline" size={18} color={c.badInk} />
            <T size={15} weight="600" tone="badInk" style={{ flex: 1 }}>
              {errors.save}
            </T>
          </View>
        ) : null}
      </ScrollView>

      {/* sticky action bar — save always reachable */}
      <View
        style={[
          styles.actionBar,
          {
            backgroundColor: c.surface,
            borderTopColor: c.line,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        {blocked ? (
          <View style={[styles.blocked, { backgroundColor: c.badSoft }]}>
            <MaterialIcons name="error-outline" size={20} color={c.badInk} />
            <T size={15} weight="700" tone="badInk" style={{ flex: 1 }}>
              {blocked}
            </T>
          </View>
        ) : null}

        <View style={styles.actions}>
        <Button variant="secondary" style={{ flex: 1 }} onPress={onDone}>
          Cancel
        </Button>
        <Button icon="check" style={{ flex: 2 }} loading={saving} onPress={save}>
          {editing ? "Save changes" : "Save medicine"}
        </Button>
        </View>
      </View>

      {picker && !IS_WEB && (
        <DateTimePicker
          value={pickerValue}
          mode={picker.kind === "time" ? "time" : "date"}
          is24Hour={false}
          onChange={onPicked}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function DateButton({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <T size={15} tone="ink2" weight="600" style={{ marginBottom: 6 }}>
        {label}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${prettyDate(value)}. Change`}
        onPress={onPress}
        style={[styles.dateButton, { backgroundColor: c.surface, borderColor: c.line }]}
      >
        <MaterialIcons name="event" size={20} color={c.ink3} />
        <Text style={{ color: c.ink, fontSize: 17, fontWeight: "600" }}>{prettyDate(value)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "transparent",
    borderWidth: 3,
  },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 56,
    borderRadius: 999,
    paddingLeft: 16,
    paddingRight: 6,
  },
  timeRemove: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  addTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "dashed",
    paddingHorizontal: 16,
  },
  webTimeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  quickTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 56,
    borderWidth: 2,
    borderRadius: RADIUS.field,
    paddingHorizontal: 16,
  },
  chosen: { borderTopWidth: 1, marginTop: 16, paddingTop: 14 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  saveError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: RADIUS.field,
    padding: 14,
    marginTop: 16,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 60,
    borderWidth: 2,
    borderRadius: RADIUS.field,
    paddingHorizontal: 16,
  },
  actionBar: { borderTopWidth: 1, padding: 16, paddingBottom: 12, gap: 12 },
  actions: { flexDirection: "row", gap: 12 },
  blocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: RADIUS.field,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
