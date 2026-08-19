import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RADIUS, SNOOZE_MINUTES } from "../constants/theme";
import { useApp, useTheme } from "../context/AppContext";
import type { HistoryStatus } from "../types";
import { formatTime12, prettyDate, shortDate, todayISO } from "../utils/date";
import { withAlpha } from "../utils/color";
import { Button, IconButton, T, TextArea } from "./ui";

/**
 * Dose confirmation. Answering writes to history through the reminder flow,
 * which is what updates the home stats and adherence.
 */
export function ReminderSheet() {
  const { activeReminder, respondReminder, snoozeReminder } = useApp();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  if (!activeReminder) return null;
  const { medicine, time, date } = activeReminder;

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
              label={`Close and snooze ${SNOOZE_MINUTES} minutes`}
              onPress={snooze}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: "center" }}>
              <View style={[styles.bell, { backgroundColor: c.brandSoft }]}>
                <MaterialIcons name="notifications-active" size={34} color={c.brandInk} />
              </View>

              <T size={22} weight="700" center style={{ marginTop: 14 }}>
                It&apos;s time for your dose
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

              <View
                style={[styles.when, { backgroundColor: c.surface2, borderColor: c.line }]}
              >
                <T size={20} weight="700" center>
                  {formatTime12(time)}
                </T>
                <T size={15} tone="ink3" center>
                  {date === todayISO() ? `Today, ${shortDate(date)}` : prettyDate(date)}
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
                  label="Note (optional)"
                  rows={2}
                  placeholder="e.g. Taken with food"
                  value={note}
                  onChangeText={setNote}
                />
              </View>
            )}

            <View style={styles.actions}>
              <Button size="lg" icon="check" onPress={() => answer("taken")}>
                I&apos;ve taken this dose
              </Button>
              <Button variant="secondary" icon="close" onPress={() => answer("skipped")}>
                Skip this dose
              </Button>
              {/* Recording a miss explicitly beats leaving it to be inferred an
                  hour later: the history says what happened, not what expired. */}
              <Button variant="secondary" icon="warning-amber" onPress={() => answer("missed")}>
                I missed this dose
              </Button>
              <Button variant="secondary" icon="snooze" onPress={snooze}>
                {`Snooze ${SNOOZE_MINUTES} minutes`}
              </Button>
              {!showNote && (
                <Button variant="ghost" icon="edit-note" onPress={() => setShowNote(true)}>
                  Add note
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
