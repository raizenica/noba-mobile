import React, {useState} from 'react';
import {View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {colors, spacing, fontSize, borderRadius} from '../theme/colors';
import {useDataStore} from '../store/dataStore';
import StatusBadge from '../components/StatusBadge';
import Card from '../components/Card';

interface Agent {
  hostname: string;
  cpu_percent: number;
  mem_percent: number;
  online: boolean;
  platform: string;
  uptime_s: number;
  arch: string;
  disks: Array<{mount: string; percent: number}>;
}

function formatUptime(seconds: number): string {
  if (!seconds) return '--';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function DiskBar({mount, percent}: {mount: string; percent: number}) {
  const color = percent > 90 ? colors.danger : percent > 75 ? colors.warning : colors.success;
  return (
    <View style={diskStyles.row}>
      <Text style={diskStyles.label} numberOfLines={1}>{mount}</Text>
      <View style={diskStyles.track}>
        <View style={[diskStyles.fill, {width: `${Math.min(percent, 100)}%`, backgroundColor: color}]} />
      </View>
      <Text style={[diskStyles.value, {color}]}>{percent.toFixed(0)}%</Text>
    </View>
  );
}

const diskStyles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs},
  label: {color: colors.textMuted, fontSize: fontSize.xs, width: 80},
  track: {flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, marginHorizontal: spacing.sm, overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 3},
  value: {fontSize: fontSize.xs, fontWeight: '700', width: 36, textAlign: 'right'},
});

export default function AgentsScreen() {
  const stats = useDataStore(s => s.stats);
  const error = useDataStore(s => s.statsError);
  const agents: any[] = stats?.agents || [];
  const loading = stats === null && !error;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (hostname: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(hostname) ? next.delete(hostname) : next.add(hostname);
      return next;
    });
  };

  const renderAgent = ({item}: {item: Agent}) => {
    const isExpanded = expanded.has(item.hostname);
    return (
      <TouchableOpacity onPress={() => navigation.navigate('AgentDetail', {hostname: item.hostname})} activeOpacity={0.8}>
        <Card accent={item.online ? colors.success : colors.danger}>
          <View style={styles.agentHeader}>
            <Text style={styles.hostname}>{item.hostname}</Text>
            <View style={styles.headerRight}>
              <StatusBadge status={item.online ? 'online' : 'offline'} size="md" />
              <Text style={styles.chevron}>›</Text>
            </View>
          </View>

          {item.online && (
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{(item.cpu_percent ?? 0).toFixed(0)}%</Text>
                <Text style={styles.metricLabel}>CPU</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{(item.mem_percent ?? 0).toFixed(0)}%</Text>
                <Text style={styles.metricLabel}>Memory</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{item.arch || '--'}</Text>
                <Text style={styles.metricLabel}>Arch</Text>
              </View>
              {!isExpanded && item.disks && item.disks.length > 0 && (
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, {color: item.disks[0].percent > 90 ? colors.danger : item.disks[0].percent > 75 ? colors.warning : colors.text}]}>
                    {item.disks[0].percent.toFixed(0)}%
                  </Text>
                  <Text style={styles.metricLabel}>{item.disks[0].mount}</Text>
                </View>
              )}
            </View>
          )}

          {isExpanded && item.online && (
            <View style={styles.expanded}>
              <View style={styles.expandedRow}>
                <Text style={styles.expandedLabel}>Uptime</Text>
                <Text style={styles.expandedValue}>{formatUptime(item.uptime_s)}</Text>
              </View>
              {item.platform ? (
                <View style={styles.expandedRow}>
                  <Text style={styles.expandedLabel}>Platform</Text>
                  <Text style={styles.expandedValue} numberOfLines={1}>{item.platform}</Text>
                </View>
              ) : null}
              {item.disks && item.disks.length > 0 && (
                <View style={styles.disksSection}>
                  <Text style={styles.disksSectionTitle}>Storage</Text>
                  {item.disks.map((d, i) => (
                    <DiskBar key={i} mount={d.mount} percent={d.percent} />
                  ))}
                </View>
              )}
            </View>
          )}

          {!item.online && item.platform ? (
            <Text style={styles.platform}>{item.platform}</Text>
          ) : null}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <Text style={styles.title}>Agents</Text>
      <FlatList
        data={agents}
        keyExtractor={item => item.hostname}
        renderItem={renderAgent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => useDataStore.getState().fetchStats()} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? 'Loading...' : 'No agents connected'}</Text>
        }
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: spacing.lg},
  title: {fontSize: fontSize.xxl, fontWeight: '800', color: colors.text, marginBottom: spacing.lg},
  agentHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm},
  hostname: {fontSize: fontSize.lg, fontWeight: '700', color: colors.text, flex: 1},
  headerRight: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  chevron: {color: colors.textMuted, fontSize: fontSize.xs},
  metricsRow: {flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border},
  metric: {alignItems: 'center'},
  metricValue: {fontSize: fontSize.lg, fontWeight: '800', color: colors.text},
  metricLabel: {fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2},
  expanded: {borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.sm},
  expandedRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm},
  expandedLabel: {color: colors.textMuted, fontSize: fontSize.sm},
  expandedValue: {color: colors.text, fontSize: fontSize.sm, fontWeight: '600', maxWidth: '65%', textAlign: 'right'},
  disksSection: {marginTop: spacing.sm},
  disksSectionTitle: {color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5},
  platform: {color: colors.textDim, fontSize: fontSize.xs, marginTop: spacing.sm},
  empty: {color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, fontSize: fontSize.md},
  error: {color: colors.danger, textAlign: 'center', marginTop: spacing.sm},
});
