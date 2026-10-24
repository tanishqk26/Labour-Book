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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import { apiGet, apiPost } from '../../lib/api';
import { C, R } from '../../lib/theme';
import { OperationsStackParamList } from '../details/types';

interface Plot { id: string; name: string; }
interface FarmYear { id: string; year_label: string; }
interface Lifecycle { id: string; stage: string; start_date: string | null; end_date: string | null; }
interface PlotOperation { id: string; plot_id: string; lifecycle_id: string | null; operation_date: string; operation_type: string; notes: string | null; }

type OpGroup = 'Spraying' | 'Labour Work' | 'Other';
const OP_GROUPS: OpGroup[] = ['Spraying', 'Labour Work', 'Other'];
const GROUP_CFG: Record<OpGroup, { bg: string; fg: string; icon: string; detailLabel: string; placeholder: string }> = {
  'Spraying': { bg: '#dbeafe', fg: '#1d4ed8', icon: 'spray-bottle', detailLabel: 'Chemical / Spray detail', placeholder: 'e.g. Bavistin 50g/L' },
  'Labour Work': { bg: C.primaryFixed, fg: C.primaryContainer, icon: 'account-hard-hat-outline', detailLabel: 'Work description', placeholder: 'e.g. Pruning, weeding' },
  'Other': { bg: C.surfaceHigh, fg: C.onSurface, icon: 'clipboard-list-outline', detailLabel: 'Details (optional)', placeholder: 'Any relevant notes' },
};

