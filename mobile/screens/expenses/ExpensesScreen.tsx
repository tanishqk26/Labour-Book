import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ExpenseFormSheet from '../../components/ExpenseFormSheet';
import { useLanguage } from '../../context/LanguageContext';
import { apiGet, apiPost } from '../../lib/api';
import { CAT_ICON, Txn, TxnKind, catLabelKey, currentFarmYear, farmYearLabel } from '../../lib/expenseMeta';
import { C, R, fmtCurrency, fmtDate } from '../../lib/theme';

interface PlotPnL {
  plot_id: string; plot_name: string; size_acres: number;
  income: number; expense: number; profit: number;
  profit_per_acre: number | null; expense_per_acre: number | null; unpriced_count: number;
}
interface Summary {
  year: number; income: number; expense: number; profit: number; unpriced_count: number;
  allocated: boolean; plots: PlotPnL[];
  shared: { income: number; expense: number; unpriced_count: number };
}
interface Due {
  kind: TxnKind; party: string | null; total: number; paid: number; balance: number;
  unpriced_count: number; entries: number;
}
type Tab = 'entries' | 'plots' | 'dues';

export default function ExpensesScreen({ navigation, route }: {
  navigation: { goBack: () => void };
  route?: { params?: { plotId?: string; date?: string; operationId?: string; kind?: TxnKind } };
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const thisYear = currentFarmYear();

  const [year, setYear] = useState(thisYear);
  const [tab, setTab] = useState<Tab>('entries');
  const [allocate, setAllocate] = useState(false);
  const [partyFilter, setPartyFilter] = useState<string | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Txn[]>([]);
  const [dues, setDues] = useState<Due[]>([]);
  const [plots, setPlots] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [form, setForm] = useState<{ kind: TxnKind; entry: Txn | null; prefill?: { plot_id?: string | null; date?: string; operation_id?: string | null } } | null>(null);
  const [settle, setSettle] = useState<Due | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const listParams: Record<string, string | number> = { page_size: 200 };
      if (partyFilter) listParams.party = partyFilter;            // a shop's whole history, any year
      else { listParams.date_from = `${year}-04-01`; listParams.date_to = `${year + 1}-03-31`; }
      const [sum, list, du, pl] = await Promise.all([
        apiGet<Summary>('/api/v1/expenses/summary', { year, allocate_shared: allocate ? 'true' : 'false' }),
        apiGet<{ items: Txn[] }>('/api/v1/expenses', listParams),
        apiGet<Due[]>('/api/v1/expenses/dues'),
        apiGet<{ items: { id: string; name: string; is_active: boolean }[] }>('/api/v1/plots', { page: 1, page_size: 100 }),
      ]);
      setSummary(sum); setEntries(list.items ?? []); setDues(du);
      setPlots((pl.items ?? []).filter((p) => p.is_active !== false).map((p) => ({ id: p.id, name: p.name })));
    } catch { setError(true); }
    finally { setLoading(false); setRefreshing(false); }
  }, [year, allocate, partyFilter]);

  useEffect(() => { load(); }, [load]);

  // Opened from "Add cost?" after saving an operation: go straight to the form
  useEffect(() => {
    const p = route?.params;
    if (p?.plotId || p?.date) setForm({ kind: p.kind ?? 'expense', entry: null, prefill: { plot_id: p.plotId ?? null, date: p.date, operation_id: p.operationId ?? null } });
  }, [route?.params]);

  const profit = summary?.profit ?? 0;
  const profitColor = profit >= 0 ? C.primary : C.error;

  // ── Tabs ──────────────────────────────────────────────────────────────────

  function renderEntry(e: Txn) {
    const isIncome = e.kind === 'income';
    const sub = [fmtDate(e.txn_date), e.plot_name, e.party].filter(Boolean).join(' · ');
    return (
      <TouchableOpacity key={e.id} style={s.row} onPress={() => setForm({ kind: e.kind, entry: e })} activeOpacity={0.8}>
        <View style={[s.rowIcon, { backgroundColor: isIncome ? C.primaryFixed : C.errorContainer }]}>
          <MaterialCommunityIcons name={(CAT_ICON[e.kind][e.category] ?? 'cash') as never} size={22} color={isIncome ? C.primary : C.error} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.rowTitle} numberOfLines={1}>{e.description || t(catLabelKey(e.kind, e.category))}</Text>
          <Text style={s.rowSub} numberOfLines={1}>{sub}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          {e.amount == null ? (
            <Text style={s.pending}>{t('exp_price_pending')}</Text>
          ) : (
            <Text style={[s.rowAmt, { color: isIncome ? C.primary : C.error }]}>{isIncome ? '+' : '−'}{fmtCurrency(e.amount)}</Text>
          )}
          {e.status === 'credit' || e.status === 'partial' ? (
            <View style={s.badge}><Text style={s.badgeText}>{e.status === 'credit' ? (isIncome ? t('exp_not_received') : t('exp_on_credit')) : `${fmtCurrency(e.balance ?? 0)} ${t('exp_left')}`}</Text></View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  const header = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      {/* Farm year */}
      <View style={s.yearRow}>
        <TouchableOpacity style={s.navBtn} onPress={() => setYear(year - 1)}><MaterialCommunityIcons name="chevron-left" size={22} color={C.onSurface} /></TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.yearLabel}>{farmYearLabel(year)}</Text>
          <Text style={s.yearSub}>{t('exp_season')}</Text>
        </View>
        <TouchableOpacity style={[s.navBtn, year >= thisYear && { opacity: 0.3 }]} disabled={year >= thisYear} onPress={() => setYear(year + 1)}>
          <MaterialCommunityIcons name="chevron-right" size={22} color={C.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Totals */}
      <View style={s.summaryCard}>
        <View style={s.sumCol}><Text style={s.sumLabel}>{t('exp_income')}</Text><Text style={[s.sumVal, { color: C.primary }]}>{fmtCurrency(summary?.income ?? 0)}</Text></View>
        <View style={s.sumDiv} />
        <View style={s.sumCol}><Text style={s.sumLabel}>{t('exp_expense')}</Text><Text style={[s.sumVal, { color: C.error }]}>{fmtCurrency(summary?.expense ?? 0)}</Text></View>
        <View style={s.sumDiv} />
        <View style={s.sumCol}>
          <Text style={s.sumLabel}>{profit >= 0 ? t('exp_profit') : t('exp_loss')}</Text>
          <Text style={[s.sumVal, { color: profitColor }]}>{fmtCurrency(Math.abs(profit))}</Text>
        </View>
      </View>
      {summary && summary.unpriced_count > 0 ? (
        <View style={s.warn}>
          <MaterialCommunityIcons name="alert-outline" size={18} color="#b45309" />
          <Text style={s.warnText}>{summary.unpriced_count} {t('exp_unpriced_note')}</Text>
        </View>
      ) : null}

      {/* Tabs */}
      <View style={s.tabs}>
        {(['entries', 'plots', 'dues'] as Tab[]).map((k) => (
          <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabOn]} onPress={() => setTab(k)}>
            <Text style={[s.tabText, tab === k && s.tabTextOn]}>{t(k === 'entries' ? 'exp_tab_entries' : k === 'plots' ? 'exp_tab_plots' : 'exp_tab_dues')}</Text>
            {k === 'dues' && dues.length > 0 ? <View style={s.dot} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'entries' && partyFilter ? (
        <TouchableOpacity style={s.filterChip} onPress={() => setPartyFilter(null)}>
          <Text style={s.filterText}>{partyFilter}</Text>
          <MaterialCommunityIcons name="close-circle" size={18} color={C.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  function renderPlots() {
    const shared = summary?.shared;
    const hasShared = !!shared && (shared.income > 0 || shared.expense > 0);
    return (
      <View style={{ gap: 10 }}>
        <View style={s.switchCard}>
          <Text style={s.switchLabel}>{t('exp_allocate')}</Text>
          <Switch value={allocate} onValueChange={setAllocate} trackColor={{ true: C.primaryContainer, false: C.outlineVariant }} thumbColor={allocate ? C.primary : C.outline} />
        </View>
        {summary?.plots.map((p) => (
          <View key={p.plot_id} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.cardTitle}>{p.plot_name}</Text>
              <Text style={s.cardSub}>{p.size_acres} {t('exp_acres')}</Text>
            </View>
            <View style={s.triple}>
              <View style={s.sumCol}><Text style={s.sumLabel}>{t('exp_income')}</Text><Text style={[s.tVal, { color: C.primary }]}>{fmtCurrency(p.income)}</Text></View>
              <View style={s.sumCol}><Text style={s.sumLabel}>{t('exp_expense')}</Text><Text style={[s.tVal, { color: C.error }]}>{fmtCurrency(p.expense)}</Text></View>
              <View style={s.sumCol}><Text style={s.sumLabel}>{p.profit >= 0 ? t('exp_profit') : t('exp_loss')}</Text><Text style={[s.tVal, { color: p.profit >= 0 ? C.primary : C.error }]}>{fmtCurrency(Math.abs(p.profit))}</Text></View>
            </View>
            {p.profit_per_acre != null ? (
              <Text style={s.perAcre}>
                {p.profit_per_acre >= 0 ? '+' : '−'}{fmtCurrency(Math.abs(p.profit_per_acre))} {t('exp_per_acre')}
                {p.expense_per_acre != null ? `  ·  ${t('exp_expense')} ${fmtCurrency(p.expense_per_acre)} ${t('exp_per_acre')}` : ''}
              </Text>
            ) : null}
            {p.unpriced_count > 0 ? <Text style={s.cardWarn}>{p.unpriced_count} {t('exp_unpriced_bills')}</Text> : null}
          </View>
        ))}
        {!summary?.allocated && hasShared ? (
          <View style={[s.card, { backgroundColor: C.surfaceLow }]}>
            <Text style={s.cardTitle}>{t('exp_shared')}</Text>
            <View style={s.triple}>
              <View style={s.sumCol}><Text style={s.sumLabel}>{t('exp_income')}</Text><Text style={[s.tVal, { color: C.primary }]}>{fmtCurrency(shared!.income)}</Text></View>
              <View style={s.sumCol}><Text style={s.sumLabel}>{t('exp_expense')}</Text><Text style={[s.tVal, { color: C.error }]}>{fmtCurrency(shared!.expense)}</Text></View>
              <View style={s.sumCol} />
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  function renderDues() {
    const owe = dues.filter((d) => d.kind === 'expense');
    const owed = dues.filter((d) => d.kind === 'income');
    if (!dues.length) return <Text style={s.empty}>{t('exp_no_dues')}</Text>;
    const section = (title: string, list: Due[], color: string) => list.length === 0 ? null : (
      <View key={title} style={{ gap: 8 }}>
        <Text style={s.sectionLabel}>{title}</Text>
        {list.map((d) => (
          <View key={`${d.kind}-${d.party ?? ''}`} style={s.card}>
            <TouchableOpacity
              onPress={() => { if (d.party) { setPartyFilter(d.party); setTab('entries'); } }}
              disabled={!d.party} activeOpacity={0.7} style={s.cardTop}
            >
              <Text style={s.cardTitle} numberOfLines={1}>{d.party ?? '—'}</Text>
              <Text style={[s.dueAmt, { color }]}>{fmtCurrency(d.balance)}</Text>
            </TouchableOpacity>
            <Text style={s.cardSub}>
              {d.entries} {t('exp_bills')}{d.unpriced_count > 0 ? ` · ${d.unpriced_count} ${t('exp_unpriced_bills')}` : ''}
            </Text>
            {d.party && d.balance > 0 ? (
              <TouchableOpacity style={[s.payBtn, { backgroundColor: color }]} onPress={() => setSettle(d)}>
                <Text style={s.payBtnText}>{t('exp_record_payment')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>
    );
    return (
      <View style={{ gap: 16 }}>
        {section(t('exp_you_owe'), owe, C.error)}
        {section(t('exp_owed_to_you'), owed, C.primary)}
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={{ paddingRight: 12 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>{t('expenses')}</Text>
          <Text style={s.pageSub}>{t('expenses_sub')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : error ? (
        <View style={s.centred}>
          <MaterialCommunityIcons name="wifi-off" size={44} color={C.outline} />
          <Text style={s.empty}>{t('exp_load_failed')}</Text>
          <TouchableOpacity style={s.retry} onPress={() => load()}><Text style={s.retryText}>{t('voice_retry')}</Text></TouchableOpacity>
        </View>
      ) : tab === 'entries' ? (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => renderEntry(item)}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={s.empty}>{t('exp_no_entries')}</Text>}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
        >
          {header}
          {tab === 'plots' ? renderPlots() : renderDues()}
        </ScrollView>
      )}

      {/* Add buttons */}
      {!loading && !error && (
        <View style={[s.fabRow, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={[s.fab, { borderColor: C.error }]} onPress={() => setForm({ kind: 'expense', entry: null })} activeOpacity={0.7}>
            <MaterialCommunityIcons name="minus" size={22} color={C.error} />
            <Text style={[s.fabText, { color: C.error }]}>{t('exp_add_expense')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.fab, { borderColor: C.primaryContainer }]} onPress={() => setForm({ kind: 'income', entry: null })} activeOpacity={0.7}>
            <MaterialCommunityIcons name="plus" size={22} color={C.primaryContainer} />
            <Text style={[s.fabText, { color: C.primaryContainer }]}>{t('exp_add_income')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ExpenseFormSheet
        visible={!!form}
        kind={form?.kind ?? 'expense'}
        entry={form?.entry}
        prefill={form?.prefill}
        plots={plots}
        onClose={() => setForm(null)}
        onSaved={() => load(true)}
      />

      <SettleSheet due={settle} onClose={() => setSettle(null)} onDone={() => { setSettle(null); load(true); }} />
    </View>
  );
}

// ─── Record a payment to a shop / from a buyer ────────────────────────────────

function SettleSheet({ due, onClose, onDone }: { due: Due | null; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (due) setAmount(String(due.balance)); }, [due]);
  if (!due) return null;
  const isIncome = due.kind === 'income';

  async function pay() {
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) { Alert.alert(t('expenses'), t('exp_amount_required')); return; }
    if (n > due!.balance) { Alert.alert(t('expenses'), t('exp_paid_too_much')); return; }
    setSaving(true);
    try {
      await apiPost('/api/v1/expenses/settle', { kind: due!.kind, party: due!.party, amount: n });
      onDone();
    } catch { Alert.alert(t('expenses'), t('exp_pay_failed')); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={s.dialog} onPress={() => {}}>
            <Text style={s.cardTitle}>{due.party}</Text>
            <Text style={s.cardSub}>{isIncome ? t('exp_owed_to_you') : t('exp_you_owe')}: {fmtCurrency(due.balance)}</Text>
            <TextInput
              style={s.settleInput}
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
            />
            <Text style={s.hint}>{t('exp_settle_hint')}</Text>
            <TouchableOpacity style={[s.payBtn, { backgroundColor: isIncome ? C.primaryContainer : C.error }, saving && { opacity: 0.6 }]} onPress={pay} disabled={saving}>
              {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={s.payBtnText}>{t('exp_record_payment')}</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.outlineVariant, backgroundColor: C.surface },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.primary },
  pageSub: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 1 },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  empty: { fontSize: 14, color: C.onSurfaceVariant, textAlign: 'center', paddingVertical: 28 },
  retry: { backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: C.onPrimary, fontWeight: '700' },

  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 38, height: 38, borderRadius: R.full, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  yearLabel: { fontSize: 18, fontWeight: '800', color: C.onSurface },
  yearSub: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },

  summaryCard: { flexDirection: 'row', backgroundColor: C.surfaceLowest, borderRadius: R.lg, borderWidth: 1, borderColor: C.outlineVariant, paddingVertical: 16 },
  sumCol: { flex: 1, alignItems: 'center', gap: 4 },
  sumDiv: { width: 1, backgroundColor: C.outlineVariant },
  sumLabel: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4 },
  sumVal: { fontSize: 18, fontWeight: '800' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef3c7', borderRadius: R.md, padding: 12 },
  warnText: { flex: 1, fontSize: 13, color: '#6b4c04', fontWeight: '600' },

  tabs: { flexDirection: 'row', backgroundColor: C.surfaceHigh, borderRadius: R.md, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: R.sm },
  tabOn: { backgroundColor: C.surfaceLowest },
  tabText: { fontSize: 13, fontWeight: '700', color: C.onSurfaceVariant },
  tabTextOn: { color: C.primary },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.error },
  filterChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primaryFixed, borderRadius: R.full, paddingHorizontal: 14, paddingVertical: 8 },
  filterText: { fontSize: 14, fontWeight: '700', color: C.primary },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surfaceLowest, borderRadius: R.lg, borderWidth: 1, borderColor: C.outlineVariant, padding: 12 },
  rowIcon: { width: 44, height: 44, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  rowSub: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },
  rowAmt: { fontSize: 16, fontWeight: '800' },
  pending: { fontSize: 13, fontWeight: '800', color: '#b45309' },
  badge: { backgroundColor: '#fef3c7', borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#6b4c04' },

  switchCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surfaceLowest, borderRadius: R.lg, borderWidth: 1, borderColor: C.outlineVariant, padding: 12 },
  switchLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: C.onSurface },
  card: { backgroundColor: C.surfaceLowest, borderRadius: R.lg, borderWidth: 1, borderColor: C.outlineVariant, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: C.onSurface },
  cardSub: { fontSize: 12, color: C.onSurfaceVariant },
  cardWarn: { fontSize: 12, fontWeight: '700', color: '#b45309' },
  triple: { flexDirection: 'row' },
  tVal: { fontSize: 15, fontWeight: '800' },
  perAcre: { fontSize: 12, fontWeight: '600', color: C.onSurfaceVariant },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 },
  dueAmt: { fontSize: 20, fontWeight: '800' },
  payBtn: { borderRadius: R.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  payBtnText: { color: C.onPrimary, fontWeight: '800', fontSize: 14 },

  fabRow: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 10, backgroundColor: 'rgba(252,249,248,0.95)' },
  fab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: R.full, borderWidth: 2, backgroundColor: C.surfaceLowest },
  fabText: { fontSize: 15, fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: C.surface, borderRadius: R.xl, padding: 20, gap: 12 },
  settleInput: { height: 60, borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow, fontSize: 28, fontWeight: '800', color: C.onSurface, paddingHorizontal: 16 },
  hint: { fontSize: 12, color: C.onSurfaceVariant },
});
