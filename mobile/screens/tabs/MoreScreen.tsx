import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../../components/AppHeader';
import { useAuth } from '../../context/AuthContext';
import { C, R, initials } from '../../lib/theme';

interface MenuItem { icon: string; label: string; sub: string; comingSoon?: boolean; }

const MENU_ITEMS: MenuItem[] = [
  { icon: '💳', label: 'Payments', sub: 'Record advances & settlements' },
  { icon: '📋', label: 'Contracts', sub: 'Fixed-price job assignments' },
  { icon: '📊', label: 'Statements', sub: 'Earnings, balances & ledger' },
  { icon: '🌱', label: 'Plots', sub: 'Manage farm plots & seasons' },
  { icon: '⚙️', label: 'Settings', sub: 'Language, account preferences' },
];

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  function handleLogout() {
    Alert.alert('Sign Out', 'You will be signed out of LabourBook. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  const userInitials = initials(user?.name ?? 'U');

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <AppHeader screenName="More" />
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
          <View style={styles.profileBadge}><Text style={styles.profileBadgeText}>OWNER</Text></View>
        </View>

        {/* Section label */}
        <Text style={styles.sectionLabel}>MORE FEATURES</Text>

        {/* Menu items */}
        <View style={styles.menuGroup}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                i === 0 && styles.menuItemFirst,
                i === MENU_ITEMS.length - 1 && styles.menuItemLast,
              ]}
              onPress={() => Alert.alert(item.label, 'Coming soon in next update.')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconBox}>
                <Text style={styles.menuIconText}>{item.icon}</Text>
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
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
  menuItemLast: {},
  menuIconBox: { width: 40, height: 40, borderRadius: R.md, backgroundColor: C.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  menuIconText: { fontSize: 20 },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: C.onSurface },
  menuSub: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 1 },
  menuChevron: { fontSize: 20, color: C.outlineVariant },

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
