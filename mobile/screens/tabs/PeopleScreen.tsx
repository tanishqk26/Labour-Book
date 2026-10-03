/**
 * People Screen — combines Labourers + Teams
 * Tabs: Individual | Teams
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import { apiGet, apiPost, apiPatch } from '../../lib/api';
import { Labour, TeamSummary, PaginatedResponse, EntityPaymentSummary } from '../../types';
import { C, R, AVATAR_COLORS, initials, fmtCurrency } from '../../lib/theme';
import { PeopleStackParamList } from '../details/types';

// ─── Add Labour Modal ─────────────────────────────────────────────────────────

function AddLabourModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [wage, setWage] = useState('');
  const [hometown, setHometown] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() { setName(''); setWage(''); setHometown(''); setPhone(''); }

  async function save() {
    if (!name.trim()) { Alert.alert('Required', 'Name is required'); return; }
    const w = parseFloat(wage);
    if (isNaN(w) || w < 0) { Alert.alert('Invalid', 'Enter a valid daily wage'); return; }
    setSaving(true);
    try {
      await apiPost('/api/v1/labours', { name: name.trim(), daily_wage: w, hometown: hometown.trim() || undefined, phone: phone.trim() || undefined });
      reset(); onSuccess(); onClose();
    } catch { Alert.alert('Error', 'Failed to add labourer.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={ms.container}>
        <View style={ms.header}>
          <Text style={ms.title}>Add Labourer</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
        <View style={ms.body}>
          {[
            { label: 'Full Name *', value: name, setter: setName, placeholder: 'e.g. Deepak Jadhav', kb: 'default' as const },
            { label: 'Daily Wage (₹) *', value: wage, setter: setWage, placeholder: 'e.g. 400', kb: 'numeric' as const },
            { label: 'Hometown', value: hometown, setter: setHometown, placeholder: 'e.g. Junnar', kb: 'default' as const },
            { label: 'Phone', value: phone, setter: setPhone, placeholder: '10-digit number', kb: 'phone-pad' as const },
          ].map((f) => (
            <View key={f.label} style={ms.field}>
              <Text style={ms.label}>{f.label}</Text>
              <TextInput style={ms.input} value={f.value} onChangeText={f.setter} placeholder={f.placeholder} keyboardType={f.kb} placeholderTextColor={C.outline} />
            </View>
          ))}
        </View>
        <View style={ms.footer}>
          <TouchableOpacity style={ms.cancelBtn} onPress={() => { reset(); onClose(); }}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[ms.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={ms.saveText}>Add Labourer</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Team Modal ────────────────────────────────────────────────────────────

function AddTeamModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [hometown, setHometown] = useState('');
  const [wage, setWage] = useState('');
  const [carRent, setCarRent] = useState('');
  const [mgrFee, setMgrFee] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() { setName(''); setHometown(''); setWage(''); setCarRent(''); setMgrFee(''); setDescription(''); }

  async function save() {
    if (!name.trim()) { Alert.alert('Required', 'Team name is required'); return; }
    const w = parseFloat(wage);
    if (isNaN(w) || w < 0) { Alert.alert('Invalid', 'Enter a valid daily wage'); return; }
    setSaving(true);
    try {
      await apiPost('/api/v1/teams', {
        name: name.trim(),
        hometown: hometown.trim() || undefined,
        daily_wage: w,
        car_rent: parseFloat(carRent) || 0,
        manager_fee: parseFloat(mgrFee) || 0,
        description: description.trim() || undefined,
      });
      reset(); onSuccess(); onClose();
    } catch { Alert.alert('Error', 'Failed to add team.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={ms.container}>
        <View style={ms.header}>
          <Text style={ms.title}>Add Team</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
        <View style={ms.body}>
          <View style={ms.field}>
            <Text style={ms.label}>Team Name *</Text>
            <TextInput style={ms.input} value={name} onChangeText={setName} placeholder="e.g. Shinde Team" placeholderTextColor={C.outline} />
          </View>
          <View style={ms.field}>
            <Text style={ms.label}>Hometown / Village</Text>
            <TextInput style={ms.input} value={hometown} onChangeText={setHometown} placeholder="e.g. Narayangaon" placeholderTextColor={C.outline} />
          </View>
          <View style={ms.field}>
            <Text style={ms.label}>Daily Wage Per Labour (₹) *</Text>
            <TextInput style={ms.input} value={wage} onChangeText={setWage} placeholder="e.g. 300" keyboardType="numeric" placeholderTextColor={C.outline} />
          </View>
          <View style={ms.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={ms.label}>Car Rent (₹)</Text>
              <TextInput style={ms.input} value={carRent} onChangeText={setCarRent} placeholder="0" keyboardType="numeric" placeholderTextColor={C.outline} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ms.label}>Manager Fee (₹)</Text>
              <TextInput style={ms.input} value={mgrFee} onChangeText={setMgrFee} placeholder="0" keyboardType="numeric" placeholderTextColor={C.outline} />
            </View>
          </View>
          <View style={ms.field}>
            <Text style={ms.label}>Description (optional)</Text>
            <TextInput
              style={[ms.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
              value={description} onChangeText={setDescription} multiline
              placeholder="Brief description of the team..."
              placeholderTextColor={C.outline}
            />
          </View>
        </View>
        <View style={ms.footer}>
          <TouchableOpacity style={ms.cancelBtn} onPress={() => { reset(); onClose(); }}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[ms.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={ms.saveText}>Add Team</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Table Row — Labour ───────────────────────────────────────────────────────

function LabourRow({ labour, index, onPress, onDeactivate, balance, isLast }: {
  labour: Labour; index: number; onPress: () => void;
  onDeactivate: (id: string, name: string) => void;
  balance?: EntityPaymentSummary; isLast?: boolean;
}) {
  const c = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <TouchableOpacity style={[t.tr, isLast && t.trLast]} onPress={onPress} activeOpacity={0.55}>
      <View style={t.nameCell}>
        <View style={[t.av, { backgroundColor: c.bg }]}>
          <Text style={[t.avTxt, { color: c.fg }]}>{initials(labour.name)[0]}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={t.cellName} numberOfLines={1}>{labour.name}</Text>
          {labour.hometown ? <Text style={t.cellMeta} numberOfLines={1}>{labour.hometown}</Text> : null}
        </View>
      </View>
      <Text style={t.cellWage}>{fmtCurrency(labour.daily_wage)}</Text>
      <View style={t.cellBal}>
        {balance != null
          ? <Text style={balance.pending > 0 ? t.due : t.settled}>{balance.pending > 0 ? fmtCurrency(balance.pending) : 'Settled'}</Text>
          : <Text style={t.dash}>—</Text>}
      </View>
      <TouchableOpacity onPress={() => onDeactivate(labour.id, labour.name)} hitSlop={8}>
        <MaterialCommunityIcons name="dots-vertical" size={18} color={C.outline} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Table Row — Team ─────────────────────────────────────────────────────────

function TeamRow({ team, index, onPress, balance, isLast }: {
  team: TeamSummary; index: number; onPress: () => void;
  balance?: EntityPaymentSummary; isLast?: boolean;
}) {
  const c = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <TouchableOpacity style={[t.tr, isLast && t.trLast]} onPress={onPress} activeOpacity={0.55}>
      <View style={t.nameCell}>
        <View style={[t.av, { backgroundColor: c.bg }]}>
          <Text style={[t.avTxt, { color: c.fg }]}>{initials(team.name)[0]}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={t.cellName} numberOfLines={1}>{team.name}</Text>
          {team.hometown ? <Text style={t.cellMeta} numberOfLines={1}>{team.hometown}</Text> : null}
        </View>
      </View>
      <Text style={t.cellMembers}>{team.member_count}</Text>
      <Text style={t.cellRate}>{fmtCurrency(team.daily_wage)}</Text>
      <View style={t.cellBal}>
        {balance != null
          ? <Text style={balance.pending > 0 ? t.due : t.settled}>{balance.pending > 0 ? fmtCurrency(balance.pending) : 'Settled'}</Text>
          : <Text style={t.dash}>—</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Tab = 'individual' | 'team';

export default function PeopleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<PeopleStackParamList>>();
  const [tab, setTab] = useState<Tab>('individual');
  const [labours, setLabours] = useState<Labour[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [addLabourOpen, setAddLabourOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [paymentMap, setPaymentMap] = useState<Record<string, EntityPaymentSummary>>({});

  const loadLabours = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page: 1, page_size: 100, status: 'active' };
      if (search.trim()) params.search = search.trim();
      const d = await apiGet<PaginatedResponse<Labour>>('/api/v1/labours', params);
      setLabours(d.items);
    } catch {}
  }, [search]);

  const loadTeams = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page: 1, page_size: 100, status: 'active' };
      if (search.trim()) params.search = search.trim();
      const d = await apiGet<PaginatedResponse<TeamSummary>>('/api/v1/teams', params);
      setTeams(d.items);
    } catch {}
  }, [search]);

  const loadPayments = useCallback(async () => {
    try {
      const data = await apiGet<EntityPaymentSummary[] | { items: EntityPaymentSummary[] }>('/api/v1/payments/entities');
      const items: EntityPaymentSummary[] = Array.isArray(data) ? data : ((data as any).items ?? []);
      const map: Record<string, EntityPaymentSummary> = {};
      for (const item of items) map[item.entity_id] = item;
      setPaymentMap(map);
    } catch {}
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    await Promise.all([loadLabours(), loadTeams(), loadPayments()]);
    setLoading(false);
    setRefreshing(false);
  }, [loadLabours, loadTeams, loadPayments]);

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  function deactivate(id: string, name: string) {
    Alert.alert('Deactivate', `Remove ${name} from active records?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate', style: 'destructive',
        onPress: async () => {
          try { await apiPatch(`/api/v1/labours/${id}`, { is_active: false }); load(true); }
          catch { Alert.alert('Error', 'Failed to deactivate.'); }
        },
      },
    ]);
  }

  const isIndividual = tab === 'individual';
  const data = isIndividual ? labours : teams;
  const subtitle = isIndividual
    ? 'Manage individual labourers and wages'
    : 'Manage labour teams, managers and charges';

  return (
    <View style={styles.root}>
      <AppHeader screenName={isIndividual ? 'Labours' : 'Teams'} />

      <AddLabourModal visible={addLabourOpen} onClose={() => setAddLabourOpen(false)} onSuccess={() => load(true)} />
      <AddTeamModal visible={addTeamOpen} onClose={() => setAddTeamOpen(false)} onSuccess={() => load(true)} />

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>{isIndividual ? 'Labour Directory' : 'Labour Teams'}</Text>
            <Text style={styles.pageSubtitle}>{subtitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => isIndividual ? setAddLabourOpen(true) : setAddTeamOpen(true)}
          >
            <Text style={styles.addBtnText}>+ {isIndividual ? 'Add Labour' : 'Add Team'}</Text>
          </TouchableOpacity>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'individual' && styles.tabBtnActive]}
            onPress={() => setTab('individual')}
          >
            <Text style={[styles.tabBtnText, tab === 'individual' && styles.tabBtnTextActive]}>
              Individual ({labours.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'team' && styles.tabBtnActive]}
            onPress={() => setTab('team')}
          >
            <Text style={[styles.tabBtnText, tab === 'team' && styles.tabBtnTextActive]}>
              Teams ({teams.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color={C.outline} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={isIndividual ? 'Search by name or hometown…' : 'Search teams, managers…'}
            placeholderTextColor={C.outline}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : data.length === 0 ? (
        <View style={styles.centred}>
          <MaterialCommunityIcons
            name={isIndividual ? 'account-hard-hat-outline' : 'account-group-outline'}
            size={56} color={C.outline} style={{ marginBottom: 8 }}
          />
          <Text style={styles.emptyTitle}>{search ? 'No results' : isIndividual ? 'No Labourers Yet' : 'No Teams Yet'}</Text>
          <Text style={styles.emptySub}>{search ? `No match for "${search}"` : `Tap + Add ${isIndividual ? 'Labour' : 'Team'} to get started.`}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={t.table}>
            {/* Header */}
            <View style={t.thead}>
              <Text style={[t.th, t.nameTh]}>Name</Text>
              {isIndividual
                ? <>
                    <Text style={[t.th, t.wageTh]}>Wage/day</Text>
                    <Text style={[t.th, t.balTh]}>Balance</Text>
                    <View style={{ width: 26 }} />
                  </>
                : <>
                    <Text style={[t.th, t.membersTh]}>Members</Text>
                    <Text style={[t.th, t.rateTh]}>Rate</Text>
                    <Text style={[t.th, t.balTh]}>Balance</Text>
                  </>}
            </View>
            {/* Rows */}
            {isIndividual
              ? labours.map((l, i) => (
                  <LabourRow
                    key={l.id} labour={l} index={i}
                    onPress={() => navigation.navigate('LabourDetail', { id: l.id })}
                    onDeactivate={deactivate}
                    balance={paymentMap[l.id]}
                    isLast={i === labours.length - 1}
                  />
                ))
              : teams.map((tm, i) => (
                  <TeamRow
                    key={tm.id} team={tm} index={i}
                    onPress={() => navigation.navigate('TeamDetail', { id: tm.id })}
                    balance={paymentMap[tm.id]}
                    isLast={i === teams.length - 1}
                  />
                ))
            }
          </View>
          <Text style={styles.footerNote}>
            {isIndividual
              ? `${labours.length} active agricultural worker${labours.length !== 1 ? 's' : ''}`
              : `${teams.length} active team${teams.length !== 1 ? 's' : ''}`}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  pageHeader: { backgroundColor: C.surfaceLow, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.outlineVariant, gap: 10 },
  pageHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 14 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: C.primary, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 13, color: C.onSurfaceVariant, marginTop: 2 },
  addBtn: { backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 13 },

  tabRow: { flexDirection: 'row', backgroundColor: C.surfaceHigh, borderRadius: R.md, padding: 3, gap: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: R.sm },
  tabBtnActive: { backgroundColor: C.surfaceLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: C.onSurfaceVariant },
  tabBtnTextActive: { color: C.primary },

  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLowest, borderRadius: R.md, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: C.outlineVariant, gap: 8 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: C.onSurface },

  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.onSurface },
  emptySub: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center' },

  list: { padding: 16, paddingBottom: 32 },
  footerNote: { fontSize: 11, color: C.onSurfaceVariant, textAlign: 'center', marginTop: 10 },
});

