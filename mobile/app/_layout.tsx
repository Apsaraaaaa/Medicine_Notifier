import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ReminderSheet } from "../components/ReminderSheet";
import { Splash } from "../components/Splash";
import { AppProvider, useApp, useTheme } from "../context/AppContext";
import { ensureChannel, installForegroundHandler } from "../notifications/reminders";

export default function RootLayout() {
  useEffect(() => {
    // Both are no-ops in Expo Go, which has no notifications module.
    installForegroundHandler();
    // The Android channel must exist before the first reminder is posted.
    // It is (re)named in the chosen language from inside the provider, which
    // is the only place the language is known.
    ensureChannel();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <Shell />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The auth gate. Everything outside `login` needs a session; being signed in
 * on the login screen bounces straight back to the tabs.
 */
function Shell() {
  const { ready, token, settings, language } = useApp();
  const c = useTheme();
  const router = useRouter();
  const segments = useSegments();

  // Android names a notification channel once, at creation, but re-declaring
  // it with the same id updates the name — so switching language relabels the
  // channel in the system settings too.
  useEffect(() => {
    ensureChannel(language);
  }, [language]);

  useEffect(() => {
    if (!ready) return;
    const onLogin = segments[0] === "login";
    if (!token && !onLogin) router.replace("/login");
    else if (token && onLogin) router.replace("/");
  }, [ready, token, segments, router]);

  if (!ready) return <Splash />;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.canvas },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ animation: "fade" }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="medicine/new" />
        <Stack.Screen name="medicine/[id]" />
        <Stack.Screen name="report" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="caregivers" />
        <Stack.Screen name="monitor/[id]" />
      </Stack>

      {/* Sits above every route: a dose can come due on any screen. */}
      <ReminderSheet />
      <StatusBar style={settings.darkMode ? "light" : "dark"} />
    </>
  );
}
