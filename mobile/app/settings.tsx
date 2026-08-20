import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import { LanguageSwitch } from "../components/LanguageSwitch";
import { LANGUAGES } from "../i18n";
import {
  AppHeader,
  Button,
  Card,
  Field,
  SectionTitle,
  SettingsRow,
  T,
  Toggle,
} from "../components/ui";
import { RADIUS } from "../constants/theme";
import { useApp, useTheme, useVoiceStatus } from "../context/AppContext";
import { startAlarm, stopAlarm } from "../notifications/alarm";

import {
  NOTIFICATIONS_AVAILABLE,
  reminderStatus,
  requestPermission,
} from "../notifications/reminders";

/** Matches the server's rule, so the form never bounces off the API. */
const MIN_PASSWORD = 8;

export default function SettingsScreen() {
  const { settings, updateSettings, changePassword, remindersScheduled, snoozeMinutes, t } =
    useApp();
  const c = useTheme();
  const router = useRouter();
  const voice = useVoiceStatus();
  const languageName =
    LANGUAGES.find((l) => l.key === settings.language)?.native ?? settings.language;

  const [testing, setTesting] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const testTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What the phone is actually holding, so this screen can answer "are my
  // reminders set?" without anyone having to take it on trust.
  const [allowed, setAllowed] = useState<boolean | null>(null);

  // Leaving the screen must not leave the test alarm ringing.
  useEffect(() => {
    return () => {
      if (testTimer.current) clearTimeout(testTimer.current);
      stopAlarm();
    };
  }, []);

  useEffect(() => {
    let live = true;
    reminderStatus().then((s) => live && setAllowed(s.allowed));
    return () => {
      live = false;
    };
  }, [settings.notifications, remindersScheduled]);

  const testAlarm = () => {
    if (testing) {
      if (testTimer.current) clearTimeout(testTimer.current);
      stopAlarm();
      setTesting(false);
      return;
    }
    startAlarm(settings.volume);
    setTesting(true);
    testTimer.current = setTimeout(() => {
      stopAlarm();
      setTesting(false);
    }, 3000);
  };

  const submitPw = async () => {
    setMsg(null);
    if (newPw.length < MIN_PASSWORD) {
      return setMsg({
        ok: false,
        text: t("settings.passwordTooShort", { count: MIN_PASSWORD }),
      });
    }
    setBusy(true);
    try {
      await changePassword(oldPw, newPw);
      setMsg({ ok: true, text: t("settings.passwordUpdated") });
      setOldPw("");
      setNewPw("");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const setNotifications = async (on: boolean) => {
    // Asking as the switch goes on keeps the OS prompt tied to the intent.
    if (on) await requestPermission();
    updateSettings({ notifications: on });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <SectionTitle>{t("settings.patientMode")}</SectionTitle>
        <Card style={{ marginBottom: 20, paddingVertical: 4 }}>
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
            icon="snooze"
            label={t("settings.snoozeLength")}
            description={t("settings.snoozeHint")}
            value={t("settings.minutes", { count: snoozeMinutes })}
          />
        </Card>

        <SectionTitle>{t("settings.language")}</SectionTitle>
        <Card style={{ marginBottom: 20, gap: 10 }}>
          <T size={15} tone="ink3">
            {t("settings.languageHint")}
          </T>
          <LanguageSwitch />
        </Card>

        <SectionTitle>{t("settings.reminders")}</SectionTitle>

        {!NOTIFICATIONS_AVAILABLE && (
          <View
            style={{
              backgroundColor: c.warnSoft,
              borderRadius: RADIUS.field,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <T size={15} weight="600" tone="warnInk">
              {t("settings.expoGo")}
            </T>
          </View>
        )}

        <Card style={{ marginBottom: 20, paddingVertical: 4 }}>
          <SettingsRow
            icon="notifications"
            label={t("settings.notifications")}
            description={t("settings.notificationsHint")}
            control={
              <Toggle
                label={t("settings.notifications")}
                on={settings.notifications}
                onChange={setNotifications}
              />
            }
          />
          <SettingsRow
            icon="music-note"
            label={t("settings.alarmSound")}
            description={t("settings.alarmSoundHint")}
            control={
              <Toggle
                label={t("settings.alarmSound")}
                on={settings.alarmSound}
                onChange={(v) => updateSettings({ alarmSound: v })}
              />
            }
          />
          <SettingsRow
            icon={allowed === false ? "notifications-off" : "alarm-on"}
            label={t("settings.onThisPhone")}
            description={
              allowed === false
                ? t("settings.blocked")
                : remindersScheduled === 0
                  ? t("settings.nothingScheduled")
                  : t("settings.willRing")
            }
            value={allowed === false ? t("common.off") : String(remindersScheduled)}
            onPress={
              allowed === false
                ? () => requestPermission().then((ok) => setAllowed(ok))
                : undefined
            }
          />
        </Card>

        <SectionTitle>{t("settings.sound")}</SectionTitle>
        <Card style={{ marginBottom: 20 }}>
          <SettingsRow
            icon="volume-up"
            label={t("settings.volume")}
            description={t("settings.volumeHint", {
              percent: Math.round(settings.volume * 100),
            })}
          />
          <Slider
            accessibilityLabel={t("settings.volume")}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={settings.volume}
            onSlidingComplete={(v: number) => updateSettings({ volume: v })}
            minimumTrackTintColor={c.brand}
            maximumTrackTintColor={c.line}
            thumbTintColor={c.brandSolid}
            style={{ height: 40 }}
          />
          <Button
            variant={testing ? "danger" : "secondary"}
            icon={testing ? "stop" : "notifications-active"}
            onPress={testAlarm}
            style={{ marginTop: 12 }}
          >
            {t(testing ? "settings.stopTest" : "settings.testAlarm")}
          </Button>
        </Card>

        <SectionTitle>{t("settings.account")}</SectionTitle>
        <Card style={{ gap: 16 }}>
          <SettingsRow icon="lock" label={t("settings.changePassword")} />
          <Field
            label={t("settings.currentPassword")}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            value={oldPw}
            onChangeText={setOldPw}
          />
          <Field
            label={t("settings.newPassword")}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            hint={t("auth.minChars", { count: MIN_PASSWORD })}
            value={newPw}
            onChangeText={setNewPw}
          />
          <Button loading={busy} onPress={submitPw}>
            {t("settings.updatePassword")}
          </Button>
          {msg && (
            <View
              style={{
                backgroundColor: msg.ok ? c.okSoft : c.badSoft,
                borderRadius: RADIUS.field,
                paddingVertical: 10,
                paddingHorizontal: 16,
              }}
            >
              <T size={15} weight="600" tone={msg.ok ? "okInk" : "badInk"} center>
                {msg.text}
              </T>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
