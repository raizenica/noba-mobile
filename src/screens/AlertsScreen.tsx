import React from 'react';
import {View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, spacing, fontSize, borderRadius} from '../theme/colors';
import {useDataStore} from '../store/dataStore';
import StatusBadge from '../components/StatusBadge';

interface Alert {
  id: number;
  rule_id: string;
  severity: string;
  message: string;
  timestamp: number;
  resolved_at: number | null;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AlertsScreen() {
  const alerts = useDataStore(s => s.alerts);
  const error = useDataStore(s => s.alertsError);
  const loading = alerts.length === 0 && !error;

  const renderAlert = ({item}: {item: Alert}) => {
    const severityColor =
      item.severity === 'critical' || item.severity === 'danger'
        ? colors.danger
        : item.severity === 'warning'
        ? colors.warning
        : colors.info;

    return (
      <TouchableOpacity style={[styles.alertCard, {borderLeftColor: severityColor}]}>
        <View style={styles.alertHeader}>
          <StatusBadge
            status={item.resolved_at ? 'ok' : item.severity}
            label={item.resolved_at ? 'RESOLVED' : item.severity.toUpperCase()}
          />
          <Text style={styles.time}>{timeAgo(item.timestamp)}</Text>
        </View>
        <Text style={styles.ruleId}>{item.rule_id}</Text>
        <Text style={styles.message} numberOfLines={2}>
          {item.message}
        </Text>
      </TouchableOpacity>
    );
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <Text style={styles.title}>Alerts</Text>
      <FlatList
        data={alerts}
        keyExtractor={item => String(item.id)}
        renderItem={renderAlert}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => useDataStore.getState().fetchAlerts()} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? 'Loading...' : 'No alerts'}</Text>
        }
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: spacing.lg},
  title: {fontSize: fontSize.xxl, fontWeight: '800', color: colors.text, marginBottom: spacing.lg},
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm},
  time: {color: colors.textDim, fontSize: fontSize.xs},
  ruleId: {color: colors.primaryLight, fontSize: fontSize.xs, marginBottom: spacing.xs},
  message: {color: colors.text, fontSize: fontSize.sm, lineHeight: 20},
  empty: {color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, fontSize: fontSize.md},
  error: {color: colors.danger, textAlign: 'center', marginTop: spacing.sm},
});
