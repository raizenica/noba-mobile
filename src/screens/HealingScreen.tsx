import React, {useCallback, useState} from 'react';
import {View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert} from 'react-native';
import {colors, spacing, fontSize, borderRadius} from '../theme/colors';
import {get, post} from '../services/api';
import {usePolling} from '../hooks/usePolling';
import StatusBadge from '../components/StatusBadge';

interface Approval {
  id: number;
  automation_id: string;
  action_type: string;
  action_params: string;
  trigger: string;
  created_at: number;
  status: string;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function HealingScreen() {
  const fetcher = useCallback(() => get<{queue: Approval[]}>('/api/healing/approvals'), []);
  const {data, loading, error, refresh} = usePolling(fetcher, 10000);
  const [acting, setActing] = useState<number | null>(null);

  const queue = (data?.queue || []).filter((a: Approval) => a.status === 'pending');

  const handleDecision = async (id: number, decision: 'approve' | 'deny') => {
    Alert.alert(
      `${decision === 'approve' ? 'Approve' : 'Deny'} Action`,
      `Are you sure you want to ${decision} this healing action?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: decision === 'approve' ? 'Approve' : 'Deny',
          style: decision === 'approve' ? 'default' : 'destructive',
          onPress: async () => {
            setActing(id);
            try {
              await post(`/api/healing/approvals/${id}/${decision}`);
              refresh();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setActing(null);
            }
          },
        },
      ],
    );
  };

  const renderApproval = ({item}: {item: Approval}) => {
    let params: any = {};
    try {
      params = JSON.parse(item.action_params);
    } catch {}

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <StatusBadge status="warning" label="PENDING" size="md" />
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>

        <Text style={styles.actionType}>{item.action_type}</Text>
        <Text style={styles.trigger}>{item.trigger}</Text>

        {params.params?.service && (
          <Text style={styles.detail}>Service: {params.params.service}</Text>
        )}
        {params.params?.container && (
          <Text style={styles.detail}>Container: {params.params.container}</Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnApprove]}
            onPress={() => handleDecision(item.id, 'approve')}
            disabled={acting === item.id}>
            <Text style={styles.btnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnDeny]}
            onPress={() => handleDecision(item.id, 'deny')}
            disabled={acting === item.id}>
            <Text style={styles.btnText}>Deny</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Healing</Text>
      <Text style={styles.subtitle}>
        {queue.length} pending approval{queue.length !== 1 ? 's' : ''}
      </Text>
      <FlatList
        data={queue}
        keyExtractor={item => String(item.id)}
        renderItem={renderApproval}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>&#10003;</Text>
            <Text style={styles.empty}>No pending approvals</Text>
          </View>
        }
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: spacing.lg},
  title: {fontSize: fontSize.xxl, fontWeight: '800', color: colors.text},
  subtitle: {color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.lg},
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm},
  time: {color: colors.textDim, fontSize: fontSize.xs},
  actionType: {color: colors.text, fontSize: fontSize.md, fontWeight: '700'},
  trigger: {color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2},
  detail: {color: colors.primaryLight, fontSize: fontSize.sm, marginTop: spacing.sm},
  actions: {flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg},
  btn: {flex: 1, padding: spacing.md, borderRadius: borderRadius.sm, alignItems: 'center'},
  btnApprove: {backgroundColor: colors.success},
  btnDeny: {backgroundColor: colors.danger},
  btnText: {color: colors.text, fontWeight: '700', fontSize: fontSize.sm},
  emptyContainer: {alignItems: 'center', marginTop: spacing.xxl * 2},
  emptyIcon: {fontSize: 48, color: colors.success, marginBottom: spacing.md},
  empty: {color: colors.textMuted, fontSize: fontSize.md},
  error: {color: colors.danger, textAlign: 'center', marginTop: spacing.sm},
});
