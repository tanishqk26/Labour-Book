import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { apiPost } from '../lib/api';
import { TranslationKey } from '../lib/i18n';
import { C, R } from '../lib/theme';
import VoiceCapture from './VoiceCapture';
import SelectField from './SelectField';
import DateField from './DateField';

/**
 * Voice entry for farm operations: VoiceCapture records and uploads, this sheet
 * shows the review cards. Nothing is saved until the farmer taps Save.
 */

type Category = 'Spraying' | 'Fertigation' | 'Labour Work' | 'Other';
const CATEGORIES: Category[] = ['Spraying', 'Fertigation', 'Labour Work', 'Other'];
const CAT_KEY: Record<Category, TranslationKey> = {
  'Spraying': 'spraying', 'Fertigation': 'fertigation', 'Labour Work': 'labour_work', 'Other': 'other',
};
const CAT_ICON: Record<Category, string> = {
  'Spraying': 'spray-bottle', 'Fertigation': 'water-pump', 'Labour Work': 'account-hard-hat-outline', 'Other': 'clipboard-list-outline',
};

interface Product { name: string; dose?: string | null }
interface Draft {
  key: string;
  detected_id: string | null;      // plot the voice model picked; listed first in the dropdown
  plot_id: string | null;
  plot_name?: string | null;
  plot_text?: string | null;
  category: Category;
  operation_date: string;
  notes: string;
  products: Product[];
  confidence: number;
  needs_review: string[];
}
interface ParseResponse { transcript: string; operations: Omit<Draft, 'key' | 'detected_id'>[]; warnings: string[] }
interface PlotLite { id: string; name: string }

