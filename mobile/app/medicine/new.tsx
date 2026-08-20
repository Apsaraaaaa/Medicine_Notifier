import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";

import { MedicineForm, type MedicinePrefill } from "../../components/MedicineForm";
import { AppHeader } from "../../components/ui";
import { useApp, useTheme } from "../../context/AppContext";

/**
 * Reads the scanner's suggestion off the route.
 *
 * Anything malformed is ignored rather than thrown: a bad parameter must open
 * an empty form, never a crash, and the user can simply fill it in by hand.
 */
function parsePrefill(raw: string | string[] | undefined): MedicinePrefill | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as MedicinePrefill;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export default function NewMedicineScreen() {
  const router = useRouter();
  const c = useTheme();
  const { t } = useApp();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const scanned = parsePrefill(prefill);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader
        title={t("form.addTitle")}
        subtitle={scanned ? t("scan.resultsHint") : t("form.subtitle")}
        onBack={() => router.back()}
      />
      <MedicineForm editing={null} prefill={scanned} onDone={() => router.back()} />
    </View>
  );
}
