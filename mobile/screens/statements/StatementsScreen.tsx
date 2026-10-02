import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { apiGet } from '../../lib/api';
import { C, R, fmtCurrency, fmtDate, todayISO } from '../../lib/theme';
import { MoreStackParamList } from '../details/types';

type ListProps = NativeStackScreenProps<MoreStackParamList, 'Statements'>;
type DetailProps = NativeStackScreenProps<MoreStackParamList, 'StatementDetail'>;

type StatementType = 'combined' | 'work' | 'payment';

interface StatementEntity {
  id: string;
  name: string;
  entity_type: string;
  daily_wage: number;
  hometown?: string | null;
}

interface WorkRow {
  date: string;
  status: string;
  task?: string | null;
  wage_earned: number;
  num_labourers?: number | null;
  hours_worked?: number | null;
}

interface PaymentRow {
  date: string;
  type: string;
  description: string;
  amount: number;
  method?: string | null;
}

interface Summary {
  total_days_present: number;
  total_days_absent: number;
  total_days_half: number;
  total_wage_earned: number;
  total_paid_borrowed: number;
  balance: number;
}

interface WorkStatement {
  entity: { name: string; entity_type: string };
  summary: Summary;
  rows: WorkRow[];
}

interface PaymentStatement {
  entity: { name: string; entity_type: string };
  summary: Summary;
  rows: PaymentRow[];
}

interface CombinedStatement {
  entity: { name: string; entity_type: string };
  summary: Summary;
  work_rows: WorkRow[];
  payment_rows: PaymentRow[];
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function lastMonthRange() {
  const d = new Date();
  return {
    from: new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10),
    to: new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10),
  };
}
function threeMonthsAgo() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 3, 1).toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  { label: 'This Month', get: () => ({ from: firstOfMonth(), to: todayISO() }) },
  { label: 'Last Month', get: () => lastMonthRange() },
  { label: 'Last 3M', get: () => ({ from: threeMonthsAgo(), to: todayISO() }) },
  { label: 'All Time', get: () => ({ from: '', to: '' }) },
] as const;

// ─── Status badge colours ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  present: { bg: C.primaryFixed, fg: C.primary },
  half_day: { bg: '#fef3c7', fg: '#6b4c04' },
  absent: { bg: C.errorContainer, fg: C.error },
};
const PAYMENT_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  credit: { bg: C.primaryFixed, fg: C.primary },
  borrowed: { bg: C.errorContainer, fg: C.error },
};

// ─── List Screen ──────────────────────────────────────────────────────────────

