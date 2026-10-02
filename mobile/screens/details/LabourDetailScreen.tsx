import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PaymentModal from '../../components/PaymentModal';
import { ApiError, apiGet, apiPatch, apiPost } from '../../lib/api';
import { AVATAR_COLORS, C, R, fmtCurrency, fmtDate, initials, todayISO } from '../../lib/theme';
import { EntityPaymentSummary, Labour, PaymentRead, PaginatedResponse } from '../../types';
import { PeopleStackParamList } from './types';

type Props = NativeStackScreenProps<PeopleStackParamList, 'LabourDetail'>;
type Tab = 'attendance' | 'payments';

interface AttendanceRow {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'half_day';
  task: string | null;
  hours_worked: number | null;
  wage_earned: number;
  wage_type?: string;
  contract?: { id: string; title: string } | null;
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  present: { bg: C.primaryFixed, fg: C.primary, label: 'Present' },
  absent: { bg: C.errorContainer, fg: C.error, label: 'Absent' },
  half_day: { bg: '#fef3c7', fg: '#6b4c04', label: 'Half day' },
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank', other: 'Other',
};

// ─── Edit Labour Modal ────────────────────────────────────────────────────────

function EditLabourModal({
  visible, labour, onClose, onSaved,
}: { visible: boolean; labour: Labour; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [wage, setWage] = useState('');
  const [phone, setPhone] = useState('');
  const [hometown, setHometown] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(labour.name);
    setWage(String(labour.daily_wage));
    setPhone(labour.phone ?? '');
    setHometown(labour.hometown ?? '');
    setStartTime(labour.work_start_time ?? '');
    setEndTime(labour.work_end_time ?? '');
    setError(null);
  }, [visible, labour]);

  async function save() {
    const w = parseFloat(wage);
    if (!name.trim()) { setError('Name is required.'); return; }
    if (isNaN(w) || w < 0) { setError('Enter a valid daily wage.'); return; }
    setSaving(true); setError(null);
    try {
      await apiPatch(`/api/v1/labours/${labour.id}`, {
        name: name.trim(),
        daily_wage: w,
        phone: phone.trim() || null,
        hometown: hometown.trim() || null,
        work_start_time: startTime.trim() || null,
        work_end_time: endTime.trim() || null,
      });
      onSaved(); onClose();
    } catch { setError('Could not save changes.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={e.root}>
          <View style={e.header}>
            <Text style={e.title}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={e.body} keyboardShouldPersistTaps="handled">
            {([
              { label: 'Full Name *', value: name, setter: setName, kb: 'default' as const },
              { label: 'Daily Wage (₹) *', value: wage, setter: setWage, kb: 'numeric' as const },
              { label: 'Phone', value: phone, setter: setPhone, kb: 'phone-pad' as const },
              { label: 'Hometown', value: hometown, setter: setHometown, kb: 'default' as const },
              { label: 'Shift Start (e.g. 07:00)', value: startTime, setter: setStartTime, kb: 'default' as const },
              { label: 'Shift End (e.g. 15:00)', value: endTime, setter: setEndTime, kb: 'default' as const },
            ]).map((f) => (
              <View key={f.label} style={e.field}>
                <Text style={e.label}>{f.label}</Text>
                <TextInput style={e.input} value={f.value} onChangeText={f.setter} keyboardType={f.kb} placeholderTextColor={C.outline} />
              </View>
            ))}
            {error ? <Text style={e.error}>{error}</Text> : null}
          </ScrollView>
          <View style={e.footer}>
            <TouchableOpacity style={e.cancelBtn} onPress={onClose}><Text style={e.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[e.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={e.saveText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LabourDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const rootNav = useNavigation<any>();
  const avatar = AVATAR_COLORS[0];

  const [labour, setLabour] = useState<Labour | null>(null);
  const [summary, setSummary] = useState<EntityPaymentSummary | null>(null);
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRead[]>([]);
  const [tab, setTab] = useState<Tab>('attendance');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [settling, setSettling] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [profile, paySummary, att, payList] = await Promise.all([
        apiGet<Labour>(`/api/v1/labours/${id}`),
        apiGet<EntityPaymentSummary>(`/api/v1/payments/entity/individual/${id}/summary`),
        apiGet<AttendanceRow[]>(`/api/v1/attendance/labour/${id}/history`, { limit: 100 }),
        apiGet<PaginatedResponse<PaymentRead>>('/api/v1/payments', { labour_id: id, page_size: 50 }),
      ]);
      setLabour(profile);
      setSummary(paySummary);
      setHistory(att);
      setPayments(payList.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError('Could not load this labourer.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function settle() {
    if (!summary || summary.pending <= 0) return;
    Alert.alert(
      'Settle balance',
      `Record ${fmtCurrency(summary.pending)} cash payment to clear the pending balance?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          onPress: async () => {
            setSettling(true);
            try {
              await apiPost('/api/v1/payments', {
                labour_id: id, amount: summary.pending, method: 'cash',
                date: todayISO(), notes: 'Settlement — full balance cleared',
              });
              load(true);
            } catch {
              Alert.alert('Error', 'Settlement failed. Try recording a payment instead.');
            } finally { setSettling(false); }
          },
        },
      ],
    );
  }

  function viewStatement() {
    rootNav.navigate('More', {
      screen: 'StatementDetail',
      params: { entityType: 'individual', entityId: id, name: labour?.name ?? '' },
    });
  }

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <BackBar onBack={() => navigation.goBack()} />
        <View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      </View>
    );
  }

  if (notFound || error || !labour) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <BackBar onBack={() => navigation.goBack()} />
        <View style={s.centred}>
          <Text style={s.emptyTitle}>{notFound ? 'Labourer not found' : 'Something went wrong'}</Text>
          <Text style={s.emptySub}>{error ?? 'This profile may have been removed.'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const timing = labour.work_start_time && labour.work_end_time
    ? `${labour.work_start_time} – ${labour.work_end_time}`
    : 'Not set';

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <BackBar onBack={() => navigation.goBack()} title={labour.name} onEdit={() => setEditOpen(true)} />

      <EditLabourModal
        visible={editOpen}
        labour={labour}
        onClose={() => setEditOpen(false)}
        onSaved={() => load(true)}
      />
      <PaymentModal
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        onSuccess={() => load(true)}
        entityType="individual"
        entityId={id}
        entityName={labour.name}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
      >
        <View style={s.profile}>
          <View style={[s.avatar, { backgroundColor: avatar.bg }]}>
            <Text style={[s.avatarText, { color: avatar.fg }]}>{initials(labour.name)}</Text>
          </View>
          <Text style={s.name}>{labour.name}</Text>
          {labour.hometown ? <Text style={s.meta}>📍 {labour.hometown}</Text> : null}
          {labour.phone ? <Text style={s.meta}>📞 {labour.phone}</Text> : null}
          <View style={s.wageRow}>
            <View style={s.wageChip}>
              <Text style={s.wageLabel}>DAILY WAGE</Text>
              <Text style={s.wageValue}>{fmtCurrency(labour.daily_wage)}</Text>
            </View>
            <View style={s.wageChip}>
              <Text style={s.wageLabel}>SHIFT</Text>
              <Text style={s.wageValue}>{timing}</Text>
            </View>
          </View>
        </View>

        <View style={s.kpiRow}>
          <Kpi label="Earned" value={fmtCurrency(summary?.total_earned ?? 0)} />
          <Kpi label="Paid" value={fmtCurrency(summary?.total_paid ?? 0)} />
          <Kpi label="Pending" value={fmtCurrency(summary?.pending ?? 0)} accent={(summary?.pending ?? 0) > 0} />
        </View>

        <View style={s.actions}>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setPayOpen(true)}>
            <Text style={s.primaryBtnText}>Record Payment</Text>
          </TouchableOpacity>
          {(summary?.pending ?? 0) > 0 && (
            <TouchableOpacity style={[s.secondaryBtn, settling && { opacity: 0.6 }]} onPress={settle} disabled={settling}>
              {settling
                ? <ActivityIndicator color={C.primary} />
                : <Text style={s.secondaryBtnText}>Settle {fmtCurrency(summary!.pending)}</Text>}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={s.stmtBtn} onPress={viewStatement}>
          <MaterialCommunityIcons name="chart-bar" size={16} color={C.primaryContainer} />
          <Text style={s.stmtBtnText}>View Statement</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={C.outlineVariant} />
        </TouchableOpacity>

        <View style={s.tabRow}>
          {(['attendance', 'payments'] as Tab[]).map((t) => (
            <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'attendance' ? `Attendance (${history.length})` : `Payments (${payments.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'attendance' ? (
          history.length === 0 ? (
            <Empty iconName="calendar-check-outline" title="No attendance yet" sub="Marked days will appear here." />
          ) : history.map((row) => {
            const st = STATUS_STYLE[row.status] ?? STATUS_STYLE.present;
            return (
              <View key={row.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{fmtDate(row.date)}</Text>
                  <Text style={s.rowSub}>
                    {row.wage_type === 'contract' && row.contract
                      ? `Contract · ${row.contract.title}`
                      : row.task || 'Daily wage'}
                  </Text>
                </View>
                <View style={[s.badge, { backgroundColor: st.bg }]}>
                  <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
                </View>
                <Text style={s.rowAmt}>{row.status === 'absent' ? '—' : fmtCurrency(row.wage_earned)}</Text>
              </View>
            );
          })
        ) : payments.length === 0 ? (
          <Empty iconName="credit-card-outline" title="No payments yet" sub="Record a payment to start the ledger." />
        ) : payments.map((p) => (
          <View key={p.id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{fmtDate(p.date)}</Text>
              <Text style={s.rowSub}>{METHOD_LABEL[p.method] ?? p.method}{p.notes ? ` · ${p.notes}` : ''}</Text>
            </View>
            <Text style={[s.rowAmt, { color: C.primary }]}>{fmtCurrency(p.amount)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BackBar({ onBack, title, onEdit }: { onBack: () => void; title?: string; onEdit?: () => void }) {
  return (
    <View style={s.backBar}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
      </TouchableOpacity>
      <Text style={s.backTitle} numberOfLines={1}>{title ?? 'Labourer'}</Text>
      {onEdit ? (
        <TouchableOpacity onPress={onEdit} hitSlop={12} style={s.backBtn}>
          <MaterialCommunityIcons name="pencil-outline" size={20} color={C.primary} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, accent && { color: C.tertiary }]}>{value}</Text>
    </View>
  );
}

function Empty({ iconName, title, sub }: { iconName: string; title: string; sub: string }) {
  return (
    <View style={s.emptyBox}>
      <MaterialCommunityIcons name={iconName as any} size={40} color={C.outline} style={{ marginBottom: 8 }} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{sub}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  backBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, height: 52, borderBottomWidth: 1, borderBottomColor: C.outlineVariant,
    backgroundColor: C.surfaceLowest,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.primary },
  profile: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  avatar: { width: 64, height: 64, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  avatarText: { fontSize: 22, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: C.onSurface },
  meta: { fontSize: 13, color: C.onSurfaceVariant },
  wageRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  wageChip: {
    backgroundColor: C.surfaceLowest, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: C.outlineVariant, alignItems: 'center',
  },
  wageLabel: { fontSize: 9, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.6 },
  wageValue: { fontSize: 14, fontWeight: '700', color: C.onSurface },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: {
    flex: 1, backgroundColor: C.surfaceLowest, borderRadius: R.md, padding: 12,
    borderWidth: 1, borderColor: C.outlineVariant, gap: 2,
  },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.4 },
  kpiValue: { fontSize: 15, fontWeight: '800', color: C.primary },
  actions: { flexDirection: 'row', gap: 8 },
  primaryBtn: { flex: 1, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: C.onPrimary, fontWeight: '700' },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { color: C.primary, fontWeight: '700' },
  stmtBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surfaceLowest, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: C.outlineVariant,
  },
  stmtBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: C.primaryContainer },
  tabRow: { flexDirection: 'row', backgroundColor: C.surfaceHigh, borderRadius: R.md, padding: 3, gap: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: R.sm },
  tabBtnActive: { backgroundColor: C.surfaceLowest },
  tabText: { fontSize: 13, fontWeight: '600', color: C.onSurfaceVariant },
  tabTextActive: { color: C.primary },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surfaceLowest, borderRadius: R.md, padding: 12,
    borderWidth: 1, borderColor: C.outlineVariant,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: C.onSurface },
  rowSub: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },
  rowAmt: { fontSize: 14, fontWeight: '700', color: C.onSurface },
  badge: { borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  emptySub: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center' },
  retryBtn: { marginTop: 12, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: C.onPrimary, fontWeight: '700' },
});

const e = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surfaceLowest },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant,
  },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  body: { padding: 20, paddingBottom: 32, gap: 4 },
  field: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    height: 46, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md,
    paddingHorizontal: 14, fontSize: 15, color: C.onSurface, backgroundColor: C.surfaceLow,
  },
  error: { color: C.error, marginTop: 8 },
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  cancelBtn: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
});
