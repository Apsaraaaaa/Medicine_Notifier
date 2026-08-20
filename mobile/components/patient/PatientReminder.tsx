import { MaterialIcons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PATIENT_SIZES, PATIENT_TYPE, RADIUS } from "../../constants/theme";
import { useApp, useTheme } from "../../context/AppContext";
import { formatTime12 } from "../../utils/date";
import { mealSummary } from "../../utils/meal";
import { speechAvailable } from "../../utils/speech";

/**
 * The dose reminder in Patient Mode: full screen, two buttons.
 *
 * Full screen rather than a sheet because there is nothing behind it worth
 * seeing, and a sheet invites the guess that you can swipe it away. This fills
 * the display, so the only way past it is to answer it.
 *
 * Two answers, and that is the whole design. The full sheet offers taken,
 * skipped, missed, snooze and a note — five decisions at the moment somebody is
 * standing at the sink holding a glass of water. Here there is only "I have
 * taken it" and "ask me again shortly", which are the only two that change what
 * happens next. Nothing is lost: skipped and missed are still recorded from the
 * full interface, and a dose left unanswered is still counted as missed an hour
 * later by exactly the same rule.
 *
 * There is no close button. The back gesture snoozes rather than dismissing, so
 * a dose can never be lost to a stray tap.
 */
export function PatientReminder() {
  const {
    activeReminder,
    respondReminder,
    snoozeReminder,
    speakReminder,
    snoozeMinutes,
    settings,
    t,
  } = useApp();
  const c = useTheme();
  const insets = useSafeAreaInsets();

  // The voice itself is started and stopped by the reminder lifecycle in
  // AppContext, beside the alarm tone — not here. This screen only offers the
  // button to hear it again.
  const voiceOn = settings.voiceReminder && speechAvailable();

  if (!activeReminder) return null;
  const { medicine, time } = activeReminder;
  const mealText = mealSummary(medicine, t);

  return (
    <Modal visible animationType="fade" onRequestClose={snoozeReminder} statusBarTranslucent>
      <View
        style={[
          styles.screen,
          {
            backgroundColor: c.surface,
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.bell, { backgroundColor: c.brandSoft }]}>
            <MaterialIcons name="notifications-active" size={64} color={c.brandInk} />
          </View>

          <Text style={[styles.kicker, { color: c.ink2 }]}>{t("patient.timeToTake")}</Text>

          <Text style={[styles.name, { color: c.ink }]}>{medicine.name}</Text>

          {medicine.dosage ? (
            <Text style={[styles.dosage, { color: c.ink }]}>{medicine.dosage}</Text>
          ) : null}

          <View style={[styles.timeBox, { backgroundColor: c.surface2, borderColor: c.line }]}>
            <Text style={[styles.time, { color: c.ink }]}>{formatTime12(time)}</Text>
            {mealText ? (
              <Text style={[styles.meal, { color: c.brandInk }]}>{mealText}</Text>
            ) : null}
          </View>

          {medicine.notes ? (
            <View style={[styles.notes, { backgroundColor: c.brandSoft }]}>
              <Text style={[styles.notesText, { color: c.brandInk }]}>{medicine.notes}</Text>
            </View>
          ) : null}

          {/* Hearing it again is one tap, and only offered when the phone can
              actually speak — an inert button would be worse than none. */}
          {voiceOn && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("patient.repeat")}
              onPress={speakReminder}
              style={({ pressed }) => [
                styles.repeat,
                { backgroundColor: pressed ? c.surface2 : "transparent", borderColor: c.line },
              ]}
            >
              <MaterialIcons name="volume-up" size={PATIENT_SIZES.icon} color={c.brandInk} />
              <Text style={[styles.repeatText, { color: c.brandInk }]}>{t("patient.repeat")}</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Pinned to the bottom, outside the scroll view: the two answers must
            be reachable without scrolling, whatever the medicine name's length. */}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("patient.taken")}
            onPress={() => respondReminder("taken")}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: c.okSolid, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <MaterialIcons name="check-circle" size={PATIENT_SIZES.iconLg} color={c.onOk} />
            <Text style={[styles.primaryText, { color: c.onOk }]}>{t("patient.taken")}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("patient.snooze", { minutes: snoozeMinutes })}
            onPress={snoozeReminder}
            style={({ pressed }) => [
              styles.secondary,
              { backgroundColor: pressed ? c.surface2 : c.surface, borderColor: c.ink3 },
            ]}
          >
            <MaterialIcons name="snooze" size={PATIENT_SIZES.iconLg} color={c.ink} />
            <Text style={[styles.secondaryText, { color: c.ink }]}>
              {t("patient.snooze", { minutes: snoozeMinutes })}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  content: { alignItems: "center", paddingBottom: 16, flexGrow: 1, justifyContent: "center" },
  bell: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontSize: PATIENT_TYPE.small,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 20,
    textAlign: "center",
  },
  name: {
    fontSize: PATIENT_TYPE.headline,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 10,
  },
  dosage: { fontSize: PATIENT_TYPE.bodyLg, textAlign: "center", marginTop: 8 },
  timeBox: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 20,
    borderRadius: RADIUS.field,
    borderWidth: 1,
    paddingVertical: 18,
  },
  time: { fontSize: PATIENT_TYPE.display, fontWeight: "800" },
  meal: { fontSize: PATIENT_TYPE.body, fontWeight: "700", marginTop: 4 },
  notes: { alignSelf: "stretch", marginTop: 16, borderRadius: RADIUS.field, padding: 16 },
  notesText: { fontSize: PATIENT_TYPE.body, textAlign: "center" },
  repeat: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: PATIENT_SIZES.tap,
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  repeatText: { fontSize: PATIENT_TYPE.body, fontWeight: "800" },

  actions: { gap: 14, paddingTop: 16 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    minHeight: PATIENT_SIZES.button,
    borderRadius: RADIUS.btn,
    paddingHorizontal: 16,
  },
  primaryText: { fontSize: PATIENT_TYPE.title, fontWeight: "800" },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    minHeight: PATIENT_SIZES.button,
    borderRadius: RADIUS.btn,
    borderWidth: 3,
    paddingHorizontal: 16,
  },
  secondaryText: { fontSize: PATIENT_TYPE.bodyLg, fontWeight: "800" },
});
