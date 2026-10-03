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
import { AVATAR_COLORS, C, R, fmtCurrency, initials, todayISO } from '../../lib/theme';
import { EntityPaymentSummary, Labour, PaymentRead, PaginatedResponse } from '../../types';
import { PeopleStackParamList } from './types';

type Props = NativeStackScreenProps<PeopleStackParamList, 'LabourDetail'>;
type Tab = 'attendance' | 'payments' | 'contracts';

interface AttendanceRow {
  id: string; date: string;
  status: 'present' | 'absent' | 'half_day';
  task: string | null; hours_worked: number | null; wage_earned: number;
  wage_type?: string; contract?: { id: string; title: string } | null;
}
interface ContractItem {
  id: string; title: string; description?: string | null;
  entity_type: string; entity_name?: string | null;
  amount: number; assigned_date: string; status: string;
  plot?: { name: string } | null;
}

const ATT_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  present:  { bg: C.primaryFixed,   fg: C.primary,  label: 'Present' },
  absent:   { bg: C.errorContainer, fg: C.error,     label: 'Absent' },
  half_day: { bg: '#fef3c7',        fg: '#6b4c04',  label: 'Half' },
};
const CTR_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  active:    { bg: C.primaryFixed,   fg: C.primary,  label: 'Active' },
  completed: { bg: '#d7e4f0',        fg: '#111d25',  label: 'Done' },
  cancelled: { bg: C.errorContainer, fg: C.error,    label: 'Cancelled' },
};
const METHOD: Record<string, string> = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank', other: 'Other' };

