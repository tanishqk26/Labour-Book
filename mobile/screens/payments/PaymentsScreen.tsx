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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiGet } from '../../lib/api';
import { EntityPaymentSummary, PaymentRead, PaginatedResponse } from '../../types';
import { C, R, AVATAR_COLORS, initials, fmtCurrency, fmtDate } from '../../lib/theme';
import PaymentModal from '../../components/PaymentModal';

type PaymentsScreenProps = { navigation: { goBack: () => void } };

export default function PaymentsScreen({ navigation }: PaymentsScreenProps) {
  const insets = useSafeAreaInsets();
  const [balances, setBalances] = useState<EntityPaymentSummary[]>([]);
  const [recent, setRecent] = useState<PaymentRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payTarget, setPayTarget] = useState<EntityPaymentSummary | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [bData, rData] = await Promise.all([
        apiGet<EntityPaymentSummary[] | { items: EntityPaymentSummary[] }>('/api/v1/payments/entities'),
        apiGet<PaginatedResponse<PaymentRead>>('/api/v1/payments', { page: 1, page_size: 15 }),
      ]);
      setBalances(Array.isArray(bData) ? bData : ((bData as any).items ?? []));
      setRecent(rData.items ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPending = balances.reduce((s, b) => s + Math.max(b.pending, 0), 0);
  const dueCount = balances.filter((b) => b.pending > 0).length;

  return (
    <View style={[ps.root, { paddingTop: insets.top }]}>
      <View style={ps.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={ps.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={ps.title}>Payments</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <View style={ps.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[ps.body, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary cards */}
          <View style={ps.summaryRow}>
            <View style={ps.summaryCard}>
              <Text style={ps.summaryLabel}>TOTAL PENDING</Text>
              <Text style={[ps.summaryValue, { color: totalPending > 0 ? C.error : C.primary }]}>
                {fmtCurrency(totalPending)}
              </Text>
            </View>
            <View style={ps.summaryCard}>
              <Text style={ps.summaryLabel}>DUE</Text>
              <Text style={ps.summaryValue}>{dueCount}</Text>
              <Text style={ps.summarySub}>entities</Text>
            </View>
          </View>

          {/* Entity balances */}
          {balances.length > 0 && (
            <>
              <Text style={ps.sectionLabel}>ALL BALANCES</Text>
              {balances.map((b, i) => {
                const c = AVATAR_COLORS[i % AVATAR_COLORS.length];
                return (
                  <View key={b.entity_id} style={ps.entityRow}>
                    <View style={[ps.entityAvatar, { backgroundColor: c.bg }]}>
                      <Text style={[ps.entityAvatarText, { color: c.fg }]}>{initials(b.entity_name)}</Text>
                    </View>
                    <View style={ps.entityInfo}>
                      <Text style={ps.entityName}>{b.entity_name}</Text>
                      <Text style={ps.entityType}>{b.entity_type === 'team' ? 'Team' : 'Labourer'}</Text>
                    </View>
                    <View style={ps.entityRight}>
                      <Text style={[ps.pendingAmt, { color: b.pending > 0 ? C.error : C.primary }]}>
                        {b.pending > 0 ? fmtCurrency(b.pending) : 'Settled'}
                      </Text>
                      {b.pending > 0 && (
                        <TouchableOpacity style={ps.payBtn} onPress={() => setPayTarget(b)}>
                          <Text style={ps.payBtnText}>Pay</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* Recent payments */}
          {recent.length > 0 && (
            <>
              <Text style={[ps.sectionLabel, { marginTop: 8 }]}>RECENT PAYMENTS</Text>
              {recent.map((p) => (
                <View key={p.id} style={ps.paymentRow}>
                  <View style={ps.paymentLeft}>
                    <Text style={ps.paymentEntity}>
                      {p.entity_name ?? (p.entity_type === 'team' ? 'Team' : 'Labour')}
                    </Text>
                    <Text style={ps.paymentMeta}>{fmtDate(p.date)} · {p.method}</Text>
                    {p.notes ? <Text style={ps.paymentNote} numberOfLines={1}>{p.notes}</Text> : null}
                  </View>
                  <Text style={ps.paymentAmt}>{fmtCurrency(p.amount)}</Text>
                </View>
              ))}
            </>
          )}

          {balances.length === 0 && recent.length === 0 && (
            <View style={ps.emptyBox}>
              <MaterialCommunityIcons name="credit-card-outline" size={48} color={C.outline} style={{ marginBottom: 8 }} />
              <Text style={ps.emptyTitle}>No Payments Yet</Text>
              <Text style={ps.emptySub}>Record a payment from a labour or team profile, or tap Pay next to an entity above.</Text>
            </View>
          )}
        </ScrollView>
      )}

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
  bar: {
    height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.outlineVariant,
  },
  backBtn: { width: 48, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.primary },
  body: { padding: 16, gap: 10 },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },

  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1, backgroundColor: C.surfaceLowest, borderRadius: R.xl, padding: 14,
    borderWidth: 1, borderColor: C.outlineVariant, gap: 4,
  },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.8 },
  summaryValue: { fontSize: 24, fontWeight: '800', color: C.primary, letterSpacing: -0.5 },
  summarySub: { fontSize: 11, color: C.onSurfaceVariant },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 1, paddingLeft: 4 },

  entityRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLowest,
    borderRadius: R.lg, padding: 12, borderWidth: 1, borderColor: C.outlineVariant, gap: 10,
  },
  entityAvatar: { width: 40, height: 40, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  entityAvatarText: { fontSize: 13, fontWeight: '700' },
  entityInfo: { flex: 1 },
  entityName: { fontSize: 14, fontWeight: '600', color: C.onSurface },
  entityType: { fontSize: 11, color: C.onSurfaceVariant, marginTop: 1 },
  entityRight: { alignItems: 'flex-end', gap: 4 },
  pendingAmt: { fontSize: 15, fontWeight: '800' },
  payBtn: { backgroundColor: C.primaryContainer, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5 },
  payBtnText: { color: C.onPrimary, fontSize: 12, fontWeight: '700' },

  paymentRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLowest,
    borderRadius: R.lg, padding: 12, borderWidth: 1, borderColor: C.outlineVariant,
  },
  paymentLeft: { flex: 1, gap: 2 },
  paymentEntity: { fontSize: 14, fontWeight: '600', color: C.onSurface },
  paymentMeta: { fontSize: 11, color: C.onSurfaceVariant },
  paymentNote: { fontSize: 11, color: C.outline, fontStyle: 'italic' },
  paymentAmt: { fontSize: 15, fontWeight: '700', color: C.primary },

  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.onSurface },
  emptySub: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center', paddingHorizontal: 16 },
});
