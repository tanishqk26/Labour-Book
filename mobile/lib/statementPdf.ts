/**
 * Data types + printable HTML for every downloadable statement.
 * HTML is turned into a PDF with expo-print (native) or opened for printing (web).
 */
import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { TranslationKey } from './i18n';
import { catLabelKey, farmYearLabel, TxnKind } from './expenseMeta';

type T = (k: TranslationKey) => string;

// ─── API shapes ───────────────────────────────────────────────────────────────

export interface StPeriod { year: number | null; date_from: string; date_to: string }
export interface StEntity {
  id: string; name: string; entity_type: string; daily_wage: number;
  hometown?: string | null; phone?: string | null;
  car_rent?: number | null; manager_fee?: number | null; member_count?: number | null;
}

export interface WorkDay {
  date: string; status: 'present' | 'half_day' | 'absent'; task: string | null;
  work_start_time: string | null; work_end_time: string | null; hours_worked: number | null;
  num_labourers: number | null; on_contract: boolean;
}
export interface WorkStatement {
  entity: StEntity; period: StPeriod; rows: WorkDay[];
  summary: { days_present: number; days_half: number; days_absent: number; days_worked: number; labour_days: number | null };
}

export interface EarnItem { kind: 'wage' | 'half_wage' | 'contract'; label: string; amount: number; num_labourers: number | null }
export interface PaidItem { amount: number; method: string; notes: string | null }
export interface PayDay { date: string; earned: number; paid: number; balance: number; earn_items: EarnItem[]; paid_items: PaidItem[] }
export interface PayWeek { week_start: string; week_end: string; earned: number; paid: number; closing_balance: number }
export interface PayStatement {
  entity: StEntity; period: StPeriod; rows: PayDay[]; weeks: PayWeek[];
  summary: {
    opening_balance: number; wages_earned: number; contract_earned: number; total_earned: number;
    total_paid: number; closing_balance: number; days_worked: number;
  };
}

export interface OpRow {
  id: string; date: string; season: number; plot_name: string; stage: string | null; category: string;
  notes: string | null; products: { name: string; dose: string | null }[]; workers: string[]; cost: number | null;
}
export interface OperationsReport {
  period: StPeriod; plot_name: string | null; rows: OpRow[]; total: number;
  by_category: { name: string; count: number }[]; by_plot: { name: string; count: number }[];
  products: { name: string; times: number; plots: string[] }[]; linked_cost: number;
}

export interface ExpenseRow {
  id: string; date: string; kind: TxnKind; category: string; plot_name: string | null; party: string | null;
  description: string | null; amount: number | null; amount_paid: number; balance: number | null; status: string;
}
export interface ExpenseReport {
  period: StPeriod; plot_name: string | null; rows: ExpenseRow[];
  income: number; expense: number; profit: number; unpriced_count: number; you_owe: number; owed_to_you: number;
  by_category: { kind: TxnKind; category: string; total: number; count: number; unpriced_count: number }[];
  by_plot: { plot_name: string | null; income: number; expense: number; profit: number }[];
}

export interface ContractRow {
  id: string; plot_id: string | null; title: string; description: string | null; entity_type: string; entity_name: string | null;
  plot_name: string | null; size_acres: number | null; amount_per_acre: number | null; amount: number;
  assigned_date: string; completed_date: string | null; status: string;
}
export interface ContractsReport {
  period: StPeriod; plot_name: string | null; rows: ContractRow[]; total_count: number; total_value: number;
  by_plot: { plot_id: string | null; plot_name: string | null; size_acres: number | null; count: number; total_value: number }[];
  by_status: { status: string; count: number; amount: number }[];
}

