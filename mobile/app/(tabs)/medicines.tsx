import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { isActive, MedicineCard } from "../../components/MedicineCard";
import {
  AppHeader,
  Button,
  EmptyState,
  FilterChip,
  IconButton,
  Modal,
  Sheet,
  SheetAction,
} from "../../components/ui";
import { useApp, useTheme } from "../../context/AppContext";
import type { Medicine } from "../../types";

type Filter = "all" | "active" | "inactive";

export default function MedicineListScreen() {
  const { medicines, removeMedicine, refresh, refreshing } = useApp();
  const c = useTheme();
  const router = useRouter();

  const [menuFor, setMenuFor] = useState<Medicine | null>(null);
  const [confirm, setConfirm] = useState<Medicine | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState(false);

  const activeCount = medicines.filter((m) => isActive(m)).length;
  const counts: Record<Filter, number> = {
    all: medicines.length,
    active: activeCount,
    inactive: medicines.length - activeCount,
  };

  const q = query.trim().toLowerCase();
  const list = medicines.filter((m) => {
    if (filter === "active" && !isActive(m)) return false;
    if (filter === "inactive" && isActive(m)) return false;
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.dosage.toLowerCase().includes(q);
  });

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await removeMedicine(confirm.id);
      setConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <AppHeader
        title="Medicines"
        subtitle={`${medicines.length} saved · ${activeCount} active`}
        right={
          <IconButton
            icon="add"
            label="Add medicine"
            color={c.brandInk}
            onPress={() => router.push("/medicine/new")}
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} />
        }
      >
        {medicines.length === 0 ? (
          <EmptyState
            icon="medication"
            title="No medicines yet"
            subtitle="Add your first medicine to start receiving reminders."
            action={
              <Button icon="add" onPress={() => router.push("/medicine/new")}>
                Add medicine
              </Button>
            }
          />
        ) : (
          <>
            <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
              <MaterialIcons name="search" size={22} color={c.ink3} />
              <TextInput
                accessibilityLabel="Search medicines"
                placeholder="Search medicines"
                placeholderTextColor={c.ink3}
                value={query}
                onChangeText={setQuery}
                style={{ flex: 1, color: c.ink, fontSize: 18, paddingVertical: 12 }}
              />
            </View>

            <View style={styles.filters}>
              {(["all", "active", "inactive"] as Filter[]).map((f) => (
                <FilterChip key={f} selected={filter === f} onPress={() => setFilter(f)}>
                  {`${f === "all" ? "All" : f === "active" ? "Active" : "Inactive"} (${counts[f]})`}
                </FilterChip>
              ))}
            </View>

            {list.length === 0 ? (
              <EmptyState
                icon="search"
                title="Nothing matches"
                subtitle={
                  q ? `No medicines found for “${query}”.` : "No medicines in this filter yet."
                }
              />
            ) : (
              <View style={{ gap: 12, marginTop: 16 }}>
                {list.map((m) => (
                  <MedicineCard
                    key={m.id}
                    medicine={m}
                    onOpen={() => router.push(`/medicine/${m.id}`)}
                    onOpenMenu={() => setMenuFor(m)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {menuFor && (
        <Sheet title={menuFor.name} onClose={() => setMenuFor(null)}>
          <SheetAction
            icon="edit"
            label="Edit medicine"
            onPress={() => {
              const m = menuFor;
              setMenuFor(null);
              router.push(`/medicine/${m.id}`);
            }}
          />
          <SheetAction
            icon="delete"
            label="Delete medicine"
            tone="danger"
            onPress={() => {
              setConfirm(menuFor);
              setMenuFor(null);
            }}
          />
        </Sheet>
      )}

      {confirm && (
        <Modal
          tone="danger"
          title={`Delete ${confirm.name}?`}
          description="This will remove the medicine and its future reminders. Doses already recorded stay in your history."
          onClose={() => setConfirm(null)}
        >
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" style={{ flex: 1 }} loading={deleting} onPress={doDelete}>
              Delete
            </Button>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    minHeight: 60,
  },
  filters: { flexDirection: "row", gap: 8, marginTop: 12 },
});
