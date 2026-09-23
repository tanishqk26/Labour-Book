/**
 * People Screen — combines Labourers + Teams
 * Tabs: Individual | Teams
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppHeader from '../../components/AppHeader';
import { apiGet, apiPost, apiPatch } from '../../lib/api';
import { Labour, TeamSummary, PaginatedResponse } from '../../types';
import { C, R, AVATAR_COLORS, initials, fmtCurrency } from '../../lib/theme';

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
          <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={ms.close}>✕</Text></TouchableOpacity>
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
  const [wage, setWage] = useState('');
  const [hometown, setHometown] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() { setName(''); setWage(''); setHometown(''); }

  async function save() {
    if (!name.trim()) { Alert.alert('Required', 'Team name is required'); return; }
    const w = parseFloat(wage);
    if (isNaN(w) || w < 0) { Alert.alert('Invalid', 'Enter a valid daily rate'); return; }
    setSaving(true);
    try {
      await apiPost('/api/v1/teams', { name: name.trim(), daily_wage: w, hometown: hometown.trim() || undefined });
      reset(); onSuccess(); onClose();
    } catch { Alert.alert('Error', 'Failed to add team.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={ms.container}>
        <View style={ms.header}>
          <Text style={ms.title}>Add Team</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={ms.close}>✕</Text></TouchableOpacity>
        </View>
        <View style={ms.body}>
          {[
            { label: 'Team Name *', value: name, setter: setName, placeholder: 'e.g. Shinde Team', kb: 'default' as const },
            { label: 'Daily Rate per Labour (₹) *', value: wage, setter: setWage, placeholder: 'e.g. 300', kb: 'numeric' as const },
            { label: 'Hometown', value: hometown, setter: setHometown, placeholder: 'e.g. Narayangaon', kb: 'default' as const },
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
            {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={ms.saveText}>Add Team</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Labour Card ──────────────────────────────────────────────────────────────

function LabourCard({ labour, index, onDeactivate }: { labour: Labour; index: number; onDeactivate: (id: string, name: string) => void }) {
  const c = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const timing = labour.work_start_time && labour.work_end_time
    ? `${labour.work_start_time} – ${labour.work_end_time}`
    : '—';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: c.bg }]}>
          <Text style={[styles.avatarText, { color: c.fg }]}>{initials(labour.name)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName}>{labour.name}</Text>
            <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>
          </View>
          {labour.hometown && (
            <Text style={styles.cardMeta}>📍 {labour.hometown}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => onDeactivate(labour.id, labour.name)} hitSlop={10}>
          <Text style={styles.moreBtn}>⋯</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cardGrid}>
        <View style={styles.gridCell}>
          <Text style={styles.gridLabel}>DAILY WAGE</Text>
          <Text style={styles.gridValue}>{fmtCurrency(labour.daily_wage)}/day</Text>
        </View>
        <View style={styles.gridCell}>
          <Text style={styles.gridLabel}>SHIFT TIMING</Text>
          <Text style={styles.gridValue}>{timing}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Team Card ────────────────────────────────────────────────────────────────

function TeamCard({ team, index }: { team: TeamSummary; index: number }) {
  const c = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: c.bg }]}>
          <Text style={[styles.avatarText, { color: c.fg }]}>{initials(team.name)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName}>{team.name}</Text>
            <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>
          </View>
          {team.hometown && <Text style={styles.cardMeta}>📍 {team.hometown}</Text>}
        </View>
      </View>
      <View style={styles.cardGrid}>
        <View style={styles.gridCell}>
          <Text style={styles.gridLabel}>DAILY RATE</Text>
          <Text style={styles.gridValue}>{fmtCurrency(team.daily_wage)}/labour</Text>
        </View>
        <View style={styles.gridCell}>
          <Text style={styles.gridLabel}>MEMBERS</Text>
          <Text style={styles.gridValue}>👥 {team.member_count} workers</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Tab = 'individual' | 'team';

export default function PeopleScreen() {
  const [tab, setTab] = useState<Tab>('individual');
  const [labours, setLabours] = useState<Labour[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [addLabourOpen, setAddLabourOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);

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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    await Promise.all([loadLabours(), loadTeams()]);
    setLoading(false);
    setRefreshing(false);
  }, [loadLabours, loadTeams]);

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
          <Text style={styles.searchIcon}>🔍</Text>
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
          <Text style={styles.emptyIcon}>{isIndividual ? '👷' : '👥'}</Text>
          <Text style={styles.emptyTitle}>{search ? 'No results' : isIndividual ? 'No Labourers Yet' : 'No Teams Yet'}</Text>
          <Text style={styles.emptySub}>{search ? `No match for "${search}"` : `Tap + Add ${isIndividual ? 'Labour' : 'Team'} to get started.`}</Text>
        </View>
      ) : isIndividual ? (
        <FlatList
          data={labours}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <LabourCard labour={item} index={index} onDeactivate={deactivate} />
          )}
          ListFooterComponent={
            <Text style={styles.footerNote}>Showing {labours.length} registered agricultural workers</Text>
          }
        />
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => <TeamCard team={item} index={index} />}
          ListFooterComponent={
            <Text style={styles.footerNote}>
              Daily settlement rates calculate automatically into your Daily Book at day end.
            </Text>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  pageHeader: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.outlineVariant, gap: 10 },
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

  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.onSurface },
  emptySub: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center' },

  list: { padding: 16, paddingBottom: 32, gap: 12 },

  card: {
    backgroundColor: C.surfaceLowest,
    borderRadius: R.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700' },
  cardInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  activeBadge: { backgroundColor: C.primaryFixed, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeText: { fontSize: 9, fontWeight: '800', color: C.primary, letterSpacing: 0.5 },
  cardMeta: { fontSize: 12, color: C.onSurfaceVariant },
  moreBtn: { fontSize: 22, color: C.outline, paddingHorizontal: 4, paddingTop: 2 },

  cardGrid: { flexDirection: 'row', gap: 1, backgroundColor: C.outlineVariant, borderRadius: R.sm, overflow: 'hidden' },
  gridCell: { flex: 1, backgroundColor: C.surfaceLow, padding: 10, gap: 2 },
  gridLabel: { fontSize: 9, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.6 },
  gridValue: { fontSize: 13, fontWeight: '600', color: C.onSurface },

  footerNote: { fontSize: 11, color: C.onSurfaceVariant, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
});

const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  close: { fontSize: 18, color: C.onSurfaceVariant, paddingHorizontal: 4 },
  body: { flex: 1, padding: 20, gap: 4 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input: { height: 46, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 14, fontSize: 15, color: C.onSurface, backgroundColor: C.surfaceLow },
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  cancelBtn: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
});
