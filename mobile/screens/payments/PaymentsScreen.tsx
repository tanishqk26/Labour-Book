import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiGet } from '../../lib/api';
import { EntityPaymentSummary, PaymentRead, PaginatedResponse } from '../../types';
import { C, R, AVATAR_COLORS, initials, fmtCurrency } from '../../lib/theme';
import PaymentModal from '../../components/PaymentModal';

type PaymentsScreenProps = { navigation: { goBack: () => void } };

function todayISO() { return new Date().toISOString().slice(0, 10); }

function fmtDateShort(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
}

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank' };
const METHOD_ICON: Record<string, string> = { cash: 'cash', upi: 'contactless-payment', bank_transfer: 'bank-transfer' };

export default function PaymentsScreen({ navigation }: PaymentsScreenProps) {
  const insets = useSafeAreaInsets();
  const today = todayISO();

  const [balances, setBalances] = useState<EntityPaymentSummary[]>([]);
  const [recent, setRecent] = useState<PaymentRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payTarget, setPayTarget] = useState<EntityPaymentSummary | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [bData, rData] = await Promise.all([
        apiGet<EntityPaymentSummary[] | { items: EntityPaymentSummary[] }>('/api/v1/payments/entities'),
        apiGet<PaginatedResponse<PaymentRead>>('/api/v1/payments', { page: 1, page_size: 30 }),
      ]);
      setBalances(Array.isArray(bData) ? bData : ((bData as any).items ?? []));
      setRecent(rData.items ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const todayPayments = recent.filter((p) => p.date === today);
  const recentTop5 = recent.filter((p) => p.date !== today).slice(0, 5);

  function avatarFor(entityId: string, fallbackIdx: number) {
    const idx = balances.findIndex((b) => b.entity_id === entityId);
    return idx >= 0 ? AVATAR_COLORS[idx % AVATAR_COLORS.length] : AVATAR_COLORS[fallbackIdx % AVATAR_COLORS.length];
  }

  return (
    <View style={[ps.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={ps.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={ps.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={ps.pageTitle}>Payments</Text>
          <Text style={ps.pageSub}>Record and track payments to labours and teams.</Text>
        </View>
      </View>

      {loading ? (
        <View style={ps.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[ps.body, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Today's card ── */}
          <View style={ps.todayCard}>
            <View style={ps.todayTop}>
              <View style={ps.todayIconWrap}>
                <MaterialCommunityIcons name="calendar-today" size={18} color={C.onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ps.todayDate}>{fmtDateLabel(today)}</Text>
                <Text style={ps.todayTitle}>
                  {todayPayments.length === 0
                    ? 'No payments recorded today'
                    : `${todayPayments.length} payment${todayPayments.length > 1 ? 's' : ''} today`}
                </Text>
              </View>
              <TouchableOpacity style={ps.todayBtn} onPress={() => setPickerOpen(true)}>
                <MaterialCommunityIcons name="plus" size={14} color={C.onPrimary} />
                <Text style={ps.todayBtnText}>Note Payment</Text>
              </TouchableOpacity>
            </View>
            {todayPayments.length > 0 && (
              <View style={ps.todayList}>
                {todayPayments.map((p, i) => {
                  const c = avatarFor(p.labour_id ?? p.team_id ?? '', i);
                  const name = p.entity_name ?? (p.entity_type === 'team' ? 'Team' : 'Labour');
                  const isLast = i === todayPayments.length - 1;
                  return (
                    <View key={p.id} style={[ps.todayRow, isLast && ps.todayRowLast]}>
                      <View style={[ps.av, { backgroundColor: c.bg }]}>
                        <Text style={[ps.avTxt, { color: c.fg }]}>{initials(name)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={ps.name} numberOfLines={1}>{name}</Text>
                        <Text style={ps.tag}>{p.entity_type === 'team' ? 'Team' : 'Labourer'}</Text>
                      </View>
                      <Text style={ps.todayMethod}>{METHOD_LABEL[p.method] ?? p.method}</Text>
                      <Text style={ps.todayAmt}>{fmtCurrency(p.amount)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Recent Payments (top 5, excluding today) ── */}
          {recentTop5.length > 0 && (
            <View style={ps.section}>
              <Text style={ps.sectionTitle}>Recent Payments</Text>
              <View style={ps.table}>
                <View style={ps.thead}>
                  <Text style={[ps.th, { flex: 1 }]}>Name</Text>
                  <Text style={[ps.th, { width: 68 }]}>Date</Text>
                  <Text style={[ps.th, { width: 30, textAlign: 'center' }]}>Via</Text>
                  <Text style={[ps.th, { width: 60, textAlign: 'right' }]}>Amount</Text>
                </View>
                {recentTop5.map((p, i) => {
                  const c = avatarFor(p.labour_id ?? p.team_id ?? '', i);
                  const name = p.entity_name ?? (p.entity_type === 'team' ? 'Team' : 'Labour');
                  const isLast = i === recentTop5.length - 1;
                  return (
                    <View key={p.id} style={[ps.tr, isLast && ps.trLast]}>
                      <View style={ps.nameCell}>
                        <View style={[ps.av, { backgroundColor: c.bg }]}>
                          <Text style={[ps.avTxt, { color: c.fg }]}>{initials(name)}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={ps.name} numberOfLines={1}>{name}</Text>
                          <Text style={ps.tag}>{p.entity_type === 'team' ? 'Team' : 'Labourer'}</Text>
                        </View>
                      </View>
                      <Text style={ps.date}>{fmtDateShort(p.date)}</Text>
                      <View style={{ width: 30, alignItems: 'center' }}>
                        <MaterialCommunityIcons name={(METHOD_ICON[p.method] ?? 'cash') as any} size={14} color={C.onSurfaceVariant} />
                      </View>
                      <Text style={ps.amount}>{fmtCurrency(p.amount)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {balances.length === 0 && recent.length === 0 && (
            <View style={ps.empty}>
              <MaterialCommunityIcons name="credit-card-outline" size={52} color={C.outline} style={{ marginBottom: 10 }} />
              <Text style={ps.emptyTitle}>No Payments Yet</Text>
              <Text style={ps.emptySub}>Tap "Note Payment" to record the first one.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Entity picker modal ── */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={ps.pickerOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <TouchableOpacity style={ps.pickerSheet} activeOpacity={1} onPress={() => {}}>
            <View style={ps.pickerHandle} />
            <Text style={ps.pickerTitle}>Select who to pay</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {balances.filter((b) => b.pending > 0).map((b, i) => {
                const c = AVATAR_COLORS[i % AVATAR_COLORS.length];
                return (
                  <TouchableOpacity
                    key={b.entity_id}
                    style={ps.pickerRow}
                    onPress={() => { setPickerOpen(false); setPayTarget(b); }}
                  >
                    <View style={[ps.av, { backgroundColor: c.bg }]}>
                      <Text style={[ps.avTxt, { color: c.fg }]}>{initials(b.entity_name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ps.name}>{b.entity_name}</Text>
                      <Text style={ps.tag}>{b.entity_type === 'team' ? 'Team' : 'Labourer'}</Text>
                    </View>
                    <Text style={[ps.balance, { color: C.error }]}>{fmtCurrency(b.pending)}</Text>
                  </TouchableOpacity>
                );
              })}
              {balances.filter((b) => b.pending > 0).length === 0 && (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={ps.emptySub}>All balances are settled.</Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Payment modal ── */}
      {payTarget && (
        <PaymentModal
          visible
          onClose={() => setPayTarget(null)}
          onSuccess={() => { setPayTarget(null); load(true); }}
          entityType={payTarget.entity_type as 'individual' | 'team'}
          entityId={payTarget.entity_id}
          entityName={payTarget.entity_name}
        />
      )}
    </View>
  );
}

const ps = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 20 },

  // header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: C.surfaceLowest, borderBottomWidth: 1, borderBottomColor: C.outlineVariant,
  },
  backBtn: { padding: 4 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.primary, letterSpacing: -0.3 },
  pageSub: { fontSize: 11, color: C.onSurfaceVariant, marginTop: 1 },
  noteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primaryContainer, borderRadius: R.lg, paddingHorizontal: 12, paddingVertical: 8 },
  noteBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 12 },

  // today card
  todayCard: { backgroundColor: C.surfaceLowest, borderRadius: R.xl, borderWidth: 1, borderColor: C.outlineVariant, overflow: 'hidden' },
  todayTop: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  todayIconWrap: { width: 36, height: 36, borderRadius: R.md, backgroundColor: C.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  todayDate: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5 },
  todayTitle: { fontSize: 13, fontWeight: '600', color: C.onSurface, marginTop: 1 },
  todayBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.primaryContainer, borderRadius: R.lg, paddingHorizontal: 10, paddingVertical: 7 },
  todayBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 11 },
  todayList: { borderTopWidth: 1, borderTopColor: C.outlineVariant },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  todayRowLast: { borderBottomWidth: 0 },
  todayMethod: { fontSize: 11, color: C.onSurfaceVariant },
  todayAmt: { fontSize: 13, fontWeight: '700', color: '#2a7a4f', minWidth: 52, textAlign: 'right' },

  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.onSurface, paddingLeft: 2 },

  // shared table
  table: { borderRadius: R.xl, borderWidth: 1, borderColor: C.outlineVariant, overflow: 'hidden', backgroundColor: C.surfaceLowest },
  thead: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceHigh, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  th: { fontSize: 9, fontWeight: '800', color: C.onSurfaceVariant, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  trLast: { borderBottomWidth: 0 },

  nameCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, marginRight: 4 },
  av: { width: 32, height: 32, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avTxt: { fontSize: 11, fontWeight: '700' },
  name: { fontSize: 13, fontWeight: '600', color: C.onSurface },
  tag: { fontSize: 10, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 1 },

  balance: { width: 76, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  payBtn: { backgroundColor: C.primaryContainer, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 5 },
  payBtnText: { color: C.onPrimary, fontSize: 11, fontWeight: '700' },
  date: { width: 68, fontSize: 11, color: C.onSurfaceVariant },
  amount: { width: 60, fontSize: 13, fontWeight: '700', color: '#2a7a4f', textAlign: 'right' },

  // entity picker
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: C.surfaceLowest, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '70%', paddingBottom: 32 },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.outlineVariant, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  pickerTitle: { fontSize: 13, fontWeight: '800', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, paddingVertical: 12 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.outlineVariant },

  empty: { alignItems: 'center', paddingVertical: 56, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.onSurface },
  emptySub: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center' },
});
