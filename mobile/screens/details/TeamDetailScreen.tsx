import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PaymentModal from '../../components/PaymentModal';
import { apiGet, apiPost, ApiError } from '../../lib/api';
import { AVATAR_COLORS, C, R, fmtCurrency, fmtDate, initials, todayISO } from '../../lib/theme';
import { EntityPaymentSummary, Labour, PaymentRead, PaginatedResponse, Team } from '../../types';
import { PeopleStackParamList } from './types';

type Props = NativeStackScreenProps<PeopleStackParamList, 'TeamDetail'>;
type Tab = 'attendance' | 'payments' | 'members';

interface AttendanceRow {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'half_day' | null;
  num_labourers: number | null;
  task: string | null;
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
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank',
  other: 'Other',
};

export default function TeamDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const avatar = AVATAR_COLORS[1];

  const [team, setTeam] = useState<Team | null>(null);
  const [summary, setSummary] = useState<EntityPaymentSummary | null>(null);
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRead[]>([]);
  const [tab, setTab] = useState<Tab>('attendance');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [settling, setSettling] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [profile, paySummary, att, payList] = await Promise.all([
        apiGet<Team>(`/api/v1/teams/${id}`),
        apiGet<EntityPaymentSummary>(`/api/v1/payments/entity/team/${id}/summary`),
        apiGet<AttendanceRow[]>(`/api/v1/attendance/team/${id}/history`, { limit: 100 }),
        apiGet<PaginatedResponse<PaymentRead>>('/api/v1/payments', { team_id: id, page_size: 50 }),
      ]);
      setTeam(profile);
      setSummary(paySummary);
      setHistory(att);
      setPayments(payList.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError('Could not load this team.');
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
                team_id: id,
                amount: summary.pending,
                method: 'cash',
                date: todayISO(),
                notes: 'Settlement — full balance cleared',
              });
              load(true);
            } catch {
              Alert.alert('Error', 'Settlement failed. Try recording a payment instead.');
            } finally {
              setSettling(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <BackBar onBack={() => navigation.goBack()} />
        <View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      </View>
    );
  }

  if (notFound || error || !team) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <BackBar onBack={() => navigation.goBack()} />
        <View style={s.centred}>
          <Text style={s.emptyTitle}>{notFound ? 'Team not found' : 'Something went wrong'}</Text>
          <Text style={s.emptySub}>{error ?? 'This team may have been removed.'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const members: Labour[] = team.members ?? [];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <BackBar onBack={() => navigation.goBack()} title={team.name} />
      <PaymentModal
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        onSuccess={() => load(true)}
        entityType="team"
        entityId={id}
        entityName={team.name}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
      >
        <View style={s.profile}>
          <View style={[s.avatar, { backgroundColor: avatar.bg }]}>
            <Text style={[s.avatarText, { color: avatar.fg }]}>{initials(team.name)}</Text>
          </View>
          <Text style={s.name}>{team.name}</Text>
          {team.hometown ? <Text style={s.meta}>📍 {team.hometown}</Text> : null}
          {team.description ? <Text style={s.meta}>{team.description}</Text> : null}
          <View style={s.wageRow}>
            <Chip label="PER LABOUR" value={`${fmtCurrency(team.daily_wage)}`} />
            <Chip label="CAR RENT" value={fmtCurrency(team.car_rent)} />
            <Chip label="MGR FEE" value={fmtCurrency(team.manager_fee)} />
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

        <View style={s.tabRow}>
          {([
            ['attendance', `Attendance (${history.length})`],
            ['payments', `Payments (${payments.length})`],
            ['members', `Members (${members.length})`],
          ] as [Tab, string][]).map(([key, label]) => (
            <TouchableOpacity key={key} style={[s.tabBtn, tab === key && s.tabBtnActive]} onPress={() => setTab(key)}>
              <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'attendance' && (
          history.length === 0 ? (
            <Empty icon="☑" title="No attendance yet" sub="Marked days will appear here." />
          ) : history.map((row) => {
            const st = STATUS_STYLE[row.status ?? 'present'] ?? STATUS_STYLE.present;
            return (
              <View key={row.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{fmtDate(row.date)}</Text>
                  <Text style={s.rowSub}>
                    {row.wage_type === 'contract' && row.contract
                      ? `Contract · ${row.contract.title}`
                      : `${row.num_labourers ?? 0} labourers${row.task ? ` · ${row.task}` : ''}`}
                  </Text>
                </View>
                <View style={[s.badge, { backgroundColor: st.bg }]}>
                  <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
                </View>
                <Text style={s.rowAmt}>{row.status === 'absent' ? '—' : fmtCurrency(row.wage_earned)}</Text>
              </View>
            );
          })
        )}

        {tab === 'payments' && (
          payments.length === 0 ? (
            <Empty icon="₹" title="No payments yet" sub="Record a payment to start the ledger." />
          ) : payments.map((p) => (
            <View key={p.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{fmtDate(p.date)}</Text>
                <Text style={s.rowSub}>{METHOD_LABEL[p.method] ?? p.method}{p.notes ? ` · ${p.notes}` : ''}</Text>
              </View>
              <Text style={[s.rowAmt, { color: C.primary }]}>{fmtCurrency(p.amount)}</Text>
            </View>
          ))
        )}

        {tab === 'members' && (
          members.length === 0 ? (
            <Empty icon="👥" title="No members listed" sub="Add members from the web app for now." />
          ) : members.map((m, i) => {
            const c = AVATAR_COLORS[i % AVATAR_COLORS.length];
            return (
              <TouchableOpacity
                key={m.id}
                style={s.row}
                onPress={() => navigation.navigate('LabourDetail', { id: m.id })}
              >
                <View style={[s.memberAvatar, { backgroundColor: c.bg }]}>
                  <Text style={[s.memberAvatarText, { color: c.fg }]}>{initials(m.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{m.name}</Text>
                  <Text style={s.rowSub}>{fmtCurrency(m.daily_wage)}/day{m.hometown ? ` · ${m.hometown}` : ''}</Text>
                </View>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function BackBar({ onBack, title }: { onBack: () => void; title?: string }) {
  return (
    <View style={s.backBar}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
        <Text style={s.backArrow}>‹</Text>
      </TouchableOpacity>
      <Text style={s.backTitle} numberOfLines={1}>{title ?? 'Team'}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.wageChip}>
      <Text style={s.wageLabel}>{label}</Text>
      <Text style={s.wageValue}>{value}</Text>
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

function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={s.emptyBox}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{sub}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  backBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, height: 52, borderBottomWidth: 1, borderBottomColor: C.outlineVariant,
    backgroundColor: C.surface,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 32, color: C.primary, lineHeight: 34, marginTop: -2 },
  backTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.primary },
  profile: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  avatar: { width: 64, height: 64, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  avatarText: { fontSize: 22, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: C.onSurface },
  meta: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center' },
  wageRow: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  wageChip: {
    backgroundColor: C.surfaceLowest, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: C.outlineVariant, alignItems: 'center',
  },
  wageLabel: { fontSize: 9, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.6 },
  wageValue: { fontSize: 13, fontWeight: '700', color: C.onSurface },
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
  tabRow: { flexDirection: 'row', backgroundColor: C.surfaceHigh, borderRadius: R.md, padding: 3, gap: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: R.sm },
  tabBtnActive: { backgroundColor: C.surfaceLowest },
  tabText: { fontSize: 11, fontWeight: '600', color: C.onSurfaceVariant, textAlign: 'center' },
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
  memberAvatar: { width: 36, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 13, fontWeight: '700' },
  chevron: { fontSize: 22, color: C.outline },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  emptyIcon: { fontSize: 32, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  emptySub: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center' },
  retryBtn: { marginTop: 12, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: C.onPrimary, fontWeight: '700' },
});
