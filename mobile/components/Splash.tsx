import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/** Brand screen shown while the stored session is checked against the API. */
export function Splash() {
  return (
    <LinearGradient
      colors={["#44299A", "#6C4FD0", "#A78BFA"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <View style={styles.badge}>
        <MaterialIcons name="medical-services" size={48} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>Medicine Notifier</Text>
      <Text style={styles.tagline}>Never miss a dose again</Text>
      <ActivityIndicator color="#FFFFFF" style={{ marginTop: 36 }} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "800", marginTop: 26 },
  tagline: { color: "rgba(255,255,255,0.85)", fontSize: 16, marginTop: 6 },
});
