import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";

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
import { RADIUS, SNOOZE_MINUTES } from "../constants/theme";
import { useApp, useTheme } from "../context/AppContext";
import { startAlarm, stopAlarm } from "../notifications/alarm";
import {
  NOTIFICATIONS_AVAILABLE,
  reminderStatus,
  requestPermission,
} from "../notifications/reminders";

/** Matches the server's rule, so the form never bounces off the API. */
const MIN_PASSWORD = 8;

export default function SettingsScreen() {
  const { settings, updateSettings, changePassword, remindersScheduled } = useApp();
  const c = useTheme();
  const router = useRouter();

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
      return setMsg({ ok: false, text: `New password must be ${MIN_PASSWORD}+ characters.` });
    }
    setBusy(true);
    try {
      await changePassword(oldPw, newPw);
      setMsg({ ok: true, text: "Password updated." });
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
        title="Notifications"
        subtitle="Reminders, sound & account"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <SectionTitle>Reminders</SectionTitle>

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
              Running in Expo Go, which cannot schedule notifications. Doses still ring while the
              app is open. For reminders with the app closed, run a development build
              (npx expo run:android).
            </T>
          </View>
        )}

        <Card style={{ marginBottom: 20, paddingVertical: 4 }}>
          <SettingsRow
            icon="notifications"
            label="Notifications"
            description="Schedule a reminder for every dose"
            control={
              <Toggle
                label="Notifications"
                on={settings.notifications}
                onChange={setNotifications}
              />
            }
          />
          <SettingsRow
            icon="music-note"
            label="Alarm sound"
            description="Play a sound with the in-app reminder"
            control={
              <Toggle
                label="Alarm sound"
                on={settings.alarmSound}
                onChange={(v) => updateSettings({ alarmSound: v })}
              />
            }
          />
          <SettingsRow
            icon="snooze"
            label="Snooze length"
            description="How long a snoozed dose waits"
            value={`${SNOOZE_MINUTES} min`}
          />
          <SettingsRow
            icon={allowed === false ? "notifications-off" : "alarm-on"}
            label="Reminders on this phone"
            description={
              allowed === false
                ? "Android is blocking notifications — tap to allow"
                : remindersScheduled === 0
                  ? "Nothing scheduled — add a medicine with a time"
                  : "Set to ring even when the app is closed"
            }
            value={allowed === false ? "Off" : String(remindersScheduled)}
            onPress={
              allowed === false
                ? () => requestPermission().then((ok) => setAllowed(ok))
                : undefined
            }
          />
        </Card>

        <SectionTitle>Sound</SectionTitle>
        <Card style={{ marginBottom: 20 }}>
          <SettingsRow
            icon="volume-up"
            label="Volume"
            description={`${Math.round(settings.volume * 100)}% of device volume`}
          />
          <Slider
            accessibilityLabel="Alarm volume"
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
            {testing ? "Stop test alarm" : "Test alarm sound"}
          </Button>
        </Card>

        <SectionTitle>Account</SectionTitle>
        <Card style={{ gap: 16 }}>
          <SettingsRow icon="lock" label="Change password" />
          <Field
            label="Current password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            value={oldPw}
            onChangeText={setOldPw}
          />
          <Field
            label="New password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD} characters`}
            value={newPw}
            onChangeText={setNewPw}
          />
          <Button loading={busy} onPress={submitPw}>
            Update password
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
