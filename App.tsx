import React, {useEffect, useState} from 'react';
import {StatusBar, Text, View, StyleSheet, TouchableOpacity} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import ReactNativeBiometrics from 'react-native-biometrics';

import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {loadConfig} from './src/services/api';
import {useAuthStore} from './src/store/authStore';
import {useDataStore} from './src/store/dataStore';
import {colors} from './src/theme/colors';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import AlertDetailScreen from './src/screens/AlertDetailScreen';
import AgentsScreen from './src/screens/AgentsScreen';
import AgentDetailScreen from './src/screens/AgentDetailScreen';
import HealingScreen from './src/screens/HealingScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const AgentsStack = createNativeStackNavigator();
const AlertsStack = createNativeStackNavigator();

const stackScreenOptions = {
  headerStyle: {backgroundColor: colors.surface},
  headerTintColor: colors.text,
  headerTitleStyle: {fontWeight: '600' as const},
  headerShadowVisible: false,
};

function AgentsStackScreen() {
  return (
    <AgentsStack.Navigator screenOptions={stackScreenOptions}>
      <AgentsStack.Screen name="AgentsList" component={AgentsScreen} options={{headerShown: false}} />
      <AgentsStack.Screen name="AgentDetail" component={AgentDetailScreen} options={({route}: any) => ({title: route.params.hostname})} />
    </AgentsStack.Navigator>
  );
}

function AlertsStackScreen() {
  return (
    <AlertsStack.Navigator screenOptions={stackScreenOptions}>
      <AlertsStack.Screen name="AlertsList" component={AlertsScreen} options={{headerShown: false}} />
      <AlertsStack.Screen name="AlertDetail" component={AlertDetailScreen} options={{title: 'Alert'}} />
    </AlertsStack.Navigator>
  );
}
const rnBiometrics = new ReactNativeBiometrics();

const TAB_ICONS: Record<string, [string, string]> = {
  Dashboard: ['grid', 'grid-outline'],
  Alerts: ['warning', 'warning-outline'],
  Agents: ['hardware-chip', 'hardware-chip-outline'],
  Healing: ['pulse', 'pulse-outline'],
  Settings: ['settings', 'settings-outline'],
};

function BiometricGate({children}: {children: React.ReactNode}) {
  const [unlocked, setUnlocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    rnBiometrics.isSensorAvailable().then(({available}) => {
      if (!available) {
        setUnlocked(true);
        setBiometricAvailable(false);
      } else {
        setBiometricAvailable(true);
        promptBiometric();
      }
    }).catch(() => {
      setUnlocked(true);
      setBiometricAvailable(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const promptBiometric = () => {
    rnBiometrics.simplePrompt({promptMessage: 'Unlock NOBA'}).then(({success}) => {
      if (success) setUnlocked(true);
    }).catch(() => {});
  };

  if (unlocked) return <>{children}</>;

  return (
    <View style={bioStyles.container}>
      <Icon name="lock-closed" size={48} color={colors.primary} />
      <Text style={bioStyles.title}>NOBA is locked</Text>
      <Text style={bioStyles.subtitle}>Authenticate to continue</Text>
      {biometricAvailable && (
        <TouchableOpacity style={bioStyles.btn} onPress={promptBiometric}>
          <Icon name="finger-print" size={20} color={colors.text} />
          <Text style={bioStyles.btnText}>Unlock</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const bioStyles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32},
  title: {fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 20},
  subtitle: {fontSize: 14, color: colors.textMuted, marginTop: 8, marginBottom: 32},
  btn: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8},
  btnText: {color: colors.text, fontWeight: '700', fontSize: 15},
});

export default function App() {
  const isReady = useAuthStore(s => s.isReady);
  const token = useAuthStore(s => s.token);
  const serverUrl = useAuthStore(s => s.serverUrl);
  const {fetchStats, fetchAlerts, fetchApprovals, fetchHealth, fetchNotifs, fetchLedger} = useDataStore();
  const unresolvedAlertCount = useDataStore(s => s.alerts.filter((a: any) => !a.resolved_at).length);
  const pendingApprovalCount = useDataStore(s => s.approvals.filter((a: any) => a.status === 'pending').length);

  // Hydrate auth store from AsyncStorage on first mount
  useEffect(() => {
    loadConfig().then(() => {
      useAuthStore.getState().hydrate();
    });
  }, []);

  // Single polling layer — starts/stops with authentication state
  useEffect(() => {
    if (!token || !serverUrl) return;
    fetchStats(); fetchAlerts(); fetchApprovals(); fetchHealth(); fetchNotifs(); fetchLedger();
    const t1 = setInterval(fetchStats,     5_000);
    const t2 = setInterval(fetchAlerts,   15_000);
    const t3 = setInterval(fetchApprovals,10_000);
    const t4 = setInterval(fetchHealth,   30_000);
    const t5 = setInterval(fetchLedger,   30_000);
    const t6 = setInterval(fetchNotifs,   60_000);
    return () => {
      clearInterval(t1); clearInterval(t2); clearInterval(t3);
      clearInterval(t4); clearInterval(t5); clearInterval(t6);
    };
  }, [token, serverUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isReady) {
    return null;
  }

  if (!token || !serverUrl) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <BiometricGate>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: colors.primary,
            background: colors.background,
            card: colors.surface,
            text: colors.text,
            border: colors.border,
            notification: colors.danger,
          },
          fonts: {
            regular: {fontFamily: 'System', fontWeight: '400'},
            medium: {fontFamily: 'System', fontWeight: '500'},
            bold: {fontFamily: 'System', fontWeight: '700'},
            heavy: {fontFamily: 'System', fontWeight: '900'},
          },
        }}>
        <Tab.Navigator
          screenOptions={({route}) => {
            const badge =
              route.name === 'Alerts' && unresolvedAlertCount > 0 ? unresolvedAlertCount :
              route.name === 'Healing' && pendingApprovalCount > 0 ? pendingApprovalCount :
              undefined;
            const [filled, outline] = TAB_ICONS[route.name] || ['ellipse', 'ellipse-outline'];
            return {
              tabBarIcon: ({color, focused}) => (
                <Icon name={focused ? filled : outline} size={22} color={color} />
              ),
              tabBarBadge: badge,
              tabBarBadgeStyle: {backgroundColor: colors.danger, fontSize: 10, minWidth: 16, height: 16},
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingTop: 4,
                paddingBottom: 30,
                height: 74,
              },
              tabBarLabelStyle: {fontSize: 10, fontWeight: '600'},
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.textMuted,
              headerShown: false,
            };
          }}>
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Alerts" component={AlertsStackScreen} />
          <Tab.Screen name="Agents" component={AgentsStackScreen} />
          <Tab.Screen name="Healing" component={HealingScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      </BiometricGate>
    </SafeAreaProvider>
  );
}
