import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppHeader from '../../components/AppHeader';
import { apiGet, apiPost } from '../../lib/api';
import { C, R } from '../../lib/theme';

interface Plot { id: string; name: string; }
interface FarmYear { id: string; year_label: string; }
interface Lifecycle { id: string; stage: string; start_date: string | null; end_date: string | null; }
interface PlotOperation { id: string; plot_id: string; lifecycle_id: string | null; operation_date: string; operation_type: string; notes: string | null; }

type OpGroup = 'Spraying' | 'Labour Work' | 'Other';
const OP_GROUPS: OpGroup[] = ['Spraying', 'Labour Work', 'Other'];
const GROUP_CFG: Record<OpGroup, { bg: string; fg: string; icon: string; detailLabel: string; placeholder: string }> = {
  'Spraying': { bg: '#dbeafe', fg: '#1d4ed8', icon: '🌿', detailLabel: 'Chemical / Spray detail', placeholder: 'e.g. Bavistin 50g/L' },
  'Labour Work': { bg: C.primaryFixed, fg: C.primaryContainer, icon: '👷', detailLabel: 'Work description', placeholder: 'e.g. Pruning, weeding' },
  'Other': { bg: C.surfaceHigh, fg: C.onSurface, icon: '📋', detailLabel: 'Details (optional)', placeholder: 'Any relevant notes' },
};

function opGroupOf(type: string): OpGroup {
  if (type === 'Spraying') return 'Spraying';
  if (type === 'Labour Work') return 'Labour Work';
  return 'Other';
}

function dayNum(ops: PlotOperation[], op: PlotOperation) {
  const dates = [...new Set(ops.map((o) => o.operation_date))].sort();
  return Math.floor((new Date(op.operation_date).getTime() - new Date(dates[0]).getTime()) / 86400000) + 1;
}

// ─── Add Op Modal ─────────────────────────────────────────────────────────────

