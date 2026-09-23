import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/auth/LoginScreen';
import DashboardScreen from './screens/tabs/DashboardScreen';
import PeopleScreen from './screens/tabs/PeopleScreen';
import AttendanceScreen from './screens/tabs/AttendanceScreen';
import OperationsScreen from './screens/tabs/OperationsScreen';
import MoreScreen from './screens/tabs/MoreScreen';
import { C, R } from './lib/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Tab Icons ────────────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, { default: string; active: string }> = {
  Home:       { default: '⊟', active: '⊞' },
  People:     { default: '👤', active: '👤' },
  Attendance: { default: '☑', active: '✅' },
  Operations: { default: '🌾', active: '🌾' },
  More:       { default: '☰', active: '☰' },
};

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[tabStyles.bar, { paddingBottom: insets.bottom || 8 }]}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel ?? route.name;
        const isFocused = state.index === index;

        function onPress() {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        }

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={tabStyles.tabItem}
            activeOpacity={0.7}
          >
            <View style={[tabStyles.tabIndicator, isFocused && tabStyles.tabIndicatorActive]}>
              <Text style={tabStyles.tabIcon}>{TAB_ICONS[route.name]?.[isFocused ? 'active' : 'default'] ?? '○'}</Text>
            </View>
            <Text style={[tabStyles.tabLabel, isFocused && tabStyles.tabLabelActive]}>{label as string}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main Tabs ────────────────────────────────────────────────────────────────

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="People" component={PeopleScreen} options={{ tabBarLabel: 'People' }} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ tabBarLabel: 'Attendance' }} />
      <Tab.Screen name="Operations" component={OperationsScreen} options={{ tabBarLabel: 'Operations' }} />
      <Tab.Screen name="More" component={MoreScreen} options={{ tabBarLabel: 'More' }} />
    </Tab.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={appStyles.splash}>
        <View style={appStyles.splashLogo}>
          <Text style={appStyles.splashEmoji}>🌿</Text>
        </View>
        <Text style={appStyles.splashTitle}>LabourBook</Text>
        <ActivityIndicator size="small" color={C.primaryFixed} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

// ─── App Entry ────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const appStyles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 72,
    height: 72,
    borderRadius: R.xl,
    backgroundColor: C.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  splashEmoji: { fontSize: 36 },
  splashTitle: { fontSize: 26, fontWeight: '800', color: C.onPrimary, letterSpacing: -0.5 },
});

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.outlineVariant,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tabIndicator: {
    width: 36,
    height: 28,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicatorActive: {
    backgroundColor: C.primaryFixed,
  },
  tabIcon: { fontSize: 16 },
  tabLabel: { fontSize: 10, fontWeight: '600', color: C.onSurfaceVariant },
  tabLabelActive: { color: C.primaryContainer, fontWeight: '700' },
});
