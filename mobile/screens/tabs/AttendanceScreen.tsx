import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppHeader from '../../components/AppHeader';
import { apiGet, apiPost, apiDelete, apiPatch } from '../../lib/api';
import { C, R, AVATAR_COLORS, initials } from '../../lib/theme';

type AttStatus = 'present' | 'absent' | 'half_day';
interface AttRecord { id: string; date: string; labour_id: string | null; team_id: string | null; status: AttStatus; wage_earned?: number; }
interface Labour { id: string; name: string; is_active: boolean; }
interface Team { id: string; name: string; member_count: number; is_active: boolean; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }
function mondayOf(iso: string) {
  const d = new Date(iso); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<AttStatus, string> = { present: 'P', absent: 'A', half_day: 'H' };
const STATUS_STYLE: Record<AttStatus, { bg: string; fg: string }> = {
  present: { bg: C.primaryFixed, fg: C.primary },
  absent: { bg: C.errorContainer, fg: C.error },
  half_day: { bg: '#fef3c7', fg: '#6b4c04' },
};
const DAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ─── Mark Tab — single-day attendance ─────────────────────────────────────────

function MarkTab({ today, labours, teams, records, onToggle }: {
  today: string; labours: Labour[]; teams: Team[];
  records: AttRecord[]; onToggle: (id: string, kind: 'labour' | 'team', s: AttStatus) => void;
}) {
  const all = [
    ...labours.map((l) => ({ id: l.id, name: l.name, kind: 'labour' as const })),
    ...teams.map((t) => ({ id: t.id, name: t.name, kind: 'team' as const, count: t.member_count })),
  ];

  const dateLabel = new Date(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  function statusOf(id: string, kind: string) {
    return records.find((r) => r.date === today && (kind === 'labour' ? r.labour_id === id : r.team_id === id))?.status ?? null;
  }

  return (
    <FlatList
      data={all}
      keyExtractor={(e) => `${e.kind}-${e.id}`}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 8 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={s.markHeader}>
          <Text style={s.markDate}>{dateLabel}</Text>
          <Text style={s.markHint}>Tap P / H / A to mark status. Tap again to undo.</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={s.centred}><Text style={s.emptyDesc}>No active labourers or teams.</Text></View>
      }
      renderItem={({ item: e, index }) => {
        const status = statusOf(e.id, e.kind);
        const c = AVATAR_COLORS[index % AVATAR_COLORS.length];
        return (
          <View style={s.entityRow}>
            <View style={[s.entityAvatar, { backgroundColor: c.bg }]}>
              <Text style={[s.entityAvatarText, { color: c.fg }]}>{initials(e.name)}</Text>
            </View>
            <View style={s.entityInfo}>
              <Text style={s.entityName}>{e.name}</Text>
              <Text style={s.entityKind}>
                {e.kind === 'team' ? `Team · ${(e as any).count ?? 0} workers` : 'Individual'}
              </Text>
            </View>
            <View style={s.statusBtns}>
              {(['present', 'half_day', 'absent'] as AttStatus[]).map((st) => {
                const col = STATUS_STYLE[st];
                const active = status === st;
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => onToggle(e.id, e.kind, st)}
                    style={[s.statusBtn, active && { backgroundColor: col.bg, borderColor: col.fg }]}
                  >
                    <Text style={[s.statusBtnText, active && { color: col.fg }]}>{STATUS_LABEL[st]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      }}
    />
  );
}

// ─── History Tab — weekly grid (NO horizontal scroll) ─────────────────────────

function HistoryTab({ weekDates, labours, teams, records }: {
  weekDates: string[]; labours: Labour[]; teams: Team[]; records: AttRecord[];
}) {
  // Only entities with at least one record this week
  const presentIds = new Set(records.map((r) => r.labour_id ?? r.team_id));
  const activeL = labours.filter((l) => presentIds.has(l.id));
  const activeT = teams.filter((t) => presentIds.has(t.id));

  function statusOf(id: string, kind: 'labour' | 'team', date: string) {
    return records.find((r) => r.date === date && (kind === 'labour' ? r.labour_id === id : r.team_id === id))?.status ?? null;
  }

  function dayCount(id: string, kind: 'labour' | 'team') {
    return weekDates.reduce((n, d) => {
      const s = statusOf(id, kind, d);
      return n + (s === 'present' ? 1 : s === 'half_day' ? 0.5 : 0);
    }, 0);
  }

  if (activeL.length + activeT.length === 0) {
    return <View style={s.centred}><Text style={s.emptyDesc}>No attendance marked for this week.</Text></View>;
  }

  // Day columns are: 7 × 34px + name 100px + total 36px = 374px — fits in ~375px without scroll
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      {/* Column header */}
      <View style={h.headerRow}>
        <View style={h.nameCol}><Text style={h.headerLabel}>Name</Text></View>
        {DAY_SHORT.map((d, i) => (
          <View key={i} style={h.dayCol}>
            <Text style={h.headerLabel}>{d}</Text>
            <Text style={h.headerDate}>{new Date(weekDates[i]).getDate()}</Text>
          </View>
        ))}
        <View style={h.totalCol}><Text style={h.headerLabel}>Days</Text></View>
      </View>

      {/* Labour rows */}
      {activeL.map((l, li) => {
        const c = AVATAR_COLORS[li % AVATAR_COLORS.length];
        return (
          <View key={l.id} style={h.row}>
            <View style={h.nameCol}>
              <View style={[h.miniAvatar, { backgroundColor: c.bg }]}>
                <Text style={[h.miniAvatarText, { color: c.fg }]}>{initials(l.name)[0]}</Text>
              </View>
              <Text style={h.nameText} numberOfLines={1}>{l.name.split(' ')[0]}</Text>
            </View>
            {weekDates.map((d, di) => {
              const st = statusOf(l.id, 'labour', d);
              const col = st ? STATUS_STYLE[st] : null;
              return (
                <View key={di} style={[h.dayCol, h.dayCell, col ? { backgroundColor: col.bg } : {}]}>
                  <Text style={[h.statusLabel, col ? { color: col.fg } : {}]}>{st ? STATUS_LABEL[st] : '–'}</Text>
                </View>
              );
            })}
            <View style={[h.totalCol, h.dayCell]}>
              <Text style={h.totalText}>{dayCount(l.id, 'labour')}</Text>
            </View>
          </View>
        );
      })}

      {/* Team rows */}
      {activeT.map((t) => (
        <View key={t.id} style={[h.row, { backgroundColor: '#f5f0ff' }]}>
          <View style={h.nameCol}>
            <View style={[h.miniAvatar, { backgroundColor: '#e8d5f7' }]}>
              <Text style={[h.miniAvatarText, { color: '#3d1457' }]}>T</Text>
            </View>
            <Text style={h.nameText} numberOfLines={1}>{t.name.split(' ')[0]}</Text>
          </View>
          {weekDates.map((d, di) => {
            const st = statusOf(t.id, 'team', d);
            const col = st ? STATUS_STYLE[st] : null;
            return (
              <View key={di} style={[h.dayCol, h.dayCell, col ? { backgroundColor: col.bg } : {}]}>
                <Text style={[h.statusLabel, col ? { color: col.fg } : {}]}>{st ? STATUS_LABEL[st] : '–'}</Text>
              </View>
            );
          })}
          <View style={[h.totalCol, h.dayCell]}>
            <Text style={h.totalText}>{dayCount(t.id, 'team')}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AttendanceScreen() {
  const today = todayISO();
  const [weekStart, setWeekStart] = useState(mondayOf(today));
  const [activeTab, setActiveTab] = useState<'mark' | 'history'>('mark');
  const [labours, setLabours] = useState<Labour[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const isCurrentWeek = weekStart === mondayOf(today);
  const weekLabel = `${new Date(weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(addDays(weekStart, 6)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ls, ts, rs] = await Promise.all([
        apiGet<{ items: Labour[] }>('/api/v1/labours?page=1&page_size=100&status=active'),
        apiGet<{ items: Team[] }>('/api/v1/teams?page=1&page_size=100&status=active'),
        apiGet<AttRecord[]>(`/api/v1/attendance?date_from=${weekStart}&date_to=${addDays(weekStart, 6)}`),
      ]);
      setLabours(ls.items);
      setTeams(ts.items);
      setRecords(rs);
    } catch { Alert.alert('Error', 'Failed to load attendance.'); }
    finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(entityId: string, kind: 'labour' | 'team', status: AttStatus) {
    const existing = records.find((r) => r.date === today && (kind === 'labour' ? r.labour_id === entityId : r.team_id === entityId));
    try {
      if (existing) {
        if (existing.status === status) {
          await apiDelete(`/api/v1/attendance/${existing.id}`);
          setRecords((prev) => prev.filter((r) => r.id !== existing.id));
        } else {
          const updated = await apiPatch<AttRecord>(`/api/v1/attendance/${existing.id}`, { status });
          setRecords((prev) => prev.map((r) => r.id === existing.id ? updated : r));
        }
      } else {
        const payload: Record<string, unknown> = { date: today, status };
        if (kind === 'labour') payload.labour_id = entityId; else payload.team_id = entityId;
        const created = await apiPost<AttRecord>('/api/v1/attendance', payload);
        setRecords((prev) => [...prev, created]);
      }
    } catch { Alert.alert('Error', 'Failed to update attendance.'); }
  }

  const todayHasMarks = records.some((r) => r.date === today);

  return (
    <View style={s.root}>
      <AppHeader screenName="Attendance" />

      {/* Week navigator */}
      <View style={s.weekNav}>
        <TouchableOpacity style={s.navBtn} onPress={() => setWeekStart(addDays(weekStart, -7))}>
          <Text style={s.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity style={[s.navBtn, isCurrentWeek && { opacity: 0.3 }]} onPress={() => !isCurrentWeek && setWeekStart(addDays(weekStart, 7))} disabled={isCurrentWeek}>
          <Text style={s.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Tab selector */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tabBtn, activeTab === 'mark' && s.tabBtnActive]} onPress={() => setActiveTab('mark')}>
          <Text style={[s.tabBtnText, activeTab === 'mark' && s.tabBtnTextActive]}>
            {todayHasMarks ? 'Edit Today' : 'Mark Today'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, activeTab === 'history' && s.tabBtnActive]} onPress={() => setActiveTab('history')}>
          <Text style={[s.tabBtnText, activeTab === 'history' && s.tabBtnTextActive]}>Week History</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : activeTab === 'mark' ? (
        <MarkTab today={today} labours={labours} teams={teams} records={records} onToggle={handleToggle} />
      ) : (
        <HistoryTab weekDates={weekDates} labours={labours} teams={teams} records={records} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  navBtn: { width: 36, height: 36, borderRadius: R.full, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontSize: 22, color: C.onSurface, lineHeight: 26 },
  weekLabel: { fontSize: 13, fontWeight: '600', color: C.onSurface },
  tabBar: { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2.5, borderBottomColor: C.primaryContainer },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: C.onSurfaceVariant },
  tabBtnTextActive: { color: C.primaryContainer },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyDesc: { fontSize: 14, color: C.onSurfaceVariant, textAlign: 'center' },

  markHeader: { marginBottom: 12, gap: 4 },
  markDate: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  markHint: { fontSize: 11, color: C.onSurfaceVariant },

  entityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLowest, borderRadius: R.lg, padding: 12, borderWidth: 1, borderColor: C.outlineVariant, gap: 10 },
  entityAvatar: { width: 40, height: 40, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  entityAvatarText: { fontSize: 13, fontWeight: '700' },
  entityInfo: { flex: 1 },
  entityName: { fontSize: 14, fontWeight: '600', color: C.onSurface },
  entityKind: { fontSize: 11, color: C.onSurfaceVariant, marginTop: 1 },
  statusBtns: { flexDirection: 'row', gap: 6 },
  statusBtn: { width: 34, height: 34, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceHigh },
  statusBtnText: { fontSize: 12, fontWeight: '800', color: C.onSurfaceVariant },
});

// Compact history grid — no scroll
const NAME_W = 100;
const DAY_W = 34;
const TOTAL_W = 36;

const h = StyleSheet.create({
  headerRow: { flexDirection: 'row', backgroundColor: C.surfaceHigh, borderRadius: R.sm, marginBottom: 4, paddingVertical: 6, alignItems: 'center' },
  row: { flexDirection: 'row', backgroundColor: C.surfaceLowest, borderRadius: R.sm, marginBottom: 3, borderWidth: 1, borderColor: C.outlineVariant, alignItems: 'center', minHeight: 44 },
  nameCol: { width: NAME_W, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayCol: { width: DAY_W, alignItems: 'center', justifyContent: 'center' },
  dayCell: { borderLeftWidth: 1, borderLeftColor: C.outlineVariant, alignSelf: 'stretch', justifyContent: 'center' },
  totalCol: { width: TOTAL_W, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontSize: 9, fontWeight: '700', color: C.onSurfaceVariant, textAlign: 'center' },
  headerDate: { fontSize: 9, color: C.outline, textAlign: 'center' },
  miniAvatar: { width: 22, height: 22, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 9, fontWeight: '700' },
  nameText: { fontSize: 11, fontWeight: '600', color: C.onSurface, flex: 1 },
  statusLabel: { fontSize: 11, fontWeight: '800', color: C.onSurfaceVariant },
  totalText: { fontSize: 11, fontWeight: '700', color: C.onSurface },
});
