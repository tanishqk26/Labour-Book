import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import { useLanguage } from '../../context/LanguageContext';
import ClockPicker, { fmt12h } from '../../components/ClockPicker';
import VoiceAttendanceSheet, { SavedAttendance } from '../../components/VoiceAttendanceSheet';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { C, R, AVATAR_COLORS, initials } from '../../lib/theme';

type AttStatus = 'present' | 'absent' | 'half_day';
interface AttRecord {
  id: string; date: string; labour_id: string | null; team_id: string | null;
  status: AttStatus; wage_earned?: number;
  task?: string | null; work_start_time?: string | null; work_end_time?: string | null; num_labourers?: number | null;
}
interface Labour { id: string; name: string; is_active: boolean; daily_wage?: number; }
interface Team { id: string; name: string; member_count: number; is_active: boolean; daily_wage?: number; }
interface Payment { id: string; date: string; amount: number; method: string; labour_id?: string | null; team_id?: string | null; }

const STATUS_LABEL: Record<AttStatus, string> = { present: 'P', absent: 'A', half_day: 'H' };
const STATUS_STYLE: Record<AttStatus, { bg: string; fg: string }> = {
  present: { bg: C.primaryFixed, fg: C.primary },
  absent: { bg: C.errorContainer, fg: C.error },
  half_day: { bg: '#fef3c7', fg: '#6b4c04' },
};
const DAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ROSTER_KEY = 'lb:att-roster';
const PAYMENT_METHODS = ['cash', 'upi', 'bank_transfer'] as const;
const METHOD_LABEL: Record<string, string> = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank' };

function todayISO() { return new Date().toISOString().slice(0, 10); }
function mondayOf(iso: string) {
  const d = new Date(iso); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}

// ─── Present Detail Modal ─────────────────────────────────────────────────────

interface PendingMark {
  entityId: string; kind: 'labour' | 'team'; date: string; name: string; defaultCount?: number; status: AttStatus;
  initial?: { task?: string | null; startTime?: string | null; endTime?: string | null; numLabourers?: number | null };
}

