import React, {useState} from 'react';
import {View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
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

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export default function AlertsScreen() {
  const alerts = useDataStore(s => s.alerts);
  const error = useDataStore(s => s.alertsError);
  const loading = alerts.length === 0 && !error;
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const displayAlerts = filter === 'active'
    ? alerts.filter((a: Alert) => !a.resolved_at)
    : alerts;

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderAlert = ({item}: {item: Alert}) => {
    const isExpanded = expanded.has(item.id);
    const severityColor =
      item.severity === 'critical' || item.severity === 'danger'
        ? colors.danger
        : item.severity === 'warning'
        ? colors.warning
        : colors.info;

    return (
      <TouchableOpacity
        style={[styles.alertCard, {borderLeftColor: severityColor}]}
        onPress={() => navigation.navigate('AlertDetail', {alertId: item.id})}
        activeOpacity={0.75}>
        <View style={styles.alertHeader}>
          <StatusBadge
            status={item.resolved_at ? 'ok' : item.severity}
            label={item.resolved_at ? 'RESOLVED' : item.severity.toUpperCase()}
          />
          <Text style={styles.time}>{timeAgo(item.timestamp)}</Text>
        </View>
        <Text style={styles.ruleId}>{item.rule_id}</Text>
        <Text style={styles.message} numberOfLines={isExpanded ? undefined : 2}>
          {item.message}
        </Text>
        {isExpanded && (
          <View style={styles.detail}>
            <Text style={styles.detailText}>Triggered: {formatTs(item.timestamp)}</Text>
            {item.resolved_at ? (
              <Text style={styles.detailText}>Resolved: {formatTs(item.resolved_at)}</Text>
            ) : (
              <Text style={[styles.detailText, {color: colors.warning}]}>Still active</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const insets = useSafeAreaInsets();
  const activeCount = alerts.filter((a: Alert) => !a.resolved_at).length;

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'active' && styles.filterBtnActive]}
            onPress={() => setFilter('active')}>
            <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
              Active{activeCount > 0 ? ` (${activeCount})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
            onPress={() => setFilter('all')}>
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All ({alerts.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={displayAlerts}
        keyExtractor={item => String(item.id)}
        renderItem={renderAlert}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => useDataStore.getState().fetchAlerts()} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Loading...' : filter === 'active' ? 'No active alerts' : 'No alerts'}
          </Text>
        }
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: spacing.lg},
  header: {marginBottom: spacing.lg},
  title: {fontSize: fontSize.xxl, fontWeight: '800', color: colors.text, marginBottom: spacing.md},
  filterRow: {flexDirection: 'row', gap: spacing.sm},
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {borderColor: colors.primary, backgroundColor: colors.primary + '22'},
  filterText: {color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600'},
  filterTextActive: {color: colors.primary},
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
  detail: {marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border},
  detailText: {color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 2},
  empty: {color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, fontSize: fontSize.md},
  error: {color: colors.danger, textAlign: 'center', marginTop: spacing.sm},
});
