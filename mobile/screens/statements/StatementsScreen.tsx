import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { apiGet } from '../../lib/api';
import { C, R, fmtCurrency, todayISO, AVATAR_COLORS, initials } from '../../lib/theme';
import { MoreStackParamList } from '../details/types';

type ListProps = NativeStackScreenProps<MoreStackParamList, 'Statements'>;
type DetailProps = NativeStackScreenProps<MoreStackParamList, 'StatementDetail'>;

type StatementType = 'combined' | 'work' | 'payment';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatementEntity {
  id: string;
  name: string;
  entity_type: string;
  daily_wage: number;
  hometown?: string | null;
}

interface EntityInfo {
  id: string;
  name: string;
  entity_type: string;
  daily_wage: number;
  hometown?: string | null;
  phone?: string | null;
  aadhaar?: string | null;
  car_rent?: number | null;
  manager_fee?: number | null;
  member_count?: number | null;
}

interface WorkRow {
  date: string;
  status: string;
  task?: string | null;
  wage_earned: number;
  num_labourers?: number | null;
  hours_worked?: number | null;
  work_start_time?: string | null;
  work_end_time?: string | null;
}

interface PaymentRow {
  date: string;
  type: string;
  description: string;
  amount: number;
  method?: string | null;
  notes?: string | null;
}

interface Summary {
  total_days_present: number;
  total_days_absent: number;
  total_days_half: number;
  total_wage_earned: number;
  total_paid_borrowed: number;
  total_wage_credited: number;
  balance: number;
}

interface WorkStatement {
  entity: EntityInfo;
  summary: Summary;
  rows: WorkRow[];
  date_from: string;
  date_to: string;
}

interface PaymentStatement {
  entity: EntityInfo;
  summary: Summary;
  rows: PaymentRow[];
  date_from: string;
  date_to: string;
}

interface CombinedStatement {
  entity: EntityInfo;
  summary: Summary;
  work_rows: WorkRow[];
  payment_rows: PaymentRow[];
  date_from: string;
  date_to: string;
}

type AnyStatement = WorkStatement | PaymentStatement | CombinedStatement;

// ─── Date helpers ─────────────────────────────────────────────────────────────

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function fmtDateLabel(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}
function fmtCur(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

const DATE_PRESETS = [
  { label: 'This Month', get: () => ({ from: firstOfMonth(), to: todayISO() }) },
  {
    label: 'Last Month', get: () => {
      const d = new Date();
      return {
        from: new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10),
        to: new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10),
      };
    },
  },
  {
    label: 'Last 3M', get: () => {
      const d = new Date();
      return { from: new Date(d.getFullYear(), d.getMonth() - 3, 1).toISOString().slice(0, 10), to: todayISO() };
    },
  },
  { label: 'This Year', get: () => ({ from: `${new Date().getFullYear()}-01-01`, to: todayISO() }) },
  { label: 'All Time', get: () => ({ from: '', to: '' }) },
] as const;

// ─── Professional Statement HTML (standalone document) ───────────────────────

