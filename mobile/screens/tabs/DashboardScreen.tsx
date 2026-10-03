import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import { apiGet } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { C, R, AVATAR_COLORS, initials, fmtCurrency } from '../../lib/theme';

interface EntityPaymentSummary {
  entity_id: string; entity_type: string; pending: number;
}

interface LabourStatus {
  labour_id: string; labour_name: string; daily_wage: number;
  attendance_id: string | null; status: 'present' | 'absent' | 'half_day' | null;
  wage_earned: number | null; task: string | null; hours_worked: number | null;
}
interface TeamStatus {
  team_id: string; team_name: string;
  attendance_id: string | null; status: 'present' | 'absent' | null;
  wage_earned: number | null; num_labourers: number | null; task: string | null;
}
interface DailyView { labours: LabourStatus[]; teams: TeamStatus[]; }

function todayISO() { return new Date().toISOString().slice(0, 10); }
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const today = todayISO();

  const [labours, setLabours] = useState<LabourStatus[]>([]);
  const [teams, setTeams] = useState<TeamStatus[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [data, payData] = await Promise.all([
        apiGet<DailyView>(`/api/v1/attendance/daily?for_date=${today}`),
        apiGet<EntityPaymentSummary[] | { items: EntityPaymentSummary[] }>('/api/v1/payments/entities').catch(() => [] as EntityPaymentSummary[]),
      ]);
      setLabours(data.labours);
      setTeams(data.teams);
      const items: EntityPaymentSummary[] = Array.isArray(payData) ? payData : ((payData as any).items ?? []);
      const owing = items.filter((i) => i.pending > 0);
      setTotalPending(owing.reduce((s, i) => s + i.pending, 0));
      setPendingCount(owing.length);
    } catch { setError('Failed to load today\'s data.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const all = [...labours, ...teams];
  const totalEntities = all.length;
  const isMarked = all.some((r) => r.status !== null);
  const presentLabours = labours.filter((l) => l.status === 'present' || l.status === 'half_day');
  const presentTeams = teams.filter((t) => t.status === 'present');
  const totalPresent = presentLabours.length + presentTeams.length;
  const totalWage = all.reduce((s, r) => s + (r.wage_earned ?? 0), 0);

  const dateLabel = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  const firstName = user?.name?.split(' ')[0] ?? 'Farm Manager';

  return (
    <View style={styles.root}>
      <AppHeader screenName="Dashboard" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetingRow}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <Text style={styles.greeting}>{greeting()}, {firstName}</Text>
          <Text style={styles.greetingSub}>Here's what happened on your farm today.</Text>
        </View>

        {!loading && totalPending > 0 && (
          <TouchableOpacity
            style={styles.pendingBanner}
            onPress={() => navigation.navigate('More', { screen: 'Payments' })}
          >
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={C.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingBannerTitle}>{fmtCurrency(totalPending)} pending</Text>
              <Text style={styles.pendingBannerSub}>{pendingCount} {pendingCount === 1 ? 'person' : 'people'} awaiting payment — tap to record</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={C.error} />
          </TouchableOpacity>
        )}

        {loading ? (
          <View style={styles.centred}><ActivityIndicator size="large" color={C.primary} /></View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Attendance CTA card */}
            <View style={[styles.ctaCard, isMarked && styles.ctaCardDone]}>
              <View style={styles.ctaIconRow}>
                <View style={[styles.ctaIcon, isMarked && styles.ctaIconDone]}>
                  <MaterialCommunityIcons
                    name={isMarked ? 'calendar-check' : 'clock-alert-outline'}
                    size={22}
                    color={isMarked ? C.primary : C.tertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ctaCardLabel}>{isMarked ? 'ATTENDANCE MARKED' : 'PENDING ACTION'}</Text>
                  <Text style={styles.ctaCardTitle}>
                    {isMarked ? "Today's attendance is recorded" : "Today's attendance: Not completed"}
                  </Text>
                  {!isMarked && (
                    <Text style={styles.ctaCardSub}>Ensure accurate wage calculations by marking before end of day.</Text>
                  )}
                </View>
              </View>
              {totalEntities > 0 && (
                <TouchableOpacity
                  style={[styles.ctaBtn, isMarked && styles.ctaBtnSecondary]}
                  onPress={() => navigation.navigate('Attendance')}
                >
                  <Text style={[styles.ctaBtnText, isMarked && styles.ctaBtnTextSecondary]}>
                    {isMarked ? 'Edit Attendance' : 'Mark Today\'s Attendance'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Stats */}
            {isMarked && (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>LABOUR COST</Text>
                  <Text style={styles.statValue}>{fmtCurrency(totalWage)}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>WORKERS TODAY</Text>
                  <Text style={styles.statValue}>{totalPresent}</Text>
                  <Text style={styles.statSub}>{presentTeams.length} teams · {presentLabours.length} solo</Text>
                </View>
              </View>
            )}

            {/* Attendance table */}
            {(presentLabours.length + presentTeams.length) > 0 && (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Today's Attendance</Text>
                  <Text style={styles.sectionCount}>{totalPresent} present</Text>
                </View>
                <View style={styles.attTable}>
                  {/* Header */}
                  <View style={styles.attThead}>
                    <Text style={[styles.attTh, { flex: 1 }]}>Name</Text>
                    <Text style={[styles.attTh, { width: 72, textAlign: 'right' }]}>Earned</Text>
                    <Text style={[styles.attTh, { flex: 1, paddingLeft: 10 }]}>Task</Text>
                  </View>
                  {/* Labour rows */}
                  {presentLabours.map((l, i) => {
                    const c = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    const isLast = i === presentLabours.length - 1 && presentTeams.length === 0;
                    return (
                      <TouchableOpacity
                        key={l.labour_id}
                        style={[styles.attTr, isLast && styles.attTrLast]}
                        onPress={() => navigation.navigate('People', { screen: 'LabourDetail', params: { id: l.labour_id } })}
                        activeOpacity={0.6}
                      >
                        <View style={[styles.attNameCell, { flex: 1 }]}>
                          <View style={[styles.attAv, { backgroundColor: c.bg }]}>
                            <Text style={[styles.attAvTxt, { color: c.fg }]}>{initials(l.labour_name)[0]}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.attName} numberOfLines={1}>{l.labour_name}</Text>
                            <Text style={styles.attMeta}>{l.status === 'half_day' ? 'Half Day' : 'Present'}</Text>
                          </View>
                        </View>
                        <Text style={styles.attEarned}>{fmtCurrency(l.wage_earned ?? 0)}</Text>
                        <Text style={styles.attTask} numberOfLines={2}>{l.task ?? '—'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {/* Team rows */}
                  {presentTeams.map((t, i) => {
                    const c = AVATAR_COLORS[(presentLabours.length + i) % AVATAR_COLORS.length];
                    const isLast = i === presentTeams.length - 1;
                    return (
                      <TouchableOpacity
                        key={t.team_id}
                        style={[styles.attTr, styles.attTrTeam, isLast && styles.attTrLast]}
                        onPress={() => navigation.navigate('People', { screen: 'TeamDetail', params: { id: t.team_id } })}
                        activeOpacity={0.6}
                      >
                        <View style={[styles.attNameCell, { flex: 1 }]}>
                          <View style={[styles.attAv, { backgroundColor: c.bg }]}>
                            <Text style={[styles.attAvTxt, { color: c.fg }]}>{initials(t.team_name)[0]}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.attName} numberOfLines={1}>{t.team_name}</Text>
                            <Text style={styles.attMeta}>{t.num_labourers ?? 0} workers</Text>
                          </View>
                        </View>
                        <Text style={styles.attEarned}>{fmtCurrency(t.wage_earned ?? 0)}</Text>
                        <Text style={styles.attTask} numberOfLines={2}>{t.task ?? '—'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* No active entities */}
            {totalEntities === 0 && (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons name="account-hard-hat-outline" size={56} color={C.outline} style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No Active Labourers</Text>
                <Text style={styles.emptySub}>Add labourers or teams to get started.</Text>
                <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('People')}>
                  <Text style={styles.ctaBtnText}>+ Add Labourers</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fef2f2', borderRadius: R.lg, padding: 14,
    borderWidth: 1, borderColor: '#fecaca',
  },
  pendingBannerTitle: { fontSize: 14, fontWeight: '700', color: C.error },
  pendingBannerSub: { fontSize: 12, color: C.error, opacity: 0.8 },

  greetingRow: { gap: 4, marginBottom: 4 },
  dateLabel: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 1 },
  greeting: { fontSize: 26, fontWeight: '800', color: C.primary, letterSpacing: -0.3 },
  greetingSub: { fontSize: 14, color: C.onSurfaceVariant },

  centred: { paddingVertical: 48, alignItems: 'center' },
  errorCard: { backgroundColor: C.errorContainer, borderRadius: R.xl, padding: 16, alignItems: 'center', gap: 10 },
  errorText: { color: C.error, fontSize: 13, textAlign: 'center' },
  retryBtn: { backgroundColor: C.error, borderRadius: R.md, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: '#fff', fontWeight: '700' },

  ctaCard: {
    backgroundColor: C.surfaceHigh,
    borderRadius: R.xl,
    padding: 16,
    gap: 12,
  },
  ctaCardDone: { backgroundColor: C.surfaceLow, borderWidth: 1, borderColor: C.outlineVariant },
  ctaIconRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ctaIcon: { width: 40, height: 40, borderRadius: R.md, backgroundColor: C.tertiaryFixed, alignItems: 'center', justifyContent: 'center' },
  ctaIconDone: { backgroundColor: C.primaryFixed },
  ctaCardLabel: { fontSize: 10, fontWeight: '700', color: C.primary, letterSpacing: 1 },
  ctaCardTitle: { fontSize: 15, fontWeight: '700', color: C.onSurface, marginTop: 2 },
  ctaCardSub: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 3 },
  ctaBtn: {
    height: 46,
    backgroundColor: C.primaryContainer,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaBtnSecondary: { backgroundColor: C.surfaceContainer, borderWidth: 1, borderColor: C.outlineVariant },
  ctaBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
  ctaBtnTextSecondary: { color: C.onSurface },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: C.surfaceLowest,
    borderRadius: R.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    gap: 4,
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.8 },
  statValue: { fontSize: 24, fontWeight: '800', color: C.primary, letterSpacing: -0.5 },
  statSub: { fontSize: 11, color: C.onSurfaceVariant },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  sectionCount: { fontSize: 11, fontWeight: '600', color: C.onSurfaceVariant },

  attTable:    { borderRadius: R.xl, borderWidth: 1, borderColor: C.outlineVariant, overflow: 'hidden', backgroundColor: C.surfaceLowest },
  attThead:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceHigh, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  attTh:       { fontSize: 9, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 0.8, textTransform: 'uppercase' },
  attTr:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.outlineVariant, backgroundColor: C.surfaceLowest },
  attTrTeam:   { backgroundColor: '#faf7ff' },
  attTrLast:   { borderBottomWidth: 0 },
  attNameCell: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  attAv:       { width: 28, height: 28, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  attAvTxt:    { fontSize: 10, fontWeight: '800' },
  attName:     { fontSize: 13, fontWeight: '600', color: C.onSurface },
  attMeta:     { fontSize: 10, color: C.onSurfaceVariant, marginTop: 1 },
  attEarned:   { width: 72, fontSize: 12, fontWeight: '700', color: C.primaryContainer, textAlign: 'right' },
  attTask:     { flex: 1, fontSize: 11, color: C.onSurfaceVariant, paddingLeft: 10 },

  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.onSurface },
  emptySub: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center' },
});
