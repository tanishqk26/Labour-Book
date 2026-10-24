import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '../../lib/api';
import { C, R } from '../../lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plot {
  id: string;
  name: string;
  size_acres: number;
  crop_name?: string | null;
  notes?: string | null;
  is_active: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

type NavProp = { navigation: { goBack: () => void } };

// ─── Plot Form Modal ──────────────────────────────────────────────────────────

function PlotFormModal({
  visible,
  plot,
  onClose,
  onSaved,
}: {
  visible: boolean;
  plot?: Plot;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!plot;
  const [name, setName] = useState('');
  const [sizeAcres, setSizeAcres] = useState('');
  const [cropName, setCropName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(plot?.name ?? '');
    setSizeAcres(plot?.size_acres ? String(plot.size_acres) : '');
    setCropName(plot?.crop_name ?? '');
    setNotes(plot?.notes ?? '');
    setError(null);
  }, [visible, plot]);

  async function save() {
    if (!name.trim()) { setError('Plot name is required.'); return; }
    const sz = parseFloat(sizeAcres);
    if (isNaN(sz) || sz <= 0) { setError('Size must be greater than 0.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        size_acres: sz,
        crop_name: cropName.trim() || null,
        notes: notes.trim() || null,
      };
      if (isEdit) {
        await apiPatch(`/api/v1/plots/${plot!.id}`, payload);
      } else {
        await apiPost('/api/v1/plots', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Could not save (${err.status}).` : 'Could not save plot.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={f.root}>
        {/* Header */}
        <View style={f.header}>
          <View style={f.headerIcon}>
            <MaterialCommunityIcons name="terrain" size={20} color={C.primary} />
          </View>
          <Text style={f.title}>{isEdit ? 'Edit Plot' : 'New Plot'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={{ marginLeft: 'auto' }}>
            <MaterialCommunityIcons name="close" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        <ScrollView contentContainerStyle={f.body} keyboardShouldPersistTaps="handled">
          {error && <Text style={f.errorMsg}>{error}</Text>}

          <Text style={f.label}>PLOT NAME *</Text>
          <TextInput
            style={f.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. ARA 35"
            placeholderTextColor={C.outlineVariant}
            autoFocus
          />

          <View style={f.row}>
            <View style={{ flex: 1 }}>
              <Text style={f.label}>SIZE (ACRES) *</Text>
              <TextInput
                style={f.input}
                value={sizeAcres}
                onChangeText={setSizeAcres}
                keyboardType="decimal-pad"
                placeholder="e.g. 2.5"
                placeholderTextColor={C.outlineVariant}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={f.label}>CROP NAME</Text>
              <TextInput
                style={f.input}
                value={cropName}
                onChangeText={setCropName}
                placeholder="e.g. Sugarcane"
                placeholderTextColor={C.outlineVariant}
              />
            </View>
          </View>

          <Text style={f.label}>NOTES</Text>
          <TextInput
            style={[f.input, { minHeight: 68, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Optional notes about this plot…"
            placeholderTextColor={C.outlineVariant}
          />
        </ScrollView>

        {/* Footer */}
        <View style={f.footer}>
          <TouchableOpacity style={f.cancel} onPress={onClose}>
            <Text style={f.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[f.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving
              ? <ActivityIndicator color={C.onPrimary} />
              : <Text style={f.saveText}>{isEdit ? 'Save Changes' : 'Add Plot'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const f = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.outlineVariant,
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: R.md,
    backgroundColor: C.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  body: { padding: 20, gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: C.outlineVariant,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.onSurface,
    backgroundColor: C.surfaceLowest,
    marginBottom: 2,
  },
  row: { flexDirection: 'row', gap: 10 },
  errorMsg: {
    backgroundColor: '#fee2e2',
    color: C.error,
    borderRadius: R.sm,
    padding: 10,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: C.outlineVariant,
  },
  cancel: {
    flex: 1,
    borderRadius: R.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600', fontSize: 15 },
  save: {
    flex: 2,
    backgroundColor: C.primaryContainer,
    borderRadius: R.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveText: { color: C.onPrimary, fontWeight: '700', fontSize: 15 },
});

// ─── Plot Card ────────────────────────────────────────────────────────────────

function PlotCard({
  plot,
  onEdit,
  onDeleted,
}: {
  plot: Plot;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  function confirmDelete() {
    Alert.alert(
      plot.name,
      'Delete this plot? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDelete(`/api/v1/plots/${plot.id}`);
              onDeleted();
            } catch {
              Alert.alert('Error', 'Could not delete plot.');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={s.card}>
      {/* Header row */}
      <View style={s.cardHeader}>
        <View style={s.cardIcon}>
          <MaterialCommunityIcons name="terrain" size={20} color={C.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardName} numberOfLines={1}>{plot.name}</Text>
          {plot.crop_name ? (
            <Text style={s.cardCrop} numberOfLines={1}>{plot.crop_name}</Text>
          ) : null}
        </View>
        <View style={s.cardActions}>
          <TouchableOpacity style={s.editBtn} onPress={onEdit} hitSlop={6}>
            <MaterialCommunityIcons name="pencil-outline" size={16} color={C.onSurfaceVariant} />
          </TouchableOpacity>
          <TouchableOpacity style={s.deleteBtn} onPress={confirmDelete} hitSlop={6}>
            <MaterialCommunityIcons name="delete-outline" size={16} color={C.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Size + notes */}
      <View style={s.cardMeta}>
        <View style={s.sizeBox}>
          <Text style={s.sizeLabel}>SIZE</Text>
          <Text style={s.sizeValue}>{plot.size_acres} <Text style={s.sizeUnit}>acres</Text></Text>
        </View>
        {plot.notes ? (
          <>
            <View style={s.metaDivider} />
            <Text style={s.cardNotes} numberOfLines={2}>{plot.notes}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PlotsScreen({ navigation }: NavProp) {
  const insets = useSafeAreaInsets();
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ items: Plot[]; total: number }>('/api/v1/plots', {
        status: 'active',
        page_size: 100,
      });
      setPlots(data.items ?? []);
    } catch {
      setError('Could not load plots.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditingPlot(undefined); setFormVisible(true); }
  function openEdit(p: Plot) { setEditingPlot(p); setFormVisible(true); }

  const totalAcres = plots.reduce((s, p) => s + p.size_acres, 0);

  return (
    <View style={[{ flex: 1, backgroundColor: C.background }, { paddingTop: insets.top }]}>
      {/* Nav bar */}
      <View style={s.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={s.barTitle}>Plots</Text>
        <View style={{ width: 40 }} />
      </View>

      <PlotFormModal
        visible={formVisible}
        plot={editingPlot}
        onClose={() => setFormVisible(false)}
        onSaved={load}
      />

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Page header */}
        <View style={s.pageHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>PLOTS</Text>
            <Text style={s.pageTitle}>Farm Plots</Text>
            <Text style={s.pageSub}>Manage and track your farm plots.</Text>
          </View>
          <TouchableOpacity style={s.newBtn} onPress={openCreate}>
            <MaterialCommunityIcons name="plus" size={16} color={C.onPrimary} />
            <Text style={s.newBtnText}>New Plot</Text>
          </TouchableOpacity>
        </View>

        {/* Summary strip */}
        {!loading && plots.length > 0 && (
          <View style={s.summaryCard}>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>TOTAL PLOTS</Text>
              <Text style={s.summaryValue}>{plots.length}</Text>
            </View>
            <View style={s.summaryDiv} />
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>TOTAL AREA</Text>
              <Text style={[s.summaryValue, { color: C.primary }]}>
                {totalAcres.toFixed(2)} <Text style={s.summaryUnit}>acres</Text>
              </Text>
            </View>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={s.centered}>
            <ActivityIndicator color={C.primary} size="large" />
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <View style={s.errorCard}>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={load}>
              <Text style={s.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty */}
        {!loading && !error && plots.length === 0 && (
          <View style={s.centered}>
            <MaterialCommunityIcons name="terrain" size={64} color={C.outlineVariant} />
            <Text style={s.emptyTitle}>No plots yet</Text>
            <Text style={s.emptySub}>Add your first farm plot to get started.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={openCreate}>
              <MaterialCommunityIcons name="plus" size={16} color={C.onPrimary} />
              <Text style={s.emptyBtnText}>Add Plot</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* List */}
        {!loading && !error && plots.length > 0 && (
          <View style={s.list}>
            {plots.map((p) => (
              <PlotCard
                key={p.id}
                plot={p}
                onEdit={() => openEdit(p)}
                onDeleted={load}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.outlineVariant,
    backgroundColor: C.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.md,
  },
  barTitle: { fontSize: 17, fontWeight: '700', color: C.primary },
  content: { padding: 16, gap: 14 },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 4,
  },
  eyebrow: { fontSize: 10, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 1 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: C.onSurface, marginTop: 2 },
  pageSub: { fontSize: 13, color: C.onSurfaceVariant, marginTop: 2 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primaryContainer,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
  },
  newBtnText: { fontSize: 13, fontWeight: '700', color: C.onPrimary },

  summaryCard: {
    flexDirection: 'row',
    backgroundColor: C.surfaceLowest,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    padding: 16,
  },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5 },
  summaryValue: { fontSize: 22, fontWeight: '800', color: C.onSurface, marginTop: 4 },
  summaryUnit: { fontSize: 13, fontWeight: '400' },
  summaryDiv: { width: 1, backgroundColor: C.outlineVariant, marginHorizontal: 8 },

  centered: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.onSurface },
  emptySub: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primaryContainer,
    borderRadius: R.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 4,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: C.onPrimary },

  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: R.xl,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  errorText: { fontSize: 14, fontWeight: '600', color: C.error, textAlign: 'center' },
  retryBtn: { backgroundColor: C.error, borderRadius: R.md, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700' },

  list: { gap: 10 },

  card: {
    backgroundColor: C.surfaceLowest,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { fontSize: 16, fontWeight: '700', color: C.onSurface },
  cardCrop: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },
  cardActions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.outlineVariant,
    gap: 12,
  },
  sizeBox: {},
  sizeLabel: { fontSize: 9, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 0.6 },
  sizeValue: { fontSize: 18, fontWeight: '800', color: C.primary, marginTop: 1 },
  sizeUnit: { fontSize: 12, fontWeight: '400', color: C.onSurfaceVariant },
  metaDivider: { width: 1, height: 36, backgroundColor: C.outlineVariant },
  cardNotes: { flex: 1, fontSize: 13, color: C.onSurfaceVariant },
});
