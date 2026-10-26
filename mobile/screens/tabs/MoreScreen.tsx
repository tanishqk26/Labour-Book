import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { C, R, initials } from '../../lib/theme';
import { MoreStackParamList } from '../details/types';

type NavKey = 'Payments' | 'Contracts' | 'Statements' | 'Plots' | 'Settings';

interface MenuItem {
  iconName: string;
  navKey: NavKey;
  labelKey: 'payments' | 'contracts' | 'statements' | 'plots' | 'settings';
  subKey: 'payments_sub' | 'contracts_sub' | 'statements_sub' | 'plots_sub' | 'settings_sub';
}

const MENU_ITEMS: MenuItem[] = [
  { iconName: 'credit-card-outline', navKey: 'Payments',   labelKey: 'payments',   subKey: 'payments_sub' },
  { iconName: 'file-document-outline', navKey: 'Contracts', labelKey: 'contracts',  subKey: 'contracts_sub' },
  { iconName: 'chart-bar',             navKey: 'Statements',labelKey: 'statements', subKey: 'statements_sub' },
  { iconName: 'terrain',               navKey: 'Plots',     labelKey: 'plots',      subKey: 'plots_sub' },
  { iconName: 'cog-outline',           navKey: 'Settings',  labelKey: 'settings',   subKey: 'settings_sub' },
];

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();

  function handleLogout() {
    Alert.alert(t('sign_out'), t('sign_out_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('sign_out'), style: 'destructive', onPress: logout },
    ]);
  }

  const userInitials = initials(user?.name ?? 'U');

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <AppHeader screenName={t('more')} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{userInitials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name ?? 'Farm Manager'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
          </View>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>{t('owner')}</Text>
          </View>
        </View>

        {/* Section label */}
        <Text style={styles.sectionLabel}>{t('more_features')}</Text>

        {/* Menu items */}
        <View style={styles.menuGroup}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.navKey}
              style={[
                styles.menuItem,
                i === 0 && styles.menuItemFirst,
              ]}
              onPress={() => navigation.navigate(item.navKey)}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconBox}>
                <MaterialCommunityIcons name={item.iconName as any} size={22} color={C.primary} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuLabel}>{t(item.labelKey)}</Text>
                <Text style={styles.menuSub}>{t(item.subKey)}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={C.outlineVariant} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.signOutText}>{t('sign_out')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>LabourBook Mobile · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceLowest,
    borderRadius: R.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    gap: 12,
    marginBottom: 4,
  },
  profileAvatar: { width: 52, height: 52, borderRadius: R.full, backgroundColor: C.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { fontSize: 18, fontWeight: '800', color: C.primary },
  profileName: { fontSize: 16, fontWeight: '700', color: C.primary },
  profileEmail: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },
  profileBadge: { backgroundColor: C.primaryFixed, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  profileBadgeText: { fontSize: 9, fontWeight: '800', color: C.primary, letterSpacing: 0.5 },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: C.onSurfaceVariant, letterSpacing: 1, paddingLeft: 4 },

  menuGroup: { backgroundColor: C.surfaceLowest, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: C.outlineVariant },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderTopWidth: 1, borderTopColor: C.outlineVariant },
  menuItemFirst: { borderTopWidth: 0 },
  menuIconBox: { width: 40, height: 40, borderRadius: R.md, backgroundColor: C.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: C.onSurface },
  menuSub: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 1 },

  signOutBtn: {
    backgroundColor: C.errorContainer,
    borderRadius: R.xl,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
    marginTop: 4,
  },
  signOutText: { color: C.error, fontWeight: '700', fontSize: 15 },

  version: { textAlign: 'center', fontSize: 11, color: C.outlineVariant, marginTop: 4 },
});
