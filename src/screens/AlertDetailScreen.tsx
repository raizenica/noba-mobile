import React from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, spacing, fontSize} from '../theme/colors';
import {useDataStore} from '../store/dataStore';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function duration(start: number, end: number): string {
  const diff = end - start;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

export default function AlertDetailScreen({route}: any) {
  const {alertId} = route.params;
  const alerts = useDataStore(s => s.alerts);
  const alert = alerts.find((a: any) => a.id === alertId);
  const insets = useSafeAreaInsets();

  if (!alert) {
    return (
      <View style={[styles.container, {paddingTop: insets.top}]}>
        <Text style={styles.empty}>Alert not found</Text>
      </View>
    );
  }

  const severityColor =
    alert.severity === 'critical' || alert.severity === 'danger'
      ? colors.danger
      : alert.severity === 'warning'
      ? colors.warning
      : colors.info;

  return (
    <ScrollView style={[styles.container, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <StatusBadge
          status={alert.resolved_at ? 'ok' : alert.severity}
          label={alert.resolved_at ? 'RESOLVED' : alert.severity.toUpperCase()}
          size="md"
        />
      </View>

      <Card title="Alert Details">
        <View style={styles.row}>
          <Text style={styles.label}>Rule</Text>
          <Text style={[styles.value, {color: colors.primaryLight}]}>{alert.rule_id}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Severity</Text>
          <Text style={[styles.value, {color: severityColor}]}>{alert.severity}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Triggered</Text>
          <Text style={styles.value}>{formatTs(alert.timestamp)}</Text>
        </View>
        {alert.resolved_at && (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Resolved</Text>
              <Text style={styles.value}>{formatTs(alert.resolved_at)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Duration</Text>
              <Text style={styles.value}>{duration(alert.timestamp, alert.resolved_at)}</Text>
            </View>
          </>
        )}
        {!alert.resolved_at && (
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={[styles.value, {color: colors.warning}]}>Active — {duration(alert.timestamp, Math.floor(Date.now() / 1000))}</Text>
          </View>
        )}
      </Card>

      <Card title="Message">
        <Text style={styles.message}>{alert.message}</Text>
      </Card>

      {alert.hostname && (
        <Card title="Source">
          <View style={styles.row}>
            <Text style={styles.label}>Host</Text>
            <Text style={styles.value}>{alert.hostname}</Text>
          </View>
        </Card>
      )}

      <View style={{height: spacing.xxl}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: spacing.lg},
  header: {marginBottom: spacing.lg},
  row: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border},
  label: {color: colors.textMuted, fontSize: fontSize.sm},
  value: {color: colors.text, fontSize: fontSize.sm, fontWeight: '600', maxWidth: '60%', textAlign: 'right'},
  message: {color: colors.text, fontSize: fontSize.sm, lineHeight: 22},
  empty: {color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, fontSize: fontSize.md},
});