function opGroupOf(type: string): OpGroup {
  if (type === 'Spraying') return 'Spraying';
  if (type === 'Labour Work') return 'Labour Work';
  return 'Other';
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
        plot_id: plotId,
        plot_lifecycle_id: lifecycleId,
        operation_date: date,
        operation_type: group,
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
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
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
                    <MaterialCommunityIcons name={c.icon as any} size={20} color={active ? c.fg : C.onSurfaceVariant} />
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

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function Dropdown({ label, valueLabel, options, selectedId, onSelect }: {
  label: string; valueLabel: string;
  options: { id: string; label: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const canOpen = options.length > 1;
  return (
    <>
      <TouchableOpacity style={dd.row} onPress={() => canOpen && setOpen(true)} activeOpacity={canOpen ? 0.6 : 1}>
        <Text style={dd.ddLabel}>{label}</Text>
        <View style={dd.ddValueRow}>
          <Text style={dd.ddValue} numberOfLines={1}>{valueLabel}</Text>
          {canOpen && <MaterialCommunityIcons name="chevron-down" size={16} color={C.onSurfaceVariant} />}
        </View>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={dd.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={dd.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={dd.handle} />
            <Text style={dd.sheetTitle}>{label}</Text>
            {options.map((opt) => {
              const active = opt.id === selectedId;
              return (
                <TouchableOpacity key={opt.id} style={[dd.option, active && dd.optionActive]} onPress={() => { onSelect(opt.id); setOpen(false); }}>
                  <Text style={[dd.optText, active && dd.optTextActive]}>{opt.label}</Text>
                  {active && <MaterialCommunityIcons name="check" size={18} color={C.primary} />}
                </TouchableOpacity>
              );
            })}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OperationsScreen({ navigation }: NativeStackScreenProps<OperationsStackParamList, 'OperationsList'>) {
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
    apiGet<{ items: { id: string; year: number }[] }>('/api/v1/farm-years', { page_size: 50 })
      .then((d) => {
        const years = [...d.items].sort((a, b) => a.year - b.year).map((y) => ({ id: y.id, year_label: String(y.year) }));
        setFarmYears(years);
        if (years.length) setSelectedYearId(years[years.length - 1].id);
      })
      .catch(() => {});
  }, [selectedPlotId]);

  useEffect(() => {
    if (!selectedYearId || !selectedPlotId) return;
    setLifecycles([]); setSelectedLcId(null); setOperations([]);
    apiGet<{ plot_farm_years: { plot_id: string; lifecycles: { id: string; lifecycle_type: string; start_date: string | null; end_date: string | null }[] }[] }>(`/api/v1/farm-years/${selectedYearId}`)
      .then((d) => {
        const enrolled = (d.plot_farm_years ?? []).find((p) => p.plot_id === selectedPlotId);
        const stages = (enrolled?.lifecycles ?? []).map((lc) => ({
          id: lc.id, stage: lc.lifecycle_type,
          start_date: lc.start_date, end_date: lc.end_date,
        }));
        setLifecycles(stages);
        if (stages.length) setSelectedLcId(stages[stages.length - 1].id);
      })
      .catch(() => {});
  }, [selectedYearId, selectedPlotId]);

  const loadOps = useCallback(async (silent = false) => {
    if (!selectedLcId) return;
    if (!silent) setLoading(true);
    try {
      const data = await apiGet<{ items: PlotOperation[] }>('/api/v1/plot-operations', { lifecycle_id: selectedLcId, page_size: 100 });
      setOperations([...data.items].sort((a, b) => a.operation_date.localeCompare(b.operation_date)));
    } catch { Alert.alert('Error', 'Failed to load operations.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [selectedLcId]);

  useEffect(() => { loadOps(); }, [loadOps]);

  const filtered = filter === 'All' ? operations : operations.filter((op) => opGroupOf(op.operation_type) === filter);
  const lcLabel = (lc: Lifecycle) => lc.stage === 'vegetative' ? 'Vegetative' : 'Fruit Production';

  const selectedPlot = plots.find((p) => p.id === selectedPlotId);
  const selectedYear = farmYears.find((y) => y.id === selectedYearId);
  const selectedLc = lifecycles.find((l) => l.id === selectedLcId);

  return (
    <View style={styles.root}>
      <AppHeader screenName="Operations" />

      {/* Dropdowns */}
      <View style={styles.filterCard}>
        <Dropdown
          label="Plot"
          valueLabel={selectedPlot?.name ?? 'Select plot'}
          options={plots.map((p) => ({ id: p.id, label: p.name }))}
          selectedId={selectedPlotId}
          onSelect={setSelectedPlotId}
        />
        {farmYears.length > 0 && (
          <>
            <View style={styles.filterDiv} />
            <Dropdown
              label="Season"
              valueLabel={selectedYear?.year_label ?? '—'}
              options={farmYears.map((y) => ({ id: y.id, label: y.year_label }))}
              selectedId={selectedYearId}
              onSelect={setSelectedYearId}
            />
          </>
        )}
        {lifecycles.length > 0 && (
          <>
            <View style={styles.filterDiv} />
            <Dropdown
              label="Stage"
              valueLabel={selectedLc ? lcLabel(selectedLc) : '—'}
              options={lifecycles.map((l) => ({ id: l.id, label: lcLabel(l) }))}
              selectedId={selectedLcId}
              onSelect={setSelectedLcId}
            />
          </>
        )}
      </View>

      {/* Type filter chips */}
      <View style={styles.typeRow}>
        {(['All', ...OP_GROUPS] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.typeChip, filter === f && styles.typeChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.typeChipText, filter === f && styles.typeChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <AddOpModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); loadOps(true); }}
        plotId={selectedPlotId}
        lifecycleId={selectedLcId}
      />

      {!selectedPlotId ? (
        <View style={styles.centred}><Text style={styles.hint}>Select a plot to get started</Text></View>
      ) : loading ? (
        <View style={styles.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.centred}>
          <MaterialCommunityIcons name="barley" size={52} color={C.outlineVariant} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyTitle}>{selectedLcId ? 'No operations yet' : 'Select a season & stage'}</Text>
          <Text style={styles.hint}>{selectedLcId ? 'Tap + to log the first operation' : 'Choose a year and stage above'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(op) => op.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 96 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOps(true); }} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: op }) => {
            const grp = opGroupOf(op.operation_type);
            const cfg = GROUP_CFG[grp];
            return (
              <TouchableOpacity style={styles.opCard} onPress={() => navigation.navigate('OperationDetail', { id: op.id })} activeOpacity={0.7}>
                <View style={[styles.opIconWrap, { backgroundColor: cfg.bg }]}>
                  <MaterialCommunityIcons name={cfg.icon as any} size={20} color={cfg.fg} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.opType}>{grp}</Text>
                  {op.notes ? <Text style={styles.opNotes} numberOfLines={2}>{op.notes}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.opDate}>{new Date(`${op.operation_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={C.outline} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* FAB */}
      {selectedLcId && (
        <TouchableOpacity style={styles.fab} onPress={() => setModalOpen(true)} activeOpacity={0.85}>
          <MaterialCommunityIcons name="plus" size={26} color={C.onPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  // dropdown filter card
  filterCard: { backgroundColor: C.surfaceLowest, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  filterDiv: { height: 1, backgroundColor: C.outlineVariant, marginHorizontal: 16 },

  // type filter row
  typeRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, gap: 6, backgroundColor: C.surfaceLow, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  typeChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: R.full, backgroundColor: C.surfaceHigh },
  typeChipActive: { backgroundColor: C.primaryContainer },
  typeChipText: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant },
  typeChipTextActive: { color: C.onPrimary },

  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  hint: { fontSize: 12, color: C.onSurfaceVariant, textAlign: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.onSurface, marginBottom: 6 },

  // operation cards
  opCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surfaceLowest, borderRadius: R.lg, borderWidth: 1, borderColor: C.outlineVariant, padding: 14, marginBottom: 10 },
  opIconWrap: { width: 40, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  opType: { fontSize: 13, fontWeight: '700', color: C.onSurface, marginBottom: 2 },
  opNotes: { fontSize: 12, color: C.onSurfaceVariant },
  opDate: { fontSize: 11, fontWeight: '600', color: C.onSurfaceVariant },

  // FAB
  fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primaryContainer, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
});

const dd = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  ddLabel: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  ddValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '65%' },
  ddValue: { fontSize: 14, fontWeight: '600', color: C.onSurface, flexShrink: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surfaceLowest, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingBottom: 32 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.outlineVariant, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetTitle: { fontSize: 13, fontWeight: '800', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, paddingVertical: 12 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  optionActive: { backgroundColor: C.primaryFixed },
  optText: { fontSize: 15, color: C.onSurface },
  optTextActive: { fontWeight: '700', color: C.primary },
});

const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  body: { flex: 1, padding: 20 },
  label: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  groupGrid: { flexDirection: 'row', gap: 8 },
  groupBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow, gap: 4 },
  groupText: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant },
  input: { borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.onSurface, backgroundColor: C.surfaceLow },
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  cancelBtn: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
});
