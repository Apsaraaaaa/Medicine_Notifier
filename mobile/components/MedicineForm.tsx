import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
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

import {
  FREQUENCIES,
  MEAL_RELATIONS,
  MED_COLORS,
  RADIUS,
} from "../constants/theme";
import { useApp, useTheme } from "../context/AppContext";
import type { MealRelation, Medicine } from "../types";
import { withAlpha } from "../utils/color";
import { formatTime12, fromISO, prettyDate, shiftDays, toLocalISO, todayISO } from "../utils/date";
import { CatalogSearchField } from "./CatalogSearchField";
import { Button, Card, Field, FilterChip, T, TextArea, Toggle } from "./ui";

type Errors = Partial<Record<"name" | "dosage" | "times" | "dates" | "save", string>>;
type Picker = { kind: "time" } | { kind: "start" } | { kind: "end" } | null;

/** Everything the scanner can hand the form. All of it stays editable. */
export interface MedicinePrefill {
  name?: string;
  dosage?: string;
  frequency?: string;
  times?: string[];
  mealRelation?: MealRelation;
  durationDays?: number | null;
  catalogId?: string | null;
}

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
 *
 * `prefill` is what the scanner passes across. It only ever supplies starting
 * values — every field it touches is a normal editable field afterwards, and
 * nothing reaches the server until Save is pressed.
 */
