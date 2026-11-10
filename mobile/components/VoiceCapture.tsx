import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL, ApiError, apiUpload } from '../lib/api';
import { TranslationKey } from '../lib/i18n';
import { C, R } from '../lib/theme';

/**
 * Record -> upload -> parsed result. Shared by every voice-entry sheet.
 *
 * Flow: big mic -> speak -> "Done" -> upload. The parent decides what to do with
 * the parsed result (it renders its own review screen). A failed upload keeps the
 * recording on the phone so it can be retried without speaking again.
 * Mount this only while the sheet is open: unmounting stops any recording.
 */

const MAX_SECONDS = 120;

const RECORDING_OPTIONS = {
  ...RecordingPresets.LOW_QUALITY,       // m4a / AAC — small uploads on weak networks
  sampleRate: 16000,                     // speech-only
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
};

type Phase = 'idle' | 'recording' | 'processing' | 'failed' | 'pending';

export default function VoiceCapture<T>({
  endpoint, pendingKey, exampleKey, nothingFoundKey, isEmpty, onResult,
}: {
  endpoint: string;                       // e.g. '/api/v1/voice/operations/parse'
  pendingKey: string;                     // AsyncStorage key for a saved, unprocessed recording
  exampleKey: TranslationKey;
  nothingFoundKey: TranslationKey;
  isEmpty: (res: T) => boolean;
  onResult: (res: T) => void;
}) {
  const { t, lang } = useLanguage();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recState = useAudioRecorderState(recorder, 150);

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const audioUri = useRef<string | null>(null);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  const langCode = lang === 'मराठी' ? 'mr' : lang === 'हिंदी' ? 'hi' : 'en';

  // On open: wake the (possibly sleeping) API and offer a saved recording if there is one.
  useEffect(() => {
    fetch(`${API_BASE_URL}/health`, { method: 'HEAD' }).catch(() => {});
    AsyncStorage.getItem(pendingKey).then((uri) => {
      if (uri) { audioUri.current = uri; setPhase('pending'); }
    }).catch(() => {});
    return () => {
      // Closing the sheet mid-recording must release the microphone.
      if (phaseRef.current === 'recording') {
        recorder.stop().catch(() => {});
        setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAndProcess = useCallback(async () => {
    try { await recorder.stop(); } catch { /* already stopped */ }
    const uri = recorder.uri;
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (!uri) { setErrorMsg(t('voice_failed')); setPhase('failed'); return; }
    audioUri.current = uri;
    await AsyncStorage.setItem(pendingKey, uri).catch(() => {});
    upload(uri);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder, langCode, endpoint]);

  // Auto-stop at the time limit
  useEffect(() => {
    if (phase === 'recording' && recState.durationMillis >= MAX_SECONDS * 1000) stopAndProcess();
  }, [phase, recState.durationMillis, stopAndProcess]);

  async function startRecording() {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('voice_title'), t('voice_mic_denied')); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch {
      Alert.alert(t('voice_title'), t('voice_failed'));
    }
  }

  async function cancelRecording() {
    try { await recorder.stop(); } catch { /* ignore */ }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    setPhase('idle');
  }

  async function upload(uri: string) {
    setPhase('processing');
    try {
      const form = new FormData();
      if (Platform.OS === 'web') {
        // Browsers need a real Blob (the RN {uri,name,type} shortcut becomes "[object Object]").
        const blob = await (await fetch(uri)).blob();
        const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('ogg') ? 'ogg' : blob.type.includes('wav') ? 'wav' : 'm4a';
        form.append('audio', blob, `voice.${ext}`);
      } else {
        // Expo's fetch rejects the old RN {uri,name,type} part ("Unsupported FormDataPart
        // implementation"); expo-file-system's File is a Blob it can stream from disk.
        form.append('audio', new File(uri) as unknown as Blob, 'voice.m4a');
      }
      form.append('lang', langCode);
      const res = await apiUpload<T>(endpoint, form);
      await AsyncStorage.removeItem(pendingKey).catch(() => {});
      audioUri.current = null;
      if (isEmpty(res)) {
        setErrorMsg(t(nothingFoundKey));
        setPhase('failed');
        return;
      }
      onResult(res);
    } catch (e) {
      // 4xx other than rate-limit means the recording itself is unusable: don't keep it.
      const status = e instanceof ApiError ? e.status : 0;
      const detail = e instanceof ApiError ? (e.data as { detail?: string } | null)?.detail : undefined;
      if (status >= 400 && status < 500 && status !== 429 && status !== 408) {
        await AsyncStorage.removeItem(pendingKey).catch(() => {});
        audioUri.current = null;
      }
      const base = status === 503 ? t('voice_unavailable') : (typeof detail === 'string' && status >= 400 && status < 500 ? detail : t('voice_failed'));
      // Technical hint (status 0 = could not reach the server at all) to make support/debugging easy
      setErrorMsg(`${base}\n(${status === 0 ? `no connection to ${API_BASE_URL}` : `error ${status}`})`);
      console.warn('[voice] upload failed', status, detail ?? e);
      setPhase('failed');
    }
  }

  async function discardPending() {
    await AsyncStorage.removeItem(pendingKey).catch(() => {});
    audioUri.current = null;
    setPhase('idle');
  }

  const secs = Math.floor((recState.durationMillis ?? 0) / 1000);
  const timer = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const level = Math.max(0.05, Math.min(1, ((recState.metering ?? -60) + 60) / 60));

  return (
    <>
      {phase === 'idle' && (
        <View style={s.center}>
          <TouchableOpacity style={s.micBtn} onPress={startRecording} activeOpacity={0.85}>
            <MaterialCommunityIcons name="microphone" size={64} color={C.onPrimary} />
          </TouchableOpacity>
          <Text style={s.bigText}>{t('voice_tap_to_start')}</Text>
          <Text style={s.example}>{t(exampleKey)}</Text>
        </View>
      )}

      {phase === 'recording' && (
        <View style={s.center}>
          <Text style={s.listening}>{t('voice_listening')}</Text>
          <Text style={s.timer}>{timer}</Text>
          <View style={s.meterTrack}><View style={[s.meterFill, { width: `${level * 100}%` }]} /></View>
          <TouchableOpacity style={s.doneBtn} onPress={stopAndProcess} activeOpacity={0.85}>
            <MaterialCommunityIcons name="check" size={34} color={C.onPrimary} />
            <Text style={s.doneText}>{t('voice_done')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={cancelRecording} style={s.linkBtn}>
            <Text style={s.linkText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'processing' && (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={[s.bigText, { marginTop: 20 }]}>{t('voice_processing')}</Text>
        </View>
      )}

      {phase === 'pending' && (
        <View style={s.center}>
          <MaterialCommunityIcons name="content-save-outline" size={56} color={C.primaryContainer} />
          <Text style={[s.bigText, { marginTop: 16 }]}>{t('voice_pending')}</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => audioUri.current && upload(audioUri.current)}>
            <Text style={s.primaryText}>{t('voice_retry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.linkBtn} onPress={discardPending}><Text style={s.linkText}>{t('voice_discard')}</Text></TouchableOpacity>
        </View>
      )}

      {phase === 'failed' && (
        <View style={s.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={56} color={C.error} />
          <Text style={[s.bigText, { marginTop: 16 }]}>{errorMsg}</Text>
          {audioUri.current ? (
            <TouchableOpacity style={s.primaryBtn} onPress={() => audioUri.current && upload(audioUri.current)}>
              <Text style={s.primaryText}>{t('voice_retry')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={s.linkBtn} onPress={discardPending}>
            <Text style={s.linkText}>{t('voice_record_again')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  micBtn: { width: 168, height: 168, borderRadius: 84, backgroundColor: C.primaryContainer, alignItems: 'center', justifyContent: 'center', elevation: 8, marginBottom: 28 },
  bigText: { fontSize: 20, fontWeight: '700', color: C.onSurface, textAlign: 'center', lineHeight: 28 },
  example: { fontSize: 14, color: C.onSurfaceVariant, textAlign: 'center', marginTop: 14, lineHeight: 21 },
  listening: { fontSize: 22, fontWeight: '800', color: C.primary, marginBottom: 8 },
  timer: { fontSize: 44, fontWeight: '800', color: C.onSurface, marginBottom: 18 },
  meterTrack: { width: '80%', height: 12, borderRadius: 6, backgroundColor: C.surfaceHigh, overflow: 'hidden', marginBottom: 36 },
  meterFill: { height: 12, backgroundColor: C.primaryContainer },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.primaryContainer, paddingHorizontal: 44, paddingVertical: 20, borderRadius: R.full, elevation: 6 },
  doneText: { color: C.onPrimary, fontSize: 24, fontWeight: '800' },
  linkBtn: { marginTop: 22, padding: 10 },
  linkText: { color: C.primaryContainer, fontSize: 14, fontWeight: '700' },
  primaryBtn: { marginTop: 26, backgroundColor: C.primaryContainer, paddingHorizontal: 40, paddingVertical: 16, borderRadius: R.md },
  primaryText: { color: C.onPrimary, fontSize: 16, fontWeight: '800' },
});
