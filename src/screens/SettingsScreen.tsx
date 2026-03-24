import React, {useCallback} from 'react';
import {View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, spacing, fontSize, borderRadius} from '../theme/colors';
import {get, clearAuth, getServerUrl} from '../services/api';
import {usePolling} from '../hooks/usePolling';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';

interface HealthData {
  status: string;
  version: string;
  uptime_s: number;
  components?: {
    database?: {status: string; latency_ms: number};
    collector?: {status: string; pulse_s: number};
    agents?: {connected: number; total: number};
    integrations?: {healthy: number; unhealthy: number};
  };
}

interface Profile {
  username: string;
  role: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface Props {
  onLogout: () => void;
}

export default function SettingsScreen({onLogout}: Props) {
  const healthFetcher = useCallback(() => get<HealthData>('/api/health'), []);
  const profileFetcher = useCallback(() => get<Profile>('/api/me'), []);
  const {data: health} = usePolling(healthFetcher, 30000);
  const {data: profile} = usePolling(profileFetcher, 60000);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          onLogout();
        },
      },
    ]);
  };

  const comp = health?.components;

  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={[styles.container, {paddingTop: insets.top}]}>
      <Text style={styles.title}>Settings</Text>

      <Card title="Profile">
        <View style={styles.row}>
          <Text style={styles.label}>Username</Text>
          <Text style={styles.value}>{profile?.username || '--'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Role</Text>
          <StatusBadge status={profile?.role === 'admin' ? 'online' : 'info'} label={profile?.role?.toUpperCase() || '--'} size="md" />
        </View>
      </Card>

      <Card title="Server">
        <View style={styles.row}>
          <Text style={styles.label}>URL</Text>
          <Text style={styles.value} numberOfLines={1}>{getServerUrl()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>{health?.version || '--'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <StatusBadge status={health?.status || 'unknown'} size="md" />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Uptime</Text>
          <Text style={styles.value}>{health ? formatUptime(health.uptime_s) : '--'}</Text>
        </View>
      </Card>

      {comp && (
        <Card title="Components">
          {comp.database && (
            <View style={styles.row}>
              <Text style={styles.label}>Database</Text>
              <View style={styles.rowRight}>
                <StatusBadge status={comp.database.status} />
                <Text style={styles.detail}>{comp.database.latency_ms}ms</Text>
              </View>
            </View>
          )}
          {comp.collector && (
            <View style={styles.row}>
              <Text style={styles.label}>Collector</Text>
              <StatusBadge status={comp.collector.status} />
            </View>
          )}
          {comp.agents && (
            <View style={styles.row}>
              <Text style={styles.label}>Agents</Text>
              <Text style={styles.value}>{comp.agents.connected}/{comp.agents.total}</Text>
            </View>
          )}
          {comp.integrations && (
            <View style={styles.row}>
              <Text style={styles.label}>Integrations</Text>
              <Text style={styles.value}>
                {comp.integrations.healthy} ok / {comp.integrations.unhealthy} down
              </Text>
            </View>
          )}
        </Card>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: spacing.lg},
  title: {fontSize: fontSize.xxl, fontWeight: '800', color: colors.text, marginBottom: spacing.lg},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border},
  rowRight: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  label: {color: colors.textMuted, fontSize: fontSize.sm},
  value: {color: colors.text, fontSize: fontSize.sm, fontWeight: '600', maxWidth: '60%', textAlign: 'right'},
  detail: {color: colors.textDim, fontSize: fontSize.xs},
  logoutBtn: {
    backgroundColor: colors.danger + '22',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl * 2,
  },
  logoutText: {color: colors.danger, fontWeight: '700', fontSize: fontSize.md},
});
