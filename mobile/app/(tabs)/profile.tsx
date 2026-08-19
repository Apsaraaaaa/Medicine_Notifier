import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { isActive } from "../../components/MedicineCard";
import {
  AppHeader,
  Button,
  Card,
  Field,
  Modal,
  SectionTitle,
  SettingsRow,
  Sheet,
  T,
  Toggle,
} from "../../components/ui";
import { APP_VERSION, RADIUS, SNOOZE_MINUTES } from "../../constants/theme";
import { useApp, useTheme } from "../../context/AppContext";
import { adherenceVerdict, buildDailyStats, rangeDays, summarize } from "../../utils/insights";
import { exportHistoryCsv } from "../../utils/export";

type SheetKey = "caregiver" | "help" | "about" | null;

export default function ProfileScreen() {
  const { user, logout, medicines, history, settings, updateSettings, updateProfile } = useApp();
  const c = useTheme();
  const router = useRouter();

  const [confirmOut, setConfirmOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [exported, setExported] = useState("");

  const activeCount = medicines.filter((m) => isActive(m)).length;
  const days = rangeDays("month", medicines, history);
  const summary = summarize(buildDailyStats(medicines, history, days));

  const saveName = async () => {
    if (!name.trim()) return setNameError("Name required.");
    setSaving(true);
    setNameError("");
    try {
      await updateProfile(name.trim());
      setEditing(false);
    } catch (e) {
      setNameError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doExport = async () => {
    try {
      const count = await exportHistoryCsv(history);
      setExported(count === 0 ? "Nothing to export yet." : `Exported ${count} dose records as CSV.`);
    } catch {
      setExported("Couldn't write the export file.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader title="Profile" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* identity */}
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[styles.avatar, { backgroundColor: c.brandSoft }]}>
            <Text style={{ color: c.brandInk, fontSize: 22, fontWeight: "700" }}>
              {(user?.name || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={19} weight="700" numberOfLines={1}>
              {user?.name}
            </T>
            <T size={15} tone="ink3" numberOfLines={1}>
              {user?.email}
            </T>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setName(user?.name ?? "");
                setNameError("");
                setEditing(true);
              }}
              style={styles.editLink}
            >
              <MaterialIcons name="edit" size={17} color={c.brandInk} />
              <Text style={{ color: c.brandInk, fontWeight: "700", fontSize: 15 }}>
                Edit profile
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* account stats — each opens the screen it summarises */}
        <View style={styles.stats}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${activeCount} active medicines. Open medicines`}
            onPress={() => router.push("/medicines")}
            style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <MaterialIcons name="medication" size={22} color={c.brandInk} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={19} weight="700">
                {activeCount}
              </T>
              <T size={15} tone="ink3" numberOfLines={1}>
                Active medicines
              </T>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={c.ink3} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${summary.adherence === null ? "No" : summary.adherence + "%"} consistency. Open history and insights`}
            onPress={() => router.push("/history")}
            style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <MaterialIcons name="insights" size={22} color={c.okInk} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={19} weight="700">
                {summary.adherence === null ? "—" : `${summary.adherence}%`}
              </T>
              <T size={15} tone="ink3" numberOfLines={1}>
                {summary.adherence === null ? "No data yet" : adherenceVerdict(summary.adherence)}
              </T>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={c.ink3} />
          </Pressable>
        </View>

        {/* settings */}
        <View style={{ marginTop: 20 }}>
          <SectionTitle>Settings</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            <SettingsRow
              icon="notifications"
              label="Notifications"
              description="Reminders, alarm sound & volume"
              value={settings.notifications ? "On" : "Off"}
              onPress={() => router.push("/settings")}
            />
            <SettingsRow
              icon="dark-mode"
              label="Dark mode"
              description="Easier on the eyes at night"
              control={
                <Toggle
                  label="Dark mode"
                  on={settings.darkMode}
                  onChange={(v) => updateSettings({ darkMode: v })}
                />
              }
            />
            <SettingsRow
              icon="family-restroom"
              label="Caregiver / Family access"
              description="Not available yet"
              onPress={() => setSheet("caregiver")}
            />
            <SettingsRow
              icon="ios-share"
              label="Export history"
              description="Share a CSV of every recorded dose"
              onPress={doExport}
            />
            <SettingsRow icon="help-outline" label="Help & support" onPress={() => setSheet("help")} />
            <SettingsRow
              icon="info-outline"
              label="About the app"
              value={`v${APP_VERSION}`}
              onPress={() => setSheet("about")}
            />
          </Card>
          {exported ? (
            <T size={15} weight="600" tone="okInk" style={{ marginTop: 8, paddingHorizontal: 4 }}>
              {exported}
            </T>
          ) : null}
        </View>

        <View style={{ marginTop: 20 }}>
          <Button variant="secondary" icon="logout" onPress={() => setConfirmOut(true)}>
            Log out
          </Button>
        </View>
      </ScrollView>

      {editing && (
        <Modal
          title="Edit profile"
          description="Your email is used to sign in and can't be changed here."
          onClose={() => setEditing(false)}
        >
          <View style={{ gap: 16 }}>
            <Field label="Full name" value={name} error={nameError} onChangeText={setName} />
            <Field label="Email" value={user?.email ?? ""} editable={false} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Button variant="secondary" style={{ flex: 1 }} onPress={() => setEditing(false)}>
                Cancel
              </Button>
              <Button style={{ flex: 1 }} loading={saving} onPress={saveName}>
                Save
              </Button>
            </View>
          </View>
        </Modal>
      )}

      {confirmOut && (
        <Modal
          title="Log out?"
          description="You'll need to log in again next time. Your medicines and history stay safe on the server."
          onClose={() => setConfirmOut(false)}
        >
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmOut(false)}>
              Cancel
            </Button>
            <Button variant="danger" style={{ flex: 1 }} onPress={logout}>
              Log out
            </Button>
          </View>
        </Modal>
      )}

      {sheet === "caregiver" && (
        <Sheet title="Caregiver / Family access" onClose={() => setSheet(null)}>
          <T tone="ink2" style={{ paddingBottom: 16 }}>
            Sharing a schedule with a family member needs a second account linked to yours, which
            the API doesn&apos;t model yet. In the meantime,{" "}
            <T weight="700">Export history</T> produces a CSV you can send to a caregiver or
            doctor.
          </T>
        </Sheet>
      )}

      {sheet === "help" && (
        <Sheet title="Help & support" onClose={() => setSheet(null)}>
          <View style={{ gap: 12, paddingBottom: 16 }}>
            <T tone="ink2">
              <T weight="700">Reminders</T> fire at each time you set. The app schedules them with
              the phone, so they arrive even when it is closed.
            </T>
            <T tone="ink2">
              <T weight="700">Snooze</T> asks again after {SNOOZE_MINUTES} minutes.{" "}
              <T weight="700">Skip</T> records a deliberate skip.
            </T>
            <T tone="ink2">
              A dose you don&apos;t answer within an hour is counted as{" "}
              <T weight="700">missed</T>, so your history stays honest.
            </T>
          </View>
        </Sheet>
      )}

      {sheet === "about" && (
        <Sheet title="About Medicine Notifier" onClose={() => setSheet(null)}>
          <View style={{ gap: 12, paddingBottom: 16 }}>
            <T tone="ink2">
              Version {APP_VERSION}. Medicine Notifier keeps your daily doses, rings when each one
              is due, and records what you answered so you can see how closely you&apos;re keeping
              to plan.
            </T>
            <T tone="ink2">
              Your medicines and history are stored in your account on the Django API, so they
              follow you to any device you sign in on.
            </T>
          </View>
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center" },
  editLink: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36 },
  stats: { flexDirection: "row", gap: 8, marginTop: 12 },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    padding: 14,
  },
});
