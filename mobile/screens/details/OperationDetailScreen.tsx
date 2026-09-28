import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ApiError, apiDelete, apiGet, apiPost, apiUpload } from '../../lib/api';
import { C, R, fmtCurrency, fmtDate } from '../../lib/theme';
import { Labour, PaginatedResponse, TeamSummary } from '../../types';
import { OperationsStackParamList } from './types';

type Props = NativeStackScreenProps<OperationsStackParamList, 'OperationDetail'>;

interface Operation {
  id: string;
  operation_date: string;
  operation_type: string;
  notes?: string | null;
}

interface Worker {
  id: string;
  labour_id?: string | null;
  team_id?: string | null;
  hours_worked?: number | null;
  labour?: { name: string; daily_wage: number } | null;
  team?: { name: string; daily_wage: number; car_rent: number; manager_fee: number } | null;
}

interface Photo {
  id: string;
  public_url: string;
  caption?: string | null;
}

function confirmRemove(message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message)) onYes();
    return;
  }
  Alert.alert('Remove', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: onYes },
  ]);
}

export default function OperationDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const [op, setOp] = useState<Operation | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [operation, workerRows, photoRows] = await Promise.all([
        apiGet<Operation>(`/api/v1/plot-operations/${id}`),
        apiGet<Worker[]>(`/api/v1/plot-operations/${id}/workers`),
        apiGet<Photo[]>(`/api/v1/plot-operations/${id}/photos`),
      ]);
      setOp(operation);
      setWorkers(workerRows);
      setPhotos(photoRows);
    } catch {
      setError('Could not load this operation.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function removeWorker(workerId: string) {
    confirmRemove('Remove this worker from the operation?', async () => {
      try {
        await apiDelete(`/api/v1/plot-operations/${id}/workers/${workerId}`);
        setWorkers((rows) => rows.filter((w) => w.id !== workerId));
      } catch {
        setError('Could not remove the worker.');
      }
    });
  }

  async function removePhoto(photoId: string) {
    confirmRemove('Delete this photo?', async () => {
      try {
        await apiDelete(`/api/v1/plot-operations/${id}/photos/${photoId}`);
        setPhotos((rows) => rows.filter((p) => p.id !== photoId));
      } catch {
        setError('Could not delete the photo.');
      }
    });
  }

  async function addPhoto() {
    if (photos.length >= 5) {
      setError('This operation already has 5 photos.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const name = asset.fileName ?? 'photo.jpg';
    const type = asset.mimeType ?? 'image/jpeg';
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(asset.uri)).blob();
      form.append('file', blob, name);
    } else {
      form.append('file', { uri: asset.uri, name, type } as unknown as Blob);
    }
    setUploading(true);
    setError(null);
    try {
      await apiUpload(`/api/v1/plot-operations/${id}/photos`, form);
      await load();
    } catch (err) {
      const detail = err instanceof ApiError ? ` (${err.status})` : '';
      setError(`Could not upload the photo${detail}.`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>‹</Text></TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{op?.operation_type ?? 'Operation'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.centred}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : !op ? (
        <View style={s.centred}>
          <Text style={s.empty}>{error ?? 'Operation not found'}</Text>
          <TouchableOpacity style={s.retry} onPress={() => { setLoading(true); load(); }}><Text style={s.retryText}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          <Text style={s.date}>{fmtDate(op.operation_date)}</Text>
          {op.notes ? <Text style={s.notes}>{op.notes}</Text> : null}
          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={s.sectionRow}>
            <Text style={s.section}>Workers</Text>
            <TouchableOpacity onPress={() => setAdding(true)}><Text style={s.link}>+ Add</Text></TouchableOpacity>
          </View>
          {workers.length === 0 ? <Text style={s.hint}>No labour or team attached yet.</Text> : workers.map((w) => (
            <View key={w.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{w.labour?.name ?? w.team?.name ?? 'Worker'}</Text>
                <Text style={s.hint}>
                  {w.labour
                    ? `${fmtCurrency(w.labour.daily_wage)}/day`
                    : w.team
                      ? `${fmtCurrency(w.team.daily_wage)}/day · car ${fmtCurrency(w.team.car_rent)} · manager ${fmtCurrency(w.team.manager_fee)}`
                      : w.labour_id ? 'Labour' : 'Team'}
                  {w.hours_worked ? ` · ${w.hours_worked}h` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeWorker(w.id)} hitSlop={8}><Text style={s.remove}>Remove</Text></TouchableOpacity>
            </View>
          ))}

          <View style={s.sectionRow}>
            <Text style={s.section}>Photos ({photos.length}/5)</Text>
            <TouchableOpacity onPress={addPhoto} disabled={uploading}>
              {uploading ? <ActivityIndicator color={C.primary} /> : <Text style={s.link}>+ Photo</Text>}
            </TouchableOpacity>
          </View>
          {photos.length === 0 ? <Text style={s.hint}>No photos yet.</Text> : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {photos.map((p) => (
                <View key={p.id}>
                  <TouchableOpacity onPress={() => p.public_url && setPreview(p.public_url)}>
                    {p.public_url ? (
                      <Image source={{ uri: p.public_url }} style={s.thumb} />
                    ) : (
                      <View style={[s.thumb, s.thumbEmpty]}><Text style={s.hint}>No preview</Text></View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removePhoto(p.id)}><Text style={s.remove}>Delete</Text></TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </ScrollView>
      )}

      <AddWorker
        visible={adding}
        operationId={id}
        onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); load(); }}
      />

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <TouchableOpacity style={s.lightbox} activeOpacity={1} onPress={() => setPreview(null)}>
          {preview ? <Image source={{ uri: preview }} style={s.full} resizeMode="contain" /> : null}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function AddWorker({
  visible, operationId, onClose, onSaved,
}: { visible: boolean; operationId: string; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<'individual' | 'team'>('individual');
  const [entityId, setEntityId] = useState('');
  const [hours, setHours] = useState('');
  const [labours, setLabours] = useState<Labour[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setKind('individual'); setEntityId(''); setHours(''); setError(null);
    Promise.all([
      apiGet<PaginatedResponse<Labour>>('/api/v1/labours', { status: 'active', page_size: 100 }),
      apiGet<PaginatedResponse<TeamSummary>>('/api/v1/teams', { status: 'active', page_size: 100 }),
    ]).then(([l, t]) => { setLabours(l.items); setTeams(t.items); }).catch(() => setError('Could not load people.'));
  }, [visible]);

  const options = kind === 'individual' ? labours : teams;

  async function save() {
    if (!entityId) { setError('Select a labourer or team.'); return; }
    let hoursWorked: number | undefined;
    if (hours.trim()) {
      hoursWorked = parseFloat(hours);
      if (Number.isNaN(hoursWorked) || hoursWorked <= 0 || hoursWorked > 24) {
        setError('Hours must be between 0 and 24.');
        return;
      }
    }
    setSaving(true); setError(null);
    try {
      await apiPost(`/api/v1/plot-operations/${operationId}/workers`, {
        ...(kind === 'individual' ? { labour_id: entityId } : { team_id: entityId }),
        ...(hoursWorked ? { hours_worked: hoursWorked } : {}),
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError('Already added to this operation.');
      else setError('Could not add the worker.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.root}>
        <View style={m.header}>
          <Text style={m.title}>Add worker</Text>
          <TouchableOpacity onPress={onClose}><Text style={m.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
          <View style={m.row}>
            {(['individual', 'team'] as const).map((k) => (
              <TouchableOpacity key={k} style={[m.toggle, kind === k && m.toggleOn]} onPress={() => { setKind(k); setEntityId(''); }}>
                <Text style={[m.toggleText, kind === k && m.toggleTextOn]}>{k === 'individual' ? 'Labour' : 'Team'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={m.wrap}>
            {options.map((o) => (
              <TouchableOpacity key={o.id} style={[m.person, entityId === o.id && m.personOn]} onPress={() => setEntityId(o.id)}>
                <Text style={[m.personText, entityId === o.id && m.toggleTextOn]}>{o.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={m.label}>Hours (optional)</Text>
          <TextInput style={m.input} value={hours} onChangeText={setHours} keyboardType="numeric" placeholder="e.g. 4" placeholderTextColor={C.outline} />
          {error ? <Text style={m.error}>{error}</Text> : null}
        </ScrollView>
        <View style={m.footer}>
          <TouchableOpacity style={m.cancel} onPress={onClose}><Text style={m.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[m.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={m.saveText}>Add</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  back: { width: 36, alignItems: 'center' },
  backText: { fontSize: 32, color: C.primary, lineHeight: 34 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.primary },
  date: { fontSize: 13, fontWeight: '700', color: C.onSurfaceVariant },
  notes: { fontSize: 14, color: C.onSurface },
  error: { color: C.error, fontSize: 13 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  section: { fontSize: 14, fontWeight: '800', color: C.onSurface },
  link: { color: C.primary, fontWeight: '700' },
  hint: { fontSize: 12, color: C.onSurfaceVariant },
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceLowest, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.outlineVariant },
  name: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  remove: { color: C.error, fontSize: 12, fontWeight: '700', marginTop: 4 },
  thumb: { width: 96, height: 96, borderRadius: R.md, backgroundColor: C.surfaceHigh },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { fontSize: 15, fontWeight: '700', color: C.onSurface, textAlign: 'center' },
  retry: { marginTop: 12, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: C.onPrimary, fontWeight: '700' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center' },
  full: { width: '92%', height: '80%' },
});

const m = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface, paddingTop: Platform.OS === 'android' ? 12 : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  title: { fontSize: 18, fontWeight: '700', color: C.primary },
  close: { fontSize: 18, color: C.onSurfaceVariant },
  body: { padding: 20, paddingBottom: 32 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggle: { flex: 1, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  toggleOn: { backgroundColor: C.primary, borderColor: C.primary },
  toggleText: { fontWeight: '700', color: C.onSurfaceVariant },
  toggleTextOn: { color: C.onPrimary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  person: { paddingHorizontal: 12, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceHigh },
  personOn: { backgroundColor: C.primary },
  personText: { fontSize: 13, fontWeight: '600', color: C.onSurface },
  label: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input: { height: 46, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.md, paddingHorizontal: 14, fontSize: 15, color: C.onSurface, backgroundColor: C.surfaceLow },
  error: { color: C.error, marginTop: 10 },
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  cancel: { flex: 1, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.outlineVariant },
  cancelText: { color: C.onSurfaceVariant, fontWeight: '600' },
  save: { flex: 2, backgroundColor: C.primaryContainer, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: C.onPrimary, fontWeight: '700' },
});
