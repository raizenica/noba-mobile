import React from 'react';
import {View, Text, ScrollView, StyleSheet, RefreshControl} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, spacing, fontSize} from '../theme/colors';
import {useDataStore} from '../store/dataStore';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';

interface DiskEntry {mount: string; percent: number}
interface AgentEntry {hostname: string; cpu_percent: number; mem_percent: number; online: boolean; platform: string; disks: DiskEntry[]}

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
  const stats = useDataStore(s => s.stats);
  const error = useDataStore(s => s.statsError);
  const loading = stats === null && !error;
  const insets = useSafeAreaInsets();

  const cpu = stats?.cpuPercent ?? 0;
  const mem = stats?.memPercent ?? 0;
  const swap = stats?.swapPercent ?? 0;
  const rootDisk = stats?.disks?.find((d: DiskEntry) => d.mount === '/');
  const disk = rootDisk?.percent ?? 0;

  const agents: AgentEntry[] = stats?.agents ?? [];
  const onlineAgents = agents.filter((a: AgentEntry) => a.online).length;

  const services: any[] = stats?.services ?? [];
  const servicesUp = services.filter((s: any) => s.status === 'running' || s.status === 'active').length;

  const colorFor = (v: number) =>
    v > 90 ? colors.danger : v > 70 ? colors.warning : colors.success;

  return (
    <ScrollView
      style={[styles.container, {paddingTop: insets.top}]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => useDataStore.getState().fetchStats()} tintColor={colors.primary} />}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <StatusBadge status={stats?.collector_status || 'unknown'} size="md" />
      </View>

      <Card title="System Resources">
        <GaugeBar label="CPU" value={cpu} color={colorFor(cpu)} />
        <GaugeBar label="Memory" value={mem} color={colorFor(mem)} />
        <GaugeBar label="Swap" value={swap} color={colorFor(swap)} />
        <GaugeBar label="Disk" value={disk} color={colorFor(disk)} />
      </Card>

      <Card title="Agents" accent={onlineAgents === agents.length && agents.length > 0 ? colors.success : agents.length > 0 ? colors.warning : colors.textMuted}>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, {color: onlineAgents > 0 ? colors.success : colors.textMuted}]}>{onlineAgents}</Text>
            <Text style={styles.statLabel}>Online</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{agents.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
        {agents.slice(0, 5).map((agent: AgentEntry, i: number) => (
          <View key={i} style={styles.agentRow}>
            <StatusBadge status={agent.online ? 'online' : 'offline'} />
            <Text style={styles.agentName}>{agent.hostname}</Text>
            <Text style={styles.agentCpu}>{(agent.cpu_percent ?? 0).toFixed(0)}%</Text>
          </View>
        ))}
      </Card>

      <Card title="Quick Stats">
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats?.uptime || '--'}</Text>
            <Text style={styles.statLabel}>Uptime</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{services.length}</Text>
            <Text style={styles.statLabel}>Services</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, {color: servicesUp === services.length && services.length > 0 ? colors.success : colors.textMuted}]}>{servicesUp}</Text>
            <Text style={styles.statLabel}>Healthy</Text>
          </View>
        </View>
      </Card>

      {stats?.disks && stats.disks.length > 1 && (
        <Card title="Storage">
          {stats.disks.map((d: DiskEntry, i: number) => (
            <GaugeBar key={i} label={d.mount} value={d.percent} color={colorFor(d.percent)} />
          ))}
        </Card>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      <View style={{height: spacing.xxl}} />
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
