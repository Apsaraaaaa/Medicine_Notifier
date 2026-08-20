import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  SectionTitle,
  SettingsRow,
  StatusBadge,
  T,
  Toggle,
} from "../components/ui";
import { RADIUS } from "../constants/theme";
import { useApp, useTheme } from "../context/AppContext";
import * as api from "../services/api";
import type { CaregiverLink } from "../types";
import { dateTime } from "../utils/date";

/**
 * Caregiver and family access, both directions on one screen.
 *
 * Upper half: the people this user has given access to — the patient's side.
 * Lower half: the people this user watches over — the caregiver's side, which
 * only appears once there is someone to show or a code to redeem, because most
 * people are only ever one of the two.
 */
export default function CaregiversScreen() {
  const { t, patients, alerts, unreadAlerts, refreshCaregiving, markAllAlertsRead } = useApp();
  const c = useTheme();
  const router = useRouter();

  const [links, setLinks] = useState<CaregiverLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // add-a-caregiver form
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [alertOnMissed, setAlertOnMissed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // redeem-a-code form
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [redeemed, setRedeemed] = useState("");

  const [confirmRevoke, setConfirmRevoke] = useState<CaregiverLink | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadLinks = async () => {
    try {
      setLinks(await api.getCaregivers());
    } catch {
      // The screen keeps whatever it last showed; pull-to-refresh retries.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
    refreshCaregiving();
    // Loading once on mount is deliberate: this screen is short-lived and
    // pull-to-refresh covers anything that changes while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = async () => {
    setRefreshing(true);
    await Promise.all([loadLinks(), refreshCaregiving()]);
    setRefreshing(false);
  };

  const submit = async () => {
    if (!email.trim()) return setFormError(t("care.errEmail"));
    setSaving(true);
    setFormError("");
    try {
      await api.addCaregiver({
        caregiverEmail: email.trim(),
        caregiverName: name.trim(),
        relationship: relationship.trim(),
        alertOnMissed,
      });
      setAdding(false);
      setName("");
      setEmail("");
      setRelationship("");
      setAlertOnMissed(true);
      await loadLinks();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const redeem = async () => {
    if (!code.trim()) return setCodeError(t("care.errCode"));
    setRedeeming(true);
    setCodeError("");
    try {
      await api.acceptInvite(code);
      setCode("");
      setRedeemed(t("care.redeemed"));
      await refreshCaregiving();
    } catch (err) {
      setCodeError((err as Error).message);
    } finally {
      setRedeeming(false);
    }
  };

  const revoke = async () => {
    if (!confirmRevoke) return;
    setRevoking(true);
    try {
      await api.removeCaregiver(confirmRevoke.id);
      setConfirmRevoke(null);
      await loadLinks();
    } finally {
      setRevoking(false);
    }
  };

  const toggleAlerts = async (link: CaregiverLink, on: boolean) => {
    setLinks((list) =>
      list.map((l) => (l.id === link.id ? { ...l, alertOnMissed: on } : l))
    );
    try {
      await api.updateCaregiver(link.id, { alertOnMissed: on });
    } catch {
      await loadLinks(); // put the switch back where the server has it
    }
  };

  const active = links.filter((l) => l.status !== "revoked");
  const recentAlerts = alerts.slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader title={t("care.title")} subtitle={t("care.subtitle")} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={c.brand} />
        }
      >
        {/* ================= the patient's side ================= */}
        <SectionTitle>{t("care.myCaregivers")}</SectionTitle>

        {active.length === 0 && !loading ? (
          <Card>
            <EmptyState
              icon="family-restroom"
              title={t("care.noCaregivers")}
              subtitle={t("care.noCaregiversHint")}
              action={
                <Button icon="person-add" onPress={() => setAdding(true)}>
                  {t("care.addCaregiver")}
                </Button>
              }
            />
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {active.map((link) => (
              <Card key={link.id} style={{ gap: 12 }}>
                <View style={styles.personRow}>
                  <View style={[styles.avatar, { backgroundColor: c.brandSoft }]}>
                    <Text style={{ color: c.brandInk, fontSize: 20, fontWeight: "800" }}>
                      {(link.displayName || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T size={18} weight="700" numberOfLines={1}>
                      {link.displayName}
                    </T>
                    <T size={15} tone="ink3" numberOfLines={1}>
                      {[link.relationship, link.caregiverEmail].filter(Boolean).join(" · ")}
                    </T>
                  </View>
                  <StatusBadge
                    icon={link.status === "active" ? "check-circle" : "schedule"}
                    label={t(link.status === "active" ? "care.activeAccess" : "care.invited")}
                    bg={link.status === "active" ? c.okSoft : c.warnSoft}
                    fg={link.status === "active" ? c.okInk : c.warnInk}
                  />
                </View>

                {/* An invitation to somebody without an account is useless
                    without the code, so it is shown, large, right here. */}
                {link.inviteCode ? (
                  <View style={[styles.codeBox, { backgroundColor: c.brandSoft }]}>
                    <T size={15} tone="brandInk">
                      {t("care.pendingHint", { name: link.displayName })}
                    </T>
                    <Text selectable style={[styles.code, { color: c.brandInk }]}>
                      {link.inviteCode}
                    </Text>
                  </View>
                ) : null}

                <View style={[styles.alertToggle, { borderTopColor: c.line }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T size={16} weight="700">
                      {t("care.alertOnMissed")}
                    </T>
                    <T size={15} tone="ink3">
                      {t("care.alertOnMissedHint")}
                    </T>
                  </View>
                  <Toggle
                    label={t("care.alertOnMissed")}
                    on={link.alertOnMissed}
                    onChange={(on) => toggleAlerts(link, on)}
                  />
                </View>

                <Button
                  variant="secondary"
                  icon="person-remove"
                  onPress={() => setConfirmRevoke(link)}
                >
                  {t("care.revoke")}
                </Button>
              </Card>
            ))}

            <Button variant="secondary" icon="person-add" onPress={() => setAdding(true)}>
              {t("care.addCaregiver")}
            </Button>
          </View>
        )}

        {/* ================= the caregiver's side ================= */}
        <View style={{ marginTop: 28 }}>
          <SectionTitle
            action={
              unreadAlerts > 0 ? (
                <StatusBadge
                  label={t("care.unreadAlerts", { count: unreadAlerts })}
                  bg={c.badSoft}
                  fg={c.badInk}
                />
              ) : undefined
            }
          >
            {t("care.myPatients")}
          </SectionTitle>

          {patients.length === 0 ? (
            <Card>
              <EmptyState
                icon="volunteer-activism"
                title={t("care.noPatients")}
                subtitle={t("care.noPatientsHint")}
              />
            </Card>
          ) : (
            <Card padded={false} style={{ paddingVertical: 4 }}>
              {patients.map((patient) => (
                <SettingsRow
                  key={patient.id}
                  icon="person"
                  label={patient.patientName}
                  description={
                    patient.unreadAlerts > 0
                      ? t("care.unreadAlerts", { count: patient.unreadAlerts })
                      : patient.patientEmail
                  }
                  onPress={() =>
                    router.push({ pathname: "/monitor/[id]", params: { id: patient.id } })
                  }
                />
              ))}
            </Card>
          )}

          {/* Recent alerts, so opening this screen answers "is everyone ok?"
              without having to walk into each patient in turn. */}
          {recentAlerts.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <SectionTitle
                action={
                  unreadAlerts > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={markAllAlertsRead}
                      style={{ minHeight: 44, justifyContent: "center" }}
                    >
                      <Text style={{ color: c.brandInk, fontWeight: "800", fontSize: 15 }}>
                        {t("care.markAllRead")}
                      </Text>
                    </Pressable>
                  ) : undefined
                }
              >
                {t("care.alerts")}
              </SectionTitle>
              <Card padded={false}>
                {recentAlerts.map((alert, i) => (
                  <View
                    key={alert.id}
                    style={[
                      styles.alertRow,
                      i > 0 && { borderTopWidth: 1, borderTopColor: c.line },
                      { opacity: alert.readAt ? 0.55 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.alertIcon,
                        { backgroundColor: alert.readAt ? c.surface2 : c.badSoft },
                      ]}
                    >
                      <MaterialIcons
                        name="warning-amber"
                        size={20}
                        color={alert.readAt ? c.ink3 : c.badInk}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T size={16} weight="700" numberOfLines={2}>
                        {alert.message}
                      </T>
                      <T size={15} tone="ink3">
                        {dateTime(alert.createdAt)}
                      </T>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {/* Redeeming a code is only for somebody invited before they had an
              account, so it sits below and stays quiet until it is needed. */}
          <View style={{ marginTop: 20 }}>
            <Card style={{ gap: 12 }}>
              <T size={17} weight="700">
                {t("care.enterCode")}
              </T>
              <Field
                label={t("care.codeLabel")}
                icon="vpn-key"
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={t("care.codePlaceholder")}
                value={code}
                error={codeError}
                onChangeText={(value) => {
                  setCode(value);
                  setCodeError("");
                  setRedeemed("");
                }}
              />
              <Button
                variant="secondary"
                icon="link"
                loading={redeeming}
                disabled={!code.trim()}
                onPress={redeem}
              >
                {t("care.redeem")}
              </Button>
              {redeemed ? (
                <T size={15} weight="600" tone="okInk" center>
                  {redeemed}
                </T>
              ) : null}
            </Card>
          </View>
        </View>
      </ScrollView>

      {adding && (
        <Modal
          title={t("care.addCaregiver")}
          description={t("care.noCaregiversHint")}
          onClose={() => setAdding(false)}
        >
          <View style={{ gap: 14 }}>
            <Field
              label={t("care.caregiverName")}
              icon="person"
              value={name}
              onChangeText={setName}
            />
            <Field
              label={t("care.caregiverEmail")}
              icon="email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              error={formError}
              onChangeText={(value) => {
                setEmail(value);
                setFormError("");
              }}
            />
            <Field
              label={t("care.relationship")}
              icon="favorite"
              placeholder={t("care.relationshipPlaceholder")}
              value={relationship}
              onChangeText={setRelationship}
            />
            <View style={styles.modalToggle}>
              <T size={16} weight="700" style={{ flex: 1 }}>
                {t("care.alertOnMissed")}
              </T>
              <Toggle
                label={t("care.alertOnMissed")}
                on={alertOnMissed}
                onChange={setAlertOnMissed}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Button variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(false)}>
                {t("common.cancel")}
              </Button>
              <Button style={{ flex: 1 }} loading={saving} onPress={submit}>
                {t("care.send")}
              </Button>
            </View>
          </View>
        </Modal>
      )}

      {confirmRevoke && (
        <Modal
          tone="danger"
          title={t("care.revokeTitle", { name: confirmRevoke.displayName })}
          description={t("care.revokeBody")}
          onClose={() => setConfirmRevoke(null)}
        >
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => setConfirmRevoke(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button variant="danger" style={{ flex: 1 }} loading={revoking} onPress={revoke}>
              {t("care.revoke")}
            </Button>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  codeBox: { borderRadius: RADIUS.field, padding: 14, gap: 6 },
  code: { fontSize: 30, fontWeight: "800", letterSpacing: 4, textAlign: "center" },
  alertToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  alertIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modalToggle: { flexDirection: "row", alignItems: "center", gap: 12 },
});
