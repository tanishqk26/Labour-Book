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

  const totalValue = items.reduce((s, c) => s + c.amount, 0);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Nav bar */}
      <View style={s.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={s.barTitle}>Contracts</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Page header */}
      <View style={s.pageHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.pageLabel}>CONTRACTS</Text>
          <Text style={s.pageTitle}>Contract Work</Text>
          <Text style={s.pageSub}>Fixed-price work assigned to labourers or teams.</Text>
        </View>
        <TouchableOpacity onPress={openCreate} style={s.newBtn}>
          <MaterialCommunityIcons name="plus" size={16} color={C.onPrimary} />
          <Text style={s.newBtnText}>New Contract</Text>
        </TouchableOpacity>
      </View>

      {/* KPI summary */}
      {!loading && items.length > 0 && (
        <View style={s.kpiCard}>
          <View style={s.kpiCell}>
            <Text style={s.kpiLabel}>SHOWING CONTRACTS</Text>
            <Text style={s.kpiValue}>{items.length}</Text>
          </View>
          <View style={s.kpiDiv} />
          <View style={s.kpiCell}>
            <Text style={s.kpiLabel}>TOTAL VALUE</Text>
            <Text style={[s.kpiValue, { color: C.primary }]}>{fmtCurrency(totalValue)}</Text>
          </View>
        </View>
      )}

      {/* Filter chips */}
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
              <TouchableOpacity style={s.newBtn} onPress={openCreate}>
                <MaterialCommunityIcons name="plus" size={16} color={C.onPrimary} />
                <Text style={s.newBtnText}>New Contract</Text>
              </TouchableOpacity>
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
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      {/* Title + actions */}
      <View style={s.cardTop}>
        <Text style={s.cardTitle} numberOfLines={1}>{contract.title}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity onPress={onEdit} style={s.iconBtn} hitSlop={6}>
            <MaterialCommunityIcons name="pencil-outline" size={15} color={C.onSurfaceVariant} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={[s.iconBtn, s.iconBtnRed]} hitSlop={6}>
            <MaterialCommunityIcons name="delete-outline" size={15} color={C.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Entity + type label */}
      <Text style={s.entityLabel}>
        {(contract.entity_name || (contract.entity_type === 'team' ? 'Team' : 'Labour')).toUpperCase()} · {contract.entity_type === 'team' ? 'TEAM' : 'INDIVIDUAL'}
      </Text>
      {contract.plot?.name ? <Text style={s.plotLabel}>Plot · {contract.plot.name}</Text> : null}

      <View style={s.divider} />

      {/* Amount + date row */}
      <View style={s.amountRow}>
        <View>
          <Text style={s.amountLabel}>AGREED AMOUNT</Text>
          <Text style={s.amount}>{fmtCurrency(contract.amount)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.amountLabel}>ASSIGNED</Text>
          <Text style={s.assignedDate}>{fmtDate(contract.assigned_date)}</Text>
        </View>
      </View>

      {contract.description ? (
        <>
          <View style={s.divider} />
          <Text style={s.notes} numberOfLines={2}>{contract.description}</Text>
        </>
      ) : null}

      <View style={s.divider} />

      {/* Status toggle */}
      <Text style={s.statusLabel}>STATUS</Text>
      <View style={s.statusRow}>
        {(['active', 'completed', 'cancelled'] as ContractStatus[]).map((key) => {
          const c = STATUS_STYLE[key];
          const isOn = contract.status === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => onStatusChange(key)}
              style={[s.statusChip, isOn && { backgroundColor: c.bg, borderColor: c.bg }]}
            >
              <Text style={[s.statusChipText, isOn && { color: c.fg, fontWeight: '800' }]}>
                {key.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

// ─── Sheet Picker ─────────────────────────────────────────────────────────────

function SheetPicker({ label, selectedId, options, onSelect }: {
  label: string;
  selectedId: string;
  options: { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.id === selectedId)?.label ?? '';
  return (
    <>
      <TouchableOpacity style={m.pickerRow} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[m.pickerValue, !selectedLabel && m.pickerPlaceholder]} numberOfLines={1}>
          {selectedLabel || `Select ${label}...`}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={C.onSurfaceVariant} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={m.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={m.sheetHandle} />
            <Text style={m.sheetTitle}>{label}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
              {options.map((opt) => {
                const active = opt.id === selectedId;
                return (
                  <TouchableOpacity key={opt.id} style={[m.sheetOpt, active && m.sheetOptActive]} onPress={() => { onSelect(opt.id); setOpen(false); }}>
                    <Text style={[m.sheetOptText, active && m.sheetOptTextActive]}>{opt.label}</Text>
                    {active && <MaterialCommunityIcons name="check" size={18} color={C.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
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
  const [qcHometown, setQcHometown] = useState('');
  const [qcPhone, setQcPhone] = useState('');
  const [qcCarRent, setQcCarRent] = useState('');
  const [qcMgrFee, setQcMgrFee] = useState('');
  const [qcDesc, setQcDesc] = useState('');
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
    setQcOpen(false); setQcName(''); setQcWage(''); setQcHometown(''); setQcPhone(''); setQcCarRent(''); setQcMgrFee(''); setQcDesc(''); setError(null);
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
    const area = selectedPlot?.size_acres;
    if (!isNaN(rate) && rate > 0 && area != null && area > 0) {
      setAmount(String(Math.round(rate * area)));
    }
  }, [ratePerUnit, selectedPlot]);

  async function quickCreate() {
    if (!qcName.trim()) { Alert.alert('Required', 'Name is required'); return; }
    const w = parseFloat(qcWage);
    if (isNaN(w) || w < 0) { Alert.alert('Invalid', 'Enter a valid daily wage'); return; }
    setQcSaving(true);
    try {
      let created: Labour | TeamSummary;
      if (kind === 'individual') {
        created = await apiPost<Labour>('/api/v1/labours', {
          name: qcName.trim(),
          daily_wage: w,
          hometown: qcHometown.trim() || undefined,
          phone: qcPhone.trim() || undefined,
        });
        setLabours((prev) => [...prev, created as Labour]);
      } else {
        created = await apiPost<TeamSummary>('/api/v1/teams', {
          name: qcName.trim(),
          daily_wage: w,
          hometown: qcHometown.trim() || undefined,
          car_rent: parseFloat(qcCarRent) || 0,
          manager_fee: parseFloat(qcMgrFee) || 0,
          description: qcDesc.trim() || undefined,
        });
        setTeams((prev) => [...prev, created as TeamSummary]);
      }
      setEntityId(created.id);
      setQcOpen(false);
      setQcName(''); setQcWage(''); setQcHometown(''); setQcPhone(''); setQcCarRent(''); setQcMgrFee(''); setQcDesc('');
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
              <SheetPicker
                label={kind === 'individual' ? 'Labour' : 'Team'}
                selectedId={entityId}
                options={options.map((o) => ({ id: o.id, label: o.name }))}
                onSelect={(id) => { setEntityId(id); setQcOpen(false); }}
              />
              <TouchableOpacity style={m.qcAddBtn} onPress={() => setQcOpen((v) => !v)}>
                <MaterialCommunityIcons name={qcOpen ? 'close' : 'plus'} size={14} color={C.primary} />
                <Text style={m.qcAddText}>Quick add new {kind === 'individual' ? 'labour' : 'team'}</Text>
              </TouchableOpacity>
              {/* Quick-create inline form */}
              {qcOpen && (
                <View style={m.qcForm}>
                  <Text style={m.qcFormTitle}>New {kind === 'individual' ? 'Labourer' : 'Team'}</Text>

                  <Text style={m.qcFieldLabel}>Full Name *</Text>
                  <TextInput style={m.input} value={qcName} onChangeText={setQcName} placeholder="e.g. Deepak Jadhav" placeholderTextColor={C.outline} />

                  <Text style={m.qcFieldLabel}>Daily Wage (₹) *</Text>
                  <TextInput style={m.input} value={qcWage} onChangeText={setQcWage} keyboardType="numeric" placeholder="e.g. 400" placeholderTextColor={C.outline} />

                  <Text style={m.qcFieldLabel}>Hometown</Text>
                  <TextInput style={m.input} value={qcHometown} onChangeText={setQcHometown} placeholder="e.g. Junnar" placeholderTextColor={C.outline} />

                  {kind === 'individual' ? (
                    <>
                      <Text style={m.qcFieldLabel}>Phone</Text>
                      <TextInput style={m.input} value={qcPhone} onChangeText={setQcPhone} keyboardType="phone-pad" placeholder="10-digit number" placeholderTextColor={C.outline} />
                    </>
                  ) : (
                    <>
                      <View style={m.qcRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={m.qcFieldLabel}>Car Rent (₹)</Text>
                          <TextInput style={m.input} value={qcCarRent} onChangeText={setQcCarRent} keyboardType="numeric" placeholder="0" placeholderTextColor={C.outline} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={m.qcFieldLabel}>Manager Fee (₹)</Text>
                          <TextInput style={m.input} value={qcMgrFee} onChangeText={setQcMgrFee} keyboardType="numeric" placeholder="0" placeholderTextColor={C.outline} />
                        </View>
                      </View>
                      <Text style={m.qcFieldLabel}>Description</Text>
                      <TextInput style={[m.input, { minHeight: 60, textAlignVertical: 'top' }]} value={qcDesc} onChangeText={setQcDesc} multiline placeholder="Optional notes about this team" placeholderTextColor={C.outline} />
                    </>
                  )}

                  <TouchableOpacity style={[m.qcSaveBtn, qcSaving && { opacity: 0.6 }]} onPress={quickCreate} disabled={qcSaving}>
                    {qcSaving
                      ? <ActivityIndicator size="small" color={C.onPrimary} />
                      : <Text style={m.qcSaveBtnText}>Add {kind === 'individual' ? 'Labourer' : 'Team'}</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {/* Plot picker */}
              {plots.length > 0 && (
                <>
                  <Text style={m.label}>Plot (optional)</Text>
                  <SheetPicker
                    label="Plot"
                    selectedId={plotId}
                    options={[
                      { id: '', label: 'None' },
                      ...plots.map((p) => ({ id: p.id, label: p.name + (p.size_acres != null ? ` (${p.size_acres} ac)` : '') })),
                    ]}
                    onSelect={setPlotId}
                  />
                  {selectedPlot?.size_acres != null && (
                    <>
                      <Text style={m.label}>Rate per acre (₹)</Text>
                      <TextInput
                        style={m.input}
                        value={ratePerUnit}
                        onChangeText={setRatePerUnit}
                        keyboardType="numeric"
                        placeholder={`Auto-calculates amount for ${selectedPlot.size_acres} acres`}
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

  // nav bar
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, backgroundColor: C.surfaceLowest, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  backBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  barTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.primary },

  // page header
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.surfaceLow, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  pageLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 1 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: C.primary, letterSpacing: -0.3, marginTop: 2 },
  pageSub: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primaryContainer, borderRadius: R.lg, paddingHorizontal: 12, paddingVertical: 9, marginTop: 4 },
  newBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 12 },

  // KPI summary
  kpiCard: { flexDirection: 'row', backgroundColor: C.surfaceLowest, marginHorizontal: 16, marginTop: 14, borderRadius: R.lg, borderWidth: 1, borderColor: C.outlineVariant, overflow: 'hidden' },
  kpiCell: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
  kpiDiv: { width: 1, backgroundColor: C.outlineVariant, marginVertical: 10 },
  kpiLabel: { fontSize: 9, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.8, textTransform: 'uppercase' },
  kpiValue: { fontSize: 22, fontWeight: '800', color: C.onSurface, letterSpacing: -0.3 },

  // filter chips
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.background },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: R.full, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.outlineVariant },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'capitalize' },
  chipTextOn: { color: C.onPrimary },

  list: { padding: 16, gap: 12, paddingBottom: 40 },

  // card
  card: { backgroundColor: C.surfaceLowest, borderRadius: R.xl, padding: 16, borderWidth: 1, borderColor: C.outlineVariant, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: C.onSurface },
  iconBtn: { width: 30, height: 30, borderRadius: R.full, borderWidth: 1, borderColor: C.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  iconBtnRed: { borderColor: '#fecaca' },

  entityLabel: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.3 },
  plotLabel: { fontSize: 11, color: C.onSurfaceVariant },
  divider: { height: 1, backgroundColor: C.outlineVariant },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  amountLabel: { fontSize: 9, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.8, marginBottom: 2 },
  amount: { fontSize: 20, fontWeight: '800', color: C.primary, letterSpacing: -0.3 },
  assignedDate: { fontSize: 13, fontWeight: '600', color: C.onSurface },
  notes: { fontSize: 12, color: C.onSurfaceVariant },
  statusLabel: { fontSize: 9, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.8 },
  statusRow: { flexDirection: 'row', gap: 6 },
  statusChip: { flex: 1, paddingVertical: 7, borderRadius: R.full, borderWidth: 1, borderColor: C.outlineVariant, alignItems: 'center' },
  statusChipText: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant },

  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  retry: { backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
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
  qcAddBtn: { paddingHorizontal: 14, height: 36, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primaryFixed, flexDirection: 'row', gap: 6, alignSelf: 'flex-start', marginBottom: 8 },
  qcAddText: { fontSize: 13, fontWeight: '700', color: C.primary },
  qcForm: { backgroundColor: C.surfaceLow, borderRadius: R.md, padding: 14, borderWidth: 1, borderColor: C.outlineVariant, marginBottom: 8, gap: 6 },
  qcFormTitle: { fontSize: 13, fontWeight: '800', color: C.onSurface, letterSpacing: 0.2, marginBottom: 4 },
  qcFieldLabel: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  qcRow: { flexDirection: 'row', gap: 10 },
  qcSaveBtn: { backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  qcSaveBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 13 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 8, backgroundColor: C.surfaceLowest },
  pickerValue: { fontSize: 15, color: C.onSurface, flex: 1 },
  pickerPlaceholder: { color: C.onSurfaceVariant },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surfaceLowest, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingBottom: 32 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.outlineVariant, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetTitle: { fontSize: 13, fontWeight: '800', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, paddingVertical: 12 },
  sheetOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  sheetOptActive: { backgroundColor: C.primaryFixed },
  sheetOptText: { fontSize: 15, color: C.onSurface },
  sheetOptTextActive: { fontWeight: '700', color: C.primary },
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  cancel: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600' },
  save: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: C.onPrimary, fontWeight: '700' },
});
