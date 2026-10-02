import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import ClockPicker, { fmt12h } from '../../components/ClockPicker';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { C, R, AVATAR_COLORS, initials } from '../../lib/theme';

type AttStatus = 'present' | 'absent' | 'half_day';
interface AttRecord {
  id: string; date: string; labour_id: string | null; team_id: string | null;
  status: AttStatus; wage_earned?: number;
}
interface Labour { id: string; name: string; is_active: boolean; daily_wage?: number; }
interface Team { id: string; name: string; member_count: number; is_active: boolean; daily_wage?: number; }

const STATUS_LABEL: Record<AttStatus, string> = { present: 'P', absent: 'A', half_day: 'H' };
const STATUS_STYLE: Record<AttStatus, { bg: string; fg: string }> = {
  present: { bg: C.primaryFixed, fg: C.primary },
  absent: { bg: C.errorContainer, fg: C.error },
  half_day: { bg: '#fef3c7', fg: '#6b4c04' },
};
const DAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
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

interface PendingMark { entityId: string; kind: 'labour' | 'team'; date: string; name: string; defaultCount?: number; status: AttStatus; }

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
    setNumMembers(String(pending.defaultCount ?? 1));
    setStartTime(''); setEndTime(''); setTask('');
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
              <Text style={pm.title}>{pending.status === 'half_day' ? 'Mark Half Day' : 'Mark Present'}</Text>
              <Text style={pm.sub} numberOfLines={1}>{pending.name}</Text>
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
              {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={pm.confirmText}>{pending.status === 'half_day' ? 'Mark Half Day' : 'Mark Present'}</Text>}
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

// ─── Mark Tab ─────────────────────────────────────────────────────────────────

