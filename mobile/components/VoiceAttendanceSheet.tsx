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
import { C, R } from '../lib/theme';
import VoiceCapture from './VoiceCapture';
import SelectField from './SelectField';
import DateField from './DateField';

/**
 * Voice entry for attendance: VoiceCapture records and uploads, this sheet shows
 * one review card per person/team. Nothing is saved until the farmer taps Save.
 */

type AttStatus = 'present' | 'half_day' | 'absent';
const STATUSES: AttStatus[] = ['present', 'half_day', 'absent'];
const STATUS_COLOR: Record<AttStatus, { bg: string; fg: string }> = {
  present: { bg: C.primaryFixed, fg: C.primary },
  half_day: { bg: '#fef3c7', fg: '#6b4c04' },
  absent: { bg: C.errorContainer, fg: C.error },
};

export interface SavedAttendance {
  id: string; date: string; labour_id: string | null; team_id: string | null;
  status: AttStatus; task?: string | null; work_start_time?: string | null; work_end_time?: string | null;
  num_labourers?: number | null;
}

interface Draft {
  key: string;
  detected_id: string | null;      // what the voice model picked; listed first in the dropdown
  entity_type: 'labour' | 'team' | null;
  entity_id: string | null;
  entity_name?: string | null;
  entity_text?: string | null;
  status: AttStatus;
  attendance_date: string;
  num_labourers: number | null;
  task: string | null;
  work_start_time: string | null;
  work_end_time: string | null;
  confidence: number;
  needs_review: string[];
}
interface ParseResponse { transcript: string; entries: Omit<Draft, 'key' | 'detected_id'>[]; warnings: string[] }
interface Person { id: string; name: string; kind: 'labour' | 'team'; members?: number }