function fmtShortDate(iso: string) {
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditLabourModal({ visible, labour, onClose, onSaved }: { visible: boolean; labour: Labour; onClose: () => void; onSaved: () => void }) {
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
    setName(labour.name); setWage(String(labour.daily_wage));
    setPhone(labour.phone ?? ''); setHometown(labour.hometown ?? '');
    setStartTime(labour.work_start_time ?? ''); setEndTime(labour.work_end_time ?? '');
    setError(null);
  }, [visible, labour]);

  async function save() {
    const w = parseFloat(wage);
    if (!name.trim()) { setError('Name is required.'); return; }
    if (isNaN(w) || w < 0) { setError('Enter a valid daily wage.'); return; }
    setSaving(true); setError(null);
    try {
      await apiPatch(`/api/v1/labours/${labour.id}`, {
        name: name.trim(), daily_wage: w, phone: phone.trim() || null,
        hometown: hometown.trim() || null, work_start_time: startTime.trim() || null, work_end_time: endTime.trim() || null,
      });
      onSaved(); onClose();
    } catch { setError('Could not save changes.'); } finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={m.root}>
          <View style={m.header}>
            <Text style={m.title}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><MaterialCommunityIcons name="close" size={22} color={C.onSurfaceVariant} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
            {([
              { label: 'Full Name *', value: name, setter: setName, kb: 'default' as const },
              { label: 'Daily Wage (₹) *', value: wage, setter: setWage, kb: 'numeric' as const },
              { label: 'Phone', value: phone, setter: setPhone, kb: 'phone-pad' as const },
              { label: 'Hometown', value: hometown, setter: setHometown, kb: 'default' as const },
              { label: 'Shift Start (e.g. 07:00)', value: startTime, setter: setStartTime, kb: 'default' as const },
              { label: 'Shift End (e.g. 15:00)', value: endTime, setter: setEndTime, kb: 'default' as const },
            ]).map((f) => (
              <View key={f.label} style={m.field}>
                <Text style={m.label}>{f.label}</Text>
                <TextInput style={m.input} value={f.value} onChangeText={f.setter} keyboardType={f.kb} placeholderTextColor={C.outline} />
              </View>
            ))}
            {error ? <Text style={m.error}>{error}</Text> : null}
          </ScrollView>
          <View style={m.footer}>
            <TouchableOpacity style={m.cancelBtn} onPress={onClose}><Text style={m.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[m.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={m.saveText}>Save</Text>}
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
  const ac = AVATAR_COLORS[0];

  const [labour, setLabour] = useState<Labour | null>(null);
  const [summary, setSummary] = useState<EntityPaymentSummary | null>(null);
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRead[]>([]);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
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
    setError(null); setNotFound(false);
    try {
      const [profile, paySummary, att, payList, cList] = await Promise.all([
        apiGet<Labour>(`/api/v1/labours/${id}`),
        apiGet<EntityPaymentSummary>(`/api/v1/payments/entity/individual/${id}/summary`),
        apiGet<AttendanceRow[]>(`/api/v1/attendance/labour/${id}/history`, { limit: 100 }),
        apiGet<PaginatedResponse<PaymentRead>>('/api/v1/payments', { labour_id: id, page_size: 50 }),
        apiGet<PaginatedResponse<ContractItem>>('/api/v1/contracts', { labour_id: id, page_size: 50 }),
      ]);
      setLabour(profile); setSummary(paySummary);
      setHistory(att); setPayments(payList.items); setContracts(cList.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError('Could not load this labourer.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function settle() {
    if (!summary || summary.pending <= 0) return;
    Alert.alert('Settle balance', `Record ${fmtCurrency(summary.pending)} cash payment to clear the pending balance?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Settle', onPress: async () => {
        setSettling(true);
        try {
          await apiPost('/api/v1/payments', { labour_id: id, amount: summary.pending, method: 'cash', date: todayISO(), notes: 'Settlement — full balance cleared' });
          load(true);
        } catch { Alert.alert('Error', 'Settlement failed.'); } finally { setSettling(false); }
      }},
    ]);
  }

  if (loading) return <View style={[s.root, { paddingTop: insets.top }]}><TopBar onBack={() => navigation.goBack()} /><View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View></View>;

  if (notFound || error || !labour) return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <TopBar onBack={() => navigation.goBack()} />
      <View style={s.centred}>
        <Text style={s.emptyTitle}>{notFound ? 'Labourer not found' : 'Something went wrong'}</Text>
        <Text style={s.emptySub}>{error ?? 'This profile may have been removed.'}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => load()}><Text style={s.retryText}>Try again</Text></TouchableOpacity>
      </View>
    </View>
  );

  const pending = summary?.pending ?? 0;
  const timing = labour.work_start_time && labour.work_end_time ? `${labour.work_start_time} – ${labour.work_end_time}` : '—';

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <TopBar onBack={() => navigation.goBack()} title={labour.name} onEdit={() => setEditOpen(true)} />
      <EditLabourModal visible={editOpen} labour={labour} onClose={() => setEditOpen(false)} onSaved={() => load(true)} />
      <PaymentModal visible={payOpen} onClose={() => setPayOpen(false)} onSuccess={() => load(true)} entityType="individual" entityId={id} entityName={labour.name} />

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.profileDecor} />
          <View style={[s.avatar, { backgroundColor: ac.bg }]}>
            <Text style={[s.avatarText, { color: ac.fg }]}>{initials(labour.name)}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName} numberOfLines={2}>{labour.name}</Text>
            {labour.hometown ? <View style={s.metaRow}><MaterialCommunityIcons name="map-marker" size={12} color={C.error} /><Text style={s.metaText}>{labour.hometown}</Text></View> : null}
            {labour.phone ? <View style={s.metaRow}><MaterialCommunityIcons name="phone" size={12} color={C.primaryContainer} /><Text style={s.metaText}>{labour.phone}</Text></View> : null}
          </View>
        </View>

        {/* Wage + Shift — single compact card */}
        <View style={s.infoCard}>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>DAILY WAGE</Text>
            <Text style={s.infoValue}>{fmtCurrency(labour.daily_wage)}</Text>
          </View>
          <View style={s.infoDivider} />
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>SHIFT</Text>
            <Text style={s.infoValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{timing}</Text>
          </View>
        </View>

        {/* KPI row */}
        <View style={s.kpiCard}>
          <KpiCell label="Earned" value={fmtCurrency(summary?.total_earned ?? 0)} color={C.onSurface} />
          <View style={s.kpiDiv} />
          <KpiCell label="Paid" value={fmtCurrency(summary?.total_paid ?? 0)} color="#1a3c5c" />
          <View style={s.kpiDiv} />
          <KpiCell label="Pending" value={fmtCurrency(pending)} color={pending > 0 ? C.error : C.onSurface} />
        </View>

        {/* Action buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setPayOpen(true)}>
            <MaterialCommunityIcons name="plus-circle" size={16} color={C.onPrimary} />
            <Text style={s.primaryBtnTxt} numberOfLines={1}>Record Payment</Text>
          </TouchableOpacity>
          {pending > 0 && (
            <TouchableOpacity style={[s.settleBtn, settling && { opacity: 0.6 }]} onPress={settle} disabled={settling}>
              {settling ? <ActivityIndicator color={C.primary} size="small" /> : (
                <>
                  <MaterialCommunityIcons name="check-circle" size={16} color={C.primary} />
                  <Text style={s.settleBtnTxt} numberOfLines={1}>Settle {fmtCurrency(pending)}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* View Statement */}
        <TouchableOpacity style={s.stmtBtn} onPress={() => rootNav.navigate('More', { screen: 'StatementDetail', params: { entityType: 'individual', entityId: id, name: labour.name } })}>
          <MaterialCommunityIcons name="chart-bar" size={16} color={C.primaryContainer} />
          <Text style={s.stmtTxt}>View Statement</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={C.outlineVariant} />
        </TouchableOpacity>

        {/* Tabs */}
        <View style={s.tabRow}>
          {([['attendance', `Attendance (${history.length})`], ['payments', `Payments (${payments.length})`], ['contracts', `Contracts (${contracts.length})`]] as [Tab, string][]).map(([key, label]) => (
            <TouchableOpacity key={key} style={[s.tabBtn, tab === key && s.tabBtnOn]} onPress={() => setTab(key)}>
              <Text style={[s.tabTxt, tab === key && s.tabTxtOn]} numberOfLines={1}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Attendance table ── */}
        {tab === 'attendance' && (
          history.length === 0 ? <Empty icon="calendar-check-outline" title="No attendance yet" sub="Marked days will appear here." /> : (
            <View style={t.table}>
              <View style={t.thead}>
                <Text style={[t.th, { flex: 1.1 }]} numberOfLines={1}>Date</Text>
                <Text style={[t.th, { flex: 1 }]} numberOfLines={1}>Task</Text>
                <Text style={[t.th, { width: 66, textAlign: 'center' }]} numberOfLines={1}>Status</Text>
                <Text style={[t.th, { width: 58, textAlign: 'right' }]} numberOfLines={1}>Amount</Text>
              </View>
              {history.map((row, i) => {
                const st = ATT_STYLE[row.status] ?? ATT_STYLE.present;
                return (
                  <View key={row.id} style={[t.tr, i === history.length - 1 && t.trLast]}>
                    <Text style={[t.td, { flex: 1.1 }]} numberOfLines={1}>{fmtShortDate(row.date)}</Text>
                    <Text style={[t.td, { flex: 1 }]} numberOfLines={1}>
                      {row.wage_type === 'contract' && row.contract ? row.contract.title : row.task || 'Daily wage'}
                    </Text>
                    <View style={{ width: 66, alignItems: 'center' }}>
                      <View style={[t.badge, { backgroundColor: st.bg }]}>
                        <Text style={[t.badgeTxt, { color: st.fg }]} numberOfLines={1}>{st.label}</Text>
                      </View>
                    </View>
                    <Text style={[t.td, t.amt, { width: 58 }]} numberOfLines={1}>{row.status === 'absent' ? '—' : fmtCurrency(row.wage_earned)}</Text>
                  </View>
                );
              })}
            </View>
          )
        )}

        {/* ── Payments table ── */}
        {tab === 'payments' && (
          payments.length === 0 ? <Empty icon="credit-card-outline" title="No payments yet" sub="Record a payment to start the ledger." /> : (
            <View style={t.table}>
              <View style={t.thead}>
                <Text style={[t.th, { flex: 1 }]} numberOfLines={1}>Date</Text>
                <Text style={[t.th, { flex: 1.2 }]} numberOfLines={1}>Method / Notes</Text>
                <Text style={[t.th, { width: 64, textAlign: 'right' }]} numberOfLines={1}>Amount</Text>
              </View>
              {payments.map((p, i) => (
                <View key={p.id} style={[t.tr, i === payments.length - 1 && t.trLast]}>
                  <Text style={[t.td, { flex: 1 }]} numberOfLines={1}>{fmtShortDate(p.date)}</Text>
                  <Text style={[t.td, { flex: 1.2 }]} numberOfLines={1}>{METHOD[p.method] ?? p.method}{p.notes ? ` · ${p.notes}` : ''}</Text>
                  <Text style={[t.td, t.amt, { width: 64, color: '#2a7a4f' }]} numberOfLines={1}>{fmtCurrency(p.amount)}</Text>
                </View>
              ))}
            </View>
          )
        )}

        {/* ── Contracts table ── */}
        {tab === 'contracts' && (
          contracts.length === 0 ? <Empty icon="file-document-outline" title="No contracts yet" sub="Contracts assigned to this labourer will appear here." /> : (
            <View style={t.table}>
              <View style={t.thead}>
                <Text style={[t.th, { flex: 1.1 }]} numberOfLines={1}>Date</Text>
                <Text style={[t.th, { flex: 1 }]} numberOfLines={1}>Title</Text>
                <Text style={[t.th, { width: 58, textAlign: 'center' }]} numberOfLines={1}>Status</Text>
                <Text style={[t.th, { width: 58, textAlign: 'right' }]} numberOfLines={1}>Amount</Text>
              </View>
              {contracts.map((c, i) => {
                const cs = CTR_STYLE[c.status] ?? CTR_STYLE.active;
                return (
                  <View key={c.id} style={[t.tr, i === contracts.length - 1 && t.trLast]}>
                    <Text style={[t.td, { flex: 1.1 }]} numberOfLines={1}>{fmtShortDate(c.assigned_date)}</Text>
                    <Text style={[t.td, { flex: 1 }]} numberOfLines={1}>{c.title}</Text>
                    <View style={{ width: 58, alignItems: 'center' }}>
                      <View style={[t.badge, { backgroundColor: cs.bg }]}>
                        <Text style={[t.badgeTxt, { color: cs.fg }]} numberOfLines={1}>{cs.label}</Text>
                      </View>
                    </View>
                    <Text style={[t.td, t.amt, { width: 58 }]} numberOfLines={1}>{fmtCurrency(c.amount)}</Text>
                  </View>
                );
              })}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function TopBar({ onBack, title, onEdit }: { onBack: () => void; title?: string; onEdit?: () => void }) {
  return (
    <View style={s.topBar}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={s.topBarBtn}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
      </TouchableOpacity>
      <Text style={s.topBarTitle} numberOfLines={1}>{title ?? 'Labourer'}</Text>
      {onEdit
        ? <TouchableOpacity onPress={onEdit} hitSlop={12} style={s.topBarBtn}><MaterialCommunityIcons name="pencil-outline" size={20} color={C.primary} /></TouchableOpacity>
        : <View style={{ width: 44 }} />}
    </View>
  );
}

function KpiCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.kpiCell}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={s.emptyBox}>
      <MaterialCommunityIcons name={icon as any} size={36} color={C.outline} style={{ marginBottom: 6 }} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{sub}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.background },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  scroll:  { padding: 14, paddingBottom: 40, gap: 10 },

  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, height: 52, borderBottomWidth: 1, borderBottomColor: C.outlineVariant, backgroundColor: C.surfaceLowest },
  topBarBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.onSurface },

  profileCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.primaryFixed, borderRadius: R.xl, padding: 16, overflow: 'hidden' },
  profileDecor: { position: 'absolute', right: -24, bottom: -32, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(1,45,29,0.09)' },
  avatar:       { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 24, fontWeight: '800' },
  profileInfo:  { flex: 1, gap: 3 },
  profileName:  { fontSize: 17, fontWeight: '800', color: C.primary },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:     { fontSize: 12, color: C.primaryContainer },

  infoCard:    { flexDirection: 'row', backgroundColor: C.surfaceLowest, borderRadius: R.lg, borderWidth: 1, borderColor: C.outlineVariant, overflow: 'hidden' },
  infoCell:    { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  infoDivider: { width: 1, backgroundColor: C.outlineVariant, marginVertical: 10 },
  infoLabel:   { fontSize: 9, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.6, marginBottom: 3 },
  infoValue:   { fontSize: 15, fontWeight: '700', color: C.onSurface },

  kpiCard:  { flexDirection: 'row', backgroundColor: C.surfaceLowest, borderRadius: R.lg, borderWidth: 1, borderColor: C.outlineVariant, overflow: 'hidden' },
  kpiCell:  { flex: 1, paddingVertical: 14, alignItems: 'center', gap: 3 },
  kpiDiv:   { width: 1, backgroundColor: C.outlineVariant, marginVertical: 10 },
  kpiLabel: { fontSize: 10, color: C.onSurfaceVariant, fontWeight: '500' },
  kpiValue: { fontSize: 15, fontWeight: '800' },

  actionRow:     { flexDirection: 'row', gap: 8 },
  primaryBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.primaryContainer, borderRadius: R.lg, paddingVertical: 12, paddingHorizontal: 8 },
  primaryBtnTxt: { color: C.onPrimary, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  settleBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.primaryFixed, borderRadius: R.lg, paddingVertical: 12, paddingHorizontal: 8 },
  settleBtnTxt:  { color: C.primary, fontWeight: '700', fontSize: 13, flexShrink: 1 },

  stmtBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surfaceLowest, borderRadius: R.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.outlineVariant },
  stmtTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: C.onSurface },

  tabRow:    { flexDirection: 'row', backgroundColor: C.surfaceHigh, borderRadius: R.lg, padding: 3, gap: 2 },
  tabBtn:    { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: R.md },
  tabBtnOn:  { backgroundColor: C.primaryContainer },
  tabTxt:    { fontSize: 11, fontWeight: '600', color: C.onSurfaceVariant, textAlign: 'center' },
  tabTxtOn:  { color: C.onPrimary, fontWeight: '700' },

  emptyBox:   { alignItems: 'center', paddingVertical: 28, gap: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  emptySub:   { fontSize: 12, color: C.onSurfaceVariant, textAlign: 'center' },
  retryBtn:   { marginTop: 12, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  retryText:  { color: C.onPrimary, fontWeight: '700' },
});

// Table styles (shared pattern)
const t = StyleSheet.create({
  table:    { borderRadius: R.xl, borderWidth: 1, borderColor: C.outlineVariant, overflow: 'hidden', backgroundColor: C.surfaceLowest },
  thead:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceHigh, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  th:       { fontSize: 9, fontWeight: '800', color: C.onSurfaceVariant, textTransform: 'uppercase' },
  tr:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.outlineVariant, backgroundColor: C.surfaceLowest },
  trLast:   { borderBottomWidth: 0 },
  td:       { fontSize: 12, color: C.onSurface },
  amt:      { textAlign: 'right', fontWeight: '700' },
  badge:    { borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 10, fontWeight: '700', flexShrink: 1 },
});

const m = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.surfaceLowest },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  title:     { fontSize: 18, fontWeight: '700', color: C.primary },
  body:      { padding: 20, paddingBottom: 32, gap: 4 },
  field:     { marginBottom: 12 },
  label:     { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input:     { height: 46, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 14, fontSize: 15, color: C.onSurface, backgroundColor: C.surfaceLow },
  error:     { color: C.error, marginTop: 8 },
  footer:    { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  cancelBtn: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText:{ color: C.onSurfaceVariant, fontWeight: '600' },
  saveBtn:   { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  saveText:  { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
});