function MarkTab({
  markDate, labours, teams, records, onMarkPresent, onToggleOther, onAddToSheet, onRemoveFromSheet, sheetIds,
}: {
  markDate: string; labours: Labour[]; teams: Team[];
  records: AttRecord[];
  onMarkPresent: (id: string, kind: 'labour' | 'team', name: string, defaultCount: number | undefined, status: AttStatus) => void;
  onToggleOther: (id: string, kind: 'labour' | 'team', s: AttStatus, date: string) => void;
  onAddToSheet: () => void;
  onRemoveFromSheet: (key: string) => void;
  sheetIds: Set<string> | null;
}) {
  const allEntities = [
    ...labours.map((l) => ({ id: l.id, name: l.name, kind: 'labour' as const })),
    ...teams.map((t) => ({ id: t.id, name: t.name, kind: 'team' as const, count: t.member_count })),
  ];
  const all = sheetIds
    ? allEntities.filter((e) => sheetIds.has(`${e.kind[0]}:${e.id}`))
    : allEntities;

  const dateLabel = new Date(`${markDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  function statusOf(id: string, kind: string) {
    return records.find((r) => r.date === markDate && (kind === 'labour' ? r.labour_id === id : r.team_id === id))?.status ?? null;
  }

  function handleStatusPress(id: string, kind: 'labour' | 'team', name: string, st: AttStatus, existing: AttStatus | null, defaultCount?: number) {
    if (existing === st) {
      onToggleOther(id, kind, st, markDate);
      return;
    }
    if (st === 'present' || st === 'half_day') {
      onMarkPresent(id, kind, name, defaultCount, st);
    } else {
      onToggleOther(id, kind, st, markDate);
    }
  }

  return (
    <FlatList
      data={all}
      keyExtractor={(e) => `${e.kind}-${e.id}`}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 8 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={s.markHeader}>
          <View style={s.markHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.markDate}>{dateLabel}</Text>
              <Text style={s.markHint}>Tap P / H / A to mark · tap again to undo.</Text>
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
          <Text style={s.emptyDesc}>No one on today's sheet.</Text>
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
            <View style={s.statusBtns}>
              {(['present', 'half_day', 'absent'] as AttStatus[]).map((st) => {
                const col = STATUS_STYLE[st];
                const active = status === st;
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => handleStatusPress(e.id, e.kind, e.name, st, status, (e as any).count)}
                    style={[s.statusBtn, active && { backgroundColor: col.bg, borderColor: col.fg }]}
                  >
                    <Text style={[s.statusBtnText, active && { color: col.fg }]}>{STATUS_LABEL[st]}</Text>
                  </TouchableOpacity>
                );
              })}
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

function HistoryTab({ weekDates, labours, teams, records, onCycle }: {
  weekDates: string[]; labours: Labour[]; teams: Team[]; records: AttRecord[];
  onCycle: (id: string, kind: 'labour' | 'team', date: string) => void;
}) {
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

  if (activeL.length + activeT.length === 0) {
    return <View style={s.centred}><Text style={s.emptyDesc}>No attendance marked for this week.</Text></View>;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View style={[h.row, h.headerRow]}>
        <View style={h.nameCol}><Text style={h.headerLabel}>Name</Text></View>
        {DAY_SHORT.map((d, i) => (
          <View key={i} style={[h.dayCol, h.dayCell]}>
            <Text style={h.headerLabel}>{d}</Text>
            <Text style={h.headerDate}>{new Date(`${weekDates[i]}T00:00:00`).getDate()}</Text>
          </View>
        ))}
        <View style={[h.totalCol, h.dayCell]}><Text style={h.headerLabel}>Days</Text></View>
      </View>
      {activeL.map((l, li) => {
        const c = AVATAR_COLORS[li % AVATAR_COLORS.length];
        return (
          <View key={l.id} style={h.row}>
            <View style={h.nameCol}>
              <View style={[h.miniAvatar, { backgroundColor: c.bg }]}>
                <Text style={[h.miniAvatarText, { color: c.fg }]}>{initials(l.name)[0]}</Text>
              </View>
              <Text style={h.nameText} numberOfLines={1}>{l.name.split(' ')[0]}</Text>
            </View>
            {weekDates.map((d, di) => {
              const st = statusOf(l.id, 'labour', d);
              const col = st ? STATUS_STYLE[st] : null;
              return (
                <TouchableOpacity key={di} style={[h.dayCol, h.dayCell, col ? { backgroundColor: col.bg } : {}]} onPress={() => onCycle(l.id, 'labour', d)}>
                  <Text style={[h.statusLabel, col ? { color: col.fg } : {}]}>{st ? STATUS_LABEL[st] : '–'}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={[h.totalCol, h.dayCell]}>
              <Text style={h.totalText}>{dayCount(l.id, 'labour')}</Text>
            </View>
          </View>
        );
      })}
      {activeT.map((t) => (
        <View key={t.id} style={[h.row, { backgroundColor: '#f5f0ff' }]}>
          <View style={h.nameCol}>
            <View style={[h.miniAvatar, { backgroundColor: '#e8d5f7' }]}>
              <Text style={[h.miniAvatarText, { color: '#3d1457' }]}>T</Text>
            </View>
            <Text style={h.nameText} numberOfLines={1}>{t.name.split(' ')[0]}</Text>
          </View>
          {weekDates.map((d, di) => {
            const st = statusOf(t.id, 'team', d);
            const col = st ? STATUS_STYLE[st] : null;
            return (
              <TouchableOpacity key={di} style={[h.dayCol, h.dayCell, col ? { backgroundColor: col.bg } : {}]} onPress={() => onCycle(t.id, 'team', d)}>
                <Text style={[h.statusLabel, col ? { color: col.fg } : {}]}>{st ? STATUS_LABEL[st] : '–'}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={[h.totalCol, h.dayCell]}>
            <Text style={h.totalText}>{dayCount(t.id, 'team')}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AttendanceScreen() {
  const today = todayISO();
  const [weekStart, setWeekStart] = useState(mondayOf(today));
  const [markDate, setMarkDate] = useState(today);
  const [activeTab, setActiveTab] = useState<'mark' | 'history'>('mark');
  const [labours, setLabours] = useState<Labour[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetIds, setSheetIds] = useState<Set<string> | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingMark, setPendingMark] = useState<PendingMark | null>(null);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const isCurrentWeek = weekStart === mondayOf(today);
  const weekLabel = `${new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(`${addDays(weekStart, 6)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const sheetKey = `lb:att-sheet:${weekStart}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ls, ts, rs] = await Promise.all([
        apiGet<{ items: Labour[] }>('/api/v1/labours', { page: 1, page_size: 100, status: 'active' }),
        apiGet<{ items: Team[] }>('/api/v1/teams', { page: 1, page_size: 100, status: 'active' }),
        apiGet<{ items: AttRecord[] }>('/api/v1/attendance/history', {
          date_from: weekStart, date_to: addDays(weekStart, 6), page: 1, page_size: 100,
        }),
      ]);
      const lItems = ls.items ?? [];
      const tItems = ts.items ?? [];
      setLabours(lItems); setTeams(tItems); setRecords(rs.items ?? []);
      try {
        const stored = await AsyncStorage.getItem(sheetKey);
        if (stored) {
          setSheetIds(new Set(JSON.parse(stored)));
        } else {
          const allKeys = [...lItems.map((l) => `l:${l.id}`), ...tItems.map((t) => `t:${t.id}`)];
          await AsyncStorage.setItem(sheetKey, JSON.stringify(allKeys));
          setSheetIds(new Set(allKeys));
        }
      } catch { setSheetIds(null); }
    } catch { Alert.alert('Error', 'Failed to load attendance.'); }
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
    const next = new Set(sheetIds ?? []);
    next.delete(key);
    setSheetIds(next);
    try { await AsyncStorage.setItem(sheetKey, JSON.stringify([...next])); } catch {}
  }

  function upsertLocal(next: AttRecord) {
    setRecords((prev) => [...prev.filter((r) => r.id !== next.id), next]);
  }

  // Called for half_day / absent / undo
  async function handleToggleOther(entityId: string, kind: 'labour' | 'team', status: AttStatus, date: string) {
    const existing = records.find((r) => r.date === date && (kind === 'labour' ? r.labour_id === entityId : r.team_id === entityId));
    try {
      if (existing && existing.status === status) {
        await apiDelete(`/api/v1/attendance/${existing.id}`);
        setRecords((prev) => prev.filter((r) => r.id !== existing.id));
        return;
      }
      const team = kind === 'team' ? teams.find((t) => t.id === entityId) : undefined;
      const payload: Record<string, unknown> = {
        date, status, wage_type: 'daily',
        labour_id: kind === 'labour' ? entityId : null,
        team_id: kind === 'team' ? entityId : null,
      };
      if (kind === 'team') payload.num_labourers = team?.member_count || 1;
      if (existing) payload.id = existing.id;
      const saved = await apiPost<AttRecord>('/api/v1/attendance', payload);
      upsertLocal(saved);
    } catch { Alert.alert('Error', 'Failed to update attendance.'); }
  }

  // Called when "P" or "H" is tapped — opens modal
  function handleMarkPresent(entityId: string, kind: 'labour' | 'team', name: string, defaultCount: number | undefined, status: AttStatus = 'present') {
    setPendingMark({ entityId, kind, date: markDate, name, defaultCount, status });
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
    const eName = (labours.find((l) => l.id === entityId) ?? teams.find((t) => t.id === entityId))?.name ?? '';
    const eCount = kind === 'team' ? teams.find((t) => t.id === entityId)?.member_count : undefined;
    if (!existing) { handleMarkPresent(entityId, kind, eName, eCount, 'present'); return; }
    const idx = order.indexOf(existing.status);
    if (idx === order.length - 1) { handleToggleOther(entityId, kind, existing.status, date); return; }
    if (order[idx + 1] === 'present' || order[idx + 1] === 'half_day') { handleMarkPresent(entityId, kind, eName, eCount, order[idx + 1]); return; }
    handleToggleOther(entityId, kind, order[idx + 1], date);
  }

  const dateHasMarks = records.some((r) => r.date === markDate);

  return (
    <View style={s.root}>
      <AppHeader screenName="Attendance" />

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
      ) : activeTab === 'mark' ? (
        <MarkTab
          markDate={markDate}
          labours={labours}
          teams={teams}
          records={records}
          onMarkPresent={handleMarkPresent}
          onToggleOther={handleToggleOther}
          onAddToSheet={() => setPickerOpen(true)}
          onRemoveFromSheet={removeFromSheet}
          sheetIds={sheetIds}
        />
      ) : (
        <HistoryTab weekDates={weekDates} labours={labours} teams={teams} records={records} onCycle={handleCycle} />
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
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
});

const h = StyleSheet.create({
  headerRow: { backgroundColor: C.surfaceHigh, borderWidth: 0, minHeight: 40 },
  row: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.surfaceLowest, borderRadius: R.sm, marginBottom: 4, borderWidth: 1, borderColor: C.outlineVariant, minHeight: 44, overflow: 'hidden' },
  nameCol: { flex: 1.35, minWidth: 0, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dayCell: { borderLeftWidth: 1, borderLeftColor: C.outlineVariant },
  totalCol: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, textAlign: 'center' },
  headerDate: { fontSize: 10, color: C.outline, textAlign: 'center', marginTop: 1 },
  miniAvatar: { width: 22, height: 22, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  nameText: { fontSize: 12, fontWeight: '600', color: C.onSurface, flex: 1 },
  statusLabel: { fontSize: 12, fontWeight: '800', color: C.onSurfaceVariant, textAlign: 'center' },
  totalText: { fontSize: 12, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
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
