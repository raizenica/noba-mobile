import React from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, spacing, fontSize, borderRadius} from '../theme/colors';
import {useDataStore} from '../store/dataStore';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';

function GaugeBar({label, value, color}: {label: string; value: number; color: string}) {
  return (
    <View style={gaugeStyles.row}>
      <Text style={gaugeStyles.label} numberOfLines={1}>{label}</Text>
      <View style={gaugeStyles.track}>
        <View style={[gaugeStyles.fill, {width: `${Math.min(value, 100)}%`, backgroundColor: color}]} />
      </View>
      <Text style={[gaugeStyles.value, {color}]}>{value.toFixed(0)}%</Text>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm},
  label: {color: colors.textMuted, fontSize: fontSize.sm, width: 80},
  track: {flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, marginHorizontal: spacing.sm, overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 4},
  value: {fontSize: fontSize.sm, fontWeight: '700', width: 40, textAlign: 'right'},
});

function formatUptime(seconds: number): string {
  if (!seconds) return '--';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const colorFor = (v: number) =>
  v > 90 ? colors.danger : v > 70 ? colors.warning : colors.success;

export default function AgentDetailScreen({route}: any) {
  const {hostname} = route.params;
  const stats = useDataStore(s => s.stats);
  const agents: any[] = stats?.agents || [];
  const agent = agents.find((a: any) => a.hostname === hostname);
  const insets = useSafeAreaInsets();

  if (!agent) {
    return (
      <View style={[styles.container, {paddingTop: insets.top}]}>
        <Text style={styles.empty}>Agent not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <Text style={styles.hostname}>{agent.hostname}</Text>
        <StatusBadge status={agent.online ? 'online' : 'offline'} size="md" />
      </View>

      {agent.online && (
        <>
          <Card title="Resources">
            <GaugeBar label="CPU" value={agent.cpu_percent ?? 0} color={colorFor(agent.cpu_percent ?? 0)} />
            <GaugeBar label="Memory" value={agent.mem_percent ?? 0} color={colorFor(agent.mem_percent ?? 0)} />
          </Card>

          <Card title="Info">
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>{agent.platform || '--'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Architecture</Text>
              <Text style={styles.infoValue}>{agent.arch || '--'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Uptime</Text>
              <Text style={styles.infoValue}>{formatUptime(agent.uptime_s)}</Text>
            </View>
            {agent.agent_version && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Agent Version</Text>
                <Text style={styles.infoValue}>{agent.agent_version}</Text>
              </View>
            )}
            {agent.ip && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>IP Address</Text>
                <Text style={styles.infoValue}>{agent.ip}</Text>
              </View>
            )}
          </Card>

          {agent.disks && agent.disks.length > 0 && (
            <Card title="Storage">
              {agent.disks.map((d: any, i: number) => (
                <GaugeBar key={i} label={d.mount} value={d.percent} color={colorFor(d.percent)} />
              ))}
            </Card>
          )}
        </>
      )}

      {!agent.online && (
        <Card title="Info">
          <Text style={styles.offlineText}>This agent is currently offline.</Text>
          {agent.platform && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>{agent.platform}</Text>
            </View>
          )}
        </Card>
      )}

      <View style={{height: spacing.xxl}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: spacing.lg},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg},
  hostname: {fontSize: fontSize.xxl, fontWeight: '800', color: colors.text, flex: 1},
  infoRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border},
  infoLabel: {color: colors.textMuted, fontSize: fontSize.sm},
  infoValue: {color: colors.text, fontSize: fontSize.sm, fontWeight: '600', maxWidth: '60%', textAlign: 'right'},
  offlineText: {color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.md},
  empty: {color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, fontSize: fontSize.md},
});
