import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R } from '../lib/theme';
import { useAuth } from '../context/AuthContext';

interface Props {
  screenName: string;
}

export default function AppHeader({ screenName }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const initials = (user?.name ?? 'U').split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        {/* Logo + screen name */}
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>🌿</Text>
          </View>
          <View>
            <Text style={styles.appLabel}>LABOURBOOK</Text>
            <Text style={styles.screenName}>{screenName}</Text>
          </View>
        </View>

        {/* Right side — avatar */}
        <View style={styles.rightRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.outlineVariant,
  },
  inner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: R.md,
    backgroundColor: C.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: { fontSize: 18 },
  appLabel: { fontSize: 10, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 1 },
  screenName: { fontSize: 15, fontWeight: '700', color: C.primary, lineHeight: 18 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: R.full,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: C.onPrimary },
});