function generateStatementHTML(
  entity: EntityInfo,
  summary: Summary,
  workRows: WorkRow[],
  payRows: PaymentRow[],
  statementType: StatementType,
  dateFrom: string,
  dateTo: string,
): string {
  const typeLabel =
    statementType === 'work' ? 'Work Statement' :
    statementType === 'payment' ? 'Payment Statement' :
    'Combined Statement';

  const isTeam = entity.entity_type === 'team';
  const generatedOn = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const periodStr = `${dateFrom ? fmtDateLabel(dateFrom) : 'All time'} — ${dateTo ? fmtDateLabel(dateTo) : 'Today'}`;

  // ── Build ledger items ──────────────────────────────────────────────────────
  interface LedgerItem { date: string; isCredit: boolean; desc: string; amount: number; method?: string | null; isWork: boolean; }
  let ledgerItems: LedgerItem[] = [];

  if (statementType === 'payment') {
    payRows.forEach(r => ledgerItems.push({ date: r.date, isCredit: r.type === 'credit', desc: r.description, amount: r.amount, method: r.method, isWork: false }));
  } else if (statementType === 'combined') {
    workRows.filter(r => r.status !== 'absent').forEach(r =>
      ledgerItems.push({ date: r.date, isCredit: true, desc: `Daily Work${r.task ? ' — ' + r.task : ''}`, amount: r.wage_earned, method: null, isWork: true })
    );
    payRows.filter(r => r.type === 'borrowed').forEach(r =>
      ledgerItems.push({ date: r.date, isCredit: false, desc: r.description, amount: r.amount, method: r.method, isWork: false })
    );
  }
  ledgerItems.sort((a, b) => a.date.localeCompare(b.date));

  const totalCredited = ledgerItems.filter(r => r.isCredit).reduce((s, r) => s + r.amount, 0);
  const totalBorrowed = ledgerItems.filter(r => !r.isCredit).reduce((s, r) => s + r.amount, 0);
  const totalWorkWage = workRows.reduce((s, r) => s + r.wage_earned, 0);

  // ── Work table rows ─────────────────────────────────────────────────────────
  const workTableRows = workRows.map((r, i) => {
    const statusLabel = r.status === 'present' ? 'Present' : r.status === 'half_day' ? 'Half Day' : 'Absent';
    const statusColors: Record<string, [string,string]> = {
      present: ['#d1fae5','#065f46'], half_day: ['#fef3c7','#78350f'], absent: ['#fee2e2','#991b1b'],
    };
    const [sbg, sfg] = statusColors[r.status] ?? ['#f3f4f6','#374151'];
    const workerInfo = isTeam && r.num_labourers ? `${r.num_labourers} workers` : r.hours_worked ? `${r.hours_worked}h` : '';
    const rowBg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
    return `<tr style="background:${rowBg};">
      <td class="td">${fmtDateLabel(r.date)}</td>
      <td class="td"><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${sbg};color:${sfg};font-size:11px;font-weight:700;">${statusLabel}</span></td>
      <td class="td" style="color:#6b7280;">${r.task ?? '—'}</td>
      ${workerInfo ? `<td class="td tac">${workerInfo}</td>` : '<td class="td tac">—</td>'}
      <td class="td tar" style="font-weight:700;color:${r.status === 'absent' ? '#9ca3af' : '#059669'};">${r.status === 'absent' ? '—' : fmtCur(r.wage_earned)}</td>
    </tr>`;
  }).join('');

  // ── Ledger table rows ───────────────────────────────────────────────────────
  let runningBal = 0;
  const ledgerTableRows = ledgerItems.map((r, i) => {
    if (r.isCredit) runningBal += r.amount; else runningBal -= r.amount;
    const balColor = runningBal < 0 ? '#dc2626' : '#059669';
    const rowBg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
    const typePill = statementType === 'combined'
      ? (r.isWork
          ? `<span style="display:inline-block;padding:2px 7px;border-radius:4px;background:#d1fae5;color:#065f46;font-size:10px;font-weight:700;">Wage</span>`
          : `<span style="display:inline-block;padding:2px 7px;border-radius:4px;background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;">Adv</span>`)
      : '';
    const descExtra = r.method
      ? `<br><span style="font-size:10px;color:#9ca3af;text-transform:capitalize;">${r.method.replace(/_/g,' ')}</span>`
      : '';
    return `<tr style="background:${rowBg};">
      <td class="td" style="white-space:nowrap;">${fmtDateLabel(r.date)}</td>
      ${statementType === 'combined' ? `<td class="td tac">${typePill}</td>` : ''}
      <td class="td">${r.desc}${descExtra}</td>
      <td class="td tar" style="font-weight:700;color:#059669;">${r.isCredit ? '+' + fmtCur(r.amount) : '<span style="color:#9ca3af;">—</span>'}</td>
      <td class="td tar" style="font-weight:700;color:#dc2626;">${!r.isCredit ? '−' + fmtCur(r.amount) : '<span style="color:#9ca3af;">—</span>'}</td>
      <td class="td tar" style="font-weight:800;color:${balColor};">${fmtCur(Math.abs(runningBal))}${runningBal < 0 ? '<sup style="font-size:9px;"> Dr</sup>' : ''}</td>
    </tr>`;
  }).join('');

  const showWork = statementType === 'work' || statementType === 'combined';
  const showLedger = statementType === 'payment' || statementType === 'combined';
  const balColor = summary.balance < 0 ? '#dc2626' : summary.balance === 0 ? '#6b7280' : '#059669';
  const balNote = summary.balance < 0 ? 'Overpaid' : summary.balance === 0 ? 'Settled' : 'Pending';

  const workSection = !showWork ? '' : `
  <div class="section-label">${statementType === 'combined' ? 'Attendance Records' : 'Work Records'}</div>
  <table>
    <thead>
      <tr class="thead-row">
        <th class="th" style="width:100px;">Date</th>
        <th class="th" style="width:80px;">Status</th>
        <th class="th">Task / Notes</th>
        <th class="th tac" style="width:70px;">${isTeam ? 'Workers' : 'Hours'}</th>
        <th class="th tar" style="width:90px;">Wage Earned</th>
      </tr>
    </thead>
    <tbody>
      ${workRows.length === 0 ? `<tr><td colspan="5" style="padding:20px;text-align:center;color:#9ca3af;font-size:13px;">No work records for this period.</td></tr>` : workTableRows}
    </tbody>
    <tfoot>
      <tr class="tfoot-row">
        <td colspan="4" class="tf-label">Total Wage Earned</td>
        <td class="td tar tf-value">${fmtCur(totalWorkWage)}</td>
      </tr>
    </tfoot>
  </table>`;

  const ledgerSection = !showLedger ? '' : `
  <div class="section-label" style="margin-top:${showWork ? '28px' : '0'};">${statementType === 'combined' ? 'Payment Ledger' : 'Transaction Ledger'}</div>
  <table>
    <thead>
      <tr class="thead-row">
        <th class="th" style="width:100px;">Date</th>
        ${statementType === 'combined' ? `<th class="th tac" style="width:55px;">Type</th>` : ''}
        <th class="th">Description</th>
        <th class="th tar" style="width:90px;">Credited (+)</th>
        <th class="th tar" style="width:90px;">Borrowed (−)</th>
        <th class="th tar" style="width:90px;">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${ledgerItems.length === 0 ? `<tr><td colspan="${statementType === 'combined' ? 6 : 5}" style="padding:20px;text-align:center;color:#9ca3af;font-size:13px;">No transactions for this period.</td></tr>` : ledgerTableRows}
    </tbody>
    <tfoot>
      <tr class="tfoot-row">
        <td colspan="${statementType === 'combined' ? 3 : 2}" class="tf-label">Totals</td>
        <td class="td tar tf-value" style="color:#059669;">+${fmtCur(totalCredited)}</td>
        <td class="td tar tf-value" style="color:#dc2626;">−${fmtCur(totalBorrowed)}</td>
        <td class="td tar tf-value" style="color:${balColor};">${fmtCur(Math.abs(summary.balance))}</td>
      </tr>
    </tfoot>
  </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${typeLabel} — ${entity.name}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 14px; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    color: #111827;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page { size: A4; margin: 1.2cm 1.4cm; }
  @media print { body { margin: 0; } .no-print { display: none; } }

  /* ── Header band ── */
  .header {
    background: #0f2417;
    color: #fff;
    padding: 20px 28px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .brand { font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #86efac; margin-bottom: 4px; }
  .stmt-title { font-size: 22px; font-weight: 800; color: #fff; line-height: 1; }
  .stmt-meta { text-align: right; }
  .stmt-meta .period-label { font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: #86efac; }
  .stmt-meta .period-val { font-size: 13px; font-weight: 700; color: #fff; margin-top: 3px; }
  .stmt-meta .gen-date { font-size: 11px; color: #a7f3d0; margin-top: 6px; }

  /* ── Entity + period info strip ── */
  .info-strip {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    padding: 18px 28px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }
  .entity-block .entity-name { font-size: 17px; font-weight: 800; color: #111827; }
  .entity-block .entity-type { font-size: 11px; font-weight: 600; color: #6b7280; margin-top: 2px; text-transform: uppercase; letter-spacing: .05em; }
  .entity-details { display: flex; flex-wrap: wrap; gap: 6px 20px; margin-top: 10px; }
  .entity-detail { font-size: 12px; color: #374151; }
  .entity-detail span { color: #6b7280; margin-right: 4px; }
  .summary-pills { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .pill {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 6px 12px;
    text-align: center;
    min-width: 72px;
  }
  .pill .pnum { font-size: 15px; font-weight: 800; color: #111827; }
  .pill .plabel { font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .06em; margin-top: 1px; }
  .pill.green .pnum { color: #059669; }
  .pill.amber .pnum { color: #d97706; }
  .pill.red .pnum { color: #dc2626; }
  .pill.blue .pnum { color: #2563eb; }

  /* ── Content ── */
  .content { padding: 24px 28px 32px; }
  .section-label {
    font-size: 10px; font-weight: 800; color: #6b7280;
    text-transform: uppercase; letter-spacing: .1em;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 2px solid #0f2417;
  }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .thead-row { background: #1b4332; }
  .th {
    padding: 9px 12px;
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .07em;
    color: #a7f3d0;
    text-align: left;
    white-space: nowrap;
  }
  .td { padding: 8px 12px; font-size: 12px; color: #374151; border-bottom: 1px solid #f3f4f6; }
  .tac { text-align: center; }
  .tar { text-align: right; }
  .tfoot-row { background: #ecfdf5; border-top: 2px solid #1b4332; }
  .tf-label { padding: 10px 12px; font-size: 11px; font-weight: 800; color: #065f46; }
  .tf-value { padding: 10px 12px; font-size: 13px; font-weight: 800; color: #065f46; }

  /* ── Balance bar ── */
  .balance-bar {
    margin-top: 24px;
    background: #0f2417;
    color: #fff;
    padding: 14px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 6px;
  }
  .balance-bar .bl { font-size: 12px; font-weight: 600; color: #86efac; }
  .balance-bar .bv { font-size: 20px; font-weight: 900; }

  /* ── Footer ── */
  .footer {
    margin-top: 20px;
    padding: 14px 28px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #9ca3af;
  }
</style>
</head>
<body>

<!-- HEADER BAND -->
<div class="header">
  <div>
    <div class="brand">LabourBook</div>
    <div class="stmt-title">${typeLabel}</div>
  </div>
  <div class="stmt-meta">
    <div class="period-label">Period</div>
    <div class="period-val">${periodStr}</div>
    <div class="gen-date">Generated ${generatedOn}</div>
  </div>
</div>

<!-- ENTITY INFO + SUMMARY PILLS -->
<div class="info-strip">
  <div class="entity-block">
    <div class="entity-name">${entity.name}</div>
    <div class="entity-type">${isTeam ? 'Team' : 'Individual Labour'}</div>
    <div class="entity-details">
      <div class="entity-detail"><span>Wage:</span>${fmtCur(entity.daily_wage)}/day</div>
      ${entity.hometown ? `<div class="entity-detail"><span>Hometown:</span>${entity.hometown}</div>` : ''}
      ${entity.phone ? `<div class="entity-detail"><span>Phone:</span>${entity.phone}</div>` : ''}
      ${entity.car_rent ? `<div class="entity-detail"><span>Car Rent:</span>${fmtCur(entity.car_rent)}</div>` : ''}
      ${entity.manager_fee ? `<div class="entity-detail"><span>Mgr Fee:</span>${fmtCur(entity.manager_fee)}</div>` : ''}
      ${entity.member_count != null ? `<div class="entity-detail"><span>Members:</span>${entity.member_count}</div>` : ''}
    </div>
  </div>
  <div class="summary-pills">
    <div class="pill green"><div class="pnum">${summary.total_days_present}</div><div class="plabel">Present</div></div>
    <div class="pill amber"><div class="pnum">${summary.total_days_half}</div><div class="plabel">Half Day</div></div>
    <div class="pill red"><div class="pnum">${summary.total_days_absent}</div><div class="plabel">Absent</div></div>
    <div class="pill green"><div class="pnum">${fmtCur(summary.total_wage_earned)}</div><div class="plabel">Earned</div></div>
    <div class="pill red"><div class="pnum">${fmtCur(summary.total_paid_borrowed)}</div><div class="plabel">Paid</div></div>
  </div>
</div>

<!-- TABLES -->
<div class="content">
  ${workSection}
  ${ledgerSection}

  <!-- BALANCE BAR -->
  <div class="balance-bar">
    <div>
      <div class="bl">Closing Balance</div>
      <div style="font-size:11px;color:#86efac;margin-top:2px;">${balNote} · as of ${dateTo ? fmtDateLabel(dateTo) : 'today'}</div>
    </div>
    <div class="bv" style="color:${summary.balance < 0 ? '#fca5a5' : summary.balance === 0 ? '#a7f3d0' : '#a7f3d0'};">${fmtCur(Math.abs(summary.balance))}${summary.balance < 0 ? ' Dr' : ''}</div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer">
  <span>Computer generated document — no signature required.</span>
  <span>LabourBook · ${generatedOn}</span>
</div>

</body>
</html>`;
}