export default function VoiceAttendanceSheet({ visible, onClose, onSaved, labours, teams, existingFor }: {
  visible: boolean;
  onClose: () => void;
  onSaved: (saved: SavedAttendance[]) => void;
  labours: { id: string; name: string }[];
  teams: { id: string; name: string; member_count?: number }[];
  /** The mark already on file for this person+day (so voice does not wipe time/notes). */
  existingFor: (kind: 'labour' | 'team', id: string, date: string) => SavedAttendance | undefined;
}) {
  const { t } = useLanguage();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);   // null = still recording
  const [transcript, setTranscript] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setDrafts(null); setTranscript(''); setShowTranscript(false); }
  }, [visible]);

  const people: Person[] = [
    ...labours.map((l) => ({ id: l.id, name: l.name, kind: 'labour' as const })),
    ...teams.map((x) => ({ id: x.id, name: x.name, kind: 'team' as const, members: x.member_count })),
  ];

  function patch(key: string, p: Partial<Draft>) {
    setDrafts((ds) => (ds ?? []).map((d) => (d.key === key ? { ...d, ...p } : d)));
  }
  const clearFlag = (d: Draft, flag: string) => d.needs_review.filter((x) => x !== flag);

  function pickPerson(d: Draft, p: Person) {
    patch(d.key, {
      entity_id: p.id, entity_type: p.kind, entity_name: p.name,
      num_labourers: p.kind === 'team' ? (d.num_labourers ?? (p.members || 1)) : null,
      needs_review: clearFlag(d, 'entity'),
    });
  }

  const isTeamPresent = (d: Draft) => d.entity_type === 'team' && d.status !== 'absent';
  const allHavePerson = !!drafts && drafts.length > 0 && drafts.every((d) => !!d.entity_id);
  const countsOk = !!drafts && drafts.every((d) => !isTeamPresent(d) || (d.num_labourers ?? 0) >= 1);

  async function saveAll() {
    if (!drafts) return;
    if (!allHavePerson) { Alert.alert(t('voice_title'), t('voice_pick_person_first')); return; }
    if (!countsOk) { Alert.alert(t('voice_title'), t('voice_need_members')); return; }
    setSaving(true);
    const saved: SavedAttendance[] = [];
    try {
      for (const d of drafts) {
        const kind = d.entity_type as 'labour' | 'team';
        const prev = existingFor(kind, d.entity_id as string, d.attendance_date);
        // Keep time/notes already on file unless the farmer just said something new.
        const task = d.task ?? prev?.task ?? undefined;
        const start = d.work_start_time ?? prev?.work_start_time ?? undefined;
        const end = d.work_end_time ?? prev?.work_end_time ?? undefined;
        const res = await apiPost<SavedAttendance>('/api/v1/attendance', {
          date: d.attendance_date,
          status: d.status,
          wage_type: 'daily',
          labour_id: kind === 'labour' ? d.entity_id : null,
          team_id: kind === 'team' ? d.entity_id : null,
          ...(kind === 'team' && d.status !== 'absent' ? { num_labourers: d.num_labourers } : {}),
          ...(task ? { task } : {}),
          ...(start ? { work_start_time: start } : {}),
          ...(end ? { work_end_time: end } : {}),
        });
        saved.push(res);
      }
      onSaved(saved);
      onClose();
    } catch {
      if (saved.length) onSaved(saved);   // refresh what did go through; the rest can be retried
      Alert.alert(t('voice_title'), t('voice_save_failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>{t('voice_att_title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {visible && drafts === null && (
          <VoiceCapture<ParseResponse>
            endpoint="/api/v1/voice/attendance/parse"
            pendingKey="khetkitab_pending_voice_attendance_uri"
            exampleKey="voice_att_example"
            nothingFoundKey="voice_att_nothing_found"
            isEmpty={(res) => !res.entries.length}
            onResult={(res) => {
              setTranscript(res.transcript);
              setDrafts(res.entries.map((e, i) => ({ ...e, key: `${Date.now()}-${i}`, detected_id: e.entity_id })));
            }}
          />
        )}

        {visible && drafts !== null && (
          <>
            <ScrollView style={s.body} contentContainerStyle={{ gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <Text style={s.reviewTitle}>{t('voice_check_title')}</Text>

              {drafts.map((d) => {
                const warnPerson = !d.entity_id;
                const warnStatus = d.needs_review.includes('status');
                return (
                  <View key={d.key} style={[s.card, (warnPerson || warnStatus) && s.cardWarn]}>
                    <View style={s.cardTop}>
                      <Text style={s.cardLabel}>{t('voice_att_person')}</Text>
                      <TouchableOpacity onPress={() => setDrafts((ds) => (ds ?? []).filter((x) => x.key !== d.key))} hitSlop={8}>
                        <Text style={s.remove}>{t('voice_remove')}</Text>
                      </TouchableOpacity>
                    </View>
                    {warnPerson && d.entity_text ? <Text style={s.heard}>“{d.entity_text}”</Text> : null}
                    <SelectField
                      value={d.entity_id}
                      detectedId={d.detected_id}
                      options={people.map((p) => ({ id: p.id, label: p.name, icon: p.kind === 'team' ? 'account-group-outline' : 'account-outline' }))}
                      placeholder={t('voice_select_person')}
                      title={t('voice_att_person')}
                      warn={warnPerson}
                      onChange={(id) => { const p = people.find((x) => x.id === id); if (p) pickPerson(d, p); }}
                    />

                    <View style={s.statusRow}>
                      {STATUSES.map((st) => {
                        const on = d.status === st;
                        const col = STATUS_COLOR[st];
                        return (
                          <TouchableOpacity
                            key={st}
                            style={[s.statusBtn, on && { backgroundColor: col.bg, borderColor: col.fg }]}
                            onPress={() => patch(d.key, {
                              status: st,
                              needs_review: clearFlag(d, 'status'),
                              ...(st === 'absent' ? { num_labourers: null } : {}),
                            })}
                          >
                            <Text style={[s.statusText, on && { color: col.fg }]}>{t(st)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {isTeamPresent(d) && (
                      <View style={s.membersRow}>
                        <Text style={[s.cardLabel, d.needs_review.includes('count') && { color: '#b45309' }]}>{t('voice_att_members')}</Text>
                        <TextInput
                          style={s.membersInput}
                          value={d.num_labourers != null ? String(d.num_labourers) : ''}
                          onChangeText={(v) => {
                            const n = parseInt(v.replace(/[^0-9]/g, '').slice(0, 3), 10);
                            patch(d.key, { num_labourers: isNaN(n) ? null : n, needs_review: clearFlag(d, 'count') });
                          }}
                          keyboardType="number-pad"
                          textAlign="center"
                          placeholder="0"
                          placeholderTextColor={C.outline}
                        />
                      </View>
                    )}

                    {d.status !== 'absent' && (
                      <TextInput
                        style={s.notes}
                        value={d.task ?? ''}
                        onChangeText={(v) => patch(d.key, { task: v || null })}
                        placeholder={t('voice_att_task_ph')}
                        placeholderTextColor={C.outline}
                        maxLength={200}
                      />
                    )}
                    {(d.work_start_time || d.work_end_time) && d.status !== 'absent' ? (
                      <View style={s.timeRow}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color={C.onSurfaceVariant} />
                        <Text style={s.timeText}>{d.work_start_time ?? '—'} – {d.work_end_time ?? '—'}</Text>
                      </View>
                    ) : null}

                    <DateField value={d.attendance_date} onChange={(v) => patch(d.key, { attendance_date: v })} />
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
              <TouchableOpacity
                style={[s.primaryBtnFlex, (!allHavePerson || !countsOk || saving || drafts.length === 0) && { opacity: 0.5 }]}
                onPress={saveAll}
                disabled={saving || drafts.length === 0}
              >
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
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: R.full, backgroundColor: C.surfaceHigh, minHeight: 44 },
  chipOn: { backgroundColor: C.primaryContainer },
  chipText: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  chipTextOn: { color: C.onPrimary },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow },
  statusText: { fontSize: 14, fontWeight: '800', color: C.onSurfaceVariant },
  membersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  membersInput: { width: 84, height: 44, borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow, fontSize: 18, fontWeight: '800', color: C.onSurface, paddingVertical: 0 },
  notes: { borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, padding: 12, fontSize: 15, color: C.onSurface, backgroundColor: C.surfaceLow },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeText: { fontSize: 13, color: C.onSurfaceVariant, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInput: { flex: 1, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.onSurface, backgroundColor: C.surfaceLow },
  dateChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: R.full, backgroundColor: C.primaryFixed },
  dateChipText: { fontSize: 12, fontWeight: '700', color: C.primaryContainer },
  transcript: { fontSize: 13, color: C.onSurfaceVariant, lineHeight: 20, backgroundColor: C.surfaceLow, padding: 12, borderRadius: R.md },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: C.outlineVariant },
});
