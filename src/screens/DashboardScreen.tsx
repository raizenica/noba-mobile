import React, {useState} from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Modal, FlatList, SafeAreaView, Dimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LineChart} from 'react-native-chart-kit';
import {colors, spacing, fontSize, borderRadius} from '../theme/colors';
import {useDataStore} from '../store/dataStore';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';

interface DiskEntry {mount: string; percent: number}
interface AgentEntry {hostname: string; cpu_percent: number; mem_percent: number; online: boolean; platform: string; disks: DiskEntry[]}
interface ServiceEntry {name: string; status: string}
interface Notif {id: number; timestamp: number; level: string; title: string; message: string; read: boolean}

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

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotifLevelColor(level: string): string {
  if (level === 'critical' || level === 'error') return colors.danger;
  if (level === 'warning') return colors.warning;
  return colors.info;
}

const screenWidth = Dimensions.get('window').width - spacing.lg * 2 - spacing.lg * 2; // account for container + card padding

const chartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(108, 92, 231, ${opacity})`,
  labelColor: () => colors.textMuted,
  propsForDots: {r: '0'},
  propsForBackgroundLines: {stroke: colors.border, strokeDasharray: ''},
  strokeWidth: 2,
};

export default function DashboardScreen() {
  const stats = useDataStore(s => s.stats);
  const error = useDataStore(s => s.statsError);
  const loading = stats === null && !error;
  const statsHistory = useDataStore(s => s.statsHistory);
  const notifs = useDataStore(s => s.notifs);
  const unreadCount = useDataStore(s => s.unreadCount);
  const markNotifRead = useDataStore(s => s.markNotifRead);
  const markAllNotifsRead = useDataStore(s => s.markAllNotifsRead);
  const insets = useSafeAreaInsets();

  const [notifsOpen, setNotifsOpen] = useState(false);
  const [servicesExpanded, setServicesExpanded] = useState(false);

  const cpu = stats?.cpuPercent ?? 0;
  const mem = stats?.memPercent ?? 0;
  const swap = stats?.swapPercent ?? 0;
  const rootDisk = stats?.disks?.find((d: DiskEntry) => d.mount === '/');
  const disk = rootDisk?.percent ?? 0;

  const agents: AgentEntry[] = stats?.agents ?? [];
  const onlineAgents = agents.filter((a: AgentEntry) => a.online).length;

  const services: ServiceEntry[] = stats?.services ?? [];
  const servicesUp = services.filter((s: ServiceEntry) => s.status === 'running' || s.status === 'active').length;

  const colorFor = (v: number) =>
    v > 90 ? colors.danger : v > 70 ? colors.warning : colors.success;

  const serviceStatusColor = (status: string) =>
    status === 'running' || status === 'active' ? colors.success :
    status === 'failed' ? colors.danger : colors.warning;

  return (
    <>
      <ScrollView
        style={[styles.container, {paddingTop: insets.top}]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => useDataStore.getState().fetchStats()} tintColor={colors.primary} />}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <View style={styles.headerRight}>
            <StatusBadge status={stats?.collector_status || 'unknown'} size="md" />
            <TouchableOpacity style={styles.bellBtn} onPress={() => setNotifsOpen(true)}>
              <Text style={styles.bellIcon}>{'\uD83D\uDD14'}</Text>
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Card title="System Resources">
          <GaugeBar label="CPU" value={cpu} color={colorFor(cpu)} />
          <GaugeBar label="Memory" value={mem} color={colorFor(mem)} />
          <GaugeBar label="Swap" value={swap} color={colorFor(swap)} />
          <GaugeBar label="Disk" value={disk} color={colorFor(disk)} />
          {statsHistory.length >= 3 && (
            <View style={styles.chartContainer}>
              <LineChart
                data={{
                  labels: [],
                  datasets: [
                    {data: statsHistory.map(h => h.cpu), color: () => colors.primary, strokeWidth: 2},
                    {data: statsHistory.map(h => h.mem), color: () => colors.accent, strokeWidth: 2},
                  ],
                  legend: ['CPU', 'Memory'],
                }}
                width={screenWidth}
                height={120}
                chartConfig={chartConfig}
                bezier
                withVerticalLabels={false}
                withHorizontalLabels={false}
                withVerticalLines={false}
                withHorizontalLines={false}
                withShadow={false}
                style={styles.chart}
              />
            </View>
          )}
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

        <TouchableOpacity onPress={() => setServicesExpanded(v => !v)} activeOpacity={0.8}>
          <Card title="Services">
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{stats?.uptime || '--'}</Text>
                <Text style={styles.statLabel}>Uptime</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{services.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, {color: servicesUp === services.length && services.length > 0 ? colors.success : colors.warning}]}>{servicesUp}</Text>
                <Text style={styles.statLabel}>Healthy</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.chevron}>{servicesExpanded ? '▲' : '▼'}</Text>
                <Text style={styles.statLabel}>Detail</Text>
              </View>
            </View>
            {servicesExpanded && services.length > 0 && (
              <View style={styles.servicesList}>
                {services.map((svc: ServiceEntry, i: number) => (
                  <View key={i} style={styles.serviceRow}>
                    <View style={[styles.serviceDot, {backgroundColor: serviceStatusColor(svc.status)}]} />
                    <Text style={styles.serviceName} numberOfLines={1}>{svc.name}</Text>
                    <Text style={[styles.serviceStatus, {color: serviceStatusColor(svc.status)}]}>{svc.status}</Text>
                  </View>
                ))}
              </View>
            )}
            {servicesExpanded && services.length === 0 && (
              <Text style={styles.servicesEmpty}>No services tracked</Text>
            )}
          </Card>
        </TouchableOpacity>

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

      {/* Notifications modal */}
      <Modal
        visible={notifsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setNotifsOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setNotifsOpen(false)} />
        <SafeAreaView style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <View style={styles.modalHeaderRight}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={() => markAllNotifsRead()} style={styles.markAllBtn}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setNotifsOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={notifs}
            keyExtractor={item => String(item.id)}
            renderItem={({item}: {item: Notif}) => (
              <TouchableOpacity
                style={[styles.notifRow, !item.read && styles.notifRowUnread]}
                onPress={() => { if (!item.read) markNotifRead(item.id); }}
                activeOpacity={item.read ? 1 : 0.7}>
                <View style={[styles.notifLevel, {backgroundColor: NotifLevelColor(item.level)}]} />
                <View style={styles.notifBody}>
                  <View style={styles.notifTop}>
                    <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.notifTime}>{timeAgo(item.timestamp)}</Text>
                  </View>
                  <Text style={styles.notifMsg} numberOfLines={2}>{item.message}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.notifsEmpty}>No notifications</Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: spacing.lg},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg},
  headerRight: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  title: {fontSize: fontSize.xxl, fontWeight: '800', color: colors.text},
  bellBtn: {position: 'relative', padding: spacing.xs},
  bellIcon: {fontSize: 20},
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.danger, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {color: '#fff', fontSize: 9, fontWeight: '800'},
  statRow: {flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm},
  stat: {alignItems: 'center'},
  statValue: {fontSize: fontSize.xl, fontWeight: '800', color: colors.text},
  statLabel: {fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2},
  chevron: {fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center'},
  agentRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border},
  agentName: {flex: 1, color: colors.text, fontSize: fontSize.sm, marginLeft: spacing.sm},
  agentCpu: {color: colors.textMuted, fontSize: fontSize.sm},
  servicesList: {borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm},
  serviceRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs},
  serviceDot: {width: 7, height: 7, borderRadius: 4, marginRight: spacing.sm},
  serviceName: {flex: 1, color: colors.text, fontSize: fontSize.sm},
  serviceStatus: {fontSize: fontSize.xs, fontWeight: '600'},
  servicesEmpty: {color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', paddingTop: spacing.sm},
  chartContainer: {marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md},
  chart: {borderRadius: 8, marginLeft: -16},
  error: {color: colors.danger, textAlign: 'center', marginTop: spacing.lg},
  // Modal
  modalBackdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)'},
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: '70%',
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: {fontSize: fontSize.lg, fontWeight: '800', color: colors.text},
  modalHeaderRight: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  markAllBtn: {paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border},
  markAllText: {color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600'},
  modalClose: {color: colors.textMuted, fontSize: fontSize.lg, paddingHorizontal: spacing.xs},
  notifRow: {flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border},
  notifRowUnread: {backgroundColor: colors.primary + '0F'},
  notifLevel: {width: 3, borderRadius: 2, marginRight: spacing.md, alignSelf: 'stretch'},
  notifBody: {flex: 1},
  notifTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2},
  notifTitle: {color: colors.textMuted, fontSize: fontSize.sm, flex: 1},
  notifTitleUnread: {color: colors.text, fontWeight: '700'},
  notifMsg: {color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16},
  notifTime: {color: colors.textDim, fontSize: fontSize.xs, marginLeft: spacing.sm},
  notifsEmpty: {color: colors.textMuted, textAlign: 'center', padding: spacing.xxl, fontSize: fontSize.md},
});
