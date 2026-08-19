import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";

import { MedicineForm } from "../../components/MedicineForm";
import { AppHeader, EmptyState } from "../../components/ui";
import { useApp, useTheme } from "../../context/AppContext";

export default function EditMedicineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { medicines } = useApp();
  const router = useRouter();
  const c = useTheme();

  const medicine = medicines.find((m) => m.id === String(id)) ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader
        title={medicine ? "Edit medicine" : "Medicine"}
        subtitle={medicine ? "Set the dose and when to be reminded" : undefined}
        onBack={() => router.back()}
      />
      {medicine ? (
        <MedicineForm editing={medicine} onDone={() => router.back()} />
      ) : (
        // Reachable from a history entry whose medicine was deleted since.
        <EmptyState
          icon="search-off"
          title="Medicine not found"
          subtitle="It may have been deleted. Its recorded doses stay in your history."
        />
      )}
    </View>
  );
}
