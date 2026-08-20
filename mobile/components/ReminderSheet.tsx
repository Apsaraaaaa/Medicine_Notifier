import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RADIUS } from "../constants/theme";
import { useApp, useTheme } from "../context/AppContext";
import type { HistoryStatus } from "../types";
import { formatTime12, prettyDate, shortDate, todayISO } from "../utils/date";
import { withAlpha } from "../utils/color";
import { mealSummary } from "../utils/meal";
import { PatientReminder } from "./patient/PatientReminder";
import { Button, IconButton, T, TextArea } from "./ui";

/**
 * Dose confirmation. Answering writes to history through the reminder flow,
 * which is what updates the home stats and adherence.
 */
export function ReminderSheet() {
  const { activeReminder, respondReminder, snoozeReminder, snoozeMinutes, patientMode, t } =
    useApp();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  // Patient Mode answers the same dose with the same two calls, through a
  // sheet that offers only the two answers. Swapped here rather than inside
  // the layout so neither version has to carry the other's branches.
  if (patientMode) return <PatientReminder />;

  if (!activeReminder) return null;
  const { medicine, time, date } = activeReminder;
  // "Breakfast - After meal": what actually tells you how to take it.
  const mealText = mealSummary(medicine, t);

  const answer = (status: HistoryStatus) => {
    respondReminder(status, note);
    setNote("");
    setShowNote(false);
  };

  const snooze = () => {
    setNote("");
    setShowNote(false);
    snoozeReminder();
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={snooze}>
      <View style={[styles.scrim, { backgroundColor: c.scrim }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: c.surface,
              borderColor: c.line,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={styles.closeRow}>
            <IconButton
              icon="close"
              label={t("reminder.closeSnooze", { minutes: snoozeMinutes })}
              onPress={snooze}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: "center" }}>
              <View style={[styles.bell, { backgroundColor: c.brandSoft }]}>
                <MaterialIcons name="notifications-active" size={34} color={c.brandInk} />
              </View>

              <T size={22} weight="700" center style={{ marginTop: 14 }}>
                {t("reminder.title")}
              </T>

              <View style={styles.medRow}>
                <View
                  style={[styles.medIcon, { backgroundColor: withAlpha(medicine.color, 0.2) }]}
                >
                  <MaterialIcons name="medication" size={18} color={medicine.color} />
                </View>
                <T size={24} weight="700">
                  {medicine.name}
                </T>
              </View>
              <T tone="ink2">{medicine.dosage}</T>
              {mealText ? (
                <T size={15} tone="brandInk" weight="700" center style={{ marginTop: 4 }}>
                  {mealText}
                </T>
              ) : null}

              <View
                style={[styles.when, { backgroundColor: c.surface2, borderColor: c.line }]}
              >
                <T size={20} weight="700" center>
                  {formatTime12(time)}
                </T>
                <T size={15} tone="ink3" center>
                  {date === todayISO()
                    ? `${t("common.today")}, ${shortDate(date)}`
                    : prettyDate(date)}
                </T>
              </View>

              {medicine.notes ? (
                <View style={[styles.notes, { backgroundColor: c.brandSoft }]}>
                  <T size={15} tone="brandInk" center>
                    {medicine.notes}
                  </T>
                </View>
              ) : null}
            </View>

            {showNote && (
              <View style={{ marginTop: 16 }}>
                <TextArea
                  label={t("reminder.note")}
                  rows={2}
                  placeholder={t("reminder.notePlaceholder")}
                  value={note}
                  onChangeText={setNote}
                />
              </View>
            )}

            <View style={styles.actions}>
              <Button size="lg" icon="check" onPress={() => answer("taken")}>
                {t("reminder.taken")}
              </Button>
              <Button variant="secondary" icon="close" onPress={() => answer("skipped")}>
                {t("reminder.skip")}
              </Button>
              {/* Recording a miss explicitly beats leaving it to be inferred an
                  hour later: the history says what happened, not what expired. */}
              <Button variant="secondary" icon="warning-amber" onPress={() => answer("missed")}>
                {t("reminder.missed")}
              </Button>
              <Button variant="secondary" icon="snooze" onPress={snooze}>
                {t("reminder.snooze", { minutes: snoozeMinutes })}
              </Button>
              {!showNote && (
                <Button variant="ghost" icon="edit-note" onPress={() => setShowNote(true)}>
                  {t("reminder.addNote")}
                </Button>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  closeRow: { alignItems: "flex-end" },
  bell: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center" },
  medRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  medIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  when: {
    alignSelf: "stretch",
    marginTop: 16,
    borderRadius: RADIUS.field,
    borderWidth: 1,
    paddingVertical: 12,
  },
  notes: { alignSelf: "stretch", marginTop: 12, borderRadius: RADIUS.field, padding: 12 },
  actions: { marginTop: 20, gap: 10 },
});
