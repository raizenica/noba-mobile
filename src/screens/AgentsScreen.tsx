import React, {useCallback} from 'react';
import {View, Text, FlatList, StyleSheet, RefreshControl} from 'react-native';
import {colors, spacing, fontSize, borderRadius} from '../theme/colors';
import {get} from '../services/api';
import {usePolling} from '../hooks/usePolling';
import StatusBadge from '../components/StatusBadge';
import Card from '../components/Card';

interface Agent {
  hostname: string;
  status: string;
  cpu?: number;
  mem?: number;
  uptime?: string;
  version?: string;
  os?: string;
  lastSeen?: number;
  disks?: Array<{mount: string; percent: number}>;
}

export default function AgentsScreen() {
  const fetcher = useCallback(async () => {
    const stats = await get<any>('/api/stats');
    return (stats?.agents || []) as Agent[];
  }, []);
  const {data, loading, error, refresh} = usePolling(fetcher, 10000);

  const agents = data || [];

  const renderAgent = ({item}: {item: Agent}) => (
    <Card accent={item.status === 'online' ? colors.success : colors.danger}>
      <View style={styles.agentHeader}>
        <Text style={styles.hostname}>{item.hostname}</Text>
        <StatusBadge status={item.status || 'unknown'} size="md" />
      </View>

      {item.status === 'online' && (
        <>
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{(item.cpu ?? 0).toFixed(0)}%</Text>
              <Text style={styles.metricLabel}>CPU</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{(item.mem ?? 0).toFixed(0)}%</Text>
              <Text style={styles.metricLabel}>Memory</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{item.version || '--'}</Text>
              <Text style={styles.metricLabel}>Version</Text>
            </View>
          </View>

          {item.disks && item.disks.length > 0 && (
            <View style={styles.disksRow}>
              {item.disks.slice(0, 3).map((d, i) => (
                <Text key={i} style={styles.diskText}>
                  {d.mount}: {d.percent.toFixed(0)}%
                </Text>
              ))}
            </View>
          )}
        </>
      )}

      {item.os && <Text style={styles.os}>{item.os}</Text>}
    </Card>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Agents</Text>
      <FlatList
        data={agents}
        keyExtractor={item => item.hostname}
        renderItem={renderAgent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
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
  hostname: {fontSize: fontSize.lg, fontWeight: '700', color: colors.text},
  metricsRow: {flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border},
  metric: {alignItems: 'center'},
  metricValue: {fontSize: fontSize.lg, fontWeight: '800', color: colors.text},
  metricLabel: {fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2},
  disksRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm},
  diskText: {color: colors.textMuted, fontSize: fontSize.xs},
  os: {color: colors.textDim, fontSize: fontSize.xs, marginTop: spacing.sm},
  empty: {color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, fontSize: fontSize.md},
  error: {color: colors.danger, textAlign: 'center', marginTop: spacing.sm},
});
