import { useRouter } from "expo-router";
import { View } from "react-native";

import { MedicineForm } from "../../components/MedicineForm";
import { AppHeader } from "../../components/ui";
import { useTheme } from "../../context/AppContext";

export default function NewMedicineScreen() {
  const router = useRouter();
  const c = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader
        title="Add medicine"
        subtitle="Set the dose and when to be reminded"
        onBack={() => router.back()}
      />
      <MedicineForm editing={null} onDone={() => router.back()} />
    </View>
  );
}