// ─── Shared helpers (also used by the on-screen preview) ──────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtD(iso: string, withDay = false): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const base = `${d} ${MONTHS[m - 1]} ${y}`;
  return withDay ? `${DAYS[new Date(y, m - 1, d).getDay()]}, ${base}` : base;
}
export function fmtShort(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
export function periodLabel(p: StPeriod, t: T): string {
  if (p.year != null) return `${t('st_season')} ${farmYearLabel(p.year)} (${fmtD(p.date_from)} – ${fmtD(p.date_to)})`;
  if (!p.date_from && !p.date_to) return t('st_all_time');
  return `${p.date_from ? fmtD(p.date_from) : '…'} – ${p.date_to ? fmtD(p.date_to) : '…'}`;
}
export const OP_CAT_KEY: Record<string, TranslationKey> = {
  Spraying: 'spraying', Fertigation: 'fertigation', 'Labour Work': 'labour_work', Other: 'other',
};
export function opCatLabel(cat: string, t: T): string {
  return OP_CAT_KEY[cat] ? t(OP_CAT_KEY[cat]) : cat;
}
export function stageLabel(stage: string | null, t: T): string {
  if (stage === 'vegetative') return t('stage_vegetative');
  if (stage === 'fruit_production') return t('stage_fruit');
  return '';
}
export function statusLabel(s: string, t: T): string {
  return t(s === 'present' ? 'present' : s === 'half_day' ? 'half_day' : 'absent');
}
export function methodLabel(m: string, t: T): string {
  return t(m === 'cash' ? 'st_cash' : m === 'upi' ? 'st_upi' : m === 'bank_transfer' ? 'st_bank' : 'st_method_other');
}
export function txnStatusLabel(s: string, t: T): string {
  return t(s === 'paid' ? 'st_status_paid' : s === 'credit' ? 'st_status_credit' : s === 'partial' ? 'st_status_partial' : 'exp_price_pending');
}
export function contractStatusLabel(s: string, t: T): string {
  return t(s === 'completed' ? 'st_completed' : s === 'cancelled' ? 'st_cancelled' : 'st_active');
}
/** + = still to pay, − = paid in advance */
export function balanceText(b: number, t: T): string {
  if (Math.round(b) === 0) return t('st_settled');
  return b > 0 ? `${inr(b)} ${t('st_balance_due')}` : `${inr(-b)} ${t('st_advance')}`;
}

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ─── Document shell ───────────────────────────────────────────────────────────

interface Pill { value: string; label: string; tone?: 'green' | 'red' | 'amber' | '' }

function shell(opts: {
  t: T; title: string; period: StPeriod; heading: string; subheading?: string; details?: string[];
  pills: Pill[]; body: string; landscape?: boolean; closing?: { label: string; value: string; note?: string; negative?: boolean };
}): string {
  const { t } = opts;
  const now = new Date();
  const generated = fmtD(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.title)} — ${esc(opts.heading)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',Roboto,'Noto Sans','Noto Sans Devanagari',Arial,sans-serif;color:#1b1c1c;background:#fff;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4 ${opts.landscape ? 'landscape' : 'portrait'};margin:1cm 1.1cm}
.header{background:#012d1d;color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
.brand{font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#c1ecd4;margin-bottom:4px}
.title{font-size:21px;font-weight:800}
.meta{text-align:right}.meta .l{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#c1ecd4}
.meta .v{font-size:12px;font-weight:700;margin-top:2px}.meta .g{font-size:10px;color:#a5d0b9;margin-top:5px}
.strip{display:flex;justify-content:space-between;gap:20px;padding:14px 24px;background:#fcf9f8;border-bottom:1px solid #e4e2e1;flex-wrap:wrap}
.name{font-size:17px;font-weight:800;color:#012d1d}.sub{font-size:10px;font-weight:700;color:#717973;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.dets{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:8px;font-size:11px;color:#414844}
.pills{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:flex-start}
.pill{border:1px solid #e4e2e1;border-radius:6px;padding:6px 12px;text-align:center;min-width:78px;background:#fff}
.pill .n{font-size:15px;font-weight:800}.pill .k{font-size:9px;font-weight:700;color:#717973;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.pill.green .n{color:#1b6b3a}.pill.red .n{color:#ba1a1a}.pill.amber .n{color:#8a5a00}
.content{padding:18px 24px 8px}
.sec{font-size:10px;font-weight:800;color:#414844;text-transform:uppercase;letter-spacing:.1em;margin:18px 0 8px;padding-bottom:5px;border-bottom:2px solid #012d1d}
.sec:first-child{margin-top:0}
.note+.sec,table+.sec{margin-top:26px}
table{width:100%;border-collapse:collapse}
thead tr{background:#1b4332}
th{padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#c1ecd4;text-align:left}
td{padding:6px 8px;font-size:11px;border-bottom:1px solid #f0eded;vertical-align:top}
tr{page-break-inside:avoid}
tbody tr:nth-child(even) td{background:#fcfbfa}
.r{text-align:right}.c{text-align:center}.nw{white-space:nowrap}.mut{color:#717973}.b{font-weight:700}
.pos{color:#1b6b3a;font-weight:700}.neg{color:#ba1a1a;font-weight:700}
.tag{display:inline-block;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:700}
.t-present{background:#c1ecd4;color:#012d1d}.t-half_day{background:#fef3c7;color:#6b4c04}.t-absent{background:#ffdad6;color:#ba1a1a}
.wk td{background:#eaf4ee !important;font-weight:800;color:#012d1d;border-top:1px solid #a5d0b9}
.wkh td{background:#f6f3f2 !important;font-size:10px;font-weight:800;color:#414844;text-transform:uppercase;letter-spacing:.05em}
.open td{background:#fff8e6 !important;font-weight:700}
tfoot td{background:#eaf4ee;font-weight:800;color:#012d1d;border-top:2px solid #1b4332}
.empty{padding:22px;text-align:center;color:#717973}
.note{font-size:10px;color:#717973;margin-top:8px}
.close{margin:18px 24px 0;background:#012d1d;color:#fff;padding:12px 20px;border-radius:6px;display:flex;justify-content:space-between;align-items:center}
.close .l{font-size:12px;font-weight:700;color:#c1ecd4}.close .s{font-size:10px;color:#a5d0b9;margin-top:2px}.close .v{font-size:19px;font-weight:900}
.footer{margin:18px 24px 0;padding-top:10px;border-top:1px solid #e4e2e1;display:flex;justify-content:space-between;font-size:9px;color:#9aa19c}
</style></head><body>
<div class="header">
  <div><div class="brand">KhetKitab</div><div class="title">${esc(opts.title)}</div></div>
  <div class="meta"><div class="l">${esc(t('st_period'))}</div><div class="v">${esc(periodLabel(opts.period, t))}</div>
  <div class="g">${esc(t('st_generated'))} ${generated}</div></div>
</div>
<div class="strip">
  <div><div class="name">${esc(opts.heading)}</div>${opts.subheading ? `<div class="sub">${esc(opts.subheading)}</div>` : ''}
  ${opts.details?.length ? `<div class="dets">${opts.details.map((d) => `<span>${esc(d)}</span>`).join('')}</div>` : ''}</div>
  <div class="pills">${opts.pills.map((p) => `<div class="pill ${p.tone ?? ''}"><div class="n">${esc(p.value)}</div><div class="k">${esc(p.label)}</div></div>`).join('')}</div>
</div>
<div class="content">${opts.body}</div>
${opts.closing ? `<div class="close"><div><div class="l">${esc(opts.closing.label)}</div>${opts.closing.note ? `<div class="s">${esc(opts.closing.note)}</div>` : ''}</div>
<div class="v" style="color:${opts.closing.negative ? '#ffb4a8' : '#c1ecd4'}">${esc(opts.closing.value)}</div></div>` : ''}
<div class="footer"><span>${esc(t('st_footer'))}</span><span>${generated}</span></div>
</body></html>`;
}

const empty = (cols: number, t: T) => `<tr><td colspan="${cols}" class="empty">${esc(t('st_no_records'))}</td></tr>`;

function entityDetails(e: StEntity, t: T, withWage: boolean): string[] {
  const out: string[] = [];
  if (withWage) out.push(`${t('st_daily_wage')}: ${inr(e.daily_wage)}${t('st_per_day')}`);
  if (e.member_count != null) out.push(`${t('st_members')}: ${e.member_count}`);
  if (e.hometown) out.push(e.hometown);
  if (e.phone) out.push(e.phone);
  return out;
}
const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// ─── Labour: work ─────────────────────────────────────────────────────────────

function workParts(st: WorkStatement, t: T): { body: string; pills: Pill[] } {
  const isTeam = st.entity.entity_type === 'team';
  const s = st.summary;
  const rows = st.rows.map((r) => {
    const time = r.work_start_time && r.work_end_time ? `${r.work_start_time}–${r.work_end_time}` : r.hours_worked ? `${r.hours_worked}h` : '';
    const task = [r.task, r.on_contract ? t('st_contract_work') : ''].filter(Boolean).join(' · ');
    return `<tr>
      <td class="nw">${esc(fmtD(r.date, true))}</td>
      <td><span class="tag t-${r.status}">${esc(statusLabel(r.status, t))}</span></td>
      ${isTeam ? `<td class="c">${r.status === 'absent' ? '—' : r.num_labourers ?? '—'}</td>` : ''}
      <td>${esc(task) || '<span class="mut">—</span>'}</td>
      <td class="nw">${esc(time) || '<span class="mut">—</span>'}</td>
    </tr>`;
  }).join('');
  const cols = isTeam ? 5 : 4;
  const body = `<div class="sec">${esc(t('st_work'))} · ${st.rows.length} ${esc(t('st_entries'))}</div>
  <table><thead><tr><th style="width:120px">${esc(t('st_date'))}</th><th style="width:80px">${esc(t('st_status'))}</th>
  ${isTeam ? `<th class="c" style="width:60px">${esc(t('st_members'))}</th>` : ''}<th>${esc(t('st_task'))}</th><th style="width:90px">${esc(t('st_time'))}</th></tr></thead>
  <tbody>${rows || empty(cols, t)}</tbody>
  <tfoot><tr><td colspan="${cols - 1}">${esc(t('st_days_worked'))}</td><td>${fmtNum(s.days_worked)}</td></tr></tfoot></table>`;

  const pills: Pill[] = [
    { value: fmtNum(s.days_worked), label: t('st_days_worked'), tone: 'green' },
    { value: String(s.days_present), label: t('present'), tone: 'green' },
    { value: String(s.days_half), label: t('half_day'), tone: 'amber' },
    { value: String(s.days_absent), label: t('absent'), tone: 'red' },
  ];
  if (isTeam && s.labour_days != null) pills.splice(1, 0, { value: fmtNum(s.labour_days), label: t('st_labour_days') });
  return { body, pills };
}

export function workStatementHtml(st: WorkStatement, t: T): string {
  const { body, pills } = workParts(st, t);
  return shell({
    t, title: t('st_work'), period: st.period, heading: st.entity.name,
    subheading: st.entity.entity_type === 'team' ? t('st_team') : t('st_individual'),
    details: entityDetails(st.entity, t, false), pills, body,
  });
}

// ─── Labour: pay ──────────────────────────────────────────────────────────────

export function earnLabel(i: EarnItem, t: T): string {
  const base = i.kind === 'contract' ? `${t('st_contract')}: ${i.label}` : i.kind === 'half_wage' ? t('st_half_wage') : t('st_daily_wage');
  const extra = [i.kind !== 'contract' ? i.label : '', i.num_labourers ? `${i.num_labourers} ${t('st_members').toLowerCase()}` : ''].filter(Boolean).join(', ');
  return extra ? `${base} (${extra})` : base;
}
function balCell(b: number, t: T): string {
  if (Math.round(b) === 0) return `<span class="mut">${inr(0)}</span>`;
  return b > 0 ? `<span class="b">${inr(b)}</span>` : `<span class="neg">${inr(-b)}</span> <span class="mut">(${esc(t('st_advance'))})</span>`;
}

type Closing = { label: string; value: string; note?: string; negative?: boolean };

function payParts(st: PayStatement, t: T): { body: string; pills: Pill[]; closing: Closing } {
  const s = st.summary;
  const hasOpening = !!st.period.date_from;
  const weekOf = (d: string) => st.weeks.find((w) => d >= w.week_start && d <= w.week_end);
  let html = '';
  if (hasOpening) {
    html += `<tr class="open"><td class="nw">${esc(fmtD(st.period.date_from))}</td><td>${esc(t('st_brought_forward'))}</td><td></td><td></td><td class="r">${balCell(s.opening_balance, t)}</td></tr>`;
  }
  let current: PayWeek | undefined;
  st.rows.forEach((r, i) => {
    const w = weekOf(r.date);
    if (w && w !== current) {
      current = w;
      html += `<tr class="wkh"><td colspan="5">${esc(t('st_week'))}: ${esc(fmtShort(w.week_start))} – ${esc(fmtD(w.week_end))}</td></tr>`;
    }
    const lines = [
      ...r.earn_items.map((e) => esc(earnLabel(e, t))),
      ...r.paid_items.map((p) => `${esc(t('st_paid'))} · ${esc(methodLabel(p.method, t))}${p.notes ? ` — ${esc(p.notes)}` : ''}`),
    ];
    html += `<tr><td class="nw">${esc(fmtD(r.date, true))}</td><td>${lines.join('<br>')}</td>
      <td class="r pos">${r.earned ? inr(r.earned) : '<span class="mut">—</span>'}</td>
      <td class="r neg">${r.paid ? inr(r.paid) : '<span class="mut">—</span>'}</td>
      <td class="r nw">${balCell(r.balance, t)}</td></tr>`;
    const next = st.rows[i + 1];
    if (w && (!next || weekOf(next.date) !== w)) {
      html += `<tr class="wk"><td colspan="2">${esc(t('st_week_total'))}</td><td class="r">${inr(w.earned)}</td><td class="r">${inr(w.paid)}</td><td class="r nw">${balCell(w.closing_balance, t)}</td></tr>`;
    }
  });
  if (!st.rows.length) html += empty(5, t);

  const body = `<div class="sec">${esc(t('st_pay'))}</div>
  <table><thead><tr><th style="width:120px">${esc(t('st_date'))}</th><th>${esc(t('st_details'))}</th>
  <th class="r" style="width:80px">${esc(t('st_earned'))}</th><th class="r" style="width:80px">${esc(t('st_paid'))}</th><th class="r" style="width:130px">${esc(t('st_balance'))}</th></tr></thead>
  <tbody>${html}</tbody>
  <tfoot><tr><td colspan="2">${esc(t('st_total'))}</td><td class="r">${inr(s.total_earned)}</td><td class="r">${inr(s.total_paid)}</td><td class="r nw">${balCell(s.closing_balance, t)}</td></tr></tfoot></table>
  <div class="note">${esc(t('st_pay_note'))}</div>`;

  const pills: Pill[] = [];
  if (hasOpening) pills.push({ value: inr(s.opening_balance), label: t('st_brought_forward') });
  pills.push({ value: inr(s.total_earned), label: t('st_earned'), tone: 'green' });
  pills.push({ value: inr(s.total_paid), label: t('st_paid'), tone: 'red' });
  pills.push({ value: fmtNum(s.days_worked), label: t('st_days_worked') });

  const closing: Closing = {
    label: s.closing_balance < 0 ? t('st_advance') : Math.round(s.closing_balance) === 0 ? t('st_settled') : t('st_balance_due'),
    note: st.period.date_to ? fmtD(st.period.date_to) : undefined,
    value: inr(Math.abs(s.closing_balance)),
    negative: s.closing_balance < 0,
  };
  return { body, pills, closing };
}

export function payStatementHtml(st: PayStatement, t: T): string {
  const { body, pills, closing } = payParts(st, t);
  return shell({
    t, title: t('st_pay'), period: st.period, heading: st.entity.name,
    subheading: st.entity.entity_type === 'team' ? t('st_team') : t('st_individual'),
    details: entityDetails(st.entity, t, true), pills, body, closing,
  });
}

/** Work section followed by the pay ledger, one document. */
export function combinedStatementHtml(work: WorkStatement, pay: PayStatement, t: T): string {
  const w = workParts(work, t);
  const p = payParts(pay, t);
  const s = pay.summary;
  const pills: Pill[] = [
    ...w.pills,
    { value: inr(s.total_earned), label: t('st_earned'), tone: 'green' },
    { value: inr(s.total_paid), label: t('st_paid'), tone: 'red' },
  ];
  return shell({
    t, title: t('st_combined'), period: pay.period, heading: pay.entity.name,
    subheading: pay.entity.entity_type === 'team' ? t('st_team') : t('st_individual'),
    details: entityDetails(pay.entity, t, true), pills, body: w.body + p.body, closing: p.closing,
  });
}

// ─── Operations ───────────────────────────────────────────────────────────────

export function operationsHtml(r: OperationsReport, t: T): string {
  const rows = r.rows.map((o) => `<tr>
    <td class="nw">${esc(fmtD(o.date))}</td>
    <td class="b">${esc(o.plot_name)}</td>
    <td>${esc(opCatLabel(o.category, t))}<br><span class="mut">${esc(stageLabel(o.stage, t))}</span></td>
    <td>${o.products.map((p) => `${esc(p.name)}${p.dose ? ` <span class="mut">${esc(p.dose)}</span>` : ''}`).join('<br>') || '<span class="mut">—</span>'}</td>
    <td>${esc(o.notes) || '<span class="mut">—</span>'}</td>
    <td>${esc(o.workers.join(', ')) || '<span class="mut">—</span>'}</td>
    <td class="r nw">${o.cost != null ? inr(o.cost) : '<span class="mut">—</span>'}</td></tr>`).join('');

  const products = r.products.length ? `<div class="sec">${esc(t('st_products_used'))}</div>
  <table><thead><tr><th>${esc(t('st_products_used'))}</th><th class="c" style="width:80px">${esc(t('st_times'))}</th><th>${esc(t('plots'))}</th></tr></thead>
  <tbody>${r.products.map((p) => `<tr><td class="b">${esc(p.name)}</td><td class="c">${p.times}</td><td>${esc(p.plots.join(', '))}</td></tr>`).join('')}</tbody></table>` : '';

  const body = `<div class="sec">${esc(t('operations'))} · ${r.total} ${esc(t('st_entries'))}</div>
  <table><thead><tr><th style="width:85px">${esc(t('st_date'))}</th><th style="width:80px">${esc(t('plot'))}</th><th style="width:110px">${esc(t('st_task'))}</th>
  <th style="width:150px">${esc(t('st_products_used'))}</th><th>${esc(t('st_details'))}</th><th style="width:120px">${esc(t('st_workers'))}</th><th class="r" style="width:70px">${esc(t('st_cost'))}</th></tr></thead>
  <tbody>${rows || empty(7, t)}</tbody>
  ${r.linked_cost ? `<tfoot><tr><td colspan="6">${esc(t('st_cost'))}</td><td class="r">${inr(r.linked_cost)}</td></tr></tfoot>` : ''}</table>
  ${products}`;

  return shell({
    t, title: t('st_ops_report'), period: r.period, heading: r.plot_name ?? t('st_all_plots'), landscape: true,
    details: r.by_plot.length > 1 ? r.by_plot.map((p) => `${p.name}: ${p.count}`) : undefined,
    pills: [{ value: String(r.total), label: t('operations'), tone: 'green' },
      ...r.by_category.map((c) => ({ value: String(c.count), label: opCatLabel(c.name, t) }))],
    body,
  });
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export function expensesHtml(r: ExpenseReport, t: T): string {
  const rows = r.rows.map((x) => {
    const inc = x.kind === 'income';
    return `<tr>
    <td class="nw">${esc(fmtD(x.date))}</td>
    <td>${esc(t(catLabelKey(x.kind, x.category)))}<br><span class="mut">${esc(t(inc ? 'exp_income' : 'exp_expense'))}</span></td>
    <td>${esc(x.plot_name ?? t('st_whole_farm'))}</td>
    <td>${esc(x.party) || '<span class="mut">—</span>'}</td>
    <td>${esc(x.description) || '<span class="mut">—</span>'}</td>
    <td class="r nw ${inc ? 'pos' : 'neg'}">${x.amount != null ? `${inc ? '+' : '−'}${inr(x.amount)}` : `<span class="mut">${esc(t('exp_price_pending'))}</span>`}</td>
    <td class="r nw">${x.amount != null ? inr(x.amount_paid) : '—'}</td>
    <td class="nw">${esc(txnStatusLabel(x.status, t))}${x.balance ? `<br><span class="mut">${inr(x.balance)} ${esc(t('exp_left'))}</span>` : ''}</td></tr>`;
  }).join('');

  const cats = r.by_category.map((c) => `<tr><td>${esc(t(catLabelKey(c.kind, c.category)))}</td><td class="mut">${esc(t(c.kind === 'income' ? 'exp_income' : 'exp_expense'))}</td>
    <td class="c">${c.count}</td><td class="r ${c.kind === 'income' ? 'pos' : 'neg'}">${inr(c.total)}${c.unpriced_count ? ` <span class="mut">(+${c.unpriced_count} ${esc(t('exp_price_pending'))})</span>` : ''}</td></tr>`).join('');
  const plots = r.by_plot.map((p) => `<tr><td class="b">${esc(p.plot_name ?? t('st_whole_farm'))}</td><td class="r pos">${inr(p.income)}</td><td class="r neg">${inr(p.expense)}</td>
    <td class="r ${p.profit < 0 ? 'neg' : 'pos'}">${p.profit < 0 ? '−' : ''}${inr(Math.abs(p.profit))}</td></tr>`).join('');

  const body = `
  <div class="sec">${esc(t('st_by_category'))}</div>
  <table><thead><tr><th>${esc(t('exp_category'))}</th><th style="width:90px"></th><th class="c" style="width:70px">${esc(t('st_entries'))}</th><th class="r" style="width:180px">${esc(t('st_total'))}</th></tr></thead>
  <tbody>${cats || empty(4, t)}</tbody></table>
  ${r.by_plot.length ? `<div class="sec">${esc(t('st_by_plot'))}</div>
  <table><thead><tr><th>${esc(t('plot'))}</th><th class="r">${esc(t('exp_income'))}</th><th class="r">${esc(t('exp_expense'))}</th><th class="r">${esc(t('exp_profit'))} / ${esc(t('exp_loss'))}</th></tr></thead>
  <tbody>${plots}</tbody></table>` : ''}
  <div class="sec">${esc(t('st_details'))} · ${r.rows.length} ${esc(t('st_entries'))}</div>
  <table><thead><tr><th style="width:85px">${esc(t('st_date'))}</th><th style="width:120px">${esc(t('exp_category'))}</th><th style="width:90px">${esc(t('plot'))}</th>
  <th style="width:110px">${esc(t('st_party'))}</th><th>${esc(t('st_details'))}</th><th class="r" style="width:90px">${esc(t('st_amount'))}</th><th class="r" style="width:80px">${esc(t('st_paid'))}</th><th style="width:100px">${esc(t('st_status'))}</th></tr></thead>
  <tbody>${rows || empty(8, t)}</tbody></table>
  ${r.unpriced_count ? `<div class="note">${r.unpriced_count} ${esc(t('exp_unpriced_note'))}</div>` : ''}`;

  const loss = r.profit < 0;
  return shell({
    t, title: t('st_exp_report'), period: r.period, heading: r.plot_name ?? t('st_all_plots'), landscape: true,
    pills: [
      { value: inr(r.income), label: t('exp_income'), tone: 'green' },
      { value: inr(r.expense), label: t('exp_expense'), tone: 'red' },
      { value: inr(r.you_owe), label: t('exp_you_owe'), tone: r.you_owe ? 'amber' : '' },
      { value: inr(r.owed_to_you), label: t('exp_owed_to_you') },
    ],
    body,
    closing: { label: loss ? t('exp_loss') : t('exp_profit'), value: inr(Math.abs(r.profit)), negative: loss },
  });
}

// ─── Contracts ────────────────────────────────────────────────────────────────

function plotTitle(name: string | null, acres: number | null, t: T): string {
  if (!name) return t('st_no_plot');
  return acres != null ? `${name} (${acres} ${t('st_acre')})` : name;
}

export function contractsHtml(r: ContractsReport, t: T): string {
  const row = (c: ContractRow) => `<tr>
    <td class="nw">${esc(fmtD(c.assigned_date))}</td>
    <td class="b">${esc(c.title)}${c.description ? `<br><span class="mut" style="font-weight:400">${esc(c.description)}</span>` : ''}</td>
    <td>${esc(c.entity_name ?? '—')}<br><span class="mut">${esc(c.entity_type === 'team' ? t('st_team') : t('st_individual'))}</span></td>
    <td class="r nw">${c.amount_per_acre != null ? `${inr(c.amount_per_acre)}/${esc(t('st_acre'))}` : '<span class="mut">—</span>'}</td>
    <td class="r nw b" style="${c.status === 'cancelled' ? 'text-decoration:line-through;color:#9aa19c' : ''}">${inr(c.amount)}</td>
    <td class="nw">${esc(contractStatusLabel(c.status, t))}${c.completed_date ? `<br><span class="mut">${esc(fmtD(c.completed_date))}</span>` : ''}</td></tr>`;
  const head = `<thead><tr><th style="width:85px">${esc(t('st_given_on'))}</th><th>${esc(t('st_task'))}</th><th style="width:140px">${esc(t('st_given_to'))}</th>
    <th class="r" style="width:100px">${esc(t('st_rate'))}</th><th class="r" style="width:90px">${esc(t('st_amount'))}</th><th style="width:100px">${esc(t('st_status'))}</th></tr></thead>`;

  // One table per plot, each with its own total; contracts without a plot come last.
  const groups = r.by_plot.map((g) => {
    const list = r.rows.filter((c) => (c.plot_id ?? null) === (g.plot_id ?? null));
    return `<div class="sec">${esc(plotTitle(g.plot_name, g.size_acres, t))} · ${g.count} ${esc(t('st_entries'))}</div>
    <table>${head}<tbody>${list.map(row).join('')}</tbody>
    <tfoot><tr><td colspan="4">${esc(t('st_plot_total'))}</td><td class="r">${inr(g.total_value)}</td><td></td></tr></tfoot></table>`;
  }).join('');

  const summary = !r.plot_name && r.by_plot.length > 1 ? `<div class="sec">${esc(t('st_by_plot'))}</div>
    <table><thead><tr><th>${esc(t('plot'))}</th><th class="c" style="width:90px">${esc(t('contracts'))}</th><th class="r" style="width:140px">${esc(t('st_total_value'))}</th></tr></thead>
    <tbody>${r.by_plot.map((g) => `<tr><td class="b">${esc(plotTitle(g.plot_name, g.size_acres, t))}</td><td class="c">${g.count}</td><td class="r b">${inr(g.total_value)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>${esc(t('st_total'))}</td><td class="c">${r.total_count}</td><td class="r">${inr(r.total_value)}</td></tr></tfoot></table>` : '';

  const body = summary + (groups || `<table>${head}<tbody>${empty(6, t)}</tbody></table>`);

  return shell({
    t, title: t('st_con_report'), period: r.period, heading: r.plot_name ?? t('st_all_plots'), landscape: true,
    pills: [
      { value: String(r.total_count), label: t('contracts'), tone: 'green' },
      ...r.by_status.map((s) => ({
        value: `${s.count} · ${inr(s.amount)}`, label: contractStatusLabel(s.status, t),
        tone: (s.status === 'cancelled' ? 'red' : s.status === 'completed' ? 'green' : 'amber') as Pill['tone'],
      })),
    ],
    body,
    closing: { label: t('st_total_value'), value: inr(r.total_value) },
  });
}

// ─── Output ───────────────────────────────────────────────────────────────────

/** Native: create a PDF and open the share sheet. Web: open a printable tab. */
export async function sharePdf(html: string, t: T, landscape = false): Promise<void> {
  if (Platform.OS === 'web') {
    const win = (globalThis as any).open?.('', '_blank');
    if (!win) { Alert.alert(t('error'), t('st_popup_blocked')); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }
  // A4 in points; set explicitly because some engines ignore CSS @page size.
  const { uri } = await Print.printToFileAsync({ html, width: landscape ? 842 : 595, height: landscape ? 595 : 842 });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('st_download'), UTI: 'com.adobe.pdf' });
}
