import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { LanguageSwitch } from "../../components/LanguageSwitch";
import { LANGUAGES } from "../../i18n";
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
  StatusBadge,
  T,
  Toggle,
} from "../../components/ui";
import { APP_VERSION, RADIUS } from "../../constants/theme";
import { useApp, useTheme, useVoiceStatus } from "../../context/AppContext";
import { adherenceVerdict, buildDailyStats, rangeDays, summarize } from "../../utils/insights";
import { exportHistoryCsv } from "../../utils/export";


type SheetKey = "help" | "about" | null;

export default function ProfileScreen() {
  const {
    user,
    logout,
    medicines,
    history,
    settings,
    updateSettings,
    updateProfile,
    patients,
    unreadAlerts,
    snoozeMinutes,
    t,
  } = useApp();
  const c = useTheme();
  const router = useRouter();
  const voice = useVoiceStatus();
  const languageName =
    LANGUAGES.find((l) => l.key === settings.language)?.native ?? settings.language;

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
    if (!name.trim()) return setNameError(t("profile.nameRequired"));
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
      setExported(
        count === 0 ? t("profile.exportEmpty") : t("profile.exported", { count })
      );
    } catch {
      setExported(t("profile.exportFailed"));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader title={t("profile.title")} />

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
                {t("profile.editProfile")}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Language sits above everything else on purpose: somebody who opened
            the app in the wrong language needs to find this first, and it is
            labelled in both scripts so it is findable either way. */}
        <View style={{ marginTop: 20 }}>
          <SectionTitle>{t("profile.language")}</SectionTitle>
          <Card>
            <LanguageSwitch />
          </Card>
        </View>

        {/* account stats — each opens the screen it summarises */}
        <View style={styles.stats}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${activeCount} ${t("profile.activeMedicines")}`}
            onPress={() => router.push("/medicines")}
            style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <MaterialIcons name="medication" size={22} color={c.brandInk} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={19} weight="700">
                {activeCount}
              </T>
              <T size={15} tone="ink3" numberOfLines={1}>
                {t("profile.activeMedicines")}
              </T>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={c.ink3} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("home.consistency")}
            onPress={() => router.push("/history")}
            style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <MaterialIcons name="insights" size={22} color={c.okInk} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={19} weight="700">
                {summary.adherence === null ? "—" : `${summary.adherence}%`}
              </T>
              <T size={15} tone="ink3" numberOfLines={1}>
                {summary.adherence === null
                  ? t("profile.noDataYet")
                  : t(adherenceVerdict(summary.adherence))}
              </T>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={c.ink3} />
          </Pressable>
        </View>

        {/* settings */}
        <View style={{ marginTop: 20 }}>
          <SectionTitle>{t("profile.settings")}</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            <SettingsRow
              icon="accessibility-new"
              label={t("settings.patientMode")}
              description={t("settings.patientModeHint")}
              control={
                <Toggle
                  label={t("settings.patientMode")}
                  on={settings.patientMode}
                  onChange={(v) => updateSettings({ patientMode: v })}
                />
              }
            />
            <SettingsRow
              icon="record-voice-over"
              label={t("settings.voiceReminder")}
              description={t(voice.hint, { language: languageName })}
              control={
                <Toggle
                  label={t("settings.voiceReminder")}
                  on={settings.voiceReminder && voice.available}
                  onChange={(v) => updateSettings({ voiceReminder: v })}
                  disabled={!voice.available}
                />
              }
            />
            <SettingsRow
              icon="summarize"
              label={t("report.open")}
              description={t("report.openHint")}
              onPress={() => router.push("/report")}
            />
            <SettingsRow
              icon="document-scanner"
              label={t("scan.open")}
              description={t("scan.openHint")}
              onPress={() => router.push("/scan")}
            />
            <SettingsRow
              icon="family-restroom"
              label={t("care.open")}
              description={t("care.openHint")}
              control={
                unreadAlerts > 0 ? (
                  <StatusBadge
                    label={t("care.unreadAlerts", { count: unreadAlerts })}
                    bg={c.badSoft}
                    fg={c.badInk}
                  />
                ) : patients.length > 0 ? (
                  <StatusBadge label={String(patients.length)} bg={c.brandSoft} fg={c.brandInk} />
                ) : undefined
              }
              onPress={() => router.push("/caregivers")}
            />
            <SettingsRow
              icon="notifications"
              label={t("profile.notifications")}
              description={t("profile.notificationsHint")}
              value={settings.notifications ? t("common.on") : t("common.off")}
              onPress={() => router.push("/settings")}
            />
            <SettingsRow
              icon="dark-mode"
              label={t("profile.darkMode")}
              description={t("profile.darkModeHint")}
              control={
                <Toggle
                  label={t("profile.darkMode")}
                  on={settings.darkMode}
                  onChange={(v) => updateSettings({ darkMode: v })}
                />
              }
            />
            <SettingsRow
              icon="ios-share"
              label={t("profile.exportHistory")}
              description={t("profile.exportHistoryHint")}
              onPress={doExport}
            />
            <SettingsRow
              icon="help-outline"
              label={t("profile.help")}
              onPress={() => setSheet("help")}
            />
            <SettingsRow
              icon="info-outline"
              label={t("profile.about")}
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
            {t("profile.logout")}
          </Button>
        </View>
      </ScrollView>

      {editing && (
        <Modal
          title={t("profile.editTitle")}
          description={t("profile.editBody")}
          onClose={() => setEditing(false)}
        >
          <View style={{ gap: 16 }}>
            <Field
              label={t("auth.fullName")}
              value={name}
              error={nameError}
              onChangeText={setName}
            />
            <Field label={t("auth.email")} value={user?.email ?? ""} editable={false} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Button variant="secondary" style={{ flex: 1 }} onPress={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
              <Button style={{ flex: 1 }} loading={saving} onPress={saveName}>
                {t("common.save")}
              </Button>
            </View>
          </View>
        </Modal>
      )}

      {confirmOut && (
        <Modal
          title={t("profile.logoutTitle")}
          description={t("profile.logoutBody")}
          onClose={() => setConfirmOut(false)}
        >
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmOut(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" style={{ flex: 1 }} onPress={logout}>
              {t("profile.logout")}
            </Button>
          </View>
        </Modal>
      )}

      {sheet === "help" && (
        <Sheet title={t("profile.help")} onClose={() => setSheet(null)}>
          <View style={{ gap: 12, paddingBottom: 16 }}>
            <T tone="ink2">{t("profile.helpReminders")}</T>
            <T tone="ink2">{t("profile.helpSnooze", { minutes: snoozeMinutes })}</T>
            <T tone="ink2">{t("profile.helpMissed")}</T>
          </View>
        </Sheet>
      )}

      {sheet === "about" && (
        <Sheet title={t("profile.about")} onClose={() => setSheet(null)}>
          <View style={{ gap: 12, paddingBottom: 16 }}>
            <T tone="ink2">{t("profile.aboutBody", { version: APP_VERSION })}</T>
            <T tone="ink2">{t("profile.aboutStorage")}</T>
          </View>
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center" },
  editLink: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36 },
  stats: { flexDirection: "row", gap: 8, marginTop: 20 },
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
