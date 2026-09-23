import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { apiGet, apiPost, apiPatch } from "../../lib/api";
import { Labour, PaginatedResponse } from "../../types";

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

const AVATAR_COLORS = [
  { bg: "#c1ecd4", fg: "#012d1d" },
  { bg: "#d7e4f0", fg: "#111d25" },
  { bg: "#fef3c7", fg: "#6b4c04" },
  { bg: "#ffdad3", fg: "#510900" },
  { bg: "#e8d5f7", fg: "#3d1457" },
];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// ─── Add Labour Modal ───────────────────────────────────────────────────────

interface AddLabourModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function AddLabourModal({ visible, onClose, onSuccess }: AddLabourModalProps) {
  const [name, setName] = useState("");
  const [wage, setWage] = useState("");
  const [hometown, setHometown] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() { setName(""); setWage(""); setHometown(""); setPhone(""); }

  async function save() {
    if (!name.trim()) { Alert.alert("Required", "Name is required"); return; }
    const dailyWage = parseFloat(wage);
    if (isNaN(dailyWage) || dailyWage < 0) { Alert.alert("Invalid", "Enter a valid daily wage"); return; }
    setSaving(true);
    try {
      await apiPost("/api/v1/labours", {
        name: name.trim(),
        daily_wage: dailyWage,
        hometown: hometown.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      reset();
      onSuccess();
      onClose();
    } catch {
      Alert.alert("Error", "Failed to add labourer. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Add Labourer</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={modalStyles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={modalStyles.body}>
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>Name *</Text>
            <TextInput style={modalStyles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#9ca3af" />
          </View>
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>Daily Wage (₹) *</Text>
            <TextInput style={modalStyles.input} value={wage} onChangeText={setWage} placeholder="e.g. 500" keyboardType="numeric" placeholderTextColor="#9ca3af" />
          </View>
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>Hometown</Text>
            <TextInput style={modalStyles.input} value={hometown} onChangeText={setHometown} placeholder="Village / City" placeholderTextColor="#9ca3af" />
          </View>
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>Phone</Text>
            <TextInput style={modalStyles.input} value={phone} onChangeText={setPhone} placeholder="10-digit number" keyboardType="phone-pad" placeholderTextColor="#9ca3af" />
          </View>
        </View>

        <View style={modalStyles.footer}>
          <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
            <Text style={modalStyles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={modalStyles.saveBtnText}>Add Labourer</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function LaboursScreen() {
  const [labours, setLabours] = useState<Labour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: 1, page_size: 100, status: "active" };
      if (search.trim()) params.search = search.trim();
      const data = await apiGet<PaginatedResponse<Labour>>("/api/v1/labours", params);
      setLabours(data.items);
    } catch {
      setError("Failed to load labourers.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  async function deactivate(id: string, name: string) {
    Alert.alert("Deactivate", `Remove ${name} from active labourers?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate", style: "destructive",
        onPress: async () => {
          try {
            await apiPatch(`/api/v1/labours/${id}`, { is_active: false });
            load(true);
          } catch {
            Alert.alert("Error", "Failed to deactivate labourer.");
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <AddLabourModal visible={modalOpen} onClose={() => setModalOpen(false)} onSuccess={() => load(true)} />

      {/* Search bar */}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search labourers..."
          placeholderTextColor="#9ca3af"
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : error ? (
        <View style={styles.centred}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : labours.length === 0 ? (
        <View style={styles.centred}>
          <Text style={styles.emptyIcon}>👷</Text>
          <Text style={styles.emptyTitle}>{search ? "No results found" : "No Labourers Yet"}</Text>
          <Text style={styles.emptyDesc}>{search ? `No match for "${search}"` : "Tap + Add to add your first labourer."}</Text>
        </View>
      ) : (
        <FlatList
          data={labours}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#16a34a"]} />}
          renderItem={({ item: l, index }) => {
            const c = AVATAR_COLORS[index % AVATAR_COLORS.length];
            return (
              <View style={styles.card}>
                <View style={[styles.avatar, { backgroundColor: c.bg }]}>
                  <Text style={[styles.avatarText, { color: c.fg }]}>{initials(l.name)}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{l.name}</Text>
                  <Text style={styles.meta}>
                    {fmt(l.daily_wage)}/day{l.hometown ? `  ·  ${l.hometown}` : ""}
                  </Text>
                </View>
                <Pressable onPress={() => deactivate(l.id, l.name)} hitSlop={8}>
                  <Text style={styles.moreBtn}>⋯</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8faf8" },
  toolbar: { flexDirection: "row", padding: 12, gap: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  searchInput: { flex: 1, height: 42, backgroundColor: "#f3f4f6", borderRadius: 10, paddingHorizontal: 14, fontSize: 14, color: "#111827" },
  addBtn: { backgroundColor: "#16a34a", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  centred: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorText: { color: "#b91c1c", fontSize: 14, textAlign: "center" },
  retryBtn: { backgroundColor: "#b91c1c", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  emptyDesc: { fontSize: 14, color: "#6b7280", textAlign: "center" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#e5e7eb", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "700" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: "#111827" },
  meta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  moreBtn: { fontSize: 22, color: "#9ca3af", paddingHorizontal: 4 },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  closeBtn: { fontSize: 18, color: "#6b7280", paddingHorizontal: 4 },
  body: { flex: 1, padding: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827", backgroundColor: "#f9fafb" },
  footer: { flexDirection: "row", gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  cancelBtn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#d1d5db" },
  cancelBtnText: { color: "#374151", fontWeight: "600" },
  saveBtn: { flex: 2, backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
