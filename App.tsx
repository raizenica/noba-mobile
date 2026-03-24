import React, {useState, useEffect} from 'react';
import {StatusBar, Text} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {loadConfig, isAuthenticated, isConfigured} from './src/services/api';
import {colors} from './src/theme/colors';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import AgentsScreen from './src/screens/AgentsScreen';
import HealingScreen from './src/screens/HealingScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    loadConfig().then(() => {
      setLoggedIn(isConfigured() && isAuthenticated());
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  if (!loggedIn) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <LoginScreen onLogin={() => setLoggedIn(true)} />
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
              Dashboard: '\u25A3',  // ▣
              Alerts: '\u25C6',     // ◆
              Agents: '\u25CE',     // ◎
              Healing: '\u2725',    // ✥
              Settings: '\u2699',   // ⚙
            };
            return {
              tabBarIcon: ({color}) => (
                <Text style={{fontSize: 18, color, marginBottom: -2}}>{icons[route.name] || '\u25CB'}</Text>
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
          <Tab.Screen
            name="Settings"
            children={() => <SettingsScreen onLogout={() => setLoggedIn(false)} />}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