export function StatementsListScreen({ navigation }: ListProps) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<StatementEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'individual' | 'team'>('individual');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiGet<StatementEntity[]>('/api/v1/statements/entities');
      setItems(data);
    } catch {
      setError('Could not load people.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = items.filter((e) =>
    e.entity_type === tab &&
    (search === '' || e.name.toLowerCase().includes(search.toLowerCase()) || (e.hometown ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Statements</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <MaterialCommunityIcons name="magnify" size={18} color={C.outline} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or hometown…"
          placeholderTextColor={C.outline}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={18} color={C.outline} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab filter */}
      <View style={s.filters}>
        {(['individual', 'team'] as const).map((k) => (
          <TouchableOpacity key={k} style={[s.chip, tab === k && s.chipOn]} onPress={() => setTab(k)}>
            <Text style={[s.chipText, tab === k && s.chipTextOn]}>{k === 'individual' ? 'Labour' : 'Teams'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : error ? (
        <View style={s.centred}>
          <Text style={s.empty}>{error}</Text>
          <TouchableOpacity style={s.retry} onPress={load}><Text style={s.retryText}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(e) => `${e.entity_type}-${e.id}`}
          contentContainerStyle={shown.length === 0 ? s.centred : { padding: 12, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="account-search-outline" size={48} color={C.outline} />
              <Text style={s.empty}>No {tab === 'team' ? 'teams' : 'labourers'} found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('StatementDetail', { entityType: item.entity_type, entityId: item.id, name: item.name })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.meta}>{fmtCurrency(item.daily_wage)}/day{item.hometown ? ` · ${item.hometown}` : ''}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={C.outline} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// ─── Detail Screen ────────────────────────────────────────────────────────────

export function StatementDetailScreen({ route, navigation }: DetailProps) {
  const { entityType, entityId, name } = route.params;
  const insets = useSafeAreaInsets();

  const [stmtType, setStmtType] = useState<StatementType>('combined');
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [activePreset, setActivePreset] = useState<string>('This Month');

  const [data, setData] = useState<WorkStatement | PaymentStatement | CombinedStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (type: StatementType, from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      const result = await apiGet<WorkStatement | PaymentStatement | CombinedStatement>(
        `/api/v1/statements/${type}/${entityType}/${entityId}`,
        params
      );
      setData(result);
    } catch {
      setError('Could not load this statement.');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { load(stmtType, dateFrom, dateTo); }, [load, stmtType, dateFrom, dateTo]);

  function applyPreset(label: string, range: { from: string; to: string }) {
    setActivePreset(label);
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  async function exportPDF() {
    if (!data) return;
    setExporting(true);
    try {
      const summary = data.summary;
      const wRows: WorkRow[] = stmtType === 'combined'
        ? ((data as CombinedStatement).work_rows ?? [])
        : stmtType === 'work' ? ((data as WorkStatement).rows ?? []) : [];
      const pRows: PaymentRow[] = stmtType === 'combined'
        ? ((data as CombinedStatement).payment_rows ?? [])
        : stmtType === 'payment' ? ((data as PaymentStatement).rows ?? []) : [];

      const workHtml = wRows.map((r) => `
        <tr>
          <td>${fmtDate(r.date)}</td>
          <td>${r.status === 'half_day' ? 'Half Day' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}</td>
          <td>${r.task ?? ''}</td>
          <td style="text-align:right">${r.status === 'absent' ? '—' : fmtCurrency(r.wage_earned)}</td>
        </tr>`).join('');
      const payHtml = pRows.map((r) => `
        <tr>
          <td>${fmtDate(r.date)}</td>
          <td>${r.type === 'credit' ? 'Wage' : 'Advance'}</td>
          <td>${r.description}</td>
          <td style="text-align:right;color:${r.type === 'credit' ? '#012d1d' : '#7f1d1d'}">${r.type === 'credit' ? '+' : '−'}${fmtCurrency(r.amount)}</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
        body{font-family:sans-serif;padding:24px;color:#1a1a1a}
        h1{color:#012d1d;font-size:22px;margin-bottom:4px}
        h2{color:#012d1d;font-size:16px;margin:20px 0 8px}
        .kpi{display:flex;gap:16px;margin-bottom:16px}
        .kpi-box{border:1px solid #ccc;border-radius:8px;padding:12px;min-width:100px}
        .kpi-label{font-size:10px;font-weight:700;color:#666;text-transform:uppercase}
        .kpi-value{font-size:20px;font-weight:800;color:#012d1d;margin-top:2px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th{background:#f5f5f5;padding:8px;text-align:left;font-weight:700;border-bottom:2px solid #ccc}
        td{padding:7px 8px;border-bottom:1px solid #eee}
        tr:last-child td{border-bottom:none}
        .footer{margin-top:32px;font-size:11px;color:#999;text-align:center}
      </style></head><body>
        <h1>${name}</h1>
        <p style="color:#666;margin:0 0 16px">${stmtType.charAt(0).toUpperCase() + stmtType.slice(1)} Statement · ${dateFrom || 'All time'} – ${dateTo || 'today'}</p>
        ${summary ? `<div class="kpi">
          <div class="kpi-box"><div class="kpi-label">Earned</div><div class="kpi-value">${fmtCurrency(summary.total_wage_earned)}</div></div>
          <div class="kpi-box"><div class="kpi-label">Paid</div><div class="kpi-value">${fmtCurrency(summary.total_paid_borrowed)}</div></div>
          <div class="kpi-box"><div class="kpi-label">Balance</div><div class="kpi-value" style="color:${summary.balance > 0 ? '#7f1d1d' : '#012d1d'}">${fmtCurrency(summary.balance)}</div></div>
        </div>` : ''}
        ${wRows.length > 0 ? `<h2>Attendance Records</h2><table><thead><tr><th>Date</th><th>Status</th><th>Task</th><th>Wage</th></tr></thead><tbody>${workHtml}</tbody></table>` : ''}
        ${pRows.length > 0 ? `<h2>Payment Records</h2><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead><tbody>${payHtml}</tbody></table>` : ''}
        <div class="footer">Generated by LabourBook · ${new Date().toLocaleDateString('en-IN')}</div>
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${name} Statement` });
      } else {
        Alert.alert('PDF Saved', `Saved to: ${uri}`);
      }
    } catch {
      Alert.alert('Error', 'Could not generate PDF.');
    } finally {
      setExporting(false);
    }
  }

  // Derive rows from data based on type
  const workRows: WorkRow[] = stmtType === 'combined'
    ? ((data as CombinedStatement)?.work_rows ?? [])
    : stmtType === 'work' ? ((data as WorkStatement)?.rows ?? []) : [];

  const payRows: PaymentRow[] = stmtType === 'combined'
    ? ((data as CombinedStatement)?.payment_rows ?? [])
    : stmtType === 'payment' ? ((data as PaymentStatement)?.rows ?? []) : [];

  const summary = data?.summary;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{name}</Text>
        <TouchableOpacity onPress={exportPDF} disabled={exporting || !data} hitSlop={10} style={s.backBtn}>
          {exporting
            ? <ActivityIndicator size="small" color={C.primary} />
            : <MaterialCommunityIcons name="share-variant-outline" size={22} color={data ? C.primary : C.outline} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Type selector */}
        <View style={s.typeRow}>
          {([
            { key: 'combined', icon: 'text-box-multiple-outline', label: 'Combined' },
            { key: 'work', icon: 'calendar-account-outline', label: 'Work' },
            { key: 'payment', icon: 'wallet-outline', label: 'Payments' },
          ] as { key: StatementType; icon: string; label: string }[]).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[s.typeChip, stmtType === opt.key && s.typeChipOn]}
              onPress={() => setStmtType(opt.key)}
            >
              <MaterialCommunityIcons
                name={opt.icon as any}
                size={16}
                color={stmtType === opt.key ? C.onPrimary : C.onSurfaceVariant}
              />
              <Text style={[s.typeChipText, stmtType === opt.key && s.typeChipTextOn]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date presets */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetRow}>
          {DATE_PRESETS.map((p) => (
            <TouchableOpacity
              key={p.label}
              style={[s.presetChip, activePreset === p.label && s.presetChipOn]}
              onPress={() => applyPreset(p.label, p.get())}
            >
              <Text style={[s.presetText, activePreset === p.label && s.presetTextOn]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={[s.centred, { marginTop: 40 }]}><ActivityIndicator size="large" color={C.primary} /></View>
        ) : error || !data ? (
          <View style={[s.centred, { marginTop: 40 }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={C.error} />
            <Text style={s.empty}>{error ?? 'No statement'}</Text>
            <TouchableOpacity style={s.retry} onPress={() => load(stmtType, dateFrom, dateTo)}>
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ padding: 12, gap: 12 }}>
            {/* KPI summary */}
            {summary && (
              <View style={s.kpiRow}>
                <Kpi label="Earned" value={fmtCurrency(summary.total_wage_earned)} />
                <Kpi label="Paid" value={fmtCurrency(summary.total_paid_borrowed)} />
                <Kpi label="Balance" value={fmtCurrency(summary.balance)} accent={summary.balance > 0} />
              </View>
            )}

            {/* Attendance summary strip (work / combined) */}
            {(stmtType === 'work' || stmtType === 'combined') && summary && (
              <View style={s.stripRow}>
                <View style={s.stripCell}>
                  <Text style={s.stripNum}>{summary.total_days_present}</Text>
                  <Text style={s.stripLabel}>Present</Text>
                </View>
                <View style={s.stripDivider} />
                <View style={s.stripCell}>
                  <Text style={[s.stripNum, { color: '#6b4c04' }]}>{summary.total_days_half}</Text>
                  <Text style={s.stripLabel}>Half</Text>
                </View>
                <View style={s.stripDivider} />
                <View style={s.stripCell}>
                  <Text style={[s.stripNum, { color: C.error }]}>{summary.total_days_absent}</Text>
                  <Text style={s.stripLabel}>Absent</Text>
                </View>
              </View>
            )}

            {/* Work rows */}
            {(stmtType === 'work' || stmtType === 'combined') && (
              <>
                <Text style={s.section}>
                  {stmtType === 'combined' ? 'Attendance Records' : 'Work Records'}
                  {workRows.length > 0 ? ` · ${workRows.length} entries` : ''}
                </Text>
                {workRows.length === 0 ? (
                  <Text style={s.meta}>No work records for this period.</Text>
                ) : workRows.map((row, i) => {
                  const sc = STATUS_COLORS[row.status] ?? STATUS_COLORS.present;
                  return (
                    <View key={`w-${row.date}-${i}`} style={s.line}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={s.name}>{fmtDate(row.date)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <View style={[s.typeBadge, { backgroundColor: sc.bg }]}>
                            <Text style={[s.typeBadgeText, { color: sc.fg }]}>
                              {row.status === 'half_day' ? 'Half Day' : row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                            </Text>
                          </View>
                          {row.task ? <Text style={s.meta}>{row.task}</Text> : null}
                          {row.num_labourers ? <Text style={s.meta}>{row.num_labourers} workers</Text> : null}
                        </View>
                      </View>
                      <Text style={[s.amount, row.status === 'absent' && { color: C.outline }]}>
                        {row.status === 'absent' ? '—' : fmtCurrency(row.wage_earned)}
                      </Text>
                    </View>
                  );
                })}
              </>
            )}

            {/* Payment rows */}
            {(stmtType === 'payment' || stmtType === 'combined') && (
              <>
                <Text style={s.section}>
                  {stmtType === 'combined' ? 'Payment Records' : 'All Transactions'}
                  {payRows.length > 0 ? ` · ${payRows.length} entries` : ''}
                </Text>
                {payRows.length === 0 ? (
                  <Text style={s.meta}>No payment records for this period.</Text>
                ) : payRows.map((row, i) => {
                  const pc = PAYMENT_TYPE_COLORS[row.type] ?? PAYMENT_TYPE_COLORS.borrowed;
                  return (
                    <View key={`p-${row.date}-${i}`} style={s.line}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={s.name}>{fmtDate(row.date)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <View style={[s.typeBadge, { backgroundColor: pc.bg }]}>
                            <Text style={[s.typeBadgeText, { color: pc.fg }]}>
                              {row.type === 'credit' ? 'Wage' : 'Advance'}
                            </Text>
                          </View>
                          <Text style={s.meta}>{row.description}</Text>
                        </View>
                      </View>
                      <Text style={[s.amount, { color: row.type === 'credit' ? C.primary : C.error }]}>
                        {row.type === 'credit' ? '+' : '−'}{fmtCurrency(row.amount)}
                      </Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, accent && { color: C.tertiary }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  backBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.primary },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, marginBottom: 4, paddingHorizontal: 12, height: 44, backgroundColor: C.surfaceLowest, borderRadius: R.md, borderWidth: 1, borderColor: C.outlineVariant },
  searchInput: { flex: 1, fontSize: 14, color: C.onSurface },

  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chip: { flex: 1, height: 36, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceHigh },
  chipOn: { backgroundColor: C.primary },
  chipText: { fontWeight: '700', color: C.onSurfaceVariant },
  chipTextOn: { color: C.onPrimary },

  typeRow: { flexDirection: 'row', gap: 6, padding: 12, paddingBottom: 4 },
  typeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: R.md, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.outlineVariant },
  typeChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  typeChipText: { fontSize: 12, fontWeight: '700', color: C.onSurfaceVariant },
  typeChipTextOn: { color: C.onPrimary },

  presetRow: { gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.full, backgroundColor: C.surfaceHigh },
  presetChipOn: { backgroundColor: C.primaryFixed },
  presetText: { fontSize: 12, fontWeight: '600', color: C.onSurfaceVariant },
  presetTextOn: { color: C.primary, fontWeight: '700' },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLowest, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: C.outlineVariant },
  name: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  meta: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 1 },
  chevron: { fontSize: 22, color: C.outline },

  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  empty: { fontSize: 15, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  retry: { marginTop: 12, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: C.onPrimary, fontWeight: '700' },

  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, backgroundColor: C.surfaceLowest, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.outlineVariant },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant },
  kpiValue: { fontSize: 14, fontWeight: '800', color: C.primary, marginTop: 2 },

  stripRow: { flexDirection: 'row', backgroundColor: C.surfaceLowest, borderRadius: R.md, borderWidth: 1, borderColor: C.outlineVariant, overflow: 'hidden' },
  stripCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  stripDivider: { width: 1, backgroundColor: C.outlineVariant },
  stripNum: { fontSize: 18, fontWeight: '800', color: C.primary },
  stripLabel: { fontSize: 10, fontWeight: '600', color: C.onSurfaceVariant, marginTop: 1 },

  section: { fontSize: 13, fontWeight: '800', color: C.onSurfaceVariant, marginTop: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceLowest, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.outlineVariant },
  typeBadge: { borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, fontWeight: '800' },
  amount: { fontSize: 14, fontWeight: '700', color: C.onSurface },
});
