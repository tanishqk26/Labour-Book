import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/auth/LoginScreen';
import DashboardScreen from './screens/tabs/DashboardScreen';
import PeopleScreen from './screens/tabs/PeopleScreen';
import AttendanceScreen from './screens/tabs/AttendanceScreen';
import OperationsScreen from './screens/tabs/OperationsScreen';
import MoreScreen from './screens/tabs/MoreScreen';
import LabourDetailScreen from './screens/details/LabourDetailScreen';
import TeamDetailScreen from './screens/details/TeamDetailScreen';
import OperationDetailScreen from './screens/details/OperationDetailScreen';
import ContractsScreen from './screens/contracts/ContractsScreen';
import ContractDetailScreen from './screens/contracts/ContractDetailScreen';
import PaymentsScreen from './screens/payments/PaymentsScreen';
import { StatementsListScreen, StatementDetailScreen } from './screens/statements/StatementsScreen';
import { MoreStackParamList, OperationsStackParamList, PeopleStackParamList } from './screens/details/types';
import { C, R } from './lib/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const PeopleStack = createNativeStackNavigator<PeopleStackParamList>();
const OperationsStack = createNativeStackNavigator<OperationsStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

function PeopleStackScreen() {
  return (
    <PeopleStack.Navigator screenOptions={{ headerShown: false }}>
      <PeopleStack.Screen name="PeopleList" component={PeopleScreen} />
      <PeopleStack.Screen name="LabourDetail" component={LabourDetailScreen} />
      <PeopleStack.Screen name="TeamDetail" component={TeamDetailScreen} />
    </PeopleStack.Navigator>
  );
}

function OperationsStackScreen() {
  return (
    <OperationsStack.Navigator screenOptions={{ headerShown: false }}>
      <OperationsStack.Screen name="OperationsList" component={OperationsScreen} />
      <OperationsStack.Screen name="OperationDetail" component={OperationDetailScreen} />
    </OperationsStack.Navigator>
  );
}

function MoreStackScreen() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Payments" component={PaymentsScreen} />
      <MoreStack.Screen name="Contracts" component={ContractsScreen} />
      <MoreStack.Screen name="ContractDetail" component={ContractDetailScreen} />
      <MoreStack.Screen name="Statements" component={StatementsListScreen} />
      <MoreStack.Screen name="StatementDetail" component={StatementDetailScreen} />
    </MoreStack.Navigator>
  );
}

// ─── Tab Icons ────────────────────────────────────────────────────────────────

const TAB_ICON_NAMES: Record<string, { default: string; active: string }> = {
  Home:       { default: 'view-dashboard-outline', active: 'view-dashboard' },
  People:     { default: 'account-multiple-outline', active: 'account-multiple' },
  Attendance: { default: 'calendar-check-outline', active: 'calendar-check' },
  Operations: { default: 'sprout-outline', active: 'sprout' },
  More:       { default: 'dots-horizontal-circle-outline', active: 'dots-horizontal-circle' },
};

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index];
  const nestedName = current.state?.routes?.[current.state.index ?? 0]?.name;
  const rootScreens: Record<string, string> = {
    People: 'PeopleList',
    Operations: 'OperationsList',
    More: 'MoreHome',
  };
  const rootScreen = rootScreens[current.name];
  if (rootScreen && nestedName && nestedName !== rootScreen) {
    return null;
  }
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

        const iconName = (TAB_ICON_NAMES[route.name]?.[isFocused ? 'active' : 'default'] ?? 'circle') as any;
        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={tabStyles.tabItem}
            activeOpacity={0.7}
          >
            <View style={[tabStyles.tabIndicator, isFocused && tabStyles.tabIndicatorActive]}>
              <MaterialCommunityIcons name={iconName} size={22} color={isFocused ? C.primary : C.onSurfaceVariant} />
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
      <Tab.Screen name="People" component={PeopleStackScreen} options={{ tabBarLabel: 'People' }} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ tabBarLabel: 'Attendance' }} />
      <Tab.Screen name="Operations" component={OperationsStackScreen} options={{ tabBarLabel: 'Operations' }} />
      <Tab.Screen name="More" component={MoreStackScreen} options={{ tabBarLabel: 'More' }} />
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
          <MaterialCommunityIcons name="leaf" size={36} color={C.primary} />
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
  splashTitle: { fontSize: 26, fontWeight: '800', color: C.onPrimary, letterSpacing: -0.5 },
});

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: C.surfaceLowest,
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
  tabLabel: { fontSize: 10, fontWeight: '600', color: C.onSurfaceVariant },
  tabLabelActive: { color: C.primaryContainer, fontWeight: '700' },
});
