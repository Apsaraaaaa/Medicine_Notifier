import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LanguageSwitch } from "../components/LanguageSwitch";
import { Button, Field, IconButton, Segmented, T } from "../components/ui";
import { RADIUS } from "../constants/theme";
import { useApp, useTheme } from "../context/AppContext";

/** Matches the server's rule, so the form never bounces off the API. */
const MIN_PASSWORD = 8;

export default function LoginScreen() {
  const { login, register, authLoading, t } = useApp();
  const c = useTheme();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      if (mode === "register") {
        if (!name.trim()) return setError(t("auth.needName"));
        if (password.length < MIN_PASSWORD) {
          return setError(t("auth.passwordTooShort", { count: MIN_PASSWORD }));
        }
        if (password !== confirm) return setError(t("auth.passwordMismatch"));
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* brand hero */}
        <LinearGradient
          colors={["#4C319E", "#6C4FD0", "#9C86EC"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 32 }]}
        >
          <View style={styles.heroBadge}>
            <MaterialIcons name="medical-services" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Medicine Notifier</Text>
          <Text style={styles.heroTagline}>{t("auth.tagline")}</Text>
        </LinearGradient>

        {/* form card overlapping the hero */}
        <View style={styles.formWrap}>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            {/* Before anything else on the very first screen: somebody who
                cannot read English must be able to switch without signing in. */}
            <View style={{ marginBottom: 18 }}>
              <LanguageSwitch />
            </View>

            <Segmented
              label={t("auth.mode")}
              value={mode}
              onChange={(m) => {
                setError("");
                setMode(m);
              }}
              options={[
                { key: "login", label: t("auth.login") },
                { key: "register", label: t("auth.signup") },
              ]}
            />

            <View style={{ gap: 16, marginTop: 20 }}>
              {mode === "register" && (
                <Field
                  label={t("auth.fullName")}
                  icon="person"
                  autoComplete="name"
                  value={name}
                  onChangeText={setName}
                />
              )}

              <Field
                label={t("auth.email")}
                icon="email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />

              <Field
                label={t("auth.password")}
                icon="lock"
                secureTextEntry={!reveal}
                autoCapitalize="none"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                hint={mode === "register" ? t("auth.minChars", { count: MIN_PASSWORD }) : undefined}
                value={password}
                onChangeText={setPassword}
                right={
                  <IconButton
                    icon={reveal ? "visibility-off" : "visibility"}
                    label={t(reveal ? "auth.hidePassword" : "auth.showPassword")}
                    onPress={() => setReveal((v) => !v)}
                  />
                }
              />

              {mode === "register" && (
                <Field
                  label={t("auth.confirmPassword")}
                  icon="lock"
                  secureTextEntry={!reveal}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  value={confirm}
                  onChangeText={setConfirm}
                />
              )}

              {error ? (
                <View style={[styles.error, { backgroundColor: c.badSoft }]}>
                  <T size={16} weight="600" tone="badInk" center>
                    {error}
                  </T>
                </View>
              ) : null}

              <Button size="lg" loading={authLoading} onPress={submit}>
                {t(mode === "login" ? "auth.login" : "auth.createAccount")}
              </Button>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingBottom: 72, paddingHorizontal: 24 },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginTop: 12 },
  heroTagline: { color: "rgba(255,255,255,0.85)", fontSize: 17, marginTop: 4 },
  formWrap: { paddingHorizontal: 20, marginTop: -44 },
  card: { borderRadius: RADIUS.sheet, borderWidth: 1, padding: 20 },
  error: { borderRadius: RADIUS.field, paddingVertical: 12, paddingHorizontal: 16 },
});
