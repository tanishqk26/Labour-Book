import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import { C, R, fmtCurrency, fmtDate, todayISO } from '../../lib/theme';
import { Labour, PaginatedResponse, Plot, TeamSummary } from '../../types';

interface ContractItem {
  id: string;
  title: string;
  description?: string | null;
  entity_type: string;
  entity_name?: string | null;
  amount: number;
  assigned_date: string;
  status: string;
  plot?: { name: string } | null;
}

type ContractStatus = 'active' | 'completed' | 'cancelled';

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  active: { bg: C.primaryFixed, fg: C.primary },
  completed: { bg: '#d7e4f0', fg: '#111d25' },
  cancelled: { bg: C.errorContainer, fg: C.error },
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ContractsScreen({ navigation }: { navigation: { goBack: () => void; navigate: (screen: string, params?: any) => void } }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ContractItem[]>([]);
  const [status, setStatus] = useState<'' | ContractStatus>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractItem | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: 1, page_size: 100 };
      if (status) params.status = status;
      const data = await apiGet<PaginatedResponse<ContractItem>>('/api/v1/contracts', params);
      setItems(data.items);
    } catch {
      setError('Could not load contracts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditingContract(null); setFormOpen(true); }
  function openEdit(contract: ContractItem) { setEditingContract(contract); setFormOpen(true); }

  async function handleDelete(contract: ContractItem) {
    Alert.alert(
      'Delete Contract',
      `Delete "${contract.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await apiDelete(`/api/v1/contracts/${contract.id}`);
              load(true);
            } catch {
              Alert.alert('Error', 'Could not delete this contract.');
            }
          },
        },
      ]
    );
  }

  async function handleStatusChange(id: string, newStatus: ContractStatus) {
    setItems((prev) => prev.map((c) => c.id === id ? { ...c, status: newStatus } : c));
    try {
      await apiPatch(`/api/v1/contracts/${id}`, { status: newStatus });
    } catch {
      Alert.alert('Error', 'Could not update status.');
      load(true);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Contracts</Text>
        <TouchableOpacity onPress={openCreate} style={s.addBtn}>
          <MaterialCommunityIcons name="plus" size={20} color={C.primary} />
          <Text style={s.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={s.filters}>
        {(['', 'active', 'completed', 'cancelled'] as const).map((key) => (
          <TouchableOpacity key={key || 'all'} style={[s.chip, status === key && s.chipOn]} onPress={() => setStatus(key)}>
            <Text style={[s.chipText, status === key && s.chipTextOn]}>{key || 'All'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ContractFormModal
        visible={formOpen}
        contract={editingContract}
        onClose={() => setFormOpen(false)}
        onSaved={() => load(true)}
      />

      {loading ? (
        <View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : error ? (
        <View style={s.centred}>
          <Text style={s.emptyTitle}>{error}</Text>
          <TouchableOpacity style={s.retry} onPress={() => load()}><Text style={s.retryText}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={items.length === 0 ? s.centred : s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="file-document-outline" size={48} color={C.outline} />
              <Text style={s.emptyTitle}>No contracts yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ContractCard
              contract={item}
              onPress={() => navigation.navigate('ContractDetail', { id: item.id })}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item)}
              onStatusChange={(st) => handleStatusChange(item.id, st)}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Contract Card ────────────────────────────────────────────────────────────

function ContractCard({
  contract,
  onPress,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  contract: ContractItem;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (st: ContractStatus) => void;
}) {
  const st = STATUS_STYLE[contract.status] ?? STATUS_STYLE.active;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      {/* Header row */}
      <View style={s.cardTop}>
        <Text style={s.cardTitle} numberOfLines={1}>{contract.title}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity onPress={onEdit} style={s.iconBtn} hitSlop={6}>
            <MaterialCommunityIcons name="pencil-outline" size={16} color={C.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={[s.iconBtn, { borderColor: C.errorContainer }]} hitSlop={6}>
            <MaterialCommunityIcons name="delete-outline" size={16} color={C.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Meta */}
      <Text style={s.meta}>{contract.entity_name || (contract.entity_type === 'team' ? 'Team' : 'Labour')} · {fmtDate(contract.assigned_date)}</Text>
      {contract.plot?.name ? <Text style={s.meta}>Plot · {contract.plot.name}</Text> : null}
      {contract.description ? <Text style={s.notes} numberOfLines={2}>{contract.description}</Text> : null}
      <Text style={s.amount}>{fmtCurrency(contract.amount)}</Text>

      {/* Inline status toggle */}
      <View style={s.statusRow}>
        {(['active', 'completed', 'cancelled'] as ContractStatus[]).map((key) => {
          const c = STATUS_STYLE[key];
          const isActive = contract.status === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => onStatusChange(key)}
              style={[s.statusChip, isActive && { backgroundColor: c.bg, borderColor: c.bg }]}
            >
              <Text style={[s.statusChipText, isActive && { color: c.fg }]}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

// ─── Contract Form Modal (create + edit) ──────────────────────────────────────

function ContractFormModal({
  visible,
  contract,
  onClose,
  onSaved,
}: {
  visible: boolean;
  contract: ContractItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!contract;
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'individual' | 'team'>('individual');
  const [entityId, setEntityId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [labours, setLabours] = useState<Labour[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [plotId, setPlotId] = useState('');
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Quick-create inline form
  const [qcOpen, setQcOpen] = useState(false);
  const [qcName, setQcName] = useState('');
  const [qcWage, setQcWage] = useState('');
  const [qcSaving, setQcSaving] = useState(false);

  const selectedPlot = plots.find((p) => p.id === plotId);

  useEffect(() => {
    if (!visible) return;
    // Pre-fill for edit
    if (contract) {
      setTitle(contract.title);
      setKind(contract.entity_type as 'individual' | 'team');
      setEntityId(''); // entity can't change on edit
      setAmount(String(contract.amount));
      setDate(contract.assigned_date);
      setNotes(contract.description ?? '');
    } else {
      setTitle(''); setKind('individual'); setEntityId(''); setAmount(''); setDate(todayISO()); setNotes('');
      setPlotId(''); setRatePerUnit('');
    }
    setQcOpen(false); setQcName(''); setQcWage(''); setError(null);
    if (!isEdit) {
      Promise.all([
        apiGet<PaginatedResponse<Labour>>('/api/v1/labours', { status: 'active', page_size: 100 }),
        apiGet<PaginatedResponse<TeamSummary>>('/api/v1/teams', { status: 'active', page_size: 100 }),
        apiGet<PaginatedResponse<Plot>>('/api/v1/plots', { status: 'active', page_size: 100 }),
      ]).then(([l, t, pl]) => { setLabours(l.items); setTeams(t.items); setPlots(pl.items ?? []); }).catch(() => {});
    }
  }, [visible, contract, isEdit]);

  // Auto-calculate amount when rate + plot area changes
  useEffect(() => {
    const rate = parseFloat(ratePerUnit);
    const area = selectedPlot?.area;
    if (!isNaN(rate) && rate > 0 && area != null && area > 0) {
      setAmount(String(Math.round(rate * area)));
    }
  }, [ratePerUnit, selectedPlot]);

  async function quickCreate() {
    const w = parseFloat(qcWage);
    if (!qcName.trim() || isNaN(w) || w < 0) return;
    setQcSaving(true);
    try {
      const endpoint = kind === 'individual' ? '/api/v1/labours' : '/api/v1/teams';
      const created = await apiPost<Labour | TeamSummary>(endpoint, { name: qcName.trim(), daily_wage: w });
      if (kind === 'individual') setLabours((prev) => [...prev, created as Labour]);
      else setTeams((prev) => [...prev, created as TeamSummary]);
      setEntityId(created.id);
      setQcOpen(false); setQcName(''); setQcWage('');
    } catch {
      Alert.alert('Error', 'Could not create.');
    } finally {
      setQcSaving(false);
    }
  }

  const options = kind === 'individual' ? labours : teams;

  async function save() {
    const value = parseFloat(amount);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!isEdit && !entityId) { setError('Select a labourer or team.'); return; }
    if (!amount.trim() || Number.isNaN(value) || value <= 0) { setError('Enter an amount greater than 0.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Date must be YYYY-MM-DD.'); return; }
    setSaving(true); setError(null);
    try {
      if (isEdit) {
        await apiPatch(`/api/v1/contracts/${contract!.id}`, {
          title: title.trim(),
          description: notes.trim() || null,
          amount: value,
          assigned_date: date,
        });
      } else {
        await apiPost('/api/v1/contracts', {
          title: title.trim(),
          description: notes.trim() || null,
          entity_type: kind,
          labour_id: kind === 'individual' ? entityId : null,
          team_id: kind === 'team' ? entityId : null,
          plot_id: plotId || null,
          amount: value,
          assigned_date: date,
          status: 'active',
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Could not save (${err.status}).` : 'Could not save contract.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.root}>
        <View style={m.header}>
          <Text style={m.title}>{isEdit ? 'Edit Contract' : 'New Contract'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
          <Text style={m.label}>Title *</Text>
          <TextInput style={m.input} value={title} onChangeText={setTitle} placeholder="e.g. Pruning block A" placeholderTextColor={C.outline} />

          {/* Entity picker — only on create */}
          {!isEdit && (
            <>
              <Text style={m.label}>Assign to</Text>
              <View style={m.row}>
                {(['individual', 'team'] as const).map((k) => (
                  <TouchableOpacity key={k} style={[m.toggle, kind === k && m.toggleOn]} onPress={() => { setKind(k); setEntityId(''); setQcOpen(false); }}>
                    <Text style={[m.toggleText, kind === k && m.toggleTextOn]}>{k === 'individual' ? 'Labour' : 'Team'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
                {options.map((o) => (
                  <TouchableOpacity key={o.id} style={[m.person, entityId === o.id && m.personOn]} onPress={() => { setEntityId(o.id); setQcOpen(false); }}>
                    <Text style={[m.personText, entityId === o.id && m.toggleTextOn]}>{o.name}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={m.qcAddBtn} onPress={() => setQcOpen((v) => !v)}>
                  <MaterialCommunityIcons name={qcOpen ? 'close' : 'plus'} size={16} color={C.primary} />
                  <Text style={m.qcAddText}>New</Text>
                </TouchableOpacity>
              </ScrollView>
              {/* Quick-create inline form */}
              {qcOpen && (
                <View style={m.qcForm}>
                  <Text style={m.qcFormTitle}>Quick Add {kind === 'individual' ? 'Labour' : 'Team'}</Text>
                  <View style={m.qcRow}>
                    <TextInput
                      style={[m.input, { flex: 2 }]}
                      value={qcName}
                      onChangeText={setQcName}
                      placeholder="Name"
                      placeholderTextColor={C.outline}
                    />
                    <TextInput
                      style={[m.input, { flex: 1 }]}
                      value={qcWage}
                      onChangeText={setQcWage}
                      keyboardType="numeric"
                      placeholder="₹/day"
                      placeholderTextColor={C.outline}
                    />
                    <TouchableOpacity
                      style={[m.qcSaveBtn, qcSaving && { opacity: 0.6 }]}
                      onPress={quickCreate}
                      disabled={qcSaving}
                    >
                      {qcSaving
                        ? <ActivityIndicator size="small" color={C.onPrimary} />
                        : <Text style={m.qcSaveBtnText}>Add</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Plot picker */}
              {plots.length > 0 && (
                <>
                  <Text style={m.label}>Plot (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
                    <TouchableOpacity style={[m.person, plotId === '' && m.personOn]} onPress={() => setPlotId('')}>
                      <Text style={[m.personText, plotId === '' && m.toggleTextOn]}>None</Text>
                    </TouchableOpacity>
                    {plots.map((p) => (
                      <TouchableOpacity key={p.id} style={[m.person, plotId === p.id && m.personOn]} onPress={() => setPlotId(p.id)}>
                        <Text style={[m.personText, plotId === p.id && m.toggleTextOn]}>
                          {p.name}{p.area != null ? ` (${p.area}${p.area_unit ?? ''})` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {selectedPlot?.area != null && (
                    <>
                      <Text style={m.label}>Rate per {selectedPlot.area_unit ?? 'unit'} (₹)</Text>
                      <TextInput
                        style={m.input}
                        value={ratePerUnit}
                        onChangeText={setRatePerUnit}
                        keyboardType="numeric"
                        placeholder={`Auto-calculates amount for ${selectedPlot.area} ${selectedPlot.area_unit ?? 'units'}`}
                        placeholderTextColor={C.outline}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}

          <Text style={m.label}>Amount (₹) *</Text>
          <TextInput style={m.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={C.outline} />
          <Text style={m.label}>Assigned date *</Text>
          <TextInput style={m.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" placeholderTextColor={C.outline} />
          <Text style={m.label}>Notes</Text>
          <TextInput style={[m.input, { height: 72, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="Optional" placeholderTextColor={C.outline} />
          {error ? <Text style={m.error}>{error}</Text> : null}
        </ScrollView>
        <View style={m.footer}>
          <TouchableOpacity style={m.cancel} onPress={onClose}><Text style={m.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[m.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={m.saveText}>{isEdit ? 'Save Changes' : 'Create'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, backgroundColor: C.surfaceLowest, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  backBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.primary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8 },
  addBtnText: { color: C.primary, fontWeight: '700', fontSize: 14 },

  filters: { flexDirection: 'row', gap: 6, padding: 12, backgroundColor: C.surfaceLow },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.full, backgroundColor: C.surfaceHigh },
  chipOn: { backgroundColor: C.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'capitalize' },
  chipTextOn: { color: C.onPrimary },

  list: { padding: 12, gap: 10, paddingBottom: 32 },

  card: { backgroundColor: C.surfaceLowest, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: C.outlineVariant, gap: 5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: C.onSurface },
  iconBtn: { width: 30, height: 30, borderRadius: R.sm, borderWidth: 1, borderColor: C.outlineVariant, alignItems: 'center', justifyContent: 'center' },

  meta: { fontSize: 12, color: C.onSurfaceVariant },
  notes: { fontSize: 12, color: C.onSurface },
  amount: { fontSize: 16, fontWeight: '800', color: C.primary, marginTop: 2 },

  statusRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  statusChip: { flex: 1, paddingVertical: 6, borderRadius: R.full, borderWidth: 1, borderColor: C.outlineVariant, alignItems: 'center' },
  statusChipText: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'capitalize' },

  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  retry: { marginTop: 12, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: C.onPrimary, fontWeight: '700' },
});

const m = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surfaceLowest, paddingTop: Platform.OS === 'android' ? 12 : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  body: { padding: 20, paddingBottom: 32 },
  label: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input: { height: 46, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 14, fontSize: 15, color: C.onSurface, backgroundColor: C.surfaceLow },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  toggle: { flex: 1, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  toggleOn: { backgroundColor: C.primary, borderColor: C.primary },
  toggleText: { fontWeight: '700', color: C.onSurfaceVariant },
  toggleTextOn: { color: C.onPrimary },
  person: { paddingHorizontal: 12, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceHigh },
  personOn: { backgroundColor: C.primary },
  personText: { fontSize: 13, fontWeight: '600', color: C.onSurface },
  error: { color: C.error, marginTop: 10 },
  qcAddBtn: { paddingHorizontal: 12, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primaryFixed, flexDirection: 'row', gap: 4 },
  qcAddText: { fontSize: 13, fontWeight: '700', color: C.primary },
  qcForm: { backgroundColor: C.surfaceLow, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.outlineVariant, marginBottom: 8, gap: 8 },
  qcFormTitle: { fontSize: 12, fontWeight: '700', color: C.onSurfaceVariant },
  qcRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  qcSaveBtn: { backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  qcSaveBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 13 },
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  cancel: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600' },
  save: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: C.onPrimary, fontWeight: '700' },
});
