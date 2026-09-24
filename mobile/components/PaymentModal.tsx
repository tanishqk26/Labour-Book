import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ApiError, apiGet, apiPost } from '../lib/api';
import { C, R, fmtCurrency, todayISO } from '../lib/theme';
import { EntityPaymentSummary } from '../types';

type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other';

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI' },
  { id: 'bank_transfer', label: 'Bank' },
  { id: 'other', label: 'Other' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entityType: 'individual' | 'team';
  entityId: string;
  entityName: string;
}

export default function PaymentModal({
  visible,
  onClose,
  onSuccess,
  entityType,
  entityId,
  entityName,
}: Props) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<EntityPaymentSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAmount('');
    setMethod('cash');
    setDate(todayISO());
    setNotes('');
    setError(null);
    setSaving(false);

    apiGet<EntityPaymentSummary>(`/api/v1/payments/entity/${entityType}/${entityId}/summary`)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [visible, entityType, entityId]);

  function usePending() {
    if (summary && summary.pending > 0) setAmount(String(summary.pending));
  }

  async function save() {
    const value = parseFloat(amount);
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      setError('Enter an amount greater than 0.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Date must be YYYY-MM-DD.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost('/api/v1/payments', {
        labour_id: entityType === 'individual' ? entityId : null,
        team_id: entityType === 'team' ? entityId : null,
        amount: value,
        method,
        date,
        notes: notes.trim() || null,
      });
      onSuccess();
      onClose();
    } catch (err) {
      const detail = err instanceof ApiError
        ? (typeof (err.data as { detail?: unknown } | null)?.detail === 'string'
            ? (err.data as { detail: string }).detail
            : `Could not save payment (${err.status}).`)
        : 'Could not save payment. Check your connection.';
      setError(detail);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.header}>
          <Text style={s.title}>Record Payment</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={s.close}>✕</Text></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.payee}>{entityName}</Text>
          <Text style={s.payeeHint}>{entityType === 'team' ? 'Team' : 'Labourer'}</Text>

          {summary && (
            <View style={s.balanceBox}>
              <View style={s.balanceCol}>
                <Text style={s.balanceLabel}>PENDING</Text>
                <Text style={[s.balanceValue, { color: summary.pending > 0 ? C.tertiary : C.primary }]}>
                  {fmtCurrency(summary.pending)}
                </Text>
              </View>
              {summary.pending > 0 && (
                <TouchableOpacity style={s.fillBtn} onPress={usePending}>
                  <Text style={s.fillBtnText}>Use pending</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={s.field}>
            <Text style={s.label}>Amount (₹) *</Text>
            <TextInput
              style={s.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={C.outline}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Method</Text>
            <View style={s.methodRow}>
              {METHODS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[s.methodBtn, method === m.id && s.methodBtnActive]}
                  onPress={() => setMethod(m.id)}
                >
                  <Text style={[s.methodText, method === m.id && s.methodTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Date *</Text>
            <TextInput
              style={s.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              placeholderTextColor={C.outline}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Note</Text>
            <TextInput
              style={[s.input, s.notes]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional note"
              multiline
              placeholderTextColor={C.outline}
            />
          </View>

          {error && <Text style={s.error}>{error}</Text>}
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={saving}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={s.saveText}>Save Payment</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant,
  },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  close: { fontSize: 18, color: C.onSurfaceVariant, paddingHorizontal: 4 },
  body: { padding: 20, paddingBottom: 32 },
  payee: { fontSize: 20, fontWeight: '800', color: C.onSurface },
  payeeHint: { fontSize: 13, color: C.onSurfaceVariant, marginBottom: 16 },
  balanceBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surfaceLow, borderRadius: R.md, padding: 14, marginBottom: 18,
    borderWidth: 1, borderColor: C.outlineVariant,
  },
  balanceCol: { gap: 2 },
  balanceLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.6 },
  balanceValue: { fontSize: 20, fontWeight: '800' },
  fillBtn: { backgroundColor: C.primaryFixed, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 7 },
  fillBtnText: { fontSize: 12, fontWeight: '700', color: C.primary },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    height: 46, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md,
    paddingHorizontal: 14, fontSize: 15, color: C.onSurface, backgroundColor: C.surfaceLow,
  },
  notes: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  methodRow: { flexDirection: 'row', gap: 6 },
  methodBtn: {
    flex: 1, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.outlineVariant, backgroundColor: C.surfaceLowest,
  },
  methodBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  methodText: { fontSize: 12, fontWeight: '600', color: C.onSurfaceVariant },
  methodTextActive: { color: C.onPrimary },
  error: { color: C.error, fontSize: 13, marginTop: 4 },
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  cancelBtn: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
});
