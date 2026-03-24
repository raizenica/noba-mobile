import React, {useCallback} from 'react';
import {View, Text, ScrollView, StyleSheet, RefreshControl} from 'react-native';
import {colors, spacing, fontSize} from '../theme/colors';
import {get} from '../services/api';
import {usePolling} from '../hooks/usePolling';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';

interface Stats {
  cpuPercent?: number;
  memPercent?: number;
  swapPercent?: number;
  uptime?: string;
  diskPercent?: number;
  services?: Record<string, any>;
  agents?: any[];
  collector_status?: string;
  [key: string]: any;
}

function GaugeBar({label, value, color}: {label: string; value: number; color: string}) {
  return (
    <View style={gaugeStyles.row}>
      <Text style={gaugeStyles.label}>{label}</Text>
      <View style={gaugeStyles.track}>
        <View style={[gaugeStyles.fill, {width: `${Math.min(value, 100)}%`, backgroundColor: color}]} />
      </View>
      <Text style={[gaugeStyles.value, {color}]}>{value.toFixed(0)}%</Text>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm},
  label: {color: colors.textMuted, fontSize: fontSize.sm, width: 55},
  track: {flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, marginHorizontal: spacing.sm, overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 4},
  value: {fontSize: fontSize.sm, fontWeight: '700', width: 40, textAlign: 'right'},
});

export default function DashboardScreen() {
  const fetcher = useCallback(() => get<Stats>('/api/stats'), []);
  const {data, loading, error, refresh} = usePolling(fetcher, 5000);

  const cpu = data?.cpuPercent ?? 0;
  const mem = data?.memPercent ?? 0;
  const swap = data?.swapPercent ?? 0;
  const disk = data?.diskPercent ?? 0;

  const agents = data?.agents ?? [];
  const onlineAgents = agents.filter((a: any) => a.status === 'online').length;

  const colorFor = (v: number) =>
    v > 90 ? colors.danger : v > 70 ? colors.warning : colors.success;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <StatusBadge status={data?.collector_status || 'unknown'} size="md" />
      </View>

      <Card title="System Resources">
        <GaugeBar label="CPU" value={cpu} color={colorFor(cpu)} />
        <GaugeBar label="Memory" value={mem} color={colorFor(mem)} />
        <GaugeBar label="Swap" value={swap} color={colorFor(swap)} />
        <GaugeBar label="Disk" value={disk} color={colorFor(disk)} />
      </Card>

      <Card title="Agents" accent={onlineAgents === agents.length ? colors.success : colors.warning}>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{onlineAgents}</Text>
            <Text style={styles.statLabel}>Online</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{agents.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
        {agents.slice(0, 5).map((agent: any, i: number) => (
          <View key={i} style={styles.agentRow}>
            <StatusBadge status={agent.status || 'unknown'} />
            <Text style={styles.agentName}>{agent.hostname || agent.name || 'Unknown'}</Text>
            <Text style={styles.agentCpu}>{(agent.cpu ?? 0).toFixed(0)}%</Text>
          </View>
        ))}
      </Card>

      <Card title="Quick Stats">
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{data?.uptime || '--'}</Text>
            <Text style={styles.statLabel}>Uptime</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{Object.keys(data?.services || {}).length}</Text>
            <Text style={styles.statLabel}>Services</Text>
          </View>
        </View>
      </Card>

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: spacing.lg},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg},
  title: {fontSize: fontSize.xxl, fontWeight: '800', color: colors.text},
  statRow: {flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm},
  stat: {alignItems: 'center'},
  statValue: {fontSize: fontSize.xl, fontWeight: '800', color: colors.text},
  statLabel: {fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2},
  agentRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border},
  agentName: {flex: 1, color: colors.text, fontSize: fontSize.sm, marginLeft: spacing.sm},
  agentCpu: {color: colors.textMuted, fontSize: fontSize.sm},
  error: {color: colors.danger, textAlign: 'center', marginTop: spacing.lg},
});
