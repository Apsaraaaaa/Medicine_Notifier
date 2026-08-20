import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PATIENT_SIZES, PATIENT_TYPE, RADIUS } from "../../constants/theme";
import { useApp, useTheme } from "../../context/AppContext";
import type { Medicine } from "../../types";
import { withAlpha } from "../../utils/color";
import { formatTime12 } from "../../utils/date";
import { isActive } from "../MedicineCard";

/**
 * My Medicines in Patient Mode: add, edit, delete, and nothing else.
 *
 * The full list screen carries a search box, three filters, counts in the
 * header and an overflow menu behind a ⋮. All of that is right when somebody
 * is managing a dozen medicines; none of it helps when there are four and you
 * want to change the time on one.
 *
 * So each medicine is a large card showing what it is and when it is taken,
 * with its two actions spelled out as buttons rather than hidden in a menu —
 * a ⋮ is not discoverable for somebody who has never been taught what it means.
 * Both actions reuse the existing screens: Edit opens the same form the full
 * app uses, and Delete goes through the same confirmation and the same API.
 */
export function PatientMedicines() {
  const { medicines, removeMedicine, refresh, refreshing, t } = useApp();
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [confirm, setConfirm] = useState<Medicine | null>(null);
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await removeMedicine(confirm.id);
      setConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} />
        }
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={[styles.title, { color: c.ink }]}>{t("nav.myMedicines")}</Text>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("nav.addMedicine")}
            onPress={() => router.push("/medicine/new")}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: c.brandSolid, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <MaterialIcons name="add-circle" size={PATIENT_SIZES.iconLg} color={c.onBrand} />
            <Text style={[styles.addText, { color: c.onBrand }]}>{t("nav.addMedicine")}</Text>
          </Pressable>
        </View>

        {medicines.length === 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
            <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.line }]}>
              <MaterialIcons name="medication" size={72} color={c.ink3} />
              <Text style={[styles.emptyTitle, { color: c.ink }]}>
                {t("patient.noMedicines")}
              </Text>
              <Text style={[styles.emptyBody, { color: c.ink2 }]}>
                {t("patient.noMedicinesHint")}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 14 }}>
            {medicines.map((medicine) => (
              <MedicineCardLarge
                key={medicine.id}
                medicine={medicine}
                onEdit={() => router.push(`/medicine/${medicine.id}`)}
                onDelete={() => setConfirm(medicine)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Deleting is the one destructive thing on this screen, so it asks —
          in the same large type, with the medicine named in the question. */}
      {confirm && (
        <ConfirmDelete
          medicine={confirm}
          busy={deleting}
          onCancel={() => setConfirm(null)}
          onConfirm={doDelete}
        />
      )}
    </View>
  );
}

function MedicineCardLarge({
  medicine,
  onEdit,
  onDelete,
}: {
  medicine: Medicine;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = useTheme();
  const { t } = useApp();
  const active = isActive(medicine);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.cardHead}>
        <View style={[styles.pill, { backgroundColor: withAlpha(medicine.color, 0.2) }]}>
          <MaterialIcons name="medication" size={PATIENT_SIZES.icon} color={medicine.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.cardName, { color: c.ink }]} numberOfLines={2}>
            {medicine.name}
          </Text>
          {medicine.dosage ? (
            <Text style={[styles.cardDosage, { color: c.ink2 }]} numberOfLines={2}>
              {medicine.dosage}
            </Text>
          ) : null}
        </View>
      </View>

      {/* When it is taken — the thing most likely to need changing. */}
      <View style={styles.times}>
        {medicine.times.length === 0 ? (
          <Text style={[styles.timeChipText, { color: c.ink3 }]}>
            {t("medicines.noReminders")}
          </Text>
        ) : (
          medicine.times.map((time) => (
            <View key={time} style={[styles.timeChip, { backgroundColor: c.brandSoft }]}>
              <MaterialIcons name="schedule" size={22} color={c.brandInk} />
              <Text style={[styles.timeChipText, { color: c.brandInk }]}>
                {formatTime12(time)}
              </Text>
            </View>
          ))
        )}
      </View>

      {!active && (
        <Text style={[styles.inactive, { color: c.ink3 }]}>{t("status.inactive")}</Text>
      )}

      <View style={styles.cardActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("common.edit")} ${medicine.name}`}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: pressed ? c.surface2 : c.surface, borderColor: c.brand },
          ]}
        >
          <MaterialIcons name="edit" size={PATIENT_SIZES.icon} color={c.brandInk} />
          <Text style={[styles.actionText, { color: c.brandInk }]}>{t("common.edit")}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("common.delete")} ${medicine.name}`}
          onPress={onDelete}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: pressed ? c.badSoft : c.surface, borderColor: c.badInk },
          ]}
        >
          <MaterialIcons name="delete" size={PATIENT_SIZES.icon} color={c.badInk} />
          <Text style={[styles.actionText, { color: c.badInk }]}>{t("common.delete")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ConfirmDelete({
  medicine,
  busy,
  onCancel,
  onConfirm,
}: {
  medicine: Medicine;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const c = useTheme();
  const { t } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: c.scrim }]}>
      <View
        style={[
          styles.dialog,
          { backgroundColor: c.surface, borderColor: c.line, marginBottom: insets.bottom },
        ]}
      >
        <MaterialIcons name="warning-amber" size={64} color={c.badInk} />
        <Text style={[styles.dialogTitle, { color: c.ink }]}>
          {t("medicines.deleteTitle", { name: medicine.name })}
        </Text>
        <Text style={[styles.dialogBody, { color: c.ink2 }]}>{t("medicines.deleteBody")}</Text>

        <View style={{ alignSelf: "stretch", gap: 12, marginTop: 22 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.action,
              styles.dialogButton,
              { backgroundColor: pressed ? c.surface2 : c.surface, borderColor: c.ink3 },
            ]}
          >
            <Text style={[styles.actionText, { color: c.ink }]}>{t("common.cancel")}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.delete")}
            accessibilityState={{ busy }}
            disabled={busy}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.action,
              styles.dialogButton,
              {
                backgroundColor: c.badSolid,
                borderColor: "transparent",
                opacity: busy ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <MaterialIcons name="delete" size={PATIENT_SIZES.icon} color={c.onBad} />
            <Text style={[styles.actionText, { color: c.onBad }]}>{t("common.delete")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  title: { fontSize: PATIENT_TYPE.headline, fontWeight: "800" },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: PATIENT_SIZES.button,
    borderRadius: RADIUS.btn,
    paddingHorizontal: 16,
  },
  addText: { fontSize: PATIENT_TYPE.bodyLg, fontWeight: "800" },

  card: { borderRadius: RADIUS.card, borderWidth: 1, padding: 18, gap: 14 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  pill: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: PATIENT_TYPE.body, fontWeight: "800" },
  cardDosage: { fontSize: PATIENT_TYPE.small, marginTop: 4 },
  times: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  timeChipText: { fontSize: PATIENT_TYPE.small, fontWeight: "800" },
  inactive: { fontSize: PATIENT_TYPE.small, fontWeight: "700" },
  cardActions: { flexDirection: "row", gap: 12 },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: PATIENT_SIZES.tap,
    borderRadius: RADIUS.btn,
    borderWidth: 3,
    paddingHorizontal: 12,
  },
  actionText: { fontSize: PATIENT_TYPE.small, fontWeight: "800" },

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
  emptyBody: { fontSize: PATIENT_TYPE.body, textAlign: "center", marginTop: 8 },

  scrim: { alignItems: "center", justifyContent: "center", padding: 20 },
  dialog: {
    width: "100%",
    alignItems: "center",
    borderRadius: RADIUS.sheet,
    borderWidth: 1,
    padding: 24,
  },
  dialogTitle: {
    fontSize: PATIENT_TYPE.title,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 14,
  },
  dialogBody: { fontSize: PATIENT_TYPE.small, textAlign: "center", marginTop: 10 },
  dialogButton: { flex: 0, minHeight: PATIENT_SIZES.button },
});
