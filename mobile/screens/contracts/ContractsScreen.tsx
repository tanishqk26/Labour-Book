import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { ApiError, apiGet, apiPost } from '../../lib/api';
import { C, R, fmtCurrency, fmtDate, todayISO } from '../../lib/theme';
import { Labour, PaginatedResponse, TeamSummary } from '../../types';

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

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  active: { bg: C.primaryFixed, fg: C.primary },
  completed: { bg: '#d7e4f0', fg: '#111d25' },
  cancelled: { bg: C.errorContainer, fg: C.error },
};

export default function ContractsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ContractItem[]>([]);
  const [status, setStatus] = useState<'' | 'active' | 'completed' | 'cancelled'>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={s.back}><Text style={s.backText}>‹</Text></TouchableOpacity>
        <Text style={s.title}>Contracts</Text>
        <TouchableOpacity onPress={() => setOpen(true)}><Text style={s.add}>+ New</Text></TouchableOpacity>
      </View>

      <View style={s.filters}>
        {(['', 'active', 'completed', 'cancelled'] as const).map((key) => (
          <TouchableOpacity key={key || 'all'} style={[s.chip, status === key && s.chipOn]} onPress={() => setStatus(key)}>
            <Text style={[s.chipText, status === key && s.chipTextOn]}>{key || 'All'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <CreateContract visible={open} onClose={() => setOpen(false)} onSaved={() => load(true)} />

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
          ListEmptyComponent={<Text style={s.emptyTitle}>No contracts yet</Text>}
          renderItem={({ item }) => {
            const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.active;
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={[s.badge, { backgroundColor: st.bg }]}>
                    <Text style={[s.badgeText, { color: st.fg }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={s.meta}>{item.entity_name || (item.entity_type === 'team' ? 'Team' : 'Labour')} · {fmtDate(item.assigned_date)}</Text>
                {item.plot?.name ? <Text style={s.meta}>Plot · {item.plot.name}</Text> : null}
                {item.description ? <Text style={s.notes} numberOfLines={2}>{item.description}</Text> : null}
                <Text style={s.amount}>{fmtCurrency(item.amount)}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function CreateContract({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'individual' | 'team'>('individual');
  const [entityId, setEntityId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [labours, setLabours] = useState<Labour[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(''); setKind('individual'); setEntityId(''); setAmount(''); setDate(todayISO()); setNotes(''); setError(null);
    Promise.all([
      apiGet<PaginatedResponse<Labour>>('/api/v1/labours', { status: 'active', page_size: 100 }),
      apiGet<PaginatedResponse<TeamSummary>>('/api/v1/teams', { status: 'active', page_size: 100 }),
    ]).then(([l, t]) => { setLabours(l.items); setTeams(t.items); }).catch(() => {});
  }, [visible]);

  const options = kind === 'individual' ? labours : teams;

  async function save() {
    const value = parseFloat(amount);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!entityId) { setError('Select a labourer or team.'); return; }
    if (!amount.trim() || Number.isNaN(value) || value <= 0) { setError('Enter an amount greater than 0.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Date must be YYYY-MM-DD.'); return; }
    setSaving(true); setError(null);
    try {
      await apiPost('/api/v1/contracts', {
        title: title.trim(),
        description: notes.trim() || null,
        entity_type: kind,
        labour_id: kind === 'individual' ? entityId : null,
        team_id: kind === 'team' ? entityId : null,
        amount: value,
        assigned_date: date,
        status: 'active',
      });
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
          <Text style={m.title}>New Contract</Text>
          <TouchableOpacity onPress={onClose}><Text style={m.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
          <Text style={m.label}>Title *</Text>
          <TextInput style={m.input} value={title} onChangeText={setTitle} placeholder="e.g. Pruning block A" placeholderTextColor={C.outline} />
          <Text style={m.label}>Assign to</Text>
          <View style={m.row}>
            {(['individual', 'team'] as const).map((k) => (
              <TouchableOpacity key={k} style={[m.toggle, kind === k && m.toggleOn]} onPress={() => { setKind(k); setEntityId(''); }}>
                <Text style={[m.toggleText, kind === k && m.toggleTextOn]}>{k === 'individual' ? 'Labour' : 'Team'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
            {options.map((o) => (
              <TouchableOpacity key={o.id} style={[m.person, entityId === o.id && m.personOn]} onPress={() => setEntityId(o.id)}>
                <Text style={[m.personText, entityId === o.id && m.toggleTextOn]}>{o.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
            {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={m.saveText}>Create</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  back: { width: 36, alignItems: 'center' },
  backText: { fontSize: 32, color: C.primary, lineHeight: 34 },
  title: { fontSize: 16, fontWeight: '700', color: C.primary },
  add: { color: C.primary, fontWeight: '700', paddingHorizontal: 8 },
  filters: { flexDirection: 'row', gap: 6, padding: 12, backgroundColor: C.surface },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.full, backgroundColor: C.surfaceHigh },
  chipOn: { backgroundColor: C.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'capitalize' },
  chipTextOn: { color: C.onPrimary },
  list: { padding: 12, gap: 8, paddingBottom: 32 },
  card: { backgroundColor: C.surfaceLowest, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: C.outlineVariant, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: C.onSurface },
  badge: { borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  meta: { fontSize: 12, color: C.onSurfaceVariant },
  notes: { fontSize: 12, color: C.onSurface },
  amount: { fontSize: 16, fontWeight: '800', color: C.primary, marginTop: 4 },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  retry: { marginTop: 12, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: C.onPrimary, fontWeight: '700' },
});

const m = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface, paddingTop: Platform.OS === 'android' ? 12 : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  close: { fontSize: 18, color: C.onSurfaceVariant },
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
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  cancel: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600' },
  save: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: C.onPrimary, fontWeight: '700' },
});