const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surfaceLowest },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  body: { flex: 1, padding: 20, gap: 4 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input: { height: 46, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 14, fontSize: 15, color: C.onSurface, backgroundColor: C.surfaceLow },
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  cancelBtn: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
  twoCol: { flexDirection: 'row', gap: 10, marginBottom: 14 },
});

// ─── Table styles (shared by Labour + Team rows) ──────────────────────────────

const t = StyleSheet.create({
  table:   { borderRadius: R.xl, borderWidth: 1, borderColor: C.outlineVariant, overflow: 'hidden', backgroundColor: C.surfaceLowest },
  thead:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceHigh, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  th:      { fontSize: 9, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 0.8, textTransform: 'uppercase' },
  nameTh:  { flex: 1 },
  wageTh:  { width: 70, textAlign: 'right' },
  balTh:   { width: 78, textAlign: 'right' },
  membersTh: { width: 58, textAlign: 'center' },
  rateTh:  { width: 68, textAlign: 'right' },

  tr:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.outlineVariant, backgroundColor: C.surfaceLowest },
  trLast:  { borderBottomWidth: 0 },

  nameCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, marginRight: 4 },
  av:       { width: 28, height: 28, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avTxt:    { fontSize: 10, fontWeight: '800' },
  cellName: { fontSize: 13, fontWeight: '600', color: C.onSurface },
  cellMeta: { fontSize: 11, color: C.onSurfaceVariant, marginTop: 1 },
  cellWage: { width: 70, fontSize: 12, fontWeight: '600', color: C.onSurface, textAlign: 'right' },
  cellMembers: { width: 58, fontSize: 13, fontWeight: '600', color: C.onSurface, textAlign: 'center' },
  cellRate: { width: 68, fontSize: 12, fontWeight: '600', color: C.onSurface, textAlign: 'right' },
  cellBal:  { width: 78, alignItems: 'flex-end' },
  due:      { fontSize: 11, fontWeight: '700', color: C.error },
  settled:  { fontSize: 11, fontWeight: '700', color: '#2a7a4f' },
  dash:     { fontSize: 12, color: C.outline },
});
