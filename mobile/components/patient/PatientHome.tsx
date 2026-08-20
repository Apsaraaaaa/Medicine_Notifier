import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PATIENT_SIZES, PATIENT_TYPE, RADIUS, STATUS_META } from "../../constants/theme";
import { useApp, useTheme, useTodaySlots } from "../../context/AppContext";
import { formatTime12, longDate } from "../../utils/date";
import type { DoseSlot } from "../../utils/schedule";
import type { IconName } from "../ui";
import { PATIENT_STATUS_ICON } from "./status";

/**
 * The Patient Mode home screen.
 *
 * Three things and nothing else: what to take next, when, and the list of the
 * rest of today. No adherence ring, no filters, no trends, no charts — every
 * one of those is a number to interpret, and this screen exists for somebody
 * who should only ever have to answer "have I taken it?".
 *
 * It is a separate component rather than a branch inside the normal home
 * screen because the two share almost no layout, and interleaving them would
 * have made both harder to change without breaking the other.
 */
export function PatientHome() {
  const { user, triggerReminder, refresh, refreshing, t } = useApp();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const slots = useTodaySlots();

  // What to answer next: the dose that is ringing, else the next one due, else
  // anything still unanswered from earlier today.
  const next =
    slots.find((s) => s.status === "due") ??
    slots.find((s) => s.status === "snoozed") ??
    slots.find((s) => s.status === "upcoming") ??
    slots.find((s) => s.status === "missed");

  const done = slots.length > 0 && !next;

  return (
    <ScrollView
      style={{ backgroundColor: c.canvas }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} />
      }
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.hello, { color: c.ink }]} numberOfLines={1}>
          {user?.name || t("home.friend")}
        </Text>
        <Text style={[styles.date, { color: c.ink2 }]}>{longDate()}</Text>
      </View>

      {slots.length === 0 ? (
        <View style={{ paddingHorizontal: 16 }}>
          <EmptyCard
            icon="event-available"
            title={t("patient.nothingToday")}
            subtitle={t("patient.noMedicinesHint")}
          />
        </View>
      ) : (
        <>
          {/* ---- the one thing to do next ---- */}
          <View style={{ paddingHorizontal: 16 }}>
            {next ? (
              <NextMedicineCard
                slot={next}
                onAnswer={() => triggerReminder(next.medicine, next.time)}
                label={t("patient.nextMedicine")}
                action={t("patient.takeNow")}
              />
            ) : (
              <EmptyCard
                icon="check-circle"
                title={t("patient.allDone")}
                subtitle={t("patient.allDoneHint")}
                tone="ok"
              />
            )}
          </View>

          {/* ---- the rest of the day ---- */}
          <Text style={[styles.section, { color: c.ink2 }]}>
            {t("patient.todaysMedicines")}
          </Text>
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {slots.map((slot) => (
              <DoseRow
                key={slot.medicine.id + slot.time}
                slot={slot}
                onAnswer={() => triggerReminder(slot.medicine, slot.time)}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/**
 * The next dose, as large as the screen allows.
 *
 * The whole card is the button. A separate "take" control would be a second
 * target to aim at, and the card is already the only thing being offered.
 */
function NextMedicineCard({
  slot,
  onAnswer,
  label,
  action,
}: {
  slot: DoseSlot;
  onAnswer: () => void;
  label: string;
  action: string;
}) {
  return (
    <LinearGradient
      colors={["#3C1F8F", "#5B3AC4", "#7B61D9"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.nextCard}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${slot.medicine.name}. ${slot.medicine.dosage}. ${formatTime12(slot.time)}. ${action}`}
        onPress={onAnswer}
        style={({ pressed }) => [styles.nextBody, { opacity: pressed ? 0.92 : 1 }]}
      >
        <Text style={styles.nextKicker}>{label}</Text>

        <Text style={styles.nextName} numberOfLines={3}>
          {slot.medicine.name}
        </Text>
        {slot.medicine.dosage ? (
          <Text style={styles.nextDosage} numberOfLines={2}>
            {slot.medicine.dosage}
          </Text>
        ) : null}

        <View style={styles.nextTimeRow}>
          <MaterialIcons name="schedule" size={PATIENT_SIZES.iconLg} color="#FFFFFF" />
          <Text style={styles.nextTime}>{formatTime12(slot.time)}</Text>
        </View>

        {/* Pure white on the fixed gradient: this pairing is the same in both
            themes, so it cannot lose contrast when dark mode is on. */}
        <View style={styles.nextAction}>
          <MaterialIcons name="check-circle" size={PATIENT_SIZES.icon} color="#3C1F8F" />
          <Text style={styles.nextActionText}>{action}</Text>
        </View>
      </Pressable>
    </LinearGradient>
  );
}

/**
 * One dose in the day: time, medicine, dose, and a status you can read across
 * a room. A dose still waiting for an answer is pressable; one already
 * answered is not, so there is nothing to undo by accident.
 */
function DoseRow({ slot, onAnswer }: { slot: DoseSlot; onAnswer: () => void }) {
  const c = useTheme();
  const { t } = useApp();
  const meta = STATUS_META[slot.status];
  const answerable = slot.status === "due" || slot.status === "missed" || slot.status === "snoozed";
  const label = t(meta.label);

  const body = (
    <>
      <View style={[styles.statusBadge, { backgroundColor: c[meta.soft] }]}>
        <MaterialIcons
          name={PATIENT_STATUS_ICON[slot.status]}
          size={PATIENT_SIZES.statusIcon}
          color={c[meta.ink]}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTime, { color: c.ink }]}>{formatTime12(slot.time)}</Text>
        <Text style={[styles.rowName, { color: c.ink }]} numberOfLines={2}>
          {slot.medicine.name}
        </Text>
        {slot.medicine.dosage ? (
          <Text style={[styles.rowDosage, { color: c.ink2 }]} numberOfLines={1}>
            {slot.medicine.dosage}
          </Text>
        ) : null}
        <Text style={[styles.rowStatus, { color: c[meta.ink] }]}>{label}</Text>
      </View>

      {answerable && (
        <MaterialIcons name="chevron-right" size={PATIENT_SIZES.icon} color={c.ink3} />
      )}
    </>
  );

  if (!answerable) {
    return (
      <View
        accessible
        accessibilityLabel={`${formatTime12(slot.time)}. ${slot.medicine.name}. ${label}`}
        style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatTime12(slot.time)}. ${slot.medicine.name}. ${label}. ${t("patient.takeNow")}`}
      onPress={onAnswer}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? c.surface2 : c.surface,
          // A dose that still needs an answer gets a heavy border, so it is
          // distinguishable from a finished one without relying on colour.
          borderColor: c.brand,
          borderWidth: 3,
        },
      ]}
    >
      {body}
    </Pressable>
  );
}

function EmptyCard({
  icon,
  title,
  subtitle,
  tone = "neutral",
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  tone?: "neutral" | "ok";
}) {
  const c = useTheme();
  const fg = tone === "ok" ? c.okInk : c.ink2;
  return (
    <View
      style={[
        styles.empty,
        { backgroundColor: tone === "ok" ? c.okSoft : c.surface, borderColor: c.line },
      ]}
    >
      <MaterialIcons name={icon} size={72} color={fg} />
      <Text style={[styles.emptyTitle, { color: tone === "ok" ? c.okInk : c.ink }]}>{title}</Text>
      {subtitle ? <Text style={[styles.emptyBody, { color: c.ink2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  hello: { fontSize: PATIENT_TYPE.headline, fontWeight: "800" },
  date: { fontSize: PATIENT_TYPE.body, marginTop: 4 },

  nextCard: { borderRadius: RADIUS.card, overflow: "hidden" },
  nextBody: { padding: 22 },
  nextKicker: {
    color: "rgba(255,255,255,0.85)",
    fontSize: PATIENT_TYPE.small,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  nextName: {
    color: "#FFFFFF",
    fontSize: PATIENT_TYPE.title,
    fontWeight: "800",
    marginTop: 10,
  },
  nextDosage: { color: "rgba(255,255,255,0.9)", fontSize: PATIENT_TYPE.body, marginTop: 4 },
  nextTimeRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  nextTime: { color: "#FFFFFF", fontSize: PATIENT_TYPE.display, fontWeight: "800" },
  nextAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: PATIENT_SIZES.button,
    borderRadius: RADIUS.btn,
    backgroundColor: "#FFFFFF",
    marginTop: 20,
    paddingHorizontal: 16,
  },
  nextActionText: { color: "#3C1F8F", fontSize: PATIENT_TYPE.bodyLg, fontWeight: "800" },

  section: {
    fontSize: PATIENT_TYPE.small,
    fontWeight: "800",
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    marginTop: 28,
    marginBottom: 12,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 108,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 16,
  },
  statusBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTime: { fontSize: PATIENT_TYPE.bodyLg, fontWeight: "800" },
  rowName: { fontSize: PATIENT_TYPE.body, fontWeight: "700", marginTop: 2 },
  rowDosage: { fontSize: PATIENT_TYPE.small, marginTop: 2 },
  rowStatus: { fontSize: PATIENT_TYPE.small, fontWeight: "800", marginTop: 6 },

  empty: {
    alignItems: "center",
    borderRadius: RADIUS.card,
    borderWidth: 1,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: PATIENT_TYPE.title,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 16,
  },
  emptyBody: {
    fontSize: PATIENT_TYPE.body,
    textAlign: "center",
    marginTop: 8,
  },
});
