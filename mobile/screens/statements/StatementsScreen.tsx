import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiGet } from '../../lib/api';
import { C, R, fmtCurrency, fmtDate } from '../../lib/theme';
import { MoreStackParamList } from '../details/types';

type ListProps = NativeStackScreenProps<MoreStackParamList, 'Statements'>;
type DetailProps = NativeStackScreenProps<MoreStackParamList, 'StatementDetail'>;

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
}

interface PaymentRow {
  date: string;
  type: string;
  description: string;
  amount: number;
}

interface Summary {
  total_days_present: number;
  total_days_absent: number;
  total_days_half: number;
  total_wage_earned: number;
  total_paid_borrowed: number;
  balance: number;
}

interface Combined {
  entity: { name: string; entity_type: string };
  summary: Summary;
  work_rows: WorkRow[];
  payment_rows: PaymentRow[];
}

export function StatementsListScreen({ navigation }: ListProps) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<StatementEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'individual' | 'team'>('individual');

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

  const shown = items.filter((e) => e.entity_type === tab);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>‹</Text></TouchableOpacity>
        <Text style={s.title}>Statements</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.filters}>
        {(['individual', 'team'] as const).map((k) => (
          <TouchableOpacity key={k} style={[s.chip, tab === k && s.chipOn]} onPress={() => setTab(k)}>
            <Text style={[s.chipText, tab === k && s.chipTextOn]}>{k === 'individual' ? 'Labour' : 'Teams'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View> : error ? (
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
          ListEmptyComponent={<Text style={s.empty}>No {tab === 'team' ? 'teams' : 'labourers'} found.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('StatementDetail', { entityType: item.entity_type, entityId: item.id, name: item.name })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.meta}>{fmtCurrency(item.daily_wage)}/day{item.hometown ? ` · ${item.hometown}` : ''}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

export function StatementDetailScreen({ route, navigation }: DetailProps) {
  const { entityType, entityId, name } = route.params;
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Combined | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statement = await apiGet<Combined>(`/api/v1/statements/combined/${entityType}/${entityId}`);
      setData(statement);
    } catch {
      setError('Could not load this statement.');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>‹</Text></TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{name}</Text>
        <View style={{ width: 36 }} />
      </View>
      {loading ? <View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View> : error || !data ? (
        <View style={s.centred}>
          <Text style={s.empty}>{error ?? 'No statement'}</Text>
          <TouchableOpacity style={s.retry} onPress={load}><Text style={s.retryText}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          <View style={s.kpiRow}>
            <Kpi label="Earned" value={fmtCurrency(data.summary.total_wage_earned)} />
            <Kpi label="Paid" value={fmtCurrency(data.summary.total_paid_borrowed)} />
            <Kpi label="Balance" value={fmtCurrency(data.summary.balance)} accent={data.summary.balance > 0} />
          </View>
          <Text style={s.section}>
            Attendance · {data.summary.total_days_present} present · {data.summary.total_days_half} half · {data.summary.total_days_absent} absent
          </Text>
          {data.work_rows.length === 0 ? <Text style={s.meta}>No work rows.</Text> : data.work_rows.map((row, i) => (
            <View key={`${row.date}-${i}`} style={s.line}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{fmtDate(row.date)}</Text>
                <Text style={s.meta}>{row.status}{row.task ? ` · ${row.task}` : ''}{row.num_labourers ? ` · ${row.num_labourers} labourers` : ''}</Text>
              </View>
              <Text style={s.amount}>{fmtCurrency(row.wage_earned)}</Text>
            </View>
          ))}
          <Text style={s.section}>Payments</Text>
          {data.payment_rows.filter((r) => r.type === 'borrowed').length === 0 ? <Text style={s.meta}>No payments recorded.</Text> : data.payment_rows.filter((r) => r.type === 'borrowed').map((row, i) => (
            <View key={`${row.date}-p-${i}`} style={s.line}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{fmtDate(row.date)}</Text>
                <Text style={s.meta}>{row.description}</Text>
              </View>
              <Text style={[s.amount, { color: C.primary }]}>{fmtCurrency(row.amount)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, accent && { color: C.tertiary }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  back: { width: 36, alignItems: 'center' },
  backText: { fontSize: 32, color: C.primary, lineHeight: 34 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.primary },
  filters: { flexDirection: 'row', gap: 8, padding: 12 },
  chip: { flex: 1, height: 36, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceHigh },
  chipOn: { backgroundColor: C.primary },
  chipText: { fontWeight: '700', color: C.onSurfaceVariant },
  chipTextOn: { color: C.onPrimary },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLowest, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: C.outlineVariant },
  name: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  meta: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },
  chevron: { fontSize: 22, color: C.outline },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { fontSize: 15, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  retry: { marginTop: 12, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: C.onPrimary, fontWeight: '700' },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, backgroundColor: C.surfaceLowest, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.outlineVariant },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant },
  kpiValue: { fontSize: 14, fontWeight: '800', color: C.primary, marginTop: 2 },
  section: { fontSize: 13, fontWeight: '800', color: C.onSurfaceVariant, marginTop: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceLowest, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.outlineVariant },
  amount: { fontSize: 14, fontWeight: '700', color: C.onSurface },
});