function PresentModal({
  pending, onClose, onConfirm,
}: {
  pending: PendingMark | null;
  onClose: () => void;
  onConfirm: (payload: {
    task?: string; startTime?: string; endTime?: string; numLabourers?: number;
    payment?: { amount: number; method: string };
  }) => Promise<void>;
}) {
  const [numMembers, setNumMembers] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [clockTarget, setClockTarget] = useState<'start' | 'end' | null>(null);
  const [task, setTask] = useState('');
  const [payEnabled, setPayEnabled] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'upi' | 'bank_transfer'>('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    setNumMembers(String(pending.initial?.numLabourers ?? pending.defaultCount ?? 1));
    setStartTime(pending.initial?.startTime?.slice(0, 5) ?? '');
    setEndTime(pending.initial?.endTime?.slice(0, 5) ?? '');
    setTask(pending.initial?.task ?? '');
    setPayEnabled(false); setPayAmount(''); setPayMethod('cash');
    setError(null); setClockTarget(null);
  }, [pending]);

  if (!pending) return null;
  const isTeam = pending.kind === 'team';

  async function confirm() {
    if (isTeam) {
      const n = parseInt(numMembers, 10);
      if (isNaN(n) || n < 1) { setError('Number of members must be at least 1.'); return; }
    }
    if (payEnabled) {
      const amt = parseFloat(payAmount);
      if (isNaN(amt) || amt <= 0) { setError('Enter a valid payment amount.'); return; }
    }
    setSaving(true); setError(null);
    try {
      const payment = payEnabled ? { amount: parseFloat(payAmount), method: payMethod } : undefined;
      await onConfirm({
        task: task.trim() || undefined,
        startTime: startTime.trim() || undefined,
        endTime: endTime.trim() || undefined,
        numLabourers: isTeam ? parseInt(numMembers, 10) : undefined,
        payment,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.');
    } finally { setSaving(false); }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={pm.root}>
          <View style={pm.header}>
            <View style={{ flex: 1 }}>
              <Text style={pm.title}>Attendance Details</Text>
              <Text style={pm.sub} numberOfLines={1}>{pending.name} · {pending.status === 'half_day' ? 'Half day' : 'Present'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={pm.body} keyboardShouldPersistTaps="handled">

            {/* Team members count */}
            {isTeam && (
              <View style={pm.section}>
                <Text style={pm.label}>Members present today *</Text>
                <TextInput
                  style={pm.input}
                  value={numMembers}
                  onChangeText={(v) => setNumMembers(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="e.g. 4"
                  placeholderTextColor={C.outline}
                  textAlign="center"
                />
              </View>
            )}

            {/* Timing */}
            <View style={pm.section}>
              <Text style={pm.label}>Timing (optional)</Text>
              <View style={pm.timeRow}>
                <TouchableOpacity
                  style={[pm.timePicker, startTime && pm.timePickerFilled]}
                  onPress={() => setClockTarget('start')}
                >
                  <MaterialCommunityIcons name="clock-outline" size={16} color={startTime ? C.primary : C.outline} />
                  <Text style={[pm.timePickerTxt, startTime && pm.timePickerTxtFilled]}>
                    {startTime ? fmt12h(startTime) : 'Start time'}
                  </Text>
                </TouchableOpacity>
                <Text style={pm.timeSepText}>–</Text>
                <TouchableOpacity
                  style={[pm.timePicker, endTime && pm.timePickerFilled]}
                  onPress={() => setClockTarget('end')}
                >
                  <MaterialCommunityIcons name="clock-outline" size={16} color={endTime ? C.primary : C.outline} />
                  <Text style={[pm.timePickerTxt, endTime && pm.timePickerTxtFilled]}>
                    {endTime ? fmt12h(endTime) : 'End time'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Notes */}
            <View style={pm.section}>
              <Text style={pm.label}>Notes / Task (optional)</Text>
              <TextInput
                style={[pm.input, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
                value={task} onChangeText={setTask} multiline
                placeholder="e.g. Pruning block A, spraying, weeding..."
                placeholderTextColor={C.outline}
              />
            </View>

            {/* Payment */}
            <View style={pm.section}>
              <View style={pm.payToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={pm.label}>Record payment</Text>
                  <Text style={pm.sublabel}>Optionally log a cash advance</Text>
                </View>
                <Switch
                  value={payEnabled}
                  onValueChange={setPayEnabled}
                  trackColor={{ true: C.primaryContainer, false: C.outlineVariant }}
                  thumbColor={payEnabled ? C.primary : C.outline}
                />
              </View>
              {payEnabled && (
                <View style={{ gap: 8, marginTop: 8 }}>
                  <TextInput
                    style={pm.input}
                    value={payAmount}
                    onChangeText={setPayAmount}
                    keyboardType="numeric"
                    placeholder="Amount (₹)"
                    placeholderTextColor={C.outline}
                  />
                  <View style={pm.methodRow}>
                    {PAYMENT_METHODS.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[pm.methodChip, payMethod === m && pm.methodChipOn]}
                        onPress={() => setPayMethod(m)}
                      >
                        <Text style={[pm.methodText, payMethod === m && pm.methodTextOn]}>{METHOD_LABEL[m]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {error ? <Text style={pm.error}>{error}</Text> : null}
          </ScrollView>
          <View style={pm.footer}>
            <TouchableOpacity style={pm.cancelBtn} onPress={onClose}><Text style={pm.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[pm.confirmBtn, saving && { opacity: 0.6 }]} onPress={confirm} disabled={saving}>
              {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={pm.confirmText}>Save Details</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ClockPicker
        visible={clockTarget !== null}
        value={clockTarget === 'start' ? startTime : endTime}
        title={clockTarget === 'start' ? 'Start time' : 'End time'}
        onConfirm={(t) => { if (clockTarget === 'start') setStartTime(t); else setEndTime(t); }}
        onClose={() => setClockTarget(null)}
      />
    </Modal>
  );
}

// ─── Team member-count stepper ────────────────────────────────────────────────

function TeamCountStepper({ value, onCommit }: { value: number | null; onCommit: (n: number) => void }) {
  const [text, setText] = useState(value ? String(value) : '');
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow the saved value (e.g. after a reload or a save from the details form).
  useEffect(() => { setText(value ? String(value) : ''); }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function commitSoon(n: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(n), 400); // batches rapid +/- taps
  }
  function commitNow() {
    if (timer.current) clearTimeout(timer.current);
    onCommit(parseInt(text, 10) || 0);
  }
  function bump(delta: number) {
    const n = Math.max(0, (parseInt(text, 10) || 0) + delta);
    setText(n ? String(n) : '');
    commitSoon(n);
  }

  return (
    <View style={s.stepper}>
      <TouchableOpacity style={s.stepBtn} onPress={() => bump(-1)} hitSlop={4} accessibilityLabel="Decrease members present">
        <MaterialCommunityIcons name="minus" size={16} color={C.onSurfaceVariant} />
      </TouchableOpacity>
      <TextInput
        style={[s.stepInput, !!text && s.stepInputFilled]}
        value={text}
        onChangeText={(v) => setText(v.replace(/[^0-9]/g, '').slice(0, 3))}
        onBlur={commitNow}
        onSubmitEditing={commitNow}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={C.outline}
        textAlign="center"
        selectTextOnFocus
        accessibilityLabel="Members present"
      />
      <TouchableOpacity style={s.stepBtn} onPress={() => bump(1)} hitSlop={4} accessibilityLabel="Increase members present">
        <MaterialCommunityIcons name="plus" size={16} color={C.primary} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Mark Tab ─────────────────────────────────────────────────────────────────

function MarkTab({
  markDate, labours, teams, records, savingKeys, onEdit, onToggleOther, onSetTeamCount, onAddToSheet, onRemoveFromSheet, sheetIds,
}: {
  markDate: string; labours: Labour[]; teams: Team[];
  records: AttRecord[];
  savingKeys: Set<string>;
  onEdit: (id: string, kind: 'labour' | 'team', name: string, defaultCount: number | undefined) => void;
  onToggleOther: (id: string, kind: 'labour' | 'team', s: AttStatus, date: string) => void;
  onSetTeamCount: (id: string, count: number, date: string) => void;
  onAddToSheet: () => void;
  onRemoveFromSheet: (key: string) => void;
  sheetIds: Set<string> | null;
}) {
  const allEntities = [
    ...labours.map((l) => ({ id: l.id, name: l.name, kind: 'labour' as const })),
    ...teams.map((t) => ({ id: t.id, name: t.name, kind: 'team' as const, count: t.member_count })),
  ];
  // Roster (carried forward) plus anyone who already has a mark on this day.
  const markedToday = new Set(
    records.filter((r) => r.date === markDate).map((r) => (r.labour_id ? `l:${r.labour_id}` : `t:${r.team_id}`)),
  );
  const all = sheetIds
    ? allEntities.filter((e) => {
        const k = `${e.kind[0]}:${e.id}`;
        return sheetIds.has(k) || markedToday.has(k);
      })
    : allEntities;

  const dateLabel = new Date(`${markDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  function recordOf(id: string, kind: string) {
    return records.find((r) => r.date === markDate && (kind === 'labour' ? r.labour_id === id : r.team_id === id));
  }
  function statusOf(id: string, kind: string) {
    return records.find((r) => r.date === markDate && (kind === 'labour' ? r.labour_id === id : r.team_id === id))?.status ?? null;
  }

  // Marking is always instant (no popup). Details are added via the pencil button.
  function handleStatusPress(id: string, kind: 'labour' | 'team', st: AttStatus) {
    onToggleOther(id, kind, st, markDate);
  }

  return (
    <FlatList
      data={all}
      keyExtractor={(e) => `${e.kind}-${e.id}`}
      contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 8 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={s.markHeader}>
          <View style={s.markHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.markDate}>{dateLabel}</Text>
              <Text style={s.markHint}>Tap P / H / A to mark · tap again to undo · teams: enter members present · ✎ adds time/notes.</Text>
            </View>
            <TouchableOpacity style={s.addPersonBtn} onPress={onAddToSheet}>
              <MaterialCommunityIcons name="account-plus-outline" size={14} color={C.primary} />
              <Text style={s.addPersonText}>Add Person</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={s.centred}>
          <MaterialCommunityIcons name="calendar-account-outline" size={48} color={C.outline} style={{ marginBottom: 8 }} />
          <Text style={s.emptyDesc}>No one on your list yet. Add the people you mark attendance for — the list carries forward each day.</Text>
          <TouchableOpacity style={s.addPersonBtn} onPress={onAddToSheet}>
            <MaterialCommunityIcons name="account-plus-outline" size={14} color={C.primary} />
            <Text style={s.addPersonText}>Add Person</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item: e, index }) => {
        const status = statusOf(e.id, e.kind);
        const c = AVATAR_COLORS[index % AVATAR_COLORS.length];
        const sheetKey = `${e.kind[0]}:${e.id}`;
        const saving = savingKeys.has(`${sheetKey}:${markDate}`);
        return (
          <View style={s.entityRow}>
            <View style={[s.entityAvatar, { backgroundColor: c.bg }]}>
              <Text style={[s.entityAvatarText, { color: c.fg }]}>{initials(e.name)}</Text>
            </View>
            <View style={s.entityInfo}>
              <Text style={s.entityName}>{e.name}</Text>
              <Text style={s.entityKind}>
                {e.kind === 'team' ? `Team · ${(e as any).count ?? 0} workers` : 'Individual'}
              </Text>
            </View>
            <View style={[s.statusBtns, saving && { opacity: 0.7 }]}>
              {e.kind === 'team' ? (
                <TeamCountStepper
                  key={`${e.id}:${markDate}`}
                  value={status === 'present' || status === 'half_day' ? (recordOf(e.id, 'team')?.num_labourers ?? null) : null}
                  onCommit={(n) => onSetTeamCount(e.id, n, markDate)}
                />
              ) : (['present', 'half_day', 'absent'] as AttStatus[]).map((st) => {
                const col = STATUS_STYLE[st];
                const active = status === st;
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => handleStatusPress(e.id, e.kind, st)}
                    style={[s.statusBtn, active && { backgroundColor: col.bg, borderColor: col.fg }]}
                  >
                    {active && saving
                      ? <ActivityIndicator size="small" color={col.fg} />
                      : <Text style={[s.statusBtnText, active && { color: col.fg }]}>{STATUS_LABEL[st]}</Text>}
                  </TouchableOpacity>
                );
              })}
              {(status === 'present' || status === 'half_day') && (
                <TouchableOpacity
                  style={s.editBtn}
                  onPress={() => onEdit(e.id, e.kind, e.name, (e as any).count)}
                  hitSlop={6}
                  accessibilityLabel="Add time or notes"
                >
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={C.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={s.removeBtn}
                onPress={() => onRemoveFromSheet(sheetKey)}
                hitSlop={6}
              >
                <MaterialCommunityIcons name="minus-circle-outline" size={18} color={C.outline} />
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

// ─── Picker Modal (Add to Sheet + Create new) ─────────────────────────────────

function PickerModal({
  visible, labours, teams, sheetIds, onAddToSheet, onClose, onCreated,
}: {
  visible: boolean;
  labours: Labour[]; teams: Team[];
  sheetIds: Set<string> | null;
  onAddToSheet: (key: string) => void;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [createMode, setCreateMode] = useState<null | 'labour' | 'team'>(null);

  // Labour create state
  const [lName, setLName] = useState('');
  const [lWage, setLWage] = useState('');
  const [lSaving, setLSaving] = useState(false);

  // Team create state
  const [tName, setTName] = useState('');
  const [tHometown, setTHometown] = useState('');
  const [tWage, setTWage] = useState('');
  const [tCarRent, setTCarRent] = useState('');
  const [tMgrFee, setTMgrFee] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tSaving, setTSaving] = useState(false);

  function resetForms() {
    setCreateMode(null);
    setLName(''); setLWage('');
    setTName(''); setTHometown(''); setTWage(''); setTCarRent(''); setTMgrFee(''); setTDesc('');
  }

  async function createLabour() {
    const w = parseFloat(lWage);
    if (!lName.trim()) { Alert.alert('Required', 'Name is required'); return; }
    if (isNaN(w) || w < 0) { Alert.alert('Invalid', 'Enter a valid daily wage'); return; }
    setLSaving(true);
    try {
      const created = await apiPost<{ id: string; name: string }>('/api/v1/labours', { name: lName.trim(), daily_wage: w });
      onAddToSheet(`l:${created.id}`);
      onCreated();
      resetForms();
    } catch { Alert.alert('Error', 'Failed to create labourer.'); }
    finally { setLSaving(false); }
  }

  async function createTeam() {
    const w = parseFloat(tWage);
    if (!tName.trim()) { Alert.alert('Required', 'Team name is required'); return; }
    if (isNaN(w) || w < 0) { Alert.alert('Invalid', 'Enter a valid daily wage'); return; }
    setTSaving(true);
    try {
      const created = await apiPost<{ id: string; name: string }>('/api/v1/teams', {
        name: tName.trim(),
        hometown: tHometown.trim() || undefined,
        daily_wage: w,
        car_rent: parseFloat(tCarRent) || 0,
        manager_fee: parseFloat(tMgrFee) || 0,
        description: tDesc.trim() || undefined,
      });
      onAddToSheet(`t:${created.id}`);
      onCreated();
      resetForms();
    } catch { Alert.alert('Error', 'Failed to create team.'); }
    finally { setTSaving(false); }
  }

  const allEntities = [
    ...labours.map((l) => ({ id: l.id, name: l.name, key: `l:${l.id}`, kind: 'Labourer' })),
    ...teams.map((t) => ({ id: t.id, name: t.name, key: `t:${t.id}`, kind: 'Team' })),
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { resetForms(); onClose(); }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: C.background }}>
          <View style={pk.header}>
            <Text style={pk.title}>Add to Attendance Sheet</Text>
            <TouchableOpacity onPress={() => { resetForms(); onClose(); }} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={pk.body} keyboardShouldPersistTaps="handled">
            {/* Existing entities */}
            {allEntities.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={pk.sectionLabel}>SELECT FROM EXISTING</Text>
                {allEntities.map((e) => {
                  const inSheet = sheetIds?.has(e.key) ?? true;
                  return (
                    <TouchableOpacity
                      key={e.key}
                      style={[pk.entityRow, inSheet && pk.entityRowIn]}
                      onPress={() => { if (!inSheet) onAddToSheet(e.key); }}
                      disabled={inSheet}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={pk.entityName}>{e.name}</Text>
                        <Text style={pk.entityKind}>{e.kind}</Text>
                      </View>
                      {inSheet
                        ? <View style={pk.onSheetBadge}><Text style={pk.onSheetText}>On sheet</Text></View>
                        : <MaterialCommunityIcons name="plus-circle-outline" size={22} color={C.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Create new section */}
            <View style={{ gap: 8 }}>
              <Text style={pk.sectionLabel}>CREATE NEW</Text>
              <View style={pk.createBtns}>
                <TouchableOpacity
                  style={[pk.createBtn, createMode === 'labour' && pk.createBtnActive]}
                  onPress={() => setCreateMode(createMode === 'labour' ? null : 'labour')}
                >
                  <MaterialCommunityIcons name="account-plus-outline" size={18} color={createMode === 'labour' ? C.onPrimary : C.primary} />
                  <Text style={[pk.createBtnText, createMode === 'labour' && { color: C.onPrimary }]}>New Labourer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[pk.createBtn, createMode === 'team' && pk.createBtnActive]}
                  onPress={() => setCreateMode(createMode === 'team' ? null : 'team')}
                >
                  <MaterialCommunityIcons name="account-group-outline" size={18} color={createMode === 'team' ? C.onPrimary : C.primary} />
                  <Text style={[pk.createBtnText, createMode === 'team' && { color: C.onPrimary }]}>New Team</Text>
                </TouchableOpacity>
              </View>

              {/* Labour quick-create form */}
              {createMode === 'labour' && (
                <View style={pk.form}>
                  <Text style={pk.formTitle}>Create Labourer</Text>
                  <View style={pk.formField}>
                    <Text style={pk.formLabel}>Full Name *</Text>
                    <TextInput style={pk.formInput} value={lName} onChangeText={setLName} placeholder="e.g. Deepak Jadhav" placeholderTextColor={C.outline} />
                  </View>
                  <View style={pk.formField}>
                    <Text style={pk.formLabel}>Daily Wage (₹) *</Text>
                    <TextInput style={pk.formInput} value={lWage} onChangeText={setLWage} keyboardType="numeric" placeholder="e.g. 400" placeholderTextColor={C.outline} />
                  </View>
                  <TouchableOpacity style={[pk.saveBtn, lSaving && { opacity: 0.6 }]} onPress={createLabour} disabled={lSaving}>
                    {lSaving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={pk.saveBtnText}>Create & Add to Sheet</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {/* Team quick-create form */}
              {createMode === 'team' && (
                <View style={pk.form}>
                  <Text style={pk.formTitle}>Create Team</Text>
                  <View style={pk.formField}>
                    <Text style={pk.formLabel}>Team Name *</Text>
                    <TextInput style={pk.formInput} value={tName} onChangeText={setTName} placeholder="e.g. Shinde Group" placeholderTextColor={C.outline} />
                  </View>
                  <View style={pk.formField}>
                    <Text style={pk.formLabel}>Hometown / Village</Text>
                    <TextInput style={pk.formInput} value={tHometown} onChangeText={setTHometown} placeholder="e.g. Nashik, Pune" placeholderTextColor={C.outline} />
                  </View>
                  <View style={pk.formField}>
                    <Text style={pk.formLabel}>Daily Wage Per Labour (₹) *</Text>
                    <TextInput style={pk.formInput} value={tWage} onChangeText={setTWage} keyboardType="numeric" placeholder="e.g. 350" placeholderTextColor={C.outline} />
                  </View>
                  <View style={pk.twoCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={pk.formLabel}>Car Rent (₹)</Text>
                      <TextInput style={pk.formInput} value={tCarRent} onChangeText={setTCarRent} keyboardType="numeric" placeholder="0" placeholderTextColor={C.outline} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={pk.formLabel}>Manager Fee (₹)</Text>
                      <TextInput style={pk.formInput} value={tMgrFee} onChangeText={setTMgrFee} keyboardType="numeric" placeholder="0" placeholderTextColor={C.outline} />
                    </View>
                  </View>
                  <View style={pk.formField}>
                    <Text style={pk.formLabel}>Description (optional)</Text>
                    <TextInput
                      style={[pk.formInput, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
                      value={tDesc} onChangeText={setTDesc} multiline
                      placeholder="Brief description of the team..."
                      placeholderTextColor={C.outline}
                    />
                  </View>
                  <TouchableOpacity style={[pk.saveBtn, tSaving && { opacity: 0.6 }]} onPress={createTeam} disabled={tSaving}>
                    {tSaving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={pk.saveBtnText}>Create & Add to Sheet</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ weekDates, labours, teams, records, payments, onCycle }: {
  weekDates: string[]; labours: Labour[]; teams: Team[]; records: AttRecord[]; payments: Payment[];
  onCycle: (id: string, kind: 'labour' | 'team', date: string) => void;
}) {
  const [breakdown, setBreakdown] = useState<{ id: string; kind: 'labour' | 'team'; name: string } | null>(null);

  const presentIds = new Set(records.map((r) => r.labour_id ?? r.team_id));
  const activeL = labours.filter((l) => presentIds.has(l.id));
  const activeT = teams.filter((t) => presentIds.has(t.id));

  function statusOf(id: string, kind: 'labour' | 'team', date: string) {
    return records.find((r) => r.date === date && (kind === 'labour' ? r.labour_id === id : r.team_id === id))?.status ?? null;
  }
  function dayCount(id: string, kind: 'labour' | 'team') {
    return weekDates.reduce((n, d) => {
      const st = statusOf(id, kind, d);
      return n + (st === 'present' ? 1 : st === 'half_day' ? 0.5 : 0);
    }, 0);
  }
  function paymentsFor(id: string, kind: 'labour' | 'team') {
    return payments.filter((p) =>
      weekDates.includes(p.date) &&
      (kind === 'labour' ? p.labour_id === id : p.team_id === id)
    );
  }
  function weekPaid(id: string, kind: 'labour' | 'team') {
    return paymentsFor(id, kind).reduce((sum, p) => sum + (p.amount ?? 0), 0);
  }
  function fmtDay(iso: string) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  if (activeL.length + activeT.length === 0) {
    return <View style={s.centred}><Text style={s.emptyDesc}>No attendance marked for this week.</Text></View>;
  }

  function RowContent({ id, kind, avatarBg, avatarFg, avatarLabel, name, rowBg }: {
    id: string; kind: 'labour' | 'team'; avatarBg: string; avatarFg: string;
    avatarLabel: string; name: string; rowBg?: string;
  }) {
    const paid = weekPaid(id, kind);
    return (
      <View style={[h.row, rowBg ? { backgroundColor: rowBg } : {}]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false} style={h.hScroll}>
          <View style={h.hInner}>
            <View style={h.nameCol}>
              <View style={[h.miniAvatar, { backgroundColor: avatarBg }]}>
                <Text style={[h.miniAvatarText, { color: avatarFg }]}>{avatarLabel}</Text>
              </View>
              <Text style={h.nameText} numberOfLines={1}>{name}</Text>
            </View>
            {weekDates.map((d, di) => {
              const st = statusOf(id, kind, d);
              const col = st ? STATUS_STYLE[st] : null;
              return (
                <TouchableOpacity key={di} style={[h.dayCol, h.dayCell, col ? { backgroundColor: col.bg } : {}]} onPress={() => onCycle(id, kind, d)}>
                  <Text style={[h.statusLabel, col ? { color: col.fg } : {}]}>{st ? STATUS_LABEL[st] : '–'}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={[h.totalCol, h.dayCell]}>
              <Text style={h.totalText}>{dayCount(id, kind)}</Text>
            </View>
            <TouchableOpacity style={[h.earnedCol, h.dayCell]} onPress={() => setBreakdown({ id, kind, name })}>
              <Text style={h.earnedText} numberOfLines={1}>
                {paid > 0 ? `₹${Math.round(paid).toLocaleString('en-IN')}` : '–'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}>
        <View style={[h.hInner, h.headerRow]}>
          <View style={h.nameCol}><Text style={h.headerLabel}>Name</Text></View>
          {DAY_SHORT.map((d, i) => (
            <View key={i} style={[h.dayCol, h.dayCell]}>
              <Text style={h.headerLabel}>{d}</Text>
              <Text style={h.headerDate}>{new Date(`${weekDates[i]}T00:00:00`).getDate()}</Text>
            </View>
          ))}
          <View style={[h.totalCol, h.dayCell]}><Text style={h.headerLabel}>Days</Text></View>
          <View style={[h.earnedCol, h.dayCell]}><Text style={h.headerLabel}>Paid</Text></View>
        </View>
      </ScrollView>
      {activeL.map((l, li) => {
        const c = AVATAR_COLORS[li % AVATAR_COLORS.length];
        return (
          <RowContent key={l.id} id={l.id} kind="labour"
            avatarBg={c.bg} avatarFg={c.fg} avatarLabel={initials(l.name)[0]}
            name={l.name} />
        );
      })}
      {activeT.map((t) => (
        <RowContent key={t.id} id={t.id} kind="team"
          avatarBg="#e8d5f7" avatarFg="#3d1457" avatarLabel="T"
          name={t.name} rowBg="#f5f0ff" />
      ))}
    </ScrollView>

    {/* Payment breakdown modal */}
    <Modal visible={!!breakdown} transparent animationType="fade" onRequestClose={() => setBreakdown(null)}>
      <TouchableOpacity style={h.bdOverlay} activeOpacity={1} onPress={() => setBreakdown(null)}>
        <TouchableOpacity activeOpacity={1} style={h.bdCard} onPress={() => {}}>
          <Text style={h.bdTitle} numberOfLines={1}>{breakdown?.name}</Text>
          <Text style={h.bdSubtitle}>Payments this week</Text>
          {breakdown && paymentsFor(breakdown.id, breakdown.kind).length === 0 ? (
            <Text style={h.bdEmpty}>No payments recorded this week.</Text>
          ) : (
            breakdown && weekDates
              .map((d) => ({ date: d, items: paymentsFor(breakdown.id, breakdown.kind).filter((p) => p.date === d) }))
              .filter((x) => x.items.length > 0)
              .map((x) => (
                <View key={x.date} style={h.bdRow}>
                  <Text style={h.bdDay}>{fmtDay(x.date)}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    {x.items.map((p) => (
                      <Text key={p.id} style={h.bdAmt}>
                        {METHOD_LABEL[p.method] ?? p.method}  ₹{Math.round(p.amount).toLocaleString('en-IN')}
                      </Text>
                    ))}
                  </View>
                </View>
              ))
          )}
          {breakdown && paymentsFor(breakdown.id, breakdown.kind).length > 0 && (
            <View style={h.bdTotalRow}>
              <Text style={h.bdTotalLabel}>Total</Text>
              <Text style={h.bdTotalAmt}>₹{Math.round(weekPaid(breakdown.id, breakdown.kind)).toLocaleString('en-IN')}</Text>
            </View>
          )}
          <TouchableOpacity style={h.bdClose} onPress={() => setBreakdown(null)}>
            <Text style={h.bdCloseTxt}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AttendanceScreen() {
  const today = todayISO();
  const { t } = useLanguage();
  const [weekStart, setWeekStart] = useState(mondayOf(today));
  const [markDate, setMarkDate] = useState(today);
  const [activeTab, setActiveTab] = useState<'mark' | 'history'>('mark');
  const [labours, setLabours] = useState<Labour[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetIds, setSheetIds] = useState<Set<string> | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingMark, setPendingMark] = useState<PendingMark | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const isCurrentWeek = weekStart === mondayOf(today);
  const weekLabel = `${new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(`${addDays(weekStart, 6)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  // One roster for all days: whoever you marked (or added) carries forward to the next day.
  const sheetKey = ROSTER_KEY;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ls, ts, rs, ps] = await Promise.all([
        apiGet<{ items: Labour[] }>('/api/v1/labours', { page: 1, page_size: 100, status: 'active' }),
        apiGet<{ items: Team[] }>('/api/v1/teams', { page: 1, page_size: 100, status: 'active' }),
        apiGet<{ items: AttRecord[] }>('/api/v1/attendance/history', {
          date_from: weekStart, date_to: addDays(weekStart, 6), page: 1, page_size: 100,
        }),
        apiGet<{ items: Payment[] }>('/api/v1/payments', {
          date_from: weekStart, date_to: addDays(weekStart, 6), page: 1, page_size: 200,
        }).catch(() => ({ items: [] as Payment[] })),
      ]);
      const lItems = ls.items ?? [];
      const tItems = ts.items ?? [];
      setLabours(lItems); setTeams(tItems); setRecords(rs.items ?? []); setPayments(ps.items ?? []);
      try {
        const stored = await AsyncStorage.getItem(sheetKey);
        if (stored) {
          setSheetIds(new Set(JSON.parse(stored)));
        } else {
          // First run: start from the people already marked this week (not everyone in the DB).
          const keys = new Set<string>();
          for (const r of rs.items ?? []) {
            if (r.labour_id) keys.add(`l:${r.labour_id}`);
            else if (r.team_id) keys.add(`t:${r.team_id}`);
          }
          const arr = [...keys];
          await AsyncStorage.setItem(sheetKey, JSON.stringify(arr));
          setSheetIds(new Set(arr));
        }
      } catch { setSheetIds(null); }
    } catch { setLoadError('Failed to load attendance data. Check your connection.'); }
    finally { setLoading(false); }
  }, [weekStart, sheetKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!weekDates.includes(markDate)) setMarkDate(weekDates.includes(today) ? today : weekStart);
  }, [weekDates, weekStart, markDate, today]);

  async function addToSheet(key: string) {
    const next = new Set(sheetIds ?? []);
    next.add(key);
    setSheetIds(next);
    try { await AsyncStorage.setItem(sheetKey, JSON.stringify([...next])); } catch {}
  }

  async function removeFromSheet(key: string) {
    const isTeam = key.startsWith('t:');
    const id = key.slice(2);
    const hasMark = records.some((r) => r.date === markDate && (isTeam ? r.team_id === id : r.labour_id === id));
    if (hasMark) {
      Alert.alert('Already marked', 'Clear this person’s mark for the day first, then remove them from the list.');
      return;
    }
    const next = new Set(sheetIds ?? []);
    next.delete(key);
    setSheetIds(next);
    try { await AsyncStorage.setItem(sheetKey, JSON.stringify([...next])); } catch {}
  }

  function upsertLocal(next: AttRecord) {
    setRecords((prev) => [...prev.filter((r) => r.id !== next.id), next]);
    // Anyone you mark joins the carried-forward list.
    const key = next.labour_id ? `l:${next.labour_id}` : next.team_id ? `t:${next.team_id}` : null;
    if (key && sheetIds && !sheetIds.has(key)) addToSheet(key);
  }

  // ── Instant feedback ────────────────────────────────────────────────────────
  // Taps update the row immediately (optimistic); the request runs in the
  // background, the row shows a spinner while it's in flight, and a failure
  // rolls the row back with an error. One save per row+day at a time.
  const inFlight = useRef<Set<string>>(new Set());
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  function setSaving(key: string, on: boolean) {
    if (on) inFlight.current.add(key); else inFlight.current.delete(key);
    setSavingKeys(new Set(inFlight.current));
  }
  const rowKey = (kind: 'labour' | 'team', id: string, date: string) => `${kind[0]}:${id}:${date}`;
  const isRec = (r: AttRecord, kind: 'labour' | 'team', id: string, date: string) =>
    r.date === date && (kind === 'labour' ? r.labour_id === id : r.team_id === id);

  /** Run `save` with an optimistic local change; roll back to `before` on failure. */
  async function withOptimistic(
    kind: 'labour' | 'team', id: string, date: string,
    optimistic: AttRecord | null, save: () => Promise<AttRecord | null>,
  ) {
    const key = rowKey(kind, id, date);
    if (inFlight.current.has(key)) return;
    const before = records.find((r) => isRec(r, kind, id, date)) ?? null;
    setSaving(key, true);
    setRecords((prev) => {
      const rest = prev.filter((r) => !isRec(r, kind, id, date));
      return optimistic ? [...rest, optimistic] : rest;
    });
    try {
      const saved = await save();
      if (saved) {
        setRecords((prev) => [...prev.filter((r) => !isRec(r, kind, id, date)), saved]);
        const k = saved.labour_id ? `l:${saved.labour_id}` : saved.team_id ? `t:${saved.team_id}` : null;
        if (k && sheetIds && !sheetIds.has(k)) addToSheet(k); // marked people join the carried-forward list
      }
    } catch {
      setRecords((prev) => {
        const rest = prev.filter((r) => !isRec(r, kind, id, date));
        return before ? [...rest, before] : rest;
      });
      Alert.alert('Error', 'Failed to update attendance.');
    } finally {
      setSaving(key, false);
    }
  }

  // P / H / A tap (and tap-again to undo)
  function handleToggleOther(entityId: string, kind: 'labour' | 'team', status: AttStatus, date: string) {
    const existing = records.find((r) => isRec(r, kind, entityId, date));
    if (existing && existing.status === status) {
      return withOptimistic(kind, entityId, date, null, async () => {
        await apiDelete(`/api/v1/attendance/${existing.id}`);
        return null;
      });
    }
    const team = kind === 'team' ? teams.find((t) => t.id === entityId) : undefined;
    const payload: Record<string, unknown> = {
      date, status, wage_type: 'daily',
      labour_id: kind === 'labour' ? entityId : null,
      team_id: kind === 'team' ? entityId : null,
    };
    if (kind === 'team') payload.num_labourers = team?.member_count || 1;
    if (existing) {
      payload.id = existing.id;
      // Switching between P and H keeps any time / notes already entered.
      if (existing.task) payload.task = existing.task;
      if (existing.work_start_time) payload.work_start_time = existing.work_start_time;
      if (existing.work_end_time) payload.work_end_time = existing.work_end_time;
      if (kind === 'team' && status !== 'absent' && existing.num_labourers) payload.num_labourers = existing.num_labourers;
    }
    const optimistic: AttRecord = {
      ...(existing ?? {}),
      id: existing?.id ?? `tmp-${rowKey(kind, entityId, date)}`,
      date, status,
      labour_id: kind === 'labour' ? entityId : null,
      team_id: kind === 'team' ? entityId : null,
      num_labourers: (payload.num_labourers as number | undefined) ?? existing?.num_labourers ?? null,
    };
    return withOptimistic(kind, entityId, date, optimistic, () => apiPost<AttRecord>('/api/v1/attendance', payload));
  }

  // Team row: set the number of members present. 0 / blank clears the mark.
  function handleSetTeamCount(entityId: string, count: number, date: string) {
    const existing = records.find((r) => isRec(r, 'team', entityId, date));
    if (count <= 0) {
      if (!existing) return;
      return withOptimistic('team', entityId, date, null, async () => {
        await apiDelete(`/api/v1/attendance/${existing.id}`);
        return null;
      });
    }
    if (existing && existing.status === 'present' && existing.num_labourers === count) return;
    const payload: Record<string, unknown> = {
      date, status: 'present', wage_type: 'daily',
      labour_id: null, team_id: entityId, num_labourers: count,
    };
    if (existing) {
      payload.id = existing.id;
      if (existing.task) payload.task = existing.task;
      if (existing.work_start_time) payload.work_start_time = existing.work_start_time;
      if (existing.work_end_time) payload.work_end_time = existing.work_end_time;
    }
    const optimistic: AttRecord = {
      ...(existing ?? {}),
      id: existing?.id ?? `tmp-${rowKey('team', entityId, date)}`,
      date, status: 'present', labour_id: null, team_id: entityId, num_labourers: count,
    };
    return withOptimistic('team', entityId, date, optimistic, () => apiPost<AttRecord>('/api/v1/attendance', payload));
  }

  // Pencil tapped on a P / H row — opens the details form for the existing record.
  function handleEdit(entityId: string, kind: 'labour' | 'team', name: string, defaultCount: number | undefined) {
    const rec = records.find((r) => r.date === markDate && (kind === 'labour' ? r.labour_id === entityId : r.team_id === entityId));
    if (!rec) return;
    setPendingMark({
      entityId, kind, date: markDate, name, defaultCount, status: rec.status,
      initial: { task: rec.task, startTime: rec.work_start_time, endTime: rec.work_end_time, numLabourers: rec.num_labourers },
    });
  }

  // Called from PresentModal on confirm
  async function confirmPresent(extra: {
    task?: string; startTime?: string; endTime?: string; numLabourers?: number;
    payment?: { amount: number; method: string };
  }) {
    if (!pendingMark) return;
    const { entityId, kind, date } = pendingMark;
    const existing = records.find((r) => r.date === date && (kind === 'labour' ? r.labour_id === entityId : r.team_id === entityId));

    const payload: Record<string, unknown> = {
      date, status: pendingMark.status, wage_type: 'daily',
      labour_id: kind === 'labour' ? entityId : null,
      team_id: kind === 'team' ? entityId : null,
      ...(extra.task ? { task: extra.task } : {}),
      ...(extra.startTime ? { work_start_time: extra.startTime } : {}),
      ...(extra.endTime ? { work_end_time: extra.endTime } : {}),
      ...(extra.numLabourers != null ? { num_labourers: extra.numLabourers } : {}),
    };
    if (existing) payload.id = existing.id;

    const saved = await apiPost<AttRecord>('/api/v1/attendance', payload);
    upsertLocal(saved);

    // Optional payment
    if (extra.payment) {
      await apiPost('/api/v1/payments', {
        labour_id: kind === 'labour' ? entityId : null,
        team_id: kind === 'team' ? entityId : null,
        amount: extra.payment.amount,
        method: extra.payment.method,
        date,
        notes: 'Recorded with attendance',
      });
    }
  }

  function handleCycle(entityId: string, kind: 'labour' | 'team', date: string) {
    const existing = records.find((r) => r.date === date && (kind === 'labour' ? r.labour_id === entityId : r.team_id === entityId));
    const order: AttStatus[] = ['present', 'half_day', 'absent'];
    if (!existing) { handleToggleOther(entityId, kind, 'present', date); return; }
    const idx = order.indexOf(existing.status);
    // After absent, tapping again clears the mark (toggle with the same status deletes it).
    if (idx === order.length - 1) { handleToggleOther(entityId, kind, existing.status, date); return; }
    handleToggleOther(entityId, kind, order[idx + 1], date);
  }

  // Voice entry saved some marks: put those people on the carried-forward list,
  // jump to the (latest) day that was marked and reload from the server.
  async function handleVoiceSaved(saved: SavedAttendance[]) {
    if (!saved.length) return;
    const next = new Set(sheetIds ?? []);
    for (const r of saved) next.add(r.labour_id ? `l:${r.labour_id}` : `t:${r.team_id}`);
    setSheetIds(next);
    try { await AsyncStorage.setItem(sheetKey, JSON.stringify([...next])); } catch {}
    const latest = saved.map((r) => r.date).sort().pop() as string;
    const targetWeek = mondayOf(latest);
    setMarkDate(latest);
    if (targetWeek !== weekStart) setWeekStart(targetWeek);   // the week change triggers a reload
    else load();
  }

  const dateHasMarks = records.some((r) => r.date === markDate);

  return (
    <View style={s.root}>
      <AppHeader screenName={t('attendance')} />

      <View style={s.weekNav}>
        <TouchableOpacity style={s.navBtn} onPress={() => setWeekStart(addDays(weekStart, -7))}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={C.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
          <Text style={s.weekLabel}>{weekLabel}</Text>
          {!isCurrentWeek && (
            <TouchableOpacity onPress={() => { setWeekStart(mondayOf(today)); setMarkDate(today); }}>
              <Text style={s.todayLink}>↩ This Week</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={[s.navBtn, isCurrentWeek && { opacity: 0.3 }]} onPress={() => !isCurrentWeek && setWeekStart(addDays(weekStart, 7))} disabled={isCurrentWeek}>
          <MaterialCommunityIcons name="chevron-right" size={22} color={C.onSurface} />
        </TouchableOpacity>
      </View>

      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tabBtn, activeTab === 'mark' && s.tabBtnActive]} onPress={() => setActiveTab('mark')}>
          <Text style={[s.tabBtnText, activeTab === 'mark' && s.tabBtnTextActive]}>{dateHasMarks ? 'Edit Day' : 'Mark Day'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, activeTab === 'history' && s.tabBtnActive]} onPress={() => setActiveTab('history')}>
          <Text style={[s.tabBtnText, activeTab === 'history' && s.tabBtnTextActive]}>Week History</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'mark' && (
        <View style={s.dayChips}>
          {weekDates.map((d) => {
            const selected = d === markDate;
            return (
              <TouchableOpacity key={d} style={[s.dayChip, selected && s.dayChipActive]} onPress={() => setMarkDate(d)}>
                <Text style={[s.dayChipDow, selected && s.dayChipTextActive]}>
                  {new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'narrow' })}
                </Text>
                <Text style={[s.dayChipDate, selected && s.dayChipTextActive]}>
                  {new Date(`${d}T00:00:00`).getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {loading ? (
        <View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : loadError ? (
        <View style={s.centred}>
          <MaterialCommunityIcons name="wifi-off" size={48} color={C.outline} />
          <Text style={[s.emptyDesc, { fontSize: 16, fontWeight: '700', color: C.onSurface }]}>Connection Error</Text>
          <Text style={s.emptyDesc}>{loadError}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load}>
            <Text style={s.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'mark' ? (
        <MarkTab
          markDate={markDate}
          labours={labours}
          teams={teams}
          records={records}
          onEdit={handleEdit}
          onToggleOther={handleToggleOther}
          onSetTeamCount={handleSetTeamCount}
          savingKeys={savingKeys}
          onAddToSheet={() => setPickerOpen(true)}
          onRemoveFromSheet={removeFromSheet}
          sheetIds={sheetIds}
        />
      ) : (
        <HistoryTab weekDates={weekDates} labours={labours} teams={teams} records={records} payments={payments} onCycle={handleCycle} />
      )}

      <PickerModal
        visible={pickerOpen}
        labours={labours}
        teams={teams}
        sheetIds={sheetIds}
        onAddToSheet={addToSheet}
        onClose={() => setPickerOpen(false)}
        onCreated={() => { setPickerOpen(false); load(); }}
      />

      <PresentModal
        pending={pendingMark}
        onClose={() => setPendingMark(null)}
        onConfirm={confirmPresent}
      />

      {activeTab === 'mark' && !loading && !loadError && (
        <TouchableOpacity style={s.voiceFab} onPress={() => setVoiceOpen(true)} activeOpacity={0.85} accessibilityLabel={t('voice_att_title')}>
          <MaterialCommunityIcons name="microphone" size={26} color={C.onPrimary} />
          <Text style={s.voiceFabText}>{t('voice_add')}</Text>
        </TouchableOpacity>
      )}

      <VoiceAttendanceSheet
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onSaved={handleVoiceSaved}
        labours={labours}
        teams={teams}
        existingFor={(kind, id, date) => records.find((r) => r.date === date && (kind === 'labour' ? r.labour_id === id : r.team_id === id))}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.surfaceLowest, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  navBtn: { width: 36, height: 36, borderRadius: R.full, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  weekLabel: { fontSize: 13, fontWeight: '600', color: C.onSurface },
  todayLink: { fontSize: 11, fontWeight: '700', color: C.primaryContainer },
  tabBar: { flexDirection: 'row', backgroundColor: C.surfaceLowest, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2.5, borderBottomColor: C.primaryContainer },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: C.onSurfaceVariant },
  tabBtnTextActive: { color: C.primaryContainer },
  dayChips: { flexDirection: 'row', alignItems: 'stretch', gap: 6, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.surfaceLowest, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  dayChip: { flex: 1, minHeight: 48, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceHigh },
  dayChipActive: { backgroundColor: C.primary },
  dayChipDow: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, textAlign: 'center' },
  dayChipDate: { fontSize: 13, fontWeight: '700', color: C.onSurface, textAlign: 'center', marginTop: 1 },
  dayChipTextActive: { color: C.onPrimary },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyDesc: { fontSize: 14, color: C.onSurfaceVariant, textAlign: 'center' },
  retryBtn: { marginTop: 8, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
  markHeader: { marginBottom: 12, gap: 4 },
  markHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  markDate: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  markHint: { fontSize: 11, color: C.onSurfaceVariant },
  addPersonBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primaryFixed, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 7 },
  addPersonText: { fontSize: 12, fontWeight: '700', color: C.primary },
  entityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLowest, borderRadius: R.lg, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: C.outlineVariant, gap: 8 },
  entityAvatar: { width: 38, height: 38, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  entityAvatarText: { fontSize: 12, fontWeight: '700' },
  entityInfo: { flex: 1, minWidth: 0 },
  entityName: { fontSize: 13, fontWeight: '600', color: C.onSurface },
  entityKind: { fontSize: 11, color: C.onSurfaceVariant, marginTop: 1 },
  statusBtns: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusBtn: { width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceHigh },
  statusBtnText: { fontSize: 12, fontWeight: '800', color: C.onSurfaceVariant },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 30, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceHigh },
  stepInput: { width: 44, height: 32, borderRadius: R.sm, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLowest, fontSize: 14, fontWeight: '800', color: C.onSurface, paddingVertical: 0, paddingHorizontal: 2 },
  stepInputFilled: { backgroundColor: C.primaryFixed, borderColor: C.primary, color: C.primary },
  editBtn: { width: 28, height: 28, borderRadius: R.full, backgroundColor: C.primaryFixed, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  voiceFab: { position: 'absolute', right: 16, bottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primaryContainer, paddingHorizontal: 20, paddingVertical: 14, borderRadius: R.full, elevation: 6 },
  voiceFabText: { color: C.onPrimary, fontSize: 15, fontWeight: '800' },
});

const H_NAME = 96;
const H_DAY  = 24;
const H_TOTAL = 30;
const H_EARNED = 52;
const H_ROW_W = H_NAME + 7 * H_DAY + H_TOTAL + H_EARNED;

const h = StyleSheet.create({
  headerRow: { backgroundColor: C.surfaceHigh, borderRadius: R.sm, borderWidth: 1, borderColor: C.outlineVariant, marginBottom: 2, minHeight: 40, overflow: 'hidden' },
  row: { alignItems: 'stretch', backgroundColor: C.surfaceLowest, borderRadius: R.sm, marginBottom: 4, borderWidth: 1, borderColor: C.outlineVariant, minHeight: 44, overflow: 'hidden' },
  hScroll: { flex: 1 },
  hInner: { flexDirection: 'row', alignItems: 'stretch', width: H_ROW_W },
  nameCol: { width: H_NAME, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayCol: { width: H_DAY, alignItems: 'center', justifyContent: 'center' },
  dayCell: { borderLeftWidth: 1, borderLeftColor: C.outlineVariant },
  totalCol: { width: H_TOTAL, alignItems: 'center', justifyContent: 'center' },
  earnedCol: { width: H_EARNED, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  headerLabel: { fontSize: 9, fontWeight: '700', color: C.onSurfaceVariant, textAlign: 'center' },
  headerDate: { fontSize: 9, color: C.outline, textAlign: 'center', marginTop: 1 },
  miniAvatar: { width: 22, height: 22, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  nameText: { fontSize: 12, fontWeight: '600', color: C.onSurface, flex: 1 },
  statusLabel: { fontSize: 11, fontWeight: '800', color: C.onSurfaceVariant, textAlign: 'center' },
  totalText: { fontSize: 12, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  earnedText: { fontSize: 11, fontWeight: '700', color: '#2a7a4f', textAlign: 'center' },
  // breakdown modal
  bdOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  bdCard: { backgroundColor: C.surfaceLowest, borderRadius: R.xl, padding: 20, width: '100%', maxWidth: 360 },
  bdTitle: { fontSize: 16, fontWeight: '700', color: C.onSurface, marginBottom: 2 },
  bdSubtitle: { fontSize: 12, color: C.onSurfaceVariant, marginBottom: 14 },
  bdEmpty: { fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center', paddingVertical: 12 },
  bdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  bdDay: { fontSize: 13, color: C.onSurface, fontWeight: '500', flex: 1 },
  bdAmt: { fontSize: 13, color: C.onSurface, fontWeight: '600' },
  bdTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 2 },
  bdTotalLabel: { fontSize: 14, fontWeight: '700', color: C.onSurface },
  bdTotalAmt: { fontSize: 14, fontWeight: '800', color: '#2a7a4f' },
  bdClose: { marginTop: 16, backgroundColor: C.primaryContainer, borderRadius: R.lg, paddingVertical: 10, alignItems: 'center' },
  bdCloseTxt: { fontSize: 14, fontWeight: '700', color: C.onPrimary },
});

const pm = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant, backgroundColor: C.surfaceLowest },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  sub: { fontSize: 13, color: C.onSurfaceVariant, marginTop: 2 },
  body: { padding: 20, gap: 4, paddingBottom: 32 },
  section: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  sublabel: { fontSize: 11, color: C.onSurfaceVariant, marginBottom: 4 },
  input: { height: 46, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 14, fontSize: 15, color: C.onSurface, backgroundColor: C.surfaceLowest },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeSepText: { fontSize: 18, color: C.onSurfaceVariant },
  timePicker: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 12, backgroundColor: C.surfaceLowest },
  timePickerFilled: { borderColor: C.primaryFixed, backgroundColor: C.primaryFixed },
  timePickerTxt: { fontSize: 14, color: C.outline },
  timePickerTxtFilled: { color: C.primary, fontWeight: '600' },
  payToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodChip: { flex: 1, height: 38, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.outlineVariant, backgroundColor: C.surfaceHigh },
  methodChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  methodText: { fontSize: 13, fontWeight: '700', color: C.onSurfaceVariant },
  methodTextOn: { color: C.onPrimary },
  error: { color: C.error, fontSize: 13, textAlign: 'center' },
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant, backgroundColor: C.surfaceLowest },
  cancelBtn: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600' },
  confirmBtn: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  confirmText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
});

const pk = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant, backgroundColor: C.surfaceLowest },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  body: { padding: 16, gap: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 1, marginBottom: 4 },
  entityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLowest, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: C.outlineVariant, gap: 12 },
  entityRowIn: { borderColor: C.primaryContainer, backgroundColor: C.primaryFixed },
  entityName: { fontSize: 15, fontWeight: '600', color: C.onSurface },
  entityKind: { fontSize: 12, color: C.onSurfaceVariant },
  onSheetBadge: { backgroundColor: C.primaryContainer, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4 },
  onSheetText: { fontSize: 11, fontWeight: '700', color: C.onPrimary },
  createBtns: { flexDirection: 'row', gap: 10 },
  createBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLowest },
  createBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  createBtnText: { fontSize: 13, fontWeight: '700', color: C.primary },
  form: { backgroundColor: C.surfaceLowest, borderRadius: R.lg, padding: 16, borderWidth: 1, borderColor: C.outlineVariant, gap: 4 },
  formTitle: { fontSize: 15, fontWeight: '700', color: C.primary, marginBottom: 8 },
  formField: { marginBottom: 10 },
  formLabel: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 },
  formInput: { height: 46, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 14, fontSize: 15, color: C.onSurface, backgroundColor: C.background },
  twoCol: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  saveBtn: { backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
});