export default function VoiceOperationSheet({ visible, onClose, onSaved, plots }: {
  visible: boolean;
  onClose: () => void;
  onSaved: (savedDates: string[]) => void;
  plots: PlotLite[];
}) {
  const { t } = useLanguage();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);   // null = still recording
  const [transcript, setTranscript] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setDrafts(null); setTranscript(''); setShowTranscript(false); }
  }, [visible]);

  function patch(key: string, p: Partial<Draft>) {
    setDrafts((ds) => (ds ?? []).map((d) => (d.key === key ? { ...d, ...p, needs_review: p.plot_id ? d.needs_review.filter((x) => x !== 'plot') : d.needs_review } : d)));
  }

  const allHavePlot = !!drafts && drafts.length > 0 && drafts.every((d) => !!d.plot_id);

  async function saveAll() {
    if (!drafts) return;
    if (!allHavePlot) { Alert.alert(t('voice_title'), t('voice_pick_plot_first')); return; }
    setSaving(true);
    try {
      for (const d of drafts) {
        await apiPost('/api/v1/plot-operations', {
          plot_id: d.plot_id,
          operation_date: d.operation_date,
          operation_type: d.category,
          notes: d.notes.trim() || undefined,
          details: { source: 'voice', products: d.products, transcript },
        });
      }
      onSaved(drafts.map((d) => d.operation_date));
      onClose();
    } catch {
      Alert.alert(t('voice_title'), t('voice_save_failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>{t('voice_title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {visible && drafts === null && (
          <VoiceCapture<ParseResponse>
            endpoint="/api/v1/voice/operations/parse"
            pendingKey="khetkitab_pending_voice_uri"
            exampleKey="voice_example"
            nothingFoundKey="voice_nothing_found"
            isEmpty={(res) => !res.operations.length}
            onResult={(res) => {
              setTranscript(res.transcript);
              setDrafts(res.operations.map((o, i) => ({ ...o, key: `${Date.now()}-${i}`, notes: o.notes ?? '', detected_id: o.plot_id })));
            }}
          />
        )}

        {visible && drafts !== null && (
          <>
            <ScrollView style={s.body} contentContainerStyle={{ gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <Text style={s.reviewTitle}>{t('voice_check_title')}</Text>

              {drafts.map((d) => {
                const warnPlot = !d.plot_id;
                const warnCat = d.needs_review.includes('category');
                return (
                  <View key={d.key} style={[s.card, (warnPlot || warnCat) && s.cardWarn]}>
                    <View style={s.cardTop}>
                      <Text style={s.cardLabel}>{t('plot')}</Text>
                      <TouchableOpacity onPress={() => setDrafts((ds) => (ds ?? []).filter((x) => x.key !== d.key))} hitSlop={8}>
                        <Text style={s.remove}>{t('voice_remove')}</Text>
                      </TouchableOpacity>
                    </View>
                    {warnPlot && d.plot_text ? <Text style={s.heard}>“{d.plot_text}”</Text> : null}
                    <SelectField
                      value={d.plot_id}
                      detectedId={d.detected_id}
                      options={plots.map((p) => ({ id: p.id, label: p.name, icon: 'sprout-outline' }))}
                      placeholder={t('select_plot')}
                      title={t('plot')}
                      warn={warnPlot}
                      onChange={(id) => { const p = plots.find((x) => x.id === id); if (p) patch(d.key, { plot_id: p.id, plot_name: p.name }); }}
                    />

                    <View style={s.catRow}>
                      {CATEGORIES.map((c) => {
                        const on = d.category === c;
                        return (
                          <TouchableOpacity key={c} style={[s.catBtn, on && s.catBtnOn]} onPress={() => patch(d.key, { category: c, needs_review: d.needs_review.filter((x) => x !== 'category') })}>
                            <MaterialCommunityIcons name={CAT_ICON[c] as never} size={22} color={on ? C.onPrimary : C.onSurfaceVariant} />
                            <Text style={[s.catText, on && { color: C.onPrimary }]}>{t(CAT_KEY[c])}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TextInput
                      style={s.notes}
                      value={d.notes}
                      onChangeText={(v) => patch(d.key, { notes: v })}
                      multiline
                      placeholder={t('voice_details_ph')}
                      placeholderTextColor={C.outline}
                    />

                    <DateField value={d.operation_date} onChange={(v) => patch(d.key, { operation_date: v })} />
                  </View>
                );
              })}

              <TouchableOpacity onPress={() => setShowTranscript((v) => !v)}>
                <Text style={s.linkText}>{showTranscript ? '▾ ' : '▸ '}{t('voice_heard')}</Text>
              </TouchableOpacity>
              {showTranscript ? <Text style={s.transcript}>{transcript}</Text> : null}
            </ScrollView>

            <View style={s.footer}>
              <TouchableOpacity style={s.secondaryBtn} onPress={() => setDrafts(null)}>
                <Text style={s.secondaryText}>{t('voice_record_again')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.primaryBtnFlex, (!allHavePlot || saving) && { opacity: 0.5 }]} onPress={saveAll} disabled={saving}>
                {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={s.primaryText}>{t('voice_save_all')}</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  linkText: { color: C.primaryContainer, fontSize: 14, fontWeight: '700' },
  primaryBtnFlex: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: C.onPrimary, fontSize: 16, fontWeight: '800' },
  secondaryBtn: { flex: 1, borderRadius: R.md, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  secondaryText: { color: C.onSurfaceVariant, fontWeight: '700' },
  body: { flex: 1, padding: 16 },
  reviewTitle: { fontSize: 18, fontWeight: '800', color: C.onSurface },
  card: { backgroundColor: C.surfaceLowest, borderRadius: R.lg, borderWidth: 1, borderColor: C.outlineVariant, padding: 14, gap: 12 },
  cardWarn: { borderColor: '#d97706', borderWidth: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  remove: { color: C.error, fontWeight: '700', fontSize: 13 },
  heard: { fontSize: 13, color: '#b45309', fontWeight: '600' },
  chip: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: R.full, backgroundColor: C.surfaceHigh, minHeight: 44, justifyContent: 'center' },
  chipOn: { backgroundColor: C.primaryContainer },
  chipText: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  chipTextOn: { color: C.onPrimary },
  catRow: { flexDirection: 'row', gap: 6 },
  catBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow },
  catBtnOn: { backgroundColor: C.primaryContainer, borderColor: C.primaryContainer },
  catText: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, textAlign: 'center' },
  notes: { borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, padding: 12, fontSize: 15, minHeight: 60, textAlignVertical: 'top', color: C.onSurface, backgroundColor: C.surfaceLow },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInput: { flex: 1, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.onSurface, backgroundColor: C.surfaceLow },
  dateChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: R.full, backgroundColor: C.primaryFixed },
  dateChipText: { fontSize: 12, fontWeight: '700', color: C.primaryContainer },
  transcript: { fontSize: 13, color: C.onSurfaceVariant, lineHeight: 20, backgroundColor: C.surfaceLow, padding: 12, borderRadius: R.md },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: C.outlineVariant },
});
