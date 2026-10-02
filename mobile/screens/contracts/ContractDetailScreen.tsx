import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiError, apiDelete, apiGet, apiPatch } from '../../lib/api';
import { C, R, fmtCurrency, fmtDate } from '../../lib/theme';
import { MoreStackParamList } from '../details/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'ContractDetail'>;

interface ContractFull {
  id: string;
  title: string;
  description?: string | null;
  entity_type: string;
  entity_id?: string | null;
  entity_name?: string | null;
  amount: number;
  assigned_date: string;
  completion_date?: string | null;
  status: string;
  plot?: { id: string; name: string; area?: number | null; area_unit?: string | null } | null;
}

type ContractStatus = 'active' | 'completed' | 'cancelled';

const STATUS_STYLE: Record<string, { bg: string; fg: string; icon: string }> = {
  active: { bg: C.primaryFixed, fg: C.primary, icon: 'clock-outline' },
  completed: { bg: '#d7e4f0', fg: '#111d25', icon: 'check-circle-outline' },
  cancelled: { bg: '#fef2f2', fg: C.error, icon: 'close-circle-outline' },
};

export default function ContractDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const [contract, setContract] = useState<ContractFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<ContractStatus | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null); setNotFound(false);
    try {
      const data = await apiGet<ContractFull>(`/api/v1/contracts/${id}`);
      setContract(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError('Could not load this contract.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(newStatus: ContractStatus) {
    if (!contract || contract.status === newStatus) return;
    setUpdatingStatus(newStatus);
    try {
      await apiPatch(`/api/v1/contracts/${id}`, { status: newStatus });
      setContract((c) => c ? { ...c, status: newStatus } : c);
    } catch {
      Alert.alert('Error', 'Could not update status.');
    } finally { setUpdatingStatus(null); }
  }

  function deleteContract() {
    Alert.alert(
      'Delete Contract',
      `Delete "${contract?.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await apiDelete(`/api/v1/contracts/${id}`);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Could not delete this contract.');
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  const st = contract ? (STATUS_STYLE[contract.status] ?? STATUS_STYLE.active) : STATUS_STYLE.active;

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <Bar onBack={() => navigation.goBack()} />
        <View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      </View>
    );
  }

  if (notFound || error || !contract) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <Bar onBack={() => navigation.goBack()} />
        <View style={s.centred}>
          <MaterialCommunityIcons name="file-remove-outline" size={48} color={C.outline} />
          <Text style={s.emptyTitle}>{notFound ? 'Contract not found' : 'Something went wrong'}</Text>
          <Text style={s.emptySub}>{error ?? 'This contract may have been deleted.'}</Text>
          {error && (
            <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Bar
        onBack={() => navigation.goBack()}
        title={contract.title}
        onDelete={deleteContract}
        deleting={deleting}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
      >
        {/* Status badge + amount hero */}
        <View style={s.hero}>
          <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
            <MaterialCommunityIcons name={st.icon as any} size={14} color={st.fg} />
            <Text style={[s.statusBadgeText, { color: st.fg }]}>
              {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
            </Text>
          </View>
          <Text style={s.amountHero}>{fmtCurrency(contract.amount)}</Text>
          <Text style={s.amountLabel}>CONTRACT AMOUNT</Text>
        </View>

        {/* Key fields */}
        <View style={s.infoCard}>
          <InfoRow icon="account-outline" label="Assigned to" value={contract.entity_name ?? (contract.entity_type === 'team' ? 'Team' : 'Labour')} />
          <Divider />
          <InfoRow icon="calendar-outline" label="Assigned date" value={fmtDate(contract.assigned_date)} />
          {contract.completion_date && (
            <>
              <Divider />
              <InfoRow icon="calendar-check-outline" label="Completion date" value={fmtDate(contract.completion_date)} />
            </>
          )}
          {contract.plot && (
            <>
              <Divider />
              <InfoRow
                icon="map-marker-outline"
                label="Plot"
                value={`${contract.plot.name}${contract.plot.area != null ? ` · ${contract.plot.area}${contract.plot.area_unit ?? ''}` : ''}`}
              />
            </>
          )}
          {contract.description ? (
            <>
              <Divider />
              <InfoRow icon="text-box-outline" label="Notes" value={contract.description} />
            </>
          ) : null}
        </View>

        {/* Status controls */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Update Status</Text>
          <View style={s.statusRow}>
            {(['active', 'completed', 'cancelled'] as ContractStatus[]).map((key) => {
              const c = STATUS_STYLE[key];
              const isSelected = contract.status === key;
              const isLoading = updatingStatus === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.statusChip, isSelected && { backgroundColor: c.bg, borderColor: c.bg }]}
                  onPress={() => changeStatus(key)}
                  disabled={isSelected || updatingStatus !== null}
                >
                  {isLoading
                    ? <ActivityIndicator size="small" color={c.fg} />
                    : <Text style={[s.statusChipText, isSelected && { color: c.fg }]}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Bar({ onBack, title, onDelete, deleting }: {
  onBack: () => void; title?: string; onDelete?: () => void; deleting?: boolean;
}) {
  return (
    <View style={s.bar}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={s.barBtn}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={C.primary} />
      </TouchableOpacity>
      <Text style={s.barTitle} numberOfLines={1}>{title ?? 'Contract'}</Text>
      {onDelete ? (
        <TouchableOpacity onPress={onDelete} hitSlop={12} style={s.barBtn} disabled={deleting}>
          {deleting
            ? <ActivityIndicator size="small" color={C.error} />
            : <MaterialCommunityIcons name="delete-outline" size={22} color={C.error} />}
        </TouchableOpacity>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <MaterialCommunityIcons name={icon as any} size={18} color={C.onSurfaceVariant} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.outlineVariant, marginVertical: 8 }} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  bar: {
    height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, backgroundColor: C.surfaceLowest,
    borderBottomWidth: 1, borderBottomColor: C.outlineVariant,
  },
  barBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  barTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.primary },
  scroll: { padding: 16, paddingBottom: 48, gap: 14 },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  emptySub: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center' },
  retryBtn: { backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: C.onPrimary, fontWeight: '700' },

  hero: { alignItems: 'center', gap: 6, paddingVertical: 16 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: R.full },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  amountHero: { fontSize: 36, fontWeight: '800', color: C.primary, letterSpacing: -1 },
  amountLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 1 },

  infoCard: {
    backgroundColor: C.surfaceLowest, borderRadius: R.lg, padding: 16,
    borderWidth: 1, borderColor: C.outlineVariant,
  },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  infoLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase' },
  infoValue: { fontSize: 14, fontWeight: '600', color: C.onSurface },

  section: { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.onSurface },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    flex: 1, paddingVertical: 10, borderRadius: R.md, alignItems: 'center',
    borderWidth: 1, borderColor: C.outlineVariant, backgroundColor: C.surfaceLowest,
  },
  statusChipText: { fontSize: 12, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'capitalize' },
});
