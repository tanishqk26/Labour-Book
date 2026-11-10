import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { CAT_ICON, EXPENSE_CATS, INCOME_CATS, Txn, TxnKind, catLabelKey } from '../lib/expenseMeta';
import { C, R } from '../lib/theme';
import DateField from './DateField';
import SelectField from './SelectField';

type PayMode = 'paid' | 'credit' | 'part';
const NO_PLOT = '__none__';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Add / edit one expense or income entry.
 * The farmer may not know the price yet (bought on credit): "price not known yet"
 * saves the entry without an amount and it stays on the Dues list until priced.
 */
export default function ExpenseFormSheet({ visible, kind, entry, prefill, plots, onClose, onSaved }: {
  visible: boolean;
  kind: TxnKind;                                     // ignored when editing (the entry's own kind is used)
  entry?: Txn | null;
  prefill?: { plot_id?: string | null; date?: string; operation_id?: string | null } | null;
  plots: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const editing = !!entry;
  const k: TxnKind = entry?.kind ?? kind;
  const isIncome = k === 'income';

  const [amount, setAmount] = useState('');
  const [unknown, setUnknown] = useState(false);
  const [category, setCategory] = useState<string>(isIncome ? 'sale' : 'medicine');
  const [plotId, setPlotId] = useState<string>(NO_PLOT);
  const [party, setParty] = useState('');
  const [payMode, setPayMode] = useState<PayMode>('paid');
  const [paidText, setPaidText] = useState('');
  const [date, setDate] = useState(localToday());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [parties, setParties] = useState<string[]>([]);

  // Load the form each time it opens
  useEffect(() => {
    if (!visible) return;
    if (entry) {
      setAmount(entry.amount != null ? String(entry.amount) : '');
      setUnknown(entry.amount == null);
      setCategory(entry.category);
      setPlotId(entry.plot_id ?? NO_PLOT);
      setParty(entry.party ?? '');
      setPayMode(entry.status === 'partial' ? 'part' : entry.status === 'paid' ? 'paid' : entry.amount == null ? 'credit' : 'credit');
      setPaidText(entry.status === 'partial' ? String(entry.amount_paid) : '');
      setDate(entry.txn_date);
      setNotes(entry.description ?? '');
    } else {
      setAmount(''); setUnknown(false);
      setCategory(isIncome ? 'sale' : 'medicine');
      setPlotId(prefill?.plot_id ?? NO_PLOT);
      setParty(''); setPayMode('paid'); setPaidText('');
      setDate(prefill?.date ?? localToday()); setNotes('');
    }
    apiGet<string[]>('/api/v1/expenses/parties', { kind: k }).then(setParties).catch(() => setParties([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entry]);

  const cats = isIncome ? INCOME_CATS : EXPENSE_CATS;
  const total = parseFloat(amount);
  const typed = party.trim().toLowerCase();
  const suggestions = parties
    .filter((p) => p.trim().toLowerCase() !== typed && (!typed || p.toLowerCase().includes(typed)))
    .slice(0, 6);

  async function save() {
    let amountVal: number | null = null;
    let paidVal = 0;
    if (!unknown || isIncome) {
      if (isNaN(total) || total <= 0) { Alert.alert(t('expenses'), t('exp_amount_required')); return; }
      amountVal = total;
      if (payMode === 'paid') paidVal = total;
      else if (payMode === 'part') {
        paidVal = parseFloat(paidText);
        if (isNaN(paidVal) || paidVal < 0 || paidVal > total) { Alert.alert(t('expenses'), t('exp_paid_too_much')); return; }
      }
    }
    const body = {
      txn_date: date,
      category,
      plot_id: plotId === NO_PLOT ? null : plotId,
      party: party.trim() || null,
      amount: amountVal,
      amount_paid: paidVal,
      description: notes.trim() || null,
    };
    setSaving(true);
    try {
      if (entry) await apiPatch(`/api/v1/expenses/${entry.id}`, body);
      else await apiPost('/api/v1/expenses', { ...body, kind: k, operation_id: prefill?.operation_id ?? null });
      onSaved();
      onClose();
    } catch {
      Alert.alert(t('expenses'), t('exp_save_failed'));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!entry) return;
    Alert.alert(t('exp_delete'), t('exp_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('exp_delete'), style: 'destructive',
        onPress: async () => {
          try { await apiDelete(`/api/v1/expenses/${entry.id}`); onSaved(); onClose(); }
          catch { Alert.alert(t('expenses'), t('exp_save_failed')); }
        },
      },
    ]);
  }

  const payLabels: Record<PayMode, string> = isIncome
    ? { paid: t('exp_received'), credit: t('exp_not_received'), part: t('exp_part_received') }
    : { paid: t('exp_paid_now'), credit: t('exp_on_credit'), part: t('exp_part_paid') };
  const accent = isIncome ? C.primary : C.error;
  const showPay = isIncome || !unknown;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.container}>
          <View style={s.header}>
            <Text style={[s.title, { color: accent }]}>
              {editing ? t('exp_edit') : isIncome ? t('exp_new_income') : t('exp_new_expense')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={24} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            {/* Amount */}
            <View style={s.section}>
              <Text style={s.label}>{t('exp_amount')}</Text>
              <TextInput
                style={[s.amountInput, unknown && !isIncome && { opacity: 0.4 }]}
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={C.outline}
                editable={isIncome || !unknown}
                autoFocus={!editing}
              />
              {!isIncome && (
                <View style={s.switchRow}>
                  <Text style={s.switchText}>{t('exp_price_unknown')}</Text>
                  <Switch
                    value={unknown}
                    onValueChange={(v) => { setUnknown(v); if (v) { setPayMode('credit'); } }}
                    trackColor={{ true: C.primaryContainer, false: C.outlineVariant }}
                    thumbColor={unknown ? C.primary : C.outline}
                  />
                </View>
              )}
            </View>

            {/* Category */}
            <View style={s.section}>
              <Text style={s.label}>{t('exp_category')}</Text>
              <SelectField
                value={category}
                options={cats.map((c) => ({ id: c, label: t(catLabelKey(k, c)), icon: CAT_ICON[k][c] }))}
                placeholder={t('exp_category')}
                title={t('exp_category')}
                onChange={setCategory}
              />
            </View>

            {/* Plot */}
            <View style={s.section}>
              <Text style={s.label}>{t('exp_plot')}</Text>
              <SelectField
                value={plotId}
                options={[{ id: NO_PLOT, label: t('exp_whole_farm'), icon: 'barn' }, ...plots.map((p) => ({ id: p.id, label: p.name, icon: 'sprout-outline' }))]}
                placeholder={t('exp_plot')}
                title={t('exp_plot')}
                onChange={setPlotId}
              />
            </View>

            {/* Shop / buyer */}
            <View style={s.section}>
              <Text style={s.label}>{isIncome ? t('exp_party_income') : t('exp_party_expense')}</Text>
              <TextInput
                style={s.input}
                value={party}
                onChangeText={setParty}
                placeholder={t('exp_party_ph')}
                placeholderTextColor={C.outline}
                maxLength={120}
              />
              {suggestions.length > 0 && (
                <View style={s.sugRow}>
                  {suggestions.map((p) => (
                    <TouchableOpacity key={p} style={s.sugChip} onPress={() => setParty(p)}>
                      <Text style={s.sugText}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Payment status */}
            {showPay && (
              <View style={s.section}>
                <View style={s.payRow}>
                  {(['paid', 'credit', 'part'] as PayMode[]).map((m) => {
                    const on = payMode === m;
                    return (
                      <TouchableOpacity key={m} style={[s.payBtn, on && { backgroundColor: accent, borderColor: accent }]} onPress={() => setPayMode(m)}>
                        <Text style={[s.payText, on && { color: C.onPrimary }]}>{payLabels[m]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {payMode === 'part' && (
                  <TextInput
                    style={[s.input, { marginTop: 10 }]}
                    value={paidText}
                    onChangeText={(v) => setPaidText(v.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder={isIncome ? t('exp_received_so_far') : t('exp_paid_so_far')}
                    placeholderTextColor={C.outline}
                  />
                )}
              </View>
            )}

            {/* Date */}
            <View style={s.section}>
              <DateField value={date} onChange={setDate} />
            </View>

            {/* Notes */}
            <View style={s.section}>
              <TextInput
                style={[s.input, { minHeight: 56, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                maxLength={300}
                placeholder={t('exp_notes')}
                placeholderTextColor={C.outline}
              />
            </View>

            {editing && (
              <TouchableOpacity style={s.deleteBtn} onPress={confirmDelete}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={C.error} />
                <Text style={s.deleteText}>{t('exp_delete')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: accent }, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={s.saveText}>{t('exp_save')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  title: { fontSize: 18, fontWeight: '800' },
  body: { padding: 16, gap: 18, paddingBottom: 32 },
  section: { gap: 8 },
  label: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountInput: { height: 64, borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow, fontSize: 30, fontWeight: '800', color: C.onSurface, paddingHorizontal: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  switchText: { flex: 1, fontSize: 15, fontWeight: '600', color: C.onSurface },
  input: { minHeight: 50, borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow, fontSize: 16, color: C.onSurface, paddingHorizontal: 14, paddingVertical: 10 },
  sugRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sugChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full, backgroundColor: C.primaryFixed },
  sugText: { fontSize: 13, fontWeight: '700', color: C.primary },
  payRow: { flexDirection: 'row', gap: 8 },
  payBtn: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow, paddingHorizontal: 4 },
  payText: { fontSize: 13, fontWeight: '800', color: C.onSurfaceVariant, textAlign: 'center' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  deleteText: { color: C.error, fontWeight: '700', fontSize: 15 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  saveBtn: { borderRadius: R.md, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: C.onPrimary, fontSize: 16, fontWeight: '800' },
});
