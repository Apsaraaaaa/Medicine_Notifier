import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  SectionTitle,
  StatusBadge,
  T,
  TextArea,
} from "../components/ui";
import { RADIUS } from "../constants/theme";
import { useApp, useTheme } from "../context/AppContext";
import * as api from "../services/api";
import { ApiError } from "../services/api";
import type { ScannedMedicine } from "../types";
import { formatTime12 } from "../utils/date";
import {
  imagePickerAvailable,
  PermissionDenied,
  pickPhoto,
  takePhoto,
} from "../utils/imagePicker";

/**
 * Reading a medicine box or a prescription.
 *
 * The screen offers whichever route actually works here, and always offers at
 * least one. A photo needs both a camera module in the build and a recognition
 * engine on the server; when either is missing the typed route is offered
 * instead, and it runs through exactly the same parser — so the feature never
 * degrades into a dead end.
 *
 * Nothing found here is saved. Choosing a result opens the normal Add Medicine
 * form with the fields filled in, and the user confirms or corrects every one
 * of them before anything is created.
 */
export default function ScanScreen() {
  const { t } = useApp();
  const c = useTheme();
  const router = useRouter();

  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [results, setResults] = useState<ScannedMedicine[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  // Whether the *server* can read a photograph. Asked once, so the screen can
  // say what it can do rather than failing after the user has taken a photo.
  const [imageSupported, setImageSupported] = useState<boolean | null>(null);

  const cameraAvailable = imagePickerAvailable();

  useEffect(() => {
    let live = true;
    api
      .scanCapabilities()
      .then((caps) => live && setImageSupported(caps.imageSupported))
      .catch(() => live && setImageSupported(false));
    return () => {
      live = false;
    };
  }, []);

  const canPhotograph = cameraAvailable && imageSupported !== false;

  const runImage = async (source: "camera" | "gallery") => {
    setNotice("");
    try {
      const picked = source === "camera" ? await takePhoto() : await pickPhoto();
      if (!picked) return; // the user backed out
      setPreview(picked.uri);
      setBusy(true);
      setResults(null);
      const result = await api.scanImage(picked.uri, picked.mimeType);
      setResults(result.medicines);
      setImageSupported(result.imageSupported);
      if (result.text) setText(result.text.trim());
    } catch (err) {
      if (err instanceof PermissionDenied) setNotice(t("scan.permissionDenied"));
      else if (err instanceof ApiError && err.status === 503) {
        // The server has no engine. Say so once and leave the typed route open.
        setImageSupported(false);
        setNotice(t("scan.serverNoOcr"));
      } else setNotice(t("scan.failed"));
    } finally {
      setBusy(false);
    }
  };

  const runText = async () => {
    if (!text.trim()) return;
    setNotice("");
    setBusy(true);
    setResults(null);
    try {
      const result = await api.scanText(text);
      setResults(result.medicines);
    } catch {
      setNotice(t("scan.failed"));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Hands the reading to the Add Medicine form.
   *
   * Passed as one encoded parameter rather than a dozen: the form takes a
   * single `prefill` object, and a route parameter per field would have to be
   * re-typed and re-validated on the other side.
   */
  const use = (medicine: ScannedMedicine) => {
    const prefill = {
      name: medicine.name,
      dosage: medicine.dosage,
      frequency: medicine.frequency,
      times: medicine.times,
      mealRelation: medicine.mealRelation,
      durationDays: medicine.durationDays,
      catalogId: medicine.catalogId,
    };
    router.replace({
      pathname: "/medicine/new",
      params: { prefill: JSON.stringify(prefill) },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader
        title={t("scan.title")}
        subtitle={t("scan.subtitle")}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {preview && (
          <Card padded={false} style={{ marginBottom: 16, overflow: "hidden" }}>
            <Image
              source={{ uri: preview }}
              style={styles.preview}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </Card>
        )}

        {canPhotograph && (
          <View style={{ gap: 12, marginBottom: 16 }}>
            <Button
              size="lg"
              icon="photo-camera"
              loading={busy}
              onPress={() => runImage("camera")}
            >
              {t("scan.takePhoto")}
            </Button>
            <Button
              variant="secondary"
              icon="photo-library"
              disabled={busy}
              onPress={() => runImage("gallery")}
            >
              {t("scan.choosePhoto")}
            </Button>
          </View>
        )}

        {/* Why the camera is not on offer — stated once, without alarm, and
            always next to the route that does work. */}
        {!canPhotograph && (
          <View style={[styles.notice, { backgroundColor: c.warnSoft, marginBottom: 16 }]}>
            <MaterialIcons name="info-outline" size={22} color={c.warnInk} />
            <T size={15} weight="600" tone="warnInk" style={{ flex: 1 }}>
              {t(cameraAvailable ? "scan.serverNoOcr" : "scan.cameraUnavailable")}
            </T>
          </View>
        )}

        {notice ? (
          <View style={[styles.notice, { backgroundColor: c.badSoft, marginBottom: 16 }]}>
            <MaterialIcons name="error-outline" size={22} color={c.badInk} />
            <T size={15} weight="600" tone="badInk" style={{ flex: 1 }}>
              {notice}
            </T>
          </View>
        ) : null}

        <SectionTitle>{t("scan.typeInstead")}</SectionTitle>
        <Card style={{ gap: 12 }}>
          <TextArea
            label={t("scan.typeLabel")}
            rows={4}
            placeholder={t("scan.typePlaceholder")}
            value={text}
            onChangeText={setText}
          />
          <Button
            variant={canPhotograph ? "secondary" : "primary"}
            icon="search"
            loading={busy}
            disabled={!text.trim()}
            onPress={runText}
          >
            {busy ? t("scan.reading") : t("scan.read")}
          </Button>
        </Card>

        {results !== null && (
          <View style={{ marginTop: 24 }}>
            <SectionTitle>{t("scan.results")}</SectionTitle>

            {results.length === 0 ? (
              <Card>
                <EmptyState
                  icon="search-off"
                  title={t("scan.nothingFound")}
                  subtitle={t("scan.nothingFoundHint")}
                />
              </Card>
            ) : (
              <>
                <T size={15} tone="ink3" style={{ marginBottom: 10 }}>
                  {t("scan.resultsHint")}
                </T>
                <View style={{ gap: 12 }}>
                  {results.map((medicine, i) => (
                    <ResultCard
                      key={`${medicine.name}-${i}`}
                      medicine={medicine}
                      onUse={() => use(medicine)}
                    />
                  ))}
                </View>
                <T size={15} tone="ink3" center style={{ marginTop: 14 }}>
                  {t("scan.editHint")}
                </T>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ResultCard({
  medicine,
  onUse,
}: {
  medicine: ScannedMedicine;
  onUse: () => void;
}) {
  const { t } = useApp();
  const c = useTheme();

  const details = [
    medicine.frequency,
    medicine.mealRelation !== "none" ? t(`meal.${medicine.mealRelation}`) : "",
    medicine.durationDays ? t("scan.duration", { days: medicine.durationDays }) : "",
  ].filter(Boolean);

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.resultHead}>
        <View style={[styles.icon, { backgroundColor: c.brandSoft }]}>
          <MaterialIcons name="medication" size={22} color={c.brandInk} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={19} weight="700" numberOfLines={1}>
            {medicine.name || "—"}
          </T>
          <T size={15} tone="ink2" numberOfLines={1}>
            {medicine.dosage}
          </T>
        </View>
        <StatusBadge
          label={t("scan.confidence", { percent: Math.round(medicine.confidence * 100) })}
          bg={medicine.confidence >= 0.6 ? c.okSoft : c.surface2}
          fg={medicine.confidence >= 0.6 ? c.okInk : c.ink3}
        />
      </View>

      {details.length > 0 && (
        <View style={styles.chips}>
          {details.map((detail) => (
            <View key={detail} style={[styles.chip, { backgroundColor: c.surface2 }]}>
              <Text style={{ color: c.ink2, fontSize: 15, fontWeight: "700" }}>{detail}</Text>
            </View>
          ))}
        </View>
      )}

      {medicine.times.length > 0 && (
        <View style={styles.chips}>
          {medicine.times.map((time) => (
            <View key={time} style={[styles.chip, { backgroundColor: c.brandSoft }]}>
              <MaterialIcons name="schedule" size={16} color={c.brandInk} />
              <Text style={{ color: c.brandInk, fontSize: 15, fontWeight: "700" }}>
                {formatTime12(time)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* The line it was read from, so a wrong reading is obvious at a glance. */}
      {medicine.line ? (
        <View style={[styles.source, { borderLeftColor: c.line }]}>
          <T size={15} tone="ink3" numberOfLines={2}>
            {medicine.line}
          </T>
        </View>
      ) : null}

      <Button icon="edit" onPress={onUse}>
        {t("scan.useThis")}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  preview: { width: "100%", height: 200 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: RADIUS.field,
    padding: 14,
  },
  resultHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  source: { borderLeftWidth: 2, paddingLeft: 10 },
});
