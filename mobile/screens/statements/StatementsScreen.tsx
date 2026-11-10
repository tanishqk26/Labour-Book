import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiGet } from '../../lib/api';
import { C, R } from '../../lib/theme';
import { useLanguage } from '../../context/LanguageContext';
import { TranslationKey } from '../../lib/i18n';
import { catLabelKey } from '../../lib/expenseMeta';
import PeriodPicker, { Period, PeriodMode, defaultPeriod, resolvePeriod } from '../../components/PeriodPicker';
import SelectField from '../../components/SelectField';
import {
  ContractsReport, ExpenseReport, OperationsReport, PayStatement, WorkStatement,
  balanceText, combinedStatementHtml, contractStatusLabel, contractsHtml, earnLabel, expensesHtml, fmtD, fmtShort, inr,
  methodLabel, opCatLabel, operationsHtml, payStatementHtml, periodLabel, sharePdf, stageLabel,
  statusLabel, txnStatusLabel, workStatementHtml,
} from '../../lib/statementPdf';
import { MoreStackParamList, ReportKind } from '../details/types';

type ListProps = NativeStackScreenProps<MoreStackParamList, 'Statements'>;
type DetailProps = NativeStackScreenProps<MoreStackParamList, 'StatementDetail'>;
type ReportProps = NativeStackScreenProps<MoreStackParamList, 'StatementReport'>;
type Tr = (k: TranslationKey) => string;

const PREVIEW_ROWS = 40;

interface StatementEntity { id: string; name: string; entity_type: string; daily_wage: number; hometown?: string | null }

// ─── Shared bits ──────────────────────────────────────────────────────────────

function NavBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={s.bar}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
      </TouchableOpacity>
      <Text style={s.barTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function MoreNote({ shown, total, t }: { shown: number; total: number; t: Tr }) {
  if (total <= shown) return null;
  return <Text style={s.moreNote}>+{total - shown} {t('st_preview_more')}</Text>;
}

function DownloadBar({ disabled, busy, onPress, t, bottom }: { disabled: boolean; busy: boolean; onPress: () => void; t: Tr; bottom: number }) {
  return (
    <View style={[s.downloadBar, { paddingBottom: bottom + 12 }]}>
      <TouchableOpacity style={[s.downloadBtn, (disabled || busy) && { opacity: 0.5 }]} disabled={disabled || busy} onPress={onPress}>
        {busy ? <ActivityIndicator color={C.onPrimary} /> : (
          <>
            <MaterialCommunityIcons name="file-pdf-box" size={22} color={C.onPrimary} />
            <Text style={s.downloadText}>{t('st_download')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

/** Loads `path` whenever the query changes; ignores answers to stale requests. */
function useStatement<D>(path: string | null, params: Record<string, string>) {
  const [data, setData] = useState<D | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);
  const key = path ? `${path}?${JSON.stringify(params)}` : '';

  const load = useCallback(async () => {
    if (!path) return;
    const mine = ++seq.current;
    setLoading(true);
    setFailed(false);
    try {
      const d = await apiGet<D>(path, params);
      if (mine === seq.current) setData(d);
    } catch {
      if (mine === seq.current) { setFailed(true); setData(null); }
    } finally {
      if (mine === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { setData(null); load(); }, [load]);
  return { data, loading, failed, reload: load };
}

function StateBox({ loading, failed, reload, t }: { loading: boolean; failed: boolean; reload: () => void; t: Tr }) {
  if (loading) return <View style={s.stateBox}><ActivityIndicator color={C.primary} /></View>;
  if (failed) {
    return (
      <View style={s.stateBox}>
        <Text style={s.stateText}>{t('st_load_failed')}</Text>
        <TouchableOpacity style={s.retry} onPress={reload}><Text style={s.retryText}>{t('st_retry')}</Text></TouchableOpacity>
      </View>
    );
  }
  return null;
}

async function download(html: string, t: Tr, landscape: boolean, setBusy: (b: boolean) => void) {
  setBusy(true);
  try {
    await sharePdf(html, t, landscape);
  } catch (e: any) {
    Alert.alert(t('st_pdf_failed'), e?.message ?? String(e));
  } finally {
    setBusy(false);
  }
}

// ─── List screen ──────────────────────────────────────────────────────────────

const REPORTS: { kind: ReportKind; icon: string; label: TranslationKey; sub: TranslationKey }[] = [
  { kind: 'operations', icon: 'sprout-outline', label: 'st_ops_report', sub: 'st_ops_report_sub' },
  { kind: 'expenses', icon: 'cash-multiple', label: 'st_exp_report', sub: 'st_exp_report_sub' },
  { kind: 'contracts', icon: 'file-sign', label: 'st_con_report', sub: 'st_con_report_sub' },
];

function MenuCard({ icon, label, sub, onPress }: { icon: string; label: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.reportCard} activeOpacity={0.8} onPress={onPress}>
      <View style={s.reportIcon}><MaterialCommunityIcons name={icon as any} size={22} color={C.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.reportTitle}>{label}</Text>
        <Text style={s.reportSub}>{sub}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={C.outline} />
    </TouchableOpacity>
  );
}

export function StatementsListScreen({ navigation }: ListProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <NavBar title={t('st_title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}>
        <MenuCard icon="account-group-outline" label={t('st_labour_stmt')} sub={t('st_labour_stmt_sub')}
          onPress={() => navigation.navigate('StatementDetail', undefined)} />
        <Text style={[s.section, { marginTop: 8 }]}>{t('st_reports')}</Text>
        {REPORTS.map((r) => (
          <MenuCard key={r.kind} icon={r.icon} label={t(r.label)} sub={t(r.sub)}
            onPress={() => navigation.navigate('StatementReport', { kind: r.kind })} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Labour statement (work / pay) ────────────────────────────────────────────

const LABOUR_MODES: PeriodMode[] = ['week', 'month', 'last_month', 'season', 'custom', 'all'];
const STATUS_C: Record<string, { bg: string; fg: string }> = {
  present: { bg: C.primaryFixed, fg: C.primary },
  half_day: { bg: '#fef3c7', fg: '#6b4c04' },
  absent: { bg: C.errorContainer, fg: C.error },
};

function WorkPreview({ st, t }: { st: WorkStatement; t: Tr }) {
  const isTeam = st.entity.entity_type === 'team';
  const sm = st.summary;
  const rows = st.rows.slice(0, PREVIEW_ROWS);
  return (
    <>
      <View style={s.statsCard}>
        <Stat value={String(sm.days_worked)} label={t('st_days_worked')} color={C.primary} />
        {isTeam && sm.labour_days != null && <Stat value={String(sm.labour_days)} label={t('st_labour_days')} />}
        <Stat value={String(sm.days_present)} label={t('present')} />
        <Stat value={String(sm.days_half)} label={t('half_day')} color="#6b4c04" />
        <Stat value={String(sm.days_absent)} label={t('absent')} color={C.error} />
      </View>
      <View style={s.card}>
        {rows.length === 0 && <Text style={s.emptyText}>{t('st_no_records')}</Text>}
        {rows.map((r, i) => {
          const sc = STATUS_C[r.status] ?? STATUS_C.present;
          const time = r.work_start_time && r.work_end_time ? `${r.work_start_time}–${r.work_end_time}` : '';
          const sub = [r.task, r.on_contract ? t('st_contract_work') : '', time, isTeam && r.num_labourers && r.status !== 'absent' ? `${r.num_labourers} ${t('st_members').toLowerCase()}` : '']
            .filter(Boolean).join(' · ');
          return (
            <View key={r.date} style={[s.row, i > 0 && s.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{fmtD(r.date, true)}</Text>
                {sub ? <Text style={s.rowSub} numberOfLines={2}>{sub}</Text> : null}
              </View>
              <View style={[s.badge, { backgroundColor: sc.bg }]}>
                <Text style={[s.badgeText, { color: sc.fg }]}>{statusLabel(r.status, t)}</Text>
              </View>
            </View>
          );
        })}
        <MoreNote shown={rows.length} total={st.rows.length} t={t} />
      </View>
    </>
  );
}

function PayPreview({ st, t }: { st: PayStatement; t: Tr }) {
  const sm = st.summary;
  const due = sm.closing_balance;
  // Limit the preview to PREVIEW_ROWS days in total, keeping whole-week grouping.
  const rowsByWeek: { w: PayStatement['weeks'][number]; show: PayStatement['rows'] }[] = [];
  let budget = PREVIEW_ROWS;
  for (const w of st.weeks) {
    if (budget <= 0) break;
    const show = st.rows.filter((r) => r.date >= w.week_start && r.date <= w.week_end).slice(0, budget);
    budget -= show.length;
    rowsByWeek.push({ w, show });
  }
  return (
    <>
      <View style={[s.balanceCard, due < 0 && { backgroundColor: C.tertiary }]}>
        <Text style={s.balanceLabel}>{due < 0 ? t('st_advance') : Math.round(due) === 0 ? t('st_settled') : t('st_balance_due')}</Text>
        <Text style={s.balanceValue}>{inr(Math.abs(due))}</Text>
      </View>
      <View style={s.statsCard}>
        {!!st.period.date_from && <Stat value={inr(sm.opening_balance)} label={t('st_brought_forward')} />}
        <Stat value={inr(sm.total_earned)} label={t('st_earned')} color={C.primary} />
        <Stat value={inr(sm.total_paid)} label={t('st_paid')} color={C.error} />
        <Stat value={String(sm.days_worked)} label={t('st_days_worked')} />
      </View>
      {st.rows.length === 0 && <View style={s.card}><Text style={s.emptyText}>{t('st_no_records')}</Text></View>}
      {rowsByWeek.map(({ w, show }) => {
        return (
          <View key={w.week_start} style={s.card}>
            <Text style={s.weekHead}>{t('st_week')}: {fmtShort(w.week_start)} – {fmtShort(w.week_end)}</Text>
            {show.map((r) => (
              <View key={r.date} style={[s.row, s.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{fmtD(r.date, true)}</Text>
                  {r.earn_items.map((e, i) => <Text key={`e${i}`} style={s.rowSub} numberOfLines={1}>{earnLabel(e, t)}</Text>)}
                  {r.paid_items.map((p, i) => (
                    <Text key={`p${i}`} style={[s.rowSub, { color: C.error }]} numberOfLines={1}>
                      {t('st_paid')} · {methodLabel(p.method, t)}{p.notes ? ` — ${p.notes}` : ''}
                    </Text>
                  ))}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {r.earned > 0 && <Text style={s.earn}>+{inr(r.earned)}</Text>}
                  {r.paid > 0 && <Text style={s.paid}>−{inr(r.paid)}</Text>}
                </View>
              </View>
            ))}
            <View style={s.weekFoot}>
              <Text style={s.weekFootText}>{t('st_week_total')}: +{inr(w.earned)} / −{inr(w.paid)}</Text>
              <Text style={[s.weekFootText, { color: w.closing_balance < 0 ? C.error : C.primary }]}>{balanceText(w.closing_balance, t)}</Text>
            </View>
          </View>
        );
      })}
      <MoreNote shown={Math.min(st.rows.length, PREVIEW_ROWS)} total={st.rows.length} t={t} />
      <Text style={s.hint}>{t('st_pay_note')}</Text>
    </>
  );
}

type LabourKind = 'work' | 'pay' | 'combined';
const LABOUR_KINDS: { k: LabourKind; icon: string; label: TranslationKey; sub: TranslationKey }[] = [
  { k: 'work', icon: 'calendar-check-outline', label: 'st_work_short', sub: 'st_work_sub' },
  { k: 'pay', icon: 'wallet-outline', label: 'st_pay_short', sub: 'st_pay_sub' },
  { k: 'combined', icon: 'text-box-multiple-outline', label: 'st_combined_short', sub: 'st_combined_sub' },
];

export function StatementDetailScreen({ route, navigation }: DetailProps) {
  const initial = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [people, setPeople] = useState<StatementEntity[]>([]);
  const [peopleFailed, setPeopleFailed] = useState(false);
  const [sel, setSel] = useState<string | null>(initial ? `${initial.entityType}:${initial.entityId}` : null);
  const [kind, setKind] = useState<LabourKind>('work');
  const [period, setPeriod] = useState<Period>(() => defaultPeriod('month'));
  const [busy, setBusy] = useState(false);
  const { params } = resolvePeriod(period);

  const loadPeople = useCallback(() => {
    setPeopleFailed(false);
    apiGet<StatementEntity[]>('/api/v1/statements/entities')
      .then(setPeople)
      .catch(() => setPeopleFailed(true));
  }, []);
  useEffect(() => { loadPeople(); }, [loadPeople]);

  // A person opened from their profile may be inactive or not loaded yet: keep them selectable.
  const options = useMemo(() => {
    const opts = people.map((e) => ({
      id: `${e.entity_type}:${e.id}`,
      label: e.name,
      icon: e.entity_type === 'team' ? 'account-group' : 'account',
    }));
    if (initial && !opts.some((o) => o.id === `${initial.entityType}:${initial.entityId}`)) {
      opts.unshift({ id: `${initial.entityType}:${initial.entityId}`, label: initial.name, icon: initial.entityType === 'team' ? 'account-group' : 'account' });
    }
    return opts;
  }, [people, initial]);

  const [entityType, entityId] = sel ? sel.split(':') : [null, null];
  const base = sel ? `/api/v1/statements/labour` : null;
  const needWork = kind !== 'pay';
  const needPay = kind !== 'work';
  const work = useStatement<WorkStatement>(base && needWork ? `${base}/work/${entityType}/${entityId}` : null, params);
  const pay = useStatement<PayStatement>(base && needPay ? `${base}/pay/${entityType}/${entityId}` : null, params);
  const ready = (!needWork || !!work.data) && (!needPay || !!pay.data);
  const loading = (needWork && work.loading) || (needPay && pay.loading);
  const failed = (needWork && work.failed) || (needPay && pay.failed);
  const reload = () => { if (needWork) work.reload(); if (needPay) pay.reload(); };
  const shownPeriod = (needPay ? pay.data?.period : work.data?.period) ?? null;

  function onDownload() {
    if (kind === 'work' && work.data) download(workStatementHtml(work.data, t), t, false, setBusy);
    if (kind === 'pay' && pay.data) download(payStatementHtml(pay.data, t), t, false, setBusy);
    if (kind === 'combined' && work.data && pay.data) download(combinedStatementHtml(work.data, pay.data, t), t, false, setBusy);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <NavBar title={t('st_labour_stmt')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.section}>{t('st_person')}</Text>
        <SelectField value={sel} options={options} placeholder={t('st_select_person')} title={t('st_select_person')} onChange={setSel} />
        {peopleFailed && (
          <TouchableOpacity onPress={loadPeople}><Text style={s.warn}>{t('st_load_failed')} · {t('st_retry')}</Text></TouchableOpacity>
        )}

        <Text style={s.section}>{t('st_type')}</Text>
        <View style={s.typeRow}>
          {LABOUR_KINDS.map((o) => {
            const on = kind === o.k;
            return (
              <TouchableOpacity key={o.k} style={[s.typeCard, on && s.typeCardOn]} onPress={() => setKind(o.k)} activeOpacity={0.8}>
                <MaterialCommunityIcons name={o.icon as any} size={22} color={on ? C.onPrimary : C.primary} />
                <Text style={[s.typeLabel, on && { color: C.onPrimary }]}>{t(o.label)}</Text>
                <Text style={[s.typeSub, on && { color: C.primaryFixed }]}>{t(o.sub)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.section}>{t('st_period')}</Text>
        <PeriodPicker value={period} onChange={setPeriod} modes={LABOUR_MODES} />

        {!sel ? (
          <View style={s.pickBox}>
            <MaterialCommunityIcons name="account-search-outline" size={40} color={C.outlineVariant} />
            <Text style={s.hint}>{t('st_pick_first')}</Text>
          </View>
        ) : (
          <>
            {shownPeriod && <Text style={s.periodText}>{periodLabel(shownPeriod, t)}</Text>}
            <StateBox loading={loading} failed={!loading && failed} reload={reload} t={t} />
            {!loading && ready && kind === 'combined' && <Text style={[s.section, { marginTop: 8 }]}>{t('st_work')}</Text>}
            {!loading && ready && needWork && work.data && <WorkPreview st={work.data} t={t} />}
            {!loading && ready && kind === 'combined' && <Text style={[s.section, { marginTop: 8 }]}>{t('st_pay')}</Text>}
            {!loading && ready && needPay && pay.data && <PayPreview st={pay.data} t={t} />}
          </>
        )}
      </ScrollView>
      <DownloadBar disabled={!sel || !ready || loading} busy={busy} onPress={onDownload} t={t} bottom={insets.bottom} />
    </View>
  );
}

// ─── Farm reports (operations / expenses / contracts) ─────────────────────────

const REPORT_MODES: PeriodMode[] = ['season', 'month', 'last_month', 'custom', 'all'];
const ALL = '__all__';

function OpsPreview({ r, t }: { r: OperationsReport; t: Tr }) {
  const rows = r.rows.slice(0, PREVIEW_ROWS);
  return (
    <>
      <View style={s.statsCard}>
        <Stat value={String(r.total)} label={t('operations')} color={C.primary} />
        {r.by_category.slice(0, 3).map((c) => <Stat key={c.name} value={String(c.count)} label={opCatLabel(c.name, t)} />)}
      </View>
      {r.products.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('st_products_used')}</Text>
          {r.products.slice(0, 8).map((p) => (
            <View key={p.name} style={s.kv}>
              <Text style={s.kvKey} numberOfLines={1}>{p.name}</Text>
              <Text style={s.kvVal}>{p.times} {t('st_times')}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={s.card}>
        {rows.length === 0 && <Text style={s.emptyText}>{t('st_no_records')}</Text>}
        {rows.map((o, i) => {
          const sub = [stageLabel(o.stage, t), o.products.map((p) => p.dose ? `${p.name} ${p.dose}` : p.name).join(', '), o.notes, o.workers.join(', ')]
            .filter(Boolean).join(' · ');
          return (
            <View key={o.id} style={[s.row, i > 0 && s.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{fmtD(o.date)} · {o.plot_name}</Text>
                <Text style={[s.rowSub, { color: C.primary, fontWeight: '700' }]}>{opCatLabel(o.category, t)}</Text>
                {sub ? <Text style={s.rowSub} numberOfLines={3}>{sub}</Text> : null}
              </View>
              {o.cost != null && <Text style={s.paid}>{inr(o.cost)}</Text>}
            </View>
          );
        })}
        <MoreNote shown={rows.length} total={r.rows.length} t={t} />
      </View>
    </>
  );
}

function ExpPreview({ r, t }: { r: ExpenseReport; t: Tr }) {
  const rows = r.rows.slice(0, PREVIEW_ROWS);
  const loss = r.profit < 0;
  return (
    <>
      <View style={[s.balanceCard, loss && { backgroundColor: C.tertiary }]}>
        <Text style={s.balanceLabel}>{loss ? t('exp_loss') : t('exp_profit')}</Text>
        <Text style={s.balanceValue}>{inr(Math.abs(r.profit))}</Text>
      </View>
      <View style={s.statsCard}>
        <Stat value={inr(r.income)} label={t('exp_income')} color={C.primary} />
        <Stat value={inr(r.expense)} label={t('exp_expense')} color={C.error} />
        <Stat value={inr(r.you_owe)} label={t('exp_you_owe')} />
      </View>
      {r.unpriced_count > 0 && <Text style={s.warn}>{r.unpriced_count} {t('exp_unpriced_note')}</Text>}
      {r.by_category.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('st_by_category')}</Text>
          {r.by_category.map((c) => (
            <View key={`${c.kind}-${c.category}`} style={s.kv}>
              <Text style={s.kvKey} numberOfLines={1}>{t(catLabelKey(c.kind, c.category))}</Text>
              <Text style={[s.kvVal, { color: c.kind === 'income' ? C.primary : C.error }]}>{inr(c.total)}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={s.card}>
        {rows.length === 0 && <Text style={s.emptyText}>{t('st_no_records')}</Text>}
        {rows.map((x, i) => {
          const inc = x.kind === 'income';
          const sub = [x.plot_name ?? t('st_whole_farm'), x.party, x.description].filter(Boolean).join(' · ');
          return (
            <View key={x.id} style={[s.row, i > 0 && s.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{fmtD(x.date)} · {t(catLabelKey(x.kind, x.category))}</Text>
                <Text style={s.rowSub} numberOfLines={2}>{sub}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={inc ? s.earn : s.paid}>{x.amount != null ? `${inc ? '+' : '−'}${inr(x.amount)}` : t('exp_price_pending')}</Text>
                <Text style={s.rowSub}>{txnStatusLabel(x.status, t)}</Text>
              </View>
            </View>
          );
        })}
        <MoreNote shown={rows.length} total={r.rows.length} t={t} />
      </View>
    </>
  );
}

function ConPreview({ r, t }: { r: ContractsReport; t: Tr }) {
  // One card per plot (contracts without a plot last), capped at PREVIEW_ROWS rows overall.
  const groups: { g: ContractsReport['by_plot'][number]; show: ContractsReport['rows'] }[] = [];
  let budget = PREVIEW_ROWS;
  for (const g of r.by_plot) {
    if (budget <= 0) break;
    const show = r.rows.filter((c) => (c.plot_id ?? null) === (g.plot_id ?? null)).slice(0, budget);
    budget -= show.length;
    groups.push({ g, show });
  }
  const shown = groups.reduce((n, x) => n + x.show.length, 0);
  return (
    <>
      <View style={s.statsCard}>
        <Stat value={String(r.total_count)} label={t('contracts')} />
        <Stat value={inr(r.total_value)} label={t('st_total_value')} color={C.primary} />
        {r.by_status.map((b) => <Stat key={b.status} value={String(b.count)} label={contractStatusLabel(b.status, t)} />)}
      </View>
      {groups.length === 0 && <View style={s.card}><Text style={s.emptyText}>{t('st_no_records')}</Text></View>}
      {groups.map(({ g, show }) => (
        <View key={g.plot_id ?? 'none'} style={s.card}>
          <Text style={s.weekHead}>
            {g.plot_name ? `${g.plot_name}${g.size_acres != null ? ` · ${g.size_acres} ${t('st_acre')}` : ''}` : t('st_no_plot')}
          </Text>
          {show.map((c) => {
            const sub = [c.entity_name, `${t('st_given_on')} ${fmtD(c.assigned_date)}`].filter(Boolean).join(' · ');
            return (
              <View key={c.id} style={[s.row, s.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{c.title}</Text>
                  <Text style={s.rowSub} numberOfLines={2}>{sub}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.earn, c.status === 'cancelled' && { color: C.outline, textDecorationLine: 'line-through' }]}>{inr(c.amount)}</Text>
                  <Text style={s.rowSub}>{contractStatusLabel(c.status, t)}</Text>
                </View>
              </View>
            );
          })}
          <View style={s.weekFoot}>
            <Text style={s.weekFootText}>{t('st_plot_total')} · {g.count}</Text>
            <Text style={s.weekFootText}>{inr(g.total_value)}</Text>
          </View>
        </View>
      ))}
      <MoreNote shown={shown} total={r.rows.length} t={t} />
    </>
  );
}

const REPORT_META: Record<ReportKind, { title: TranslationKey; path: string; byPlot: boolean }> = {
  operations: { title: 'st_ops_report', path: '/api/v1/statements/operations', byPlot: true },
  expenses: { title: 'st_exp_report', path: '/api/v1/statements/expenses', byPlot: true },
  contracts: { title: 'st_con_report', path: '/api/v1/statements/contracts', byPlot: true },
};

export function StatementReportScreen({ route, navigation }: ReportProps) {
  const { kind } = route.params;
  const meta = REPORT_META[kind];
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>(() => defaultPeriod('season'));
  const [plotId, setPlotId] = useState<string>(ALL);
  const [plots, setPlots] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!meta.byPlot) return;
    apiGet<{ items: { id: string; name: string }[] }>('/api/v1/plots', { page: 1, page_size: 100 })
      .then((d) => setPlots(d.items))
      .catch(() => {});
  }, [meta.byPlot]);

  const params = useMemo(() => {
    const p = { ...resolvePeriod(period).params };
    if (meta.byPlot && plotId !== ALL) p.plot_id = plotId;
    return p;
  }, [period, plotId, meta.byPlot]);

  const rep = useStatement<OperationsReport | ExpenseReport | ContractsReport>(meta.path, params);

  function onDownload() {
    if (!rep.data) return;
    const html = kind === 'operations' ? operationsHtml(rep.data as OperationsReport, t)
      : kind === 'expenses' ? expensesHtml(rep.data as ExpenseReport, t)
      : contractsHtml(rep.data as ContractsReport, t);
    download(html, t, true, setBusy);
  }

  const plotOptions = [{ id: ALL, label: t('st_all_plots') }, ...plots.map((p) => ({ id: p.id, label: p.name }))];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <NavBar title={t(meta.title)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.section}>{t('st_period')}</Text>
        <PeriodPicker value={period} onChange={setPeriod} modes={REPORT_MODES} />
        {meta.byPlot && plots.length > 0 && (
          <SelectField value={plotId} options={plotOptions} placeholder={t('st_all_plots')} title={t('plot')} onChange={setPlotId} />
        )}
        {rep.data && <Text style={s.periodText}>{periodLabel(rep.data.period, t)}</Text>}

        <StateBox loading={rep.loading} failed={rep.failed} reload={rep.reload} t={t} />
        {rep.data && kind === 'operations' && <OpsPreview r={rep.data as OperationsReport} t={t} />}
        {rep.data && kind === 'expenses' && <ExpPreview r={rep.data as ExpenseReport} t={t} />}
        {rep.data && kind === 'contracts' && <ConPreview r={rep.data as ContractsReport} t={t} />}
      </ScrollView>
      <DownloadBar disabled={!rep.data} busy={busy} onPress={onDownload} t={t} bottom={insets.bottom} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: R.md },
  barTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.primary, paddingHorizontal: 4 },
  body: { padding: 14, gap: 12, paddingBottom: 32 },

  section: { fontSize: 11, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 0.8 },
  periodText: { fontSize: 12, fontWeight: '600', color: C.onSurfaceVariant, textAlign: 'center' },

  reportCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surfaceLowest, borderRadius: R.xl, padding: 14, borderWidth: 1, borderColor: C.outlineVariant },
  reportIcon: { width: 44, height: 44, borderRadius: R.md, backgroundColor: C.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  reportTitle: { fontSize: 15, fontWeight: '800', color: C.onSurface },
  reportSub: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 46, backgroundColor: C.surfaceLowest, borderRadius: R.md, borderWidth: 1, borderColor: C.outlineVariant },
  searchInput: { flex: 1, fontSize: 15, color: C.onSurface },

  entityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surfaceLowest, borderRadius: R.xl, padding: 14, borderWidth: 1, borderColor: C.outlineVariant },
  avatar: { width: 44, height: 44, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  entityName: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  entityMeta: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 3 },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeCard: { flex: 1, borderWidth: 1.5, borderColor: C.outlineVariant, borderRadius: R.lg, padding: 14, alignItems: 'center', gap: 4, backgroundColor: C.surfaceLowest },
  typeCardOn: { borderColor: C.primaryContainer, backgroundColor: C.primaryContainer },
  typeLabel: { fontSize: 14, fontWeight: '800', color: C.onSurface, textAlign: 'center' },
  typeSub: { fontSize: 11, color: C.onSurfaceVariant, textAlign: 'center' },

  statsCard: { flexDirection: 'row', backgroundColor: C.surfaceLowest, borderRadius: R.xl, borderWidth: 1, borderColor: C.outlineVariant, paddingVertical: 12, paddingHorizontal: 4 },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statValue: { fontSize: 16, fontWeight: '800', color: C.onSurface },
  statLabel: { fontSize: 10, fontWeight: '600', color: C.onSurfaceVariant, marginTop: 2, textAlign: 'center' },

  balanceCard: { backgroundColor: C.primaryContainer, borderRadius: R.xl, padding: 16, alignItems: 'center' },
  balanceLabel: { fontSize: 12, fontWeight: '700', color: C.primaryFixed, textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceValue: { fontSize: 28, fontWeight: '900', color: C.onPrimary, marginTop: 2 },

  card: { backgroundColor: C.surfaceLowest, borderRadius: R.xl, borderWidth: 1, borderColor: C.outlineVariant, paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden' },
  cardTitle: { fontSize: 11, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 0.5, paddingVertical: 8, textTransform: 'uppercase' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  kvKey: { flex: 1, fontSize: 14, color: C.onSurface },
  kvVal: { fontSize: 14, fontWeight: '700', color: C.onSurface },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.surfaceHigh },
  rowTitle: { fontSize: 14, fontWeight: '700', color: C.onSurface },
  rowSub: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },
  badge: { borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  earn: { fontSize: 14, fontWeight: '800', color: C.primary },
  paid: { fontSize: 14, fontWeight: '800', color: C.error },

  weekHead: { fontSize: 11, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 0.4, paddingTop: 8, paddingBottom: 2, textTransform: 'uppercase' },
  weekFoot: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, borderTopWidth: 1, borderTopColor: C.primaryFixedDim, marginHorizontal: -14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#eaf4ee' },
  weekFootText: { fontSize: 12, fontWeight: '800', color: C.primary },

  moreNote: { fontSize: 12, color: C.onSurfaceVariant, textAlign: 'center', paddingVertical: 10 },
  hint: { fontSize: 12, color: C.onSurfaceVariant, textAlign: 'center', paddingHorizontal: 8 },
  warn: { fontSize: 12, color: '#6b4c04', backgroundColor: '#fef3c7', borderRadius: R.md, padding: 10 },
  emptyText: { fontSize: 14, color: C.onSurfaceVariant, textAlign: 'center', paddingVertical: 18 },

  stateBox: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  stateText: { fontSize: 14, color: C.onSurface, textAlign: 'center' },
  retry: { backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: C.onPrimary, fontWeight: '700' },

  downloadBar: { paddingHorizontal: 14, paddingTop: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  downloadBtn: { height: 52, backgroundColor: C.primary, borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pickBox: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  downloadText: { color: C.onPrimary, fontWeight: '800', fontSize: 16 },
});
