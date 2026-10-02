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
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from '../../lib/api';
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
  cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank', other: 'Other',
};

// ─── Edit Team Modal ──────────────────────────────────────────────────────────

function EditTeamModal({
  visible, team, onClose, onSaved,
}: { visible: boolean; team: Team; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [wage, setWage] = useState('');
  const [carRent, setCarRent] = useState('');
  const [mgrFee, setMgrFee] = useState('');
  const [hometown, setHometown] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(team.name);
    setWage(String(team.daily_wage));
    setCarRent(String(team.car_rent ?? 0));
    setMgrFee(String(team.manager_fee ?? 0));
    setHometown(team.hometown ?? '');
    setDescription(team.description ?? '');
    setError(null);
  }, [visible, team]);

  async function save() {
    const w = parseFloat(wage);
    if (!name.trim()) { setError('Name is required.'); return; }
    if (isNaN(w) || w < 0) { setError('Enter a valid daily wage.'); return; }
    setSaving(true); setError(null);
    try {
      await apiPatch(`/api/v1/teams/${team.id}`, {
        name: name.trim(),
        daily_wage: w,
        car_rent: parseFloat(carRent) || 0,
        manager_fee: parseFloat(mgrFee) || 0,
        hometown: hometown.trim() || null,
        description: description.trim() || null,
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
            <Text style={e.title}>Edit Team</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={e.body} keyboardShouldPersistTaps="handled">
            {([
              { label: 'Team Name *', value: name, setter: setName, kb: 'default' as const },
              { label: 'Daily Wage per Labour (₹) *', value: wage, setter: setWage, kb: 'numeric' as const },
              { label: 'Car Rent (₹)', value: carRent, setter: setCarRent, kb: 'numeric' as const },
              { label: 'Manager Fee (₹)', value: mgrFee, setter: setMgrFee, kb: 'numeric' as const },
              { label: 'Hometown', value: hometown, setter: setHometown, kb: 'default' as const },
              { label: 'Description', value: description, setter: setDescription, kb: 'default' as const },
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

// ─── Add Member Modal ─────────────────────────────────────────────────────────

function AddMemberModal({
  visible, teamId, existingIds, onClose, onAdded,
}: { visible: boolean; teamId: string; existingIds: Set<string>; onClose: () => void; onAdded: () => void }) {
  const [labours, setLabours] = useState<Labour[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    apiGet<PaginatedResponse<Labour>>('/api/v1/labours', { status: 'active', page_size: 200 })
      .then((r) => setLabours(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  async function add(labourId: string) {
    setAdding(labourId);
    try {
      await apiPost(`/api/v1/teams/${teamId}/members`, { labour_id: labourId });
      onAdded();
    } catch {
      Alert.alert('Error', 'Could not add this member.');
    } finally { setAdding(null); }
  }

  const candidates = labours.filter((l) => !existingIds.has(l.id));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={e.root}>
        <View style={e.header}>
          <Text style={e.title}>Add Member</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : candidates.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={e.emptyText}>All active labourers are already in this team.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={e.body}>
            {candidates.map((l, i) => {
              const c = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <TouchableOpacity key={l.id} style={e.memberRow} onPress={() => add(l.id)}>
                  <View style={[e.memberAvatar, { backgroundColor: c.bg }]}>
                    <Text style={[e.memberAvatarText, { color: c.fg }]}>{initials(l.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={e.memberName}>{l.name}</Text>
                    <Text style={e.memberSub}>{fmtCurrency(l.daily_wage)}/day{l.hometown ? ` · ${l.hometown}` : ''}</Text>
                  </View>
                  {adding === l.id
                    ? <ActivityIndicator color={C.primary} />
                    : <MaterialCommunityIcons name="plus-circle-outline" size={22} color={C.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TeamDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const rootNav = useNavigation<any>();
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
  const [editOpen, setEditOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

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
                team_id: id, amount: summary.pending, method: 'cash',
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

  async function removeMember(labourId: string, name: string) {
    Alert.alert('Remove Member', `Remove ${name} from this team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          setRemoving(labourId);
          try {
            await apiDelete(`/api/v1/teams/${id}/members/${labourId}`);
            load(true);
          } catch {
            Alert.alert('Error', 'Could not remove this member.');
          } finally { setRemoving(null); }
        },
      },
    ]);
  }

  function viewStatement() {
    rootNav.navigate('More', {
      screen: 'StatementDetail',
      params: { entityType: 'team', entityId: id, name: team?.name ?? '' },
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
  const memberIds = new Set(members.map((m) => m.id));

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <BackBar onBack={() => navigation.goBack()} title={team.name} onEdit={() => setEditOpen(true)} />

      <EditTeamModal
        visible={editOpen}
        team={team}
        onClose={() => setEditOpen(false)}
        onSaved={() => load(true)}
      />
      <AddMemberModal
        visible={addMemberOpen}
        teamId={id}
        existingIds={memberIds}
        onClose={() => setAddMemberOpen(false)}
        onAdded={() => { setAddMemberOpen(false); load(true); }}
      />
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
            <Chip label="PER LABOUR" value={fmtCurrency(team.daily_wage)} />
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

        <TouchableOpacity style={s.stmtBtn} onPress={viewStatement}>
          <MaterialCommunityIcons name="chart-bar" size={16} color={C.primaryContainer} />
          <Text style={s.stmtBtnText}>View Statement</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={C.outlineVariant} />
        </TouchableOpacity>

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
            <Empty iconName="calendar-check-outline" title="No attendance yet" sub="Marked days will appear here." />
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
            <Empty iconName="credit-card-outline" title="No payments yet" sub="Record a payment to start the ledger." />
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
          <>
            <TouchableOpacity style={s.addMemberBtn} onPress={() => setAddMemberOpen(true)}>
              <MaterialCommunityIcons name="account-plus-outline" size={18} color={C.primary} />
              <Text style={s.addMemberText}>Add Member</Text>
            </TouchableOpacity>
            {members.length === 0 ? (
              <Empty iconName="account-group-outline" title="No members yet" sub="Add labourers to this team." />
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
                  <TouchableOpacity
                    onPress={() => removeMember(m.id, m.name)}
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    {removing === m.id
                      ? <ActivityIndicator size="small" color={C.error} />
                      : <MaterialCommunityIcons name="account-minus-outline" size={20} color={C.error} />}
                  </TouchableOpacity>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={C.outline} />
                </TouchableOpacity>
              );
            })}
          </>
        )}
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
      <Text style={s.backTitle} numberOfLines={1}>{title ?? 'Team'}</Text>
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
  stmtBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surfaceLowest, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: C.outlineVariant,
  },
  stmtBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: C.primaryContainer },
  tabRow: { flexDirection: 'row', backgroundColor: C.surfaceHigh, borderRadius: R.md, padding: 3, gap: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: R.sm },
  tabBtnActive: { backgroundColor: C.surfaceLowest },
  tabText: { fontSize: 11, fontWeight: '600', color: C.onSurfaceVariant, textAlign: 'center' },
  tabTextActive: { color: C.primary },
  addMemberBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md,
    paddingVertical: 10, backgroundColor: C.surfaceLowest,
  },
  addMemberText: { fontSize: 14, fontWeight: '600', color: C.primary },
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
  emptyText: { fontSize: 14, color: C.onSurfaceVariant, textAlign: 'center' },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.outlineVariant,
  },
  memberAvatar: { width: 40, height: 40, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 15, fontWeight: '700' },
  memberName: { fontSize: 14, fontWeight: '700', color: C.onSurface },
  memberSub: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },
});
