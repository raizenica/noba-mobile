import React, {useEffect} from 'react';
import {StatusBar, Text} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {loadConfig} from './src/services/api';
import {useAuthStore} from './src/store/authStore';
import {useDataStore} from './src/store/dataStore';
import {colors} from './src/theme/colors';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import AgentsScreen from './src/screens/AgentsScreen';
import HealingScreen from './src/screens/HealingScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const isReady = useAuthStore(s => s.isReady);
  const token = useAuthStore(s => s.token);
  const serverUrl = useAuthStore(s => s.serverUrl);
  const {fetchStats, fetchAlerts, fetchApprovals, fetchHealth} = useDataStore();

  // Hydrate auth store from AsyncStorage on first mount
  useEffect(() => {
    loadConfig().then(() => {
      useAuthStore.getState().hydrate();
    });
  }, []);

  // Single polling layer — starts/stops with authentication state
  useEffect(() => {
    if (!token || !serverUrl) return;
    fetchStats();
    fetchAlerts();
    fetchApprovals();
    fetchHealth();
    const t1 = setInterval(fetchStats, 5_000);
    const t2 = setInterval(fetchAlerts, 15_000);
    const t3 = setInterval(fetchApprovals, 10_000);
    const t4 = setInterval(fetchHealth, 30_000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
      clearInterval(t4);
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
            const icons: Record<string, string> = {
              Dashboard: '\u25A3',
              Alerts: '\u25C6',
              Agents: '\u25CE',
              Healing: '\u2725',
              Settings: '\u2699',
            };
            return {
              tabBarIcon: ({color}) => (
                <Text style={{fontSize: 18, color, marginBottom: -2}}>
                  {icons[route.name] || '\u25CB'}
                </Text>
              ),
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
          <Tab.Screen name="Alerts" component={AlertsScreen} />
          <Tab.Screen name="Agents" component={AgentsScreen} />
          <Tab.Screen name="Healing" component={HealingScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