// ─── Status colours ───────────────────────────────────────────────────────────

const STATUS_C: Record<string, { bg: string; fg: string }> = {
  present: { bg: C.primaryFixed, fg: C.primary },
  half_day: { bg: '#fef3c7', fg: '#6b4c04' },
  absent: { bg: C.errorContainer, fg: C.error },
};

// ─── List Screen ──────────────────────────────────────────────────────────────

export function StatementsListScreen({ navigation }: ListProps) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<StatementEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    search === '' ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.hometown ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const labourShown = shown.filter(e => e.entity_type === 'individual');
  const teamShown = shown.filter(e => e.entity_type === 'team');

  return (
    <View style={[ls.root, { paddingTop: insets.top }]}>
      {/* Nav bar */}
      <View style={ls.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={ls.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={ls.title}>Statements</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Page header */}
      <View style={ls.pageHeader}>
        <Text style={ls.eyebrow}>STATEMENTS</Text>
        <Text style={ls.pageTitle}>Earnings & Ledger</Text>
        <Text style={ls.pageSub}>Select a labour or team to generate a statement.</Text>
      </View>

      {/* Search */}
      <View style={ls.searchRow}>
        <MaterialCommunityIcons name="magnify" size={18} color={C.outlineVariant} />
        <TextInput
          style={ls.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or hometown…"
          placeholderTextColor={C.outlineVariant}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={18} color={C.outlineVariant} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={ls.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : error ? (
        <View style={ls.centred}>
          <Text style={ls.empty}>{error}</Text>
          <TouchableOpacity style={ls.retry} onPress={load}><Text style={ls.retryText}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(e) => `${e.entity_type}-${e.id}`}
          contentContainerStyle={shown.length === 0 ? ls.centred : { padding: 14, gap: 8, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
          ListHeaderComponent={
            <>
              {labourShown.length > 0 && <Text style={ls.sectionLabel}>LABOURERS</Text>}
            </>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="account-search-outline" size={56} color={C.outlineVariant} />
              <Text style={ls.empty}>No results found.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const av = AVATAR_COLORS[index % AVATAR_COLORS.length];
            const isTeam = item.entity_type === 'team';
            const prevItem = shown[index - 1];
            const showTeamHeader = isTeam && (index === 0 || prevItem?.entity_type !== 'team');
            return (
              <>
                {showTeamHeader && <Text style={[ls.sectionLabel, { marginTop: labourShown.length > 0 ? 12 : 0 }]}>TEAMS</Text>}
                <TouchableOpacity
                  style={ls.entityCard}
                  onPress={() => navigation.navigate('StatementDetail', { entityType: item.entity_type, entityId: item.id, name: item.name })}
                  activeOpacity={0.75}
                >
                  <View style={[ls.avatar, { backgroundColor: av.bg }]}>
                    <Text style={[ls.avatarText, { color: av.fg }]}>{initials(item.name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={ls.entityName} numberOfLines={1}>{item.name}</Text>
                    <View style={ls.entityMeta}>
                      <View style={[ls.typeBadge, isTeam && ls.typeBadgeTeam]}>
                        <Text style={[ls.typeBadgeText, isTeam && ls.typeBadgeTextTeam]}>
                          {isTeam ? 'Team' : 'Labour'}
                        </Text>
                      </View>
                      {item.hometown ? <Text style={ls.metaText} numberOfLines={1}>{item.hometown}</Text> : null}
                    </View>
                    <Text style={ls.wageText}>₹{item.daily_wage}/day</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={C.outlineVariant} />
                </TouchableOpacity>
              </>
            );
          }}
        />
      )}
    </View>
  );
}

const ls = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: R.md },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.primary },

  pageHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  eyebrow: { fontSize: 10, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 1 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: C.onSurface, marginTop: 2 },
  pageSub: { fontSize: 13, color: C.onSurfaceVariant, marginTop: 2 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, marginTop: 10, marginBottom: 4, paddingHorizontal: 12, height: 44, backgroundColor: C.surfaceLowest, borderRadius: R.md, borderWidth: 1, borderColor: C.outlineVariant },
  searchInput: { flex: 1, fontSize: 14, color: C.onSurface },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 0.8, marginBottom: 6, paddingLeft: 2 },

  entityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surfaceLowest, borderRadius: R.xl, padding: 14, borderWidth: 1, borderColor: C.outlineVariant },
  avatar: { width: 44, height: 44, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  entityName: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  entityMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  typeBadge: { backgroundColor: C.primaryFixed, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeTeam: { backgroundColor: '#e8d5f7' },
  typeBadgeText: { fontSize: 9, fontWeight: '800', color: C.primary, letterSpacing: 0.3 },
  typeBadgeTextTeam: { color: '#3d1457' },
  metaText: { fontSize: 11, color: C.onSurfaceVariant },
  wageText: { fontSize: 11, fontWeight: '600', color: C.onSurfaceVariant, marginTop: 2 },

  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  empty: { fontSize: 15, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  retry: { marginTop: 8, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: C.onPrimary, fontWeight: '700' },
});

// ─── Month Picker ─────────────────────────────────────────────────────────────

function MonthPicker({ label, date, isEnd, onChange }: {
  label: string; date: string; isEnd: boolean; onChange: (date: string) => void;
}) {
  const today = new Date();
  const y = date ? parseInt(date.slice(0, 4)) : today.getFullYear();
  const m = date ? parseInt(date.slice(5, 7)) : today.getMonth() + 1;
  const displayStr = date
    ? new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : 'All time';

  function step(dir: 1 | -1) {
    const d = new Date(y, m - 1 + dir, 1);
    const ny = d.getFullYear();
    const nm = d.getMonth() + 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (isEnd) {
      const last = new Date(ny, nm, 0).getDate();
      onChange(`${ny}-${pad(nm)}-${pad(last)}`);
    } else {
      onChange(`${ny}-${pad(nm)}-01`);
    }
  }

  const canGoForward = new Date(y, m, 1) <= today;

  return (
    <View style={{ flex: 1 }}>
      <Text style={ds.inputLabel}>{label}</Text>
      <View style={ds.monthPickerRow}>
        <TouchableOpacity onPress={() => step(-1)} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={C.primary} />
        </TouchableOpacity>
        <Text style={ds.monthPickerLabel}>{displayStr}</Text>
        <TouchableOpacity onPress={() => step(1)} disabled={!canGoForward} hitSlop={8}
          style={{ opacity: canGoForward ? 1 : 0.3 }}>
          <MaterialCommunityIcons name="chevron-right" size={20} color={C.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Detail Screen ────────────────────────────────────────────────────────────

export function StatementDetailScreen({ route, navigation }: DetailProps) {
  const { entityType, entityId, name } = route.params;
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<'configure' | 'view'>('configure');
  const [stmtType, setStmtType] = useState<StatementType>('combined');
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [activePreset, setActivePreset] = useState<string>('This Month');

  const [data, setData] = useState<AnyStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const result = await apiGet<AnyStatement>(
        `/api/v1/statements/${stmtType}/${entityType}/${entityId}`,
        params
      );
      setData(result);
      setStep('view');
    } catch {
      setError('Could not load statement. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, stmtType, dateFrom, dateTo]);

  async function exportPDF() {
    if (!data) return;
    setExporting(true);
    try {
      const wRows: WorkRow[] = stmtType === 'combined'
        ? ((data as CombinedStatement).work_rows ?? [])
        : stmtType === 'work' ? ((data as WorkStatement).rows ?? []) : [];
      const pRows: PaymentRow[] = stmtType === 'combined'
        ? ((data as CombinedStatement).payment_rows ?? [])
        : stmtType === 'payment' ? ((data as PaymentStatement).rows ?? []) : [];

      const html = generateStatementHTML(data.entity, data.summary, wRows, pRows, stmtType, dateFrom, dateTo);

      if (Platform.OS === 'web') {
        // On web: open the statement HTML in a new tab so the browser prints it cleanly
        const win = (window as any).open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(html);
          win.document.close();
        } else {
          Alert.alert('Popup Blocked', 'Please allow popups to open the statement.');
        }
        return;
      }

      // Native: generate PDF file then share (works on both iOS and Android)
      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await Sharing.shareAsync(contentUri, { mimeType: 'application/pdf', dialogTitle: 'Share Statement' });
      } else {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err) ?? 'Unknown error';
      Alert.alert('PDF Error', msg);
    } finally {
      setExporting(false);
    }
  }

  // Derived rows
  const workRows: WorkRow[] = stmtType === 'combined'
    ? ((data as CombinedStatement)?.work_rows ?? [])
    : stmtType === 'work' ? ((data as WorkStatement)?.rows ?? []) : [];
  const payRows: PaymentRow[] = stmtType === 'combined'
    ? ((data as CombinedStatement)?.payment_rows ?? [])
    : stmtType === 'payment' ? ((data as PaymentStatement)?.rows ?? []) : [];
  const summary = data?.summary;
  const entity = data?.entity;

  // Running balance for ledger view
  interface LedgerViewRow { date: string; isCredit: boolean; desc: string; amount: number; method?: string | null; isWork: boolean; balance: number; }
  const ledgerRows: LedgerViewRow[] = (() => {
    if (stmtType === 'work') return [];
    const items: Array<{ date: string; isCredit: boolean; desc: string; amount: number; method?: string | null; isWork: boolean }> = [];
    if (stmtType === 'payment') {
      payRows.forEach(r => items.push({ date: r.date, isCredit: r.type === 'credit', desc: r.description, amount: r.amount, method: r.method, isWork: false }));
    } else {
      workRows.filter(r => r.status !== 'absent').forEach(r =>
        items.push({ date: r.date, isCredit: true, desc: `Daily Work${r.task ? ' — ' + r.task : ''}`, amount: r.wage_earned, method: null, isWork: true })
      );
      payRows.filter(r => r.type === 'borrowed').forEach(r =>
        items.push({ date: r.date, isCredit: false, desc: r.description, amount: r.amount, method: r.method, isWork: false })
      );
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    return items.map(r => {
      if (r.isCredit) bal += r.amount; else bal -= r.amount;
      return { ...r, balance: bal };
    });
  })();

  return (
    <View style={[ds.root, { paddingTop: insets.top }]}>
      {/* Nav bar */}
      <View style={ds.bar}>
        <TouchableOpacity
          onPress={() => step === 'view' ? setStep('configure') : navigation.goBack()}
          hitSlop={12}
          style={ds.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={ds.barTitle} numberOfLines={1}>{name}</Text>
        {step === 'view' && data ? (
          <TouchableOpacity onPress={exportPDF} disabled={exporting} style={ds.pdfBtn}>
            {exporting
              ? <ActivityIndicator size="small" color={C.onPrimary} />
              : <>
                  <MaterialCommunityIcons name="file-pdf-box" size={16} color={C.onPrimary} />
                  <Text style={ds.pdfBtnText}>PDF</Text>
                </>
            }
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* ── CONFIGURE STEP ── */}
      {step === 'configure' && (
        <ScrollView contentContainerStyle={[ds.configBody, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>

          {/* Entity strip */}
          <View style={ds.entityStrip}>
            <View style={[ds.entityAvatar, { backgroundColor: AVATAR_COLORS[0].bg }]}>
              <Text style={[ds.entityAvatarText, { color: AVATAR_COLORS[0].fg }]}>{initials(name)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={ds.entityStripName} numberOfLines={1}>{name}</Text>
              <Text style={ds.entityStripType}>{entityType === 'team' ? 'Team' : 'Individual Labour'}</Text>
            </View>
          </View>

          {/* Statement type */}
          <Text style={ds.sectionLabel}>STATEMENT TYPE</Text>
          <View style={ds.typeRow}>
            {([
              { key: 'combined' as StatementType, icon: 'text-box-multiple-outline', label: 'Combined', desc: 'Work + Payments ledger' },
              { key: 'work' as StatementType, icon: 'calendar-account-outline', label: 'Work', desc: 'Attendance & wages' },
              { key: 'payment' as StatementType, icon: 'wallet-outline', label: 'Payments', desc: 'Transactions only' },
            ]).map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[ds.typeCard, stmtType === opt.key && ds.typeCardOn]}
                onPress={() => setStmtType(opt.key)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name={opt.icon as any} size={22} color={stmtType === opt.key ? C.onPrimary : C.onSurfaceVariant} />
                <Text style={[ds.typeCardLabel, stmtType === opt.key && ds.typeCardLabelOn]}>{opt.label}</Text>
                <Text style={[ds.typeCardDesc, stmtType === opt.key && ds.typeCardDescOn]}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date presets */}
          <Text style={ds.sectionLabel}>DATE RANGE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
            {DATE_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.label}
                style={[ds.presetChip, activePreset === p.label && ds.presetChipOn]}
                onPress={() => { setActivePreset(p.label); const r = p.get(); setDateFrom(r.from); setDateTo(r.to); }}
              >
                <Text style={[ds.presetText, activePreset === p.label && ds.presetTextOn]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Date inputs */}
          <View style={ds.dateRow}>
            <MonthPicker label="FROM" date={dateFrom} isEnd={false} onChange={v => { setDateFrom(v); setActivePreset(''); }} />
            <MonthPicker label="TO" date={dateTo} isEnd={true} onChange={v => { setDateTo(v); setActivePreset(''); }} />
          </View>

          {error && (
            <View style={ds.errorBox}><Text style={ds.errorText}>{error}</Text></View>
          )}

          {/* Generate button */}
          <TouchableOpacity style={[ds.generateBtn, loading && { opacity: 0.65 }]} onPress={generate} disabled={loading}>
            {loading
              ? <ActivityIndicator color={C.onPrimary} />
              : <>
                  <MaterialCommunityIcons name="receipt" size={20} color={C.onPrimary} />
                  <Text style={ds.generateBtnText}>Generate Statement</Text>
                </>
            }
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── VIEW STEP ── */}
      {step === 'view' && data && summary && entity && (
        <ScrollView contentContainerStyle={[ds.viewBody, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>

          {/* Entity info card */}
          <View style={ds.infoCard}>
            <View style={ds.infoHeader}>
              <View style={{ flex: 1 }}>
                <Text style={ds.infoEyebrow}>
                  {stmtType === 'work' ? 'WORK STATEMENT' : stmtType === 'payment' ? 'PAYMENT STATEMENT' : 'COMBINED STATEMENT'}
                </Text>
                <Text style={ds.infoName}>{entity.name}</Text>
                <Text style={ds.infoType}>{entity.entity_type === 'team' ? 'Team' : 'Individual Labour'}</Text>
              </View>
              <View style={ds.periodBox}>
                <Text style={ds.periodLabel}>PERIOD</Text>
                <Text style={ds.periodVal}>{dateFrom ? fmtDateLabel(dateFrom) : 'All'}</Text>
                <Text style={ds.periodTo}>to</Text>
                <Text style={ds.periodVal}>{dateTo ? fmtDateLabel(dateTo) : 'Today'}</Text>
              </View>
            </View>
            <View style={ds.infoDivider} />
            {/* Entity details */}
            {[
              entity.hometown ? ['Hometown', entity.hometown] : null,
              entity.phone ? ['Phone', entity.phone] : null,
              ['Daily Wage', fmtCurrency(entity.daily_wage) + '/day'],
              entity.car_rent ? ['Car Rent', fmtCurrency(entity.car_rent)] : null,
              entity.manager_fee ? ['Manager Fee', fmtCurrency(entity.manager_fee)] : null,
              entity.member_count != null ? ['Members', String(entity.member_count)] : null,
            ].filter((r): r is [string, string] => r !== null).map(([label, val]) => (
              <View key={label as string} style={ds.infoRow}>
                <Text style={ds.infoRowLabel}>{label}</Text>
                <Text style={ds.infoRowVal}>{val}</Text>
              </View>
            ))}
          </View>

          {/* Summary strip */}
          <View style={ds.summaryCard}>
            <View style={ds.sumCell}>
              <Text style={ds.sumNum}>{summary.total_days_present}</Text>
              <Text style={ds.sumLabel}>Present</Text>
            </View>
            <View style={ds.sumDiv} />
            <View style={ds.sumCell}>
              <Text style={[ds.sumNum, { color: '#6b4c04' }]}>{summary.total_days_half}</Text>
              <Text style={ds.sumLabel}>Half</Text>
            </View>
            <View style={ds.sumDiv} />
            <View style={ds.sumCell}>
              <Text style={[ds.sumNum, { color: C.error }]}>{summary.total_days_absent}</Text>
              <Text style={ds.sumLabel}>Absent</Text>
            </View>
            <View style={ds.sumDiv} />
            <View style={ds.sumCell}>
              <Text style={ds.sumNum}>{fmtCurrency(summary.total_wage_earned)}</Text>
              <Text style={ds.sumLabel}>Earned</Text>
            </View>
            <View style={ds.sumDiv} />
            <View style={ds.sumCell}>
              <Text style={[ds.sumNum, { color: C.error }]}>{fmtCurrency(summary.total_paid_borrowed)}</Text>
              <Text style={ds.sumLabel}>Paid</Text>
            </View>
            <View style={ds.sumDiv} />
            <View style={ds.sumCell}>
              <Text style={[ds.sumNum, { color: summary.balance > 0 ? C.primary : C.error }]}>{fmtCurrency(Math.abs(summary.balance))}</Text>
              <Text style={ds.sumLabel}>{summary.balance < 0 ? 'Overpaid' : summary.balance === 0 ? 'Settled' : 'Pending'}</Text>
            </View>
          </View>

          {/* Work rows */}
          {(stmtType === 'work' || stmtType === 'combined') && (
            <>
              <Text style={ds.tableSection}>
                {stmtType === 'combined' ? 'ATTENDANCE RECORDS' : 'WORK RECORDS'}
                <Text style={{ fontWeight: '400', fontSize: 11 }}>  {workRows.length} entries</Text>
              </Text>
              {workRows.length === 0 ? (
                <Text style={ds.emptyNote}>No work records for this period.</Text>
              ) : (
                <View style={ds.table}>
                  {/* Header */}
                  <View style={ds.thead}>
                    <Text style={[ds.th, { flex: 1 }]}>DATE</Text>
                    <Text style={[ds.th, { width: 64 }]}>STATUS</Text>
                    <Text style={[ds.th, { flex: 1 }]}>TASK</Text>
                    <Text style={[ds.th, { width: 64, textAlign: 'right' }]}>WAGE</Text>
                  </View>
                  {workRows.map((r, i) => {
                    const sc = STATUS_C[r.status] ?? STATUS_C.present;
                    const isLast = i === workRows.length - 1;
                    return (
                      <View key={`w-${r.date}-${i}`} style={[ds.tr, isLast && ds.trLast]}>
                        <Text style={[ds.td, { flex: 1 }]}>{fmtDateLabel(r.date)}</Text>
                        <View style={{ width: 64 }}>
                          <View style={[ds.badge, { backgroundColor: sc.bg }]}>
                            <Text style={[ds.badgeText, { color: sc.fg }]}>{r.status === 'half_day' ? 'Half' : r.status === 'present' ? 'Pres' : 'Abs'}</Text>
                          </View>
                        </View>
                        <Text style={[ds.td, { flex: 1 }]} numberOfLines={1}>{r.task ?? '—'}</Text>
                        <Text style={[ds.td, { width: 64, textAlign: 'right', color: r.status === 'absent' ? C.outlineVariant : C.primary, fontWeight: '700' }]}>
                          {r.status === 'absent' ? '—' : fmtCurrency(r.wage_earned)}
                        </Text>
                      </View>
                    );
                  })}
                  {/* Footer total */}
                  <View style={ds.tfoot}>
                    <Text style={[ds.tfLabel, { flex: 1 }]}>TOTAL EARNED</Text>
                    <Text style={ds.tfValue}>{fmtCurrency(workRows.reduce((s, r) => s + r.wage_earned, 0))}</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Ledger rows */}
          {(stmtType === 'payment' || stmtType === 'combined') && (
            <>
              <Text style={ds.tableSection}>
                {stmtType === 'combined' ? 'PAYMENT LEDGER' : 'ALL TRANSACTIONS'}
                <Text style={{ fontWeight: '400', fontSize: 11 }}>  {ledgerRows.length} entries</Text>
              </Text>
              {ledgerRows.length === 0 ? (
                <Text style={ds.emptyNote}>No payment records for this period.</Text>
              ) : (
                <View style={ds.table}>
                  <View style={ds.thead}>
                    <Text style={[ds.th, { flex: 1 }]}>DATE / DESC</Text>
                    {stmtType === 'combined' && <Text style={[ds.th, { width: 52 }]}>TYPE</Text>}
                    <Text style={[ds.th, { width: 68, textAlign: 'right' }]}>+ CREDIT</Text>
                    <Text style={[ds.th, { width: 68, textAlign: 'right' }]}>− DEBIT</Text>
                    <Text style={[ds.th, { width: 72, textAlign: 'right' }]}>BAL</Text>
                  </View>
                  {ledgerRows.map((r, i) => {
                    const isLast = i === ledgerRows.length - 1;
                    const balColor = r.balance < 0 ? C.error : C.primary;
                    return (
                      <View key={`l-${r.date}-${i}`} style={[ds.tr, isLast && ds.trLast]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[ds.td, { marginBottom: 1 }]}>{fmtDateLabel(r.date)}</Text>
                          <Text style={[ds.td, { fontSize: 11, color: C.onSurfaceVariant }]} numberOfLines={1}>{r.desc}</Text>
                          {r.method ? <Text style={[ds.td, { fontSize: 10, color: C.outlineVariant }]}>{r.method.replace(/_/g, ' ')}</Text> : null}
                        </View>
                        {stmtType === 'combined' && (
                          <View style={{ width: 52, alignItems: 'flex-start', paddingTop: 2 }}>
                            <View style={[ds.badge, r.isWork ? { backgroundColor: C.primaryFixed } : { backgroundColor: C.errorContainer }]}>
                              <Text style={[ds.badgeText, r.isWork ? { color: C.primary } : { color: C.error }]}>
                                {r.isWork ? 'Wage' : 'Adv'}
                              </Text>
                            </View>
                          </View>
                        )}
                        <Text style={[ds.td, { width: 68, textAlign: 'right', color: '#166534', fontWeight: '700' }]}>
                          {r.isCredit ? '+' + fmtCurrency(r.amount) : '—'}
                        </Text>
                        <Text style={[ds.td, { width: 68, textAlign: 'right', color: C.error, fontWeight: '700' }]}>
                          {!r.isCredit ? '−' + fmtCurrency(r.amount) : '—'}
                        </Text>
                        <Text style={[ds.td, { width: 72, textAlign: 'right', fontWeight: '800', color: balColor }]}>
                          {fmtCurrency(Math.abs(r.balance))}{r.balance < 0 ? ' Dr' : ''}
                        </Text>
                      </View>
                    );
                  })}
                  {/* Totals row */}
                  <View style={ds.tfoot}>
                    <Text style={[ds.tfLabel, { flex: 1 }]}>TOTALS</Text>
                    {stmtType === 'combined' && <View style={{ width: 52 }} />}
                    <Text style={[ds.td, { width: 68, textAlign: 'right', fontWeight: '800', color: '#166534' }]}>
                      +{fmtCurrency(ledgerRows.filter(r => r.isCredit).reduce((s, r) => s + r.amount, 0))}
                    </Text>
                    <Text style={[ds.td, { width: 68, textAlign: 'right', fontWeight: '800', color: C.error }]}>
                      −{fmtCurrency(ledgerRows.filter(r => !r.isCredit).reduce((s, r) => s + r.amount, 0))}
                    </Text>
                    <Text style={[ds.tfValue, { width: 72, color: summary.balance >= 0 ? C.primary : C.error }]}>
                      {fmtCurrency(Math.abs(summary.balance))}
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Download PDF button */}
          <TouchableOpacity style={[ds.downloadBtn, exporting && { opacity: 0.65 }]} onPress={exportPDF} disabled={exporting}>
            {exporting
              ? <ActivityIndicator color={C.onPrimary} />
              : <>
                  <MaterialCommunityIcons name="file-pdf-box" size={22} color={C.onPrimary} />
                  <Text style={ds.downloadBtnText}>Download PDF Statement</Text>
                </>
            }
          </TouchableOpacity>

          {/* Adjust filters */}
          <TouchableOpacity style={ds.adjustBtn} onPress={() => setStep('configure')}>
            <MaterialCommunityIcons name="tune" size={16} color={C.primary} />
            <Text style={ds.adjustBtnText}>Adjust Filters</Text>
          </TouchableOpacity>

          <Text style={ds.footerNote}>Computer generated document. No signature required.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const ds = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: R.md },
  barTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.primary, paddingHorizontal: 4 },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 6 },
  pdfBtnText: { fontSize: 13, fontWeight: '700', color: C.onPrimary },

  // Config step
  configBody: { padding: 16, gap: 10 },

  entityStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surfaceLowest, borderRadius: R.xl, padding: 14, borderWidth: 1, borderColor: C.outlineVariant, marginBottom: 4 },
  entityAvatar: { width: 44, height: 44, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  entityAvatarText: { fontSize: 15, fontWeight: '800' },
  entityStripName: { fontSize: 16, fontWeight: '700', color: C.onSurface },
  entityStripType: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 0.8, marginTop: 6, marginBottom: 8 },

  typeRow: { flexDirection: 'row', gap: 8 },
  typeCard: { flex: 1, borderWidth: 1.5, borderColor: C.outlineVariant, borderRadius: R.lg, padding: 12, alignItems: 'center', gap: 4, backgroundColor: C.surfaceLowest },
  typeCardOn: { borderColor: C.primary, backgroundColor: C.primaryContainer },
  typeCardLabel: { fontSize: 12, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  typeCardLabelOn: { color: C.onPrimary },
  typeCardDesc: { fontSize: 9, color: C.onSurfaceVariant, textAlign: 'center', lineHeight: 12 },
  typeCardDescOn: { color: C.primaryFixed },

  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.full, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.outlineVariant },
  presetChipOn: { backgroundColor: C.primaryFixed, borderColor: C.primaryFixed },
  presetText: { fontSize: 12, fontWeight: '600', color: C.onSurfaceVariant },
  presetTextOn: { color: C.primary, fontWeight: '700' },

  dateRow: { flexDirection: 'row', gap: 10 },
  inputLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.4, marginBottom: 4 },
  dateInput: { borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.onSurface, backgroundColor: C.surfaceLowest },
  monthPickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surfaceLowest, borderRadius: R.md, paddingHorizontal: 10, height: 46, borderWidth: 1, borderColor: C.outlineVariant },
  monthPickerLabel: { fontSize: 13, fontWeight: '700', color: C.onSurface, flex: 1, textAlign: 'center' },

  errorBox: { backgroundColor: C.errorContainer, borderRadius: R.md, padding: 12 },
  errorText: { color: C.error, fontSize: 13, fontWeight: '600' },

  generateBtn: { height: 52, backgroundColor: C.primary, borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  generateBtnText: { color: C.onPrimary, fontWeight: '800', fontSize: 16 },

  // View step
  viewBody: { padding: 14, gap: 14 },

  infoCard: { backgroundColor: C.surfaceLowest, borderRadius: R.xl, borderWidth: 1, borderColor: C.outlineVariant, padding: 16, gap: 8 },
  infoHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoEyebrow: { fontSize: 9, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 0.8 },
  infoName: { fontSize: 20, fontWeight: '800', color: C.primary, marginTop: 2 },
  infoType: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },
  infoDivider: { height: 3, backgroundColor: C.primaryContainer, borderRadius: 2, marginVertical: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoRowLabel: { fontSize: 12, color: C.onSurfaceVariant },
  infoRowVal: { fontSize: 12, fontWeight: '600', color: C.onSurface },

  periodBox: { alignItems: 'flex-end' },
  periodLabel: { fontSize: 9, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5 },
  periodVal: { fontSize: 12, fontWeight: '700', color: C.onSurface },
  periodTo: { fontSize: 10, color: C.onSurfaceVariant },

  summaryCard: { flexDirection: 'row', backgroundColor: C.surfaceLowest, borderRadius: R.xl, borderWidth: 1, borderColor: C.outlineVariant, paddingVertical: 12 },
  sumCell: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  sumDiv: { width: 1, backgroundColor: C.outlineVariant },
  sumNum: { fontSize: 12, fontWeight: '800', color: C.primary },
  sumLabel: { fontSize: 9, fontWeight: '600', color: C.onSurfaceVariant, marginTop: 2, textAlign: 'center' },

  tableSection: { fontSize: 11, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 0.5, marginTop: 4 },
  emptyNote: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center', padding: 20 },

  table: { backgroundColor: C.surfaceLowest, borderRadius: R.xl, borderWidth: 1, borderColor: C.outlineVariant, overflow: 'hidden' },
  thead: { flexDirection: 'row', backgroundColor: C.primaryContainer, paddingHorizontal: 12, paddingVertical: 10 },
  th: { fontSize: 9, fontWeight: '800', color: C.onPrimary, letterSpacing: 0.5 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  trLast: {},
  td: { fontSize: 12, color: C.onSurface },
  badge: { borderRadius: R.full, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 9, fontWeight: '800' },
  tfoot: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 2, borderTopColor: C.primaryContainer },
  tfLabel: { fontSize: 11, fontWeight: '800', color: C.primary },
  tfValue: { fontSize: 13, fontWeight: '800', color: C.primary, textAlign: 'right' },

  downloadBtn: { height: 52, backgroundColor: C.primary, borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6 },
  downloadBtnText: { color: C.onPrimary, fontWeight: '800', fontSize: 15 },

  adjustBtn: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.outlineVariant, borderRadius: R.lg, backgroundColor: C.surfaceLowest },
  adjustBtnText: { fontSize: 14, fontWeight: '600', color: C.primary },

  footerNote: { textAlign: 'center', fontSize: 11, color: C.outlineVariant, marginTop: 4 },
});
