import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiPost } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LANGUAGES } from '../../lib/i18n';
import { C, R, initials } from '../../lib/theme';

// ─── Back header ─────────────────────────────────────────────────────────────

function Header({ title }: { title: string }) {
  const nav = useNavigation();
  return (
    <View style={hdr.row}>
      <TouchableOpacity onPress={() => nav.goBack()} style={hdr.back} hitSlop={8}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={C.primary} />
      </TouchableOpacity>
      <Text style={hdr.title}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

const hdr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.background, borderBottomWidth: 1, borderBottomColor: C.outlineVariant },
  back: { width: 40, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.primary },
});

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={s.sectionIconBox}>
          <MaterialCommunityIcons name={icon as any} size={18} color={C.primary} />
        </View>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <View>
        <Text style={s.fieldLabelText}>{label}</Text>
        {sub && <Text style={s.fieldSub}>{sub}</Text>}
      </View>
      {children}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, logout, updateProfile } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const [showPwSection, setShowPwSection] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  async function handleSave() {
    if (!name.trim()) { Alert.alert(t('name_required'), t('name_required_msg')); return; }
    setSaving(true);
    try {
      await updateProfile(name.trim(), phone.trim() || null);
      Alert.alert(t('saved'), t('profile_updated'));
    } catch {
      Alert.alert(t('error'), t('save_error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!newPw || newPw.length < 8) { Alert.alert(t('weak_password'), t('weak_password_msg')); return; }
    if (newPw !== confirmPw) { Alert.alert(t('mismatch'), t('mismatch_msg')); return; }
    setPwLoading(true);
    try {
      await apiPost('/api/v1/auth/change-password', { current_password: currentPw, new_password: newPw });
      Alert.alert(t('password_done'), t('password_done_msg'));
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setShowPwSection(false);
    } catch (err: any) {
      const msg = err?.data?.detail ?? t('wrong_password');
      Alert.alert(t('error'), msg);
    } finally {
      setPwLoading(false);
    }
  }

  function handleLogout() {
    Alert.alert(t('sign_out'), t('sign_out_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('sign_out'), style: 'destructive', onPress: logout },
    ]);
  }

  const isGoogleUser = !user?.has_password;
  const userInitials = initials(user?.name ?? 'U');

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <Header title={t('settings_title')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar strip */}
          <View style={s.avatarRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{userInitials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.avatarName}>{user?.name ?? 'Farm Manager'}</Text>
              <Text style={s.avatarEmail}>{user?.email ?? ''}</Text>
            </View>
          </View>

          {/* Profile section */}
          <Section icon="account-outline" title={t('profile')}>
            <Text style={s.sectionDesc}>{t('profile_sub')}</Text>
            <Field label={t('farmer_name')} sub={t('farmer_name_hint')}>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder={t('farmer_name_placeholder')}
                placeholderTextColor={C.outlineVariant}
              />
            </Field>
            <View style={s.divider} />
            <Field label={t('phone_number')} sub={t('phone_hint')}>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                placeholder={t('phone_placeholder')}
                placeholderTextColor={C.outlineVariant}
                keyboardType="phone-pad"
              />
            </Field>
            <View style={s.divider} />
            <Field label={t('email_id')} sub={t('email_hint')}>
              <TextInput
                style={[s.input, s.inputReadonly]}
                value={user?.email ?? ''}
                editable={false}
              />
            </Field>
          </Section>

          {/* Account section */}
          <Section icon="shield-account-outline" title={t('account')}>
            <View style={s.accountRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.accountName}>{user?.name ?? 'User'}</Text>
                <Text style={s.accountEmail}>{user?.email ?? ''}</Text>
                {isGoogleUser && (
                  <View style={s.googleBadge}>
                    <MaterialCommunityIcons name="google" size={12} color="#4285f4" />
                    <Text style={s.googleBadgeText}>{t('signed_in_google')}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={s.signOutChip} onPress={handleLogout}>
                <MaterialCommunityIcons name="logout" size={14} color={C.error} />
                <Text style={s.signOutChipText}>{t('sign_out')}</Text>
              </TouchableOpacity>
            </View>
          </Section>

          {/* Reset password — only for password accounts */}
          {!isGoogleUser && (
            <Section icon="lock-outline" title={t('reset_password')}>
              {!showPwSection ? (
                <TouchableOpacity style={s.changePwBtn} onPress={() => setShowPwSection(true)}>
                  <MaterialCommunityIcons name="lock-reset" size={18} color={C.primary} />
                  <Text style={s.changePwBtnText}>{t('change_password')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 10 }}>
                  <TextInput style={s.input} value={currentPw} onChangeText={setCurrentPw} placeholder={t('current_password')} placeholderTextColor={C.outlineVariant} secureTextEntry />
                  <TextInput style={s.input} value={newPw} onChangeText={setNewPw} placeholder={t('new_password')} placeholderTextColor={C.outlineVariant} secureTextEntry />
                  <TextInput style={s.input} value={confirmPw} onChangeText={setConfirmPw} placeholder={t('confirm_password')} placeholderTextColor={C.outlineVariant} secureTextEntry />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[s.changePwBtn, { flex: 1 }]} onPress={() => { setShowPwSection(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }}>
                      <Text style={[s.changePwBtnText, { color: C.onSurfaceVariant }]}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.changePwBtn, { flex: 2, backgroundColor: C.primaryFixed }]} onPress={handleChangePassword} disabled={pwLoading}>
                      <MaterialCommunityIcons name="check" size={16} color={C.primary} />
                      <Text style={s.changePwBtnText}>{pwLoading ? t('saving') : t('update_password')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Section>
          )}

          {/* Language section */}
          <Section icon="translate" title={t('language')}>
            <Text style={s.sectionDesc}>{t('language_sub')}</Text>
            <View style={s.langRow}>
              {LANGUAGES.map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[s.langChip, lang === l && s.langChipActive]}
                  onPress={() => setLang(l)}
                >
                  <Text style={[s.langChipText, lang === l && s.langChipTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Save button */}
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            <MaterialCommunityIcons name="content-save-outline" size={18} color={C.onPrimary} />
            <Text style={s.saveBtnText}>{saving ? t('saving') : t('save_changes')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { padding: 16, gap: 12 },

  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surfaceLowest, borderRadius: R.xl, padding: 16, borderWidth: 1, borderColor: C.outlineVariant, marginBottom: 4 },
  avatar: { width: 56, height: 56, borderRadius: R.full, backgroundColor: C.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: C.primary },
  avatarName: { fontSize: 16, fontWeight: '700', color: C.primary },
  avatarEmail: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },

  section: { backgroundColor: C.surfaceLowest, borderRadius: R.xl, borderWidth: 1, borderColor: C.outlineVariant, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  sectionIconBox: { width: 32, height: 32, borderRadius: R.md, backgroundColor: C.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.primary },
  sectionDesc: { fontSize: 12, color: C.onSurfaceVariant, paddingHorizontal: 16, paddingBottom: 10 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 14, gap: 0 },

  field: { paddingVertical: 10, gap: 6 },
  fieldLabelText: { fontSize: 14, fontWeight: '600', color: C.onSurface },
  fieldSub: { fontSize: 11, color: C.onSurfaceVariant },

  input: { borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.lg, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.onSurface, backgroundColor: C.background },
  inputReadonly: { color: C.onSurfaceVariant, backgroundColor: C.surfaceLow },

  divider: { height: 1, backgroundColor: C.outlineVariant },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountName: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  accountEmail: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 1 },
  googleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  googleBadgeText: { fontSize: 11, color: '#4285f4', fontWeight: '600' },

  signOutChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#fca5a5', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.errorContainer },
  signOutChipText: { fontSize: 12, fontWeight: '600', color: C.error },

  changePwBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.outlineVariant, borderRadius: R.lg, paddingVertical: 12, backgroundColor: C.surfaceLow },
  changePwBtnText: { fontSize: 14, fontWeight: '600', color: C.primary },

  langRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 4 },
  langChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: R.full, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.background },
  langChipActive: { borderColor: C.primary, backgroundColor: C.primaryFixed },
  langChipText: { fontSize: 13, fontWeight: '600', color: C.onSurfaceVariant },
  langChipTextActive: { color: C.primary },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: R.xl, paddingVertical: 15, marginTop: 4 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: C.onPrimary },
});