function AddOpModal({ visible, onClose, onSuccess, plotId, lifecycleId }: {
  visible: boolean; onClose: () => void; onSuccess: () => void;
  plotId: string | null; lifecycleId: string | null;
}) {
  const [group, setGroup] = useState<OpGroup>('Labour Work');
  const [detail, setDetail] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!plotId) { Alert.alert('Error', 'Select a plot first'); return; }
    setSaving(true);
    try {
      await apiPost('/api/v1/plot-operations', {
        plot_id: plotId, lifecycle_id: lifecycleId,
        operation_date: date, operation_type: group,
        notes: detail.trim() || undefined,
      });
      setDetail(''); setDate(new Date().toISOString().slice(0, 10));
      onSuccess(); onClose();
    } catch { Alert.alert('Error', 'Failed to save operation.'); }
    finally { setSaving(false); }
  }

  const cfg = GROUP_CFG[group];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={ms.container}>
        <View style={ms.header}>
          <Text style={ms.title}>Add Operation</Text>
          <TouchableOpacity onPress={onClose}><Text style={ms.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={ms.body} contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={ms.label}>Category</Text>
            <View style={ms.groupGrid}>
              {OP_GROUPS.map((g) => {
                const c = GROUP_CFG[g];
                const active = group === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[ms.groupBtn, active && { backgroundColor: c.bg, borderColor: c.fg }]}
                    onPress={() => setGroup(g)}
                  >
                    <Text style={ms.groupIcon}>{c.icon}</Text>
                    <Text style={[ms.groupText, active && { color: c.fg }]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={ms.label}>{cfg.detailLabel}</Text>
            <TextInput
              style={[ms.input, { height: 80, textAlignVertical: 'top' }]}
              value={detail}
              onChangeText={setDetail}
              placeholder={cfg.placeholder}
              multiline
              placeholderTextColor={C.outline}
            />
          </View>
          <View>
            <Text style={ms.label}>Date</Text>
            <TextInput
              style={ms.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.outline}
              keyboardType="numeric"
            />
          </View>
        </ScrollView>
        <View style={ms.footer}>
          <TouchableOpacity style={ms.cancelBtn} onPress={onClose}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[ms.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={ms.saveText}>Save Operation</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OperationsScreen() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [farmYears, setFarmYears] = useState<FarmYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [lifecycles, setLifecycles] = useState<Lifecycle[]>([]);
  const [selectedLcId, setSelectedLcId] = useState<string | null>(null);
  const [operations, setOperations] = useState<PlotOperation[]>([]);
  const [filter, setFilter] = useState<OpGroup | 'All'>('All');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    apiGet<{ items: Plot[] }>('/api/v1/plots?page=1&page_size=100&status=active')
      .then((d) => { setPlots(d.items); if (d.items.length) setSelectedPlotId(d.items[0].id); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPlotId) return;
    setFarmYears([]); setSelectedYearId(null); setLifecycles([]); setSelectedLcId(null); setOperations([]);
    apiGet<FarmYear[]>(`/api/v1/farm-years?plot_id=${selectedPlotId}`)
      .then((d) => { setFarmYears(d); if (d.length) setSelectedYearId(d[d.length - 1].id); })
      .catch(() => {});
  }, [selectedPlotId]);

  useEffect(() => {
    if (!selectedYearId || !selectedPlotId) return;
    setLifecycles([]); setSelectedLcId(null); setOperations([]);
    apiGet<Lifecycle[]>(`/api/v1/farm-years/${selectedYearId}/lifecycles?plot_id=${selectedPlotId}`)
      .then((d) => { setLifecycles(d); if (d.length) setSelectedLcId(d[d.length - 1].id); })
      .catch(() => {});
  }, [selectedYearId, selectedPlotId]);

  const loadOps = useCallback(async (silent = false) => {
    if (!selectedLcId) return;
    if (!silent) setLoading(true);
    try {
      const ops = await apiGet<PlotOperation[]>(`/api/v1/plot-operations?lifecycle_id=${selectedLcId}`);
      setOperations(ops.sort((a, b) => a.operation_date.localeCompare(b.operation_date)));
    } catch { Alert.alert('Error', 'Failed to load operations.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [selectedLcId]);

  useEffect(() => { loadOps(); }, [loadOps]);

  const filtered = filter === 'All' ? operations : operations.filter((op) => opGroupOf(op.operation_type) === filter);

  const lcLabel = (lc: Lifecycle) => lc.stage === 'vegetative' ? '🌱 Vegetative' : '🍇 Fruit Production';

  return (
    <View style={styles.root}>
      <AppHeader screenName="Operations" />

      {/* Plot selector — wraps, no horizontal scroll */}
      <View style={styles.selectorSection}>
        <Text style={styles.selectorLabel}>PLOT</Text>
        <View style={styles.chipWrap}>
          {plots.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, selectedPlotId === p.id && styles.chipActive]}
              onPress={() => setSelectedPlotId(p.id)}
            >
              <Text style={[styles.chipText, selectedPlotId === p.id && styles.chipTextActive]}>🌱 {p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {farmYears.length > 0 && (
          <>
            <Text style={styles.selectorLabel}>SEASON</Text>
            <View style={styles.chipWrap}>
              {farmYears.map((y) => (
                <TouchableOpacity
                  key={y.id}
                  style={[styles.chip, selectedYearId === y.id && styles.chipActive]}
                  onPress={() => setSelectedYearId(y.id)}
                >
                  <Text style={[styles.chipText, selectedYearId === y.id && styles.chipTextActive]}>{y.year_label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {lifecycles.length > 0 && (
          <>
            <Text style={styles.selectorLabel}>STAGE</Text>
            <View style={styles.chipWrap}>
              {lifecycles.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.chip, selectedLcId === l.id && styles.chipActive]}
                  onPress={() => setSelectedLcId(l.id)}
                >
                  <Text style={[styles.chipText, selectedLcId === l.id && styles.chipTextActive]}>{lcLabel(l)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      {/* Filter + Add row */}
      <View style={styles.filterRow}>
        {(['All', ...OP_GROUPS] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        {selectedLcId && (
          <TouchableOpacity style={styles.addOpBtn} onPress={() => setModalOpen(true)}>
            <Text style={styles.addOpBtnText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <AddOpModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); loadOps(true); }}
        plotId={selectedPlotId}
        lifecycleId={selectedLcId}
      />

      {!selectedPlotId ? (
        <View style={styles.centred}><Text style={styles.hint}>Select a plot above to get started</Text></View>
      ) : loading ? (
        <View style={styles.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.centred}>
          <Text style={styles.emptyIcon}>🌾</Text>
          <Text style={styles.emptyTitle}>{selectedLcId ? 'No operations yet' : 'Select a season & stage'}</Text>
          <Text style={styles.hint}>{selectedLcId ? 'Tap + Add to log the first operation' : 'Choose a grape year and stage above'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(op) => op.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOps(true); }} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: 40 }]}>Day</Text>
              <Text style={[styles.tableHeaderText, { width: 72 }]}>Date</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Operation</Text>
            </View>
          }
          renderItem={({ item: op }) => {
            const grp = opGroupOf(op.operation_type);
            const cfg = GROUP_CFG[grp];
            const day = dayNum(operations, op);
            return (
              <View style={styles.opRow}>
                <View style={styles.dayBadge}><Text style={styles.dayText}>{day}</Text></View>
                <Text style={styles.opDate}>{op.operation_date.slice(5)}</Text>
                <View style={{ flex: 1 }}>
                  <View style={[styles.groupBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.groupBadgeText, { color: cfg.fg }]}>{cfg.icon} {grp}</Text>
                  </View>
                  {op.notes ? <Text style={styles.opNotes} numberOfLines={2}>{op.notes}</Text> : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  selectorSection: { backgroundColor: C.surface, padding: 12, borderBottomWidth: 1, borderBottomColor: C.outlineVariant, gap: 6 },
  selectorLabel: { fontSize: 9, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 1, marginTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.full, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.outlineVariant },
  chipActive: { backgroundColor: C.primaryFixed, borderColor: C.primaryContainer },
  chipText: { fontSize: 12, fontWeight: '600', color: C.onSurfaceVariant },
  chipTextActive: { color: C.primaryContainer },

  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6, backgroundColor: C.surfaceLow, borderBottomWidth: 1, borderBottomColor: C.outlineVariant, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: R.full, backgroundColor: C.surfaceHigh },
  filterChipActive: { backgroundColor: C.primaryContainer },
  filterChipText: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant },
  filterChipTextActive: { color: C.onPrimary },
  addOpBtn: { backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 6 },
  addOpBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 12 },

  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  hint: { fontSize: 12, color: C.onSurfaceVariant, textAlign: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.onSurface, marginBottom: 4 },

  tableHeader: { flexDirection: 'row', paddingHorizontal: 4, paddingBottom: 6 },
  tableHeaderText: { fontSize: 9, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },

  opRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surfaceLowest, borderRadius: R.lg, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.outlineVariant, gap: 10 },
  dayBadge: { width: 32, height: 32, borderRadius: R.sm, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 12, fontWeight: '700', color: C.onSurface },
  opDate: { width: 66, fontSize: 12, color: C.onSurfaceVariant, paddingTop: 7 },
  groupBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.sm, alignSelf: 'flex-start', marginBottom: 4 },
  groupBadgeText: { fontSize: 11, fontWeight: '700' },
  opNotes: { fontSize: 11, color: C.onSurfaceVariant },
});

const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  close: { fontSize: 18, color: C.onSurfaceVariant },
  body: { flex: 1, padding: 20 },
  label: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  groupGrid: { flexDirection: 'row', gap: 8 },
  groupBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow, gap: 4 },
  groupIcon: { fontSize: 20 },
  groupText: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant },
  input: { borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.onSurface, backgroundColor: C.surfaceLow },
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  cancelBtn: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
});
