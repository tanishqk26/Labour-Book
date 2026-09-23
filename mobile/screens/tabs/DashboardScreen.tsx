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
import AppHeader from '../../components/AppHeader';
import { apiGet } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { C, R, AVATAR_COLORS, initials, fmtCurrency } from '../../lib/theme';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await apiGet<DailyView>(`/api/v1/attendance/daily?for_date=${today}`);
      setLabours(data.labours);
      setTeams(data.teams);
    } catch { setError('Failed to load today\'s data.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const all = [...labours, ...teams];
  const totalEntities = all.length;
  const isMarked = all.some((r) => r.status !== null);
  const presentLabours = labours.filter((l) => l.status === 'present');
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
                  <Text style={styles.ctaIconEmoji}>{isMarked ? '✅' : '⏳'}</Text>
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

            {/* Present people */}
            {(presentLabours.length + presentTeams.length) > 0 && (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Today's Attendance</Text>
                  <Text style={styles.sectionCount}>{totalPresent} present</Text>
                </View>

                {presentLabours.map((l, i) => {
                  const c = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  return (
                    <View key={l.labour_id} style={styles.personRow}>
                      <View style={[styles.personAvatar, { backgroundColor: c.bg }]}>
                        <Text style={[styles.personAvatarText, { color: c.fg }]}>{initials(l.labour_name)}</Text>
                      </View>
                      <View style={styles.personInfo}>
                        <Text style={styles.personName}>{l.labour_name}</Text>
                        <Text style={styles.personMeta}>{l.task ?? 'No task specified'}</Text>
                      </View>
                      <View style={styles.personRight}>
                        <Text style={styles.personWage}>{fmtCurrency(l.wage_earned ?? 0)}</Text>
                        <View style={styles.presentBadge}><Text style={styles.presentBadgeText}>Present</Text></View>
                      </View>
                    </View>
                  );
                })}

                {presentTeams.map((t) => (
                  <View key={t.team_id} style={styles.personRow}>
                    <View style={[styles.personAvatar, { backgroundColor: '#e8d5f7' }]}>
                      <Text style={styles.personAvatarText}>👥</Text>
                    </View>
                    <View style={styles.personInfo}>
                      <Text style={styles.personName}>{t.team_name}</Text>
                      <Text style={styles.personMeta}>{t.num_labourers ?? 0} workers</Text>
                    </View>
                    <View style={styles.personRight}>
                      <Text style={styles.personWage}>{fmtCurrency(t.wage_earned ?? 0)}</Text>
                      <View style={styles.presentBadge}><Text style={styles.presentBadgeText}>Present</Text></View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* No active entities */}
            {totalEntities === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>👷</Text>
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
  ctaIconEmoji: { fontSize: 20 },
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

  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceLowest,
    borderRadius: R.lg,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    gap: 10,
  },
  personAvatar: { width: 40, height: 40, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  personAvatarText: { fontSize: 13, fontWeight: '700' },
  personInfo: { flex: 1, gap: 2 },
  personName: { fontSize: 14, fontWeight: '600', color: C.onSurface },
  personMeta: { fontSize: 11, color: C.onSurfaceVariant },
  personRight: { alignItems: 'flex-end', gap: 4 },
  personWage: { fontSize: 14, fontWeight: '700', color: C.primaryContainer },
  presentBadge: { backgroundColor: C.primaryFixed, borderRadius: R.full, paddingHorizontal: 7, paddingVertical: 2 },
  presentBadgeText: { fontSize: 10, fontWeight: '700', color: C.primary },

  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.onSurface },
  emptySub: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center' },
});