export function MedicineForm({
  editing,
  prefill,
  onDone,
}: {
  editing: Medicine | null;
  prefill?: MedicinePrefill;
  onDone: () => void;
}) {
  const { addMedicine, editMedicine, t } = useApp();
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(editing?.name ?? prefill?.name ?? "");
  const [dosage, setDosage] = useState(editing?.dosage ?? prefill?.dosage ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [startDate, setStartDate] = useState(editing?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(
    editing?.endDate ??
      // A scanned "x 5 days" is the one thing that knows how long the course
      // runs, so it sets the end date rather than being thrown away.
      (prefill?.durationDays
        ? shiftDays(todayISO(), Math.max(0, prefill.durationDays - 1))
        : todayISO())
  );
  const [frequency, setFrequency] = useState<string>(
    editing?.frequency ?? prefill?.frequency ?? FREQUENCIES[0].value
  );
  // No default time: a suggested 08:00 gets saved unnoticed and then rings at
  // the wrong hour. An empty list makes the choice explicit, and save() already
  // refuses to continue without at least one.
  const [times, setTimes] = useState<string[]>(editing?.times ?? prefill?.times ?? []);
  const [color, setColor] = useState<string>(editing?.color ?? MED_COLORS[0]);
  const [mealRelation, setMealRelation] = useState<MealRelation>(
    editing?.mealRelation ?? prefill?.mealRelation ?? "none"
  );
  const [critical, setCritical] = useState<boolean>(editing?.critical ?? false);
  // Which catalog entry this came from, if any. Null for a freehand name.
  const [catalogId, setCatalogId] = useState<string | null>(
    editing?.catalogId ?? prefill?.catalogId ?? null
  );
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
    if (times.includes(value)) setTimes(times.filter((x) => x !== value));
    else addTimeValue(value);
  };

  const addDraftTime = () => {
    const value = timeDraft.trim();
    if (!TIME_RE.test(value)) {
      return setErrors((e) => ({ ...e, times: t("form.errTimeFormat") }));
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
    if (!name.trim()) next.name = t("form.errName");
    if (!dosage.trim()) next.dosage = t("form.errDosage");
    if (times.length === 0) next.times = t("form.errTimes");
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      next.dates = t("form.errDateFormat");
    } else if (endDate < startDate) {
      next.dates = t("form.errDateOrder");
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      // Report next to the button that was pressed. The field-level messages
      // are often scrolled out of sight, which made Save look broken.
      setBlocked(next.name ?? next.dosage ?? next.times ?? next.dates ?? t("form.errGeneric"));
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
      mealRelation,
      critical,
    };
    try {
      if (editing) await editMedicine(editing.id, data);
      else await addMedicine(data);
      onDone();
    } catch (err) {
      setErrors({ save: (err as Error).message || t("form.errSave") });
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

  const reminderCount =
    times.length === 0
      ? t("form.noTimeYet")
      : times.length === 1
        ? t("form.oneReminder")
        : t("form.nReminders", { count: times.length });

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
              {name || t("form.newMedicine")}
            </T>
            <T size={15} tone="ink2" numberOfLines={1}>
              {dosage || t("form.dosage")} · {reminderCount}
            </T>
          </View>
        </Card>

        {/* Reading the box is an alternative to filling this in by hand, so it
            belongs at the top — offering it after the work is done is no use. */}
        {!editing && (
          <Button
            variant="secondary"
            icon="document-scanner"
            style={{ marginBottom: 16 }}
            onPress={() => router.push("/scan")}
          >
            {t("form.scanBox")}
          </Button>
        )}

        <T size={18} weight="700" style={{ marginBottom: 8 }}>
          {t("form.details")}
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
            label={t("form.dosage")}
            placeholder={t("form.dosagePlaceholder")}
            value={dosage}
            error={errors.dosage}
            onChangeText={setDosage}
          />

          <View>
            <T size={15} tone="ink2" weight="600" style={{ marginBottom: 8 }}>
              {t("form.labelColour")}
            </T>
            <View style={styles.colorRow}>
              {MED_COLORS.map((swatch) => (
                <Pressable
                  key={swatch}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("form.labelColour")} ${swatch}`}
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

          {/* An important medicine is the only kind that raises a caregiver
              alert, so the switch says what it actually does. */}
          <View style={[styles.criticalRow, { borderTopColor: c.line }]}>
            <View style={[styles.criticalIcon, { backgroundColor: c.warnSoft }]}>
              <MaterialIcons name="priority-high" size={22} color={c.warnInk} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={17} weight="700">
                {t("form.important")}
              </T>
              <T size={15} tone="ink3">
                {t("form.importantHint")}
              </T>
            </View>
            <Toggle label={t("form.important")} on={critical} onChange={setCritical} />
          </View>
        </Card>

        {/* ---- meal timing ---- */}
        <T size={18} weight="700" style={{ marginBottom: 8 }}>
          {t("form.mealTiming")}
        </T>
        <Card style={{ marginBottom: 16 }}>
          <View style={styles.wrapRow}>
            {MEAL_RELATIONS.map((option) => (
              <FilterChip
                key={option.key}
                selected={mealRelation === option.key}
                onPress={() => setMealRelation(option.key)}
              >
                {t(option.label)}
              </FilterChip>
            ))}
          </View>
        </Card>

        <T size={18} weight="700" style={{ marginBottom: 8 }}>
          {t("form.frequency")}
        </T>
        <Card style={{ marginBottom: 16 }}>
          <View style={styles.wrapRow}>
            {FREQUENCIES.map((f) => (
              <FilterChip
                key={f.value}
                selected={frequency === f.value}
                onPress={() => setFrequency(f.value)}
              >
                {t(f.label)}
              </FilterChip>
            ))}
          </View>
        </Card>

        <T size={18} weight="700" style={{ marginBottom: 8 }}>
          {t("form.reminderTimes")}
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
                  label={t("form.anotherTimeWeb")}
                  placeholder="14:30"
                  value={timeDraft}
                  onChangeText={setTimeDraft}
                  onSubmitEditing={addDraftTime}
                />
              </View>
              <Button icon="add" onPress={addDraftTime} style={{ marginTop: 30 }}>
                {t("common.add")}
              </Button>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("form.anotherTime")}
              onPress={() => setPicker({ kind: "time" })}
              style={[styles.addTime, { borderColor: c.brand }]}
            >
              <MaterialIcons name="schedule" size={22} color={c.brandInk} />
              <Text style={{ color: c.brandInk, fontWeight: "700", fontSize: 17 }}>
                {t("form.anotherTime")}
              </Text>
            </Pressable>
          )}

          {/* Everything chosen so far, presets and custom alike. */}
          {times.length > 0 && (
            <View style={[styles.chosen, { borderTopColor: c.line }]}>
              <T size={15} tone="ink2" weight="700" style={{ marginBottom: 8 }}>
                {times.length === 1
                  ? t("form.reminderAt")
                  : t("form.remindersADay", { count: times.length })}
              </T>
              <View style={styles.wrapRow}>
                {times.map((time) => (
                  <View key={time} style={[styles.timePill, { backgroundColor: c.brandSoft }]}>
                    <Text style={{ color: c.brandInk, fontWeight: "700", fontSize: 17 }}>
                      {formatTime12(time)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t("common.delete")} ${formatTime12(time)}`}
                      onPress={() => setTimes(times.filter((x) => x !== time))}
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
              {t("form.timesHint")}
            </T>
          ) : null}
        </Card>

        <T size={18} weight="700" style={{ marginBottom: 8 }}>
          {t("form.duration")}
        </T>
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {IS_WEB ? (
              <>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t("form.startDate")}
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
                    label={t("form.endDate")}
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
                  label={t("form.startDate")}
                  value={startDate}
                  onPress={() => setPicker({ kind: "start" })}
                />
                <DateButton
                  label={t("form.endDate")}
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
          {t("form.notes")}
        </T>
        <Card>
          <TextArea
            label={t("form.notesLabel")}
            rows={3}
            placeholder={t("form.notesPlaceholder")}
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
            {t("common.cancel")}
          </Button>
          <Button icon="check" style={{ flex: 2 }} loading={saving} onPress={save}>
            {t(editing ? "form.saveChanges" : "form.saveMedicine")}
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
        accessibilityLabel={`${label}: ${prettyDate(value)}`}
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
  criticalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  criticalIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
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
