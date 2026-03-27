import React, {useState} from 'react';
import {View, Text, FlatList, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, spacing, fontSize, borderRadius} from '../theme/colors';
import {useDataStore} from '../store/dataStore';
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

interface LedgerEntry {
  id: number;
  rule_id: string;
  target: string;
  action_type: string;
  action_success: number | null;
  created_at: number;
  duration_s: number | null;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function OutcomeBadge({success}: {success: number | null}) {
  if (success === null) return <StatusBadge status="warning" label="RUNNING" size="md" />;
  return success === 1
    ? <StatusBadge status="ok" label="SUCCESS" size="md" />
    : <StatusBadge status="danger" label="FAILED" size="md" />;
}

export default function HealingScreen() {
  const approvals = useDataStore(s => s.approvals);
  const error = useDataStore(s => s.approvalsError);
  const decideApproval = useDataStore(s => s.decideApproval);
  const ledger = useDataStore(s => s.ledger);
  const ledgerError = useDataStore(s => s.ledgerError);
  const loading = approvals.length === 0 && !error;
  const [acting, setActing] = useState<number | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(true);

  const queue = approvals.filter((a: Approval) => a.status === 'pending');

  const handleDecide = async (id: number, decision: 'approve' | 'deny') => {
    try {
      await decideApproval(id, decision);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDecision = (id: number, decision: 'approve' | 'deny') => {
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
            try { await handleDecide(id, decision); }
            finally { setActing(null); }
          },
        },
      ],
    );
  };

  const renderApproval = ({item}: {item: Approval}) => {
    let params: any = {};
    try { params = JSON.parse(item.action_params); } catch {}

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <StatusBadge status="warning" label="PENDING" size="md" />
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.actionType}>{item.action_type}</Text>
        <Text style={styles.trigger}>{item.trigger}</Text>
        {params.params?.service && <Text style={styles.detail}>Service: {params.params.service}</Text>}
        {params.params?.container && <Text style={styles.detail}>Container: {params.params.container}</Text>}
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

  const insets = useSafeAreaInsets();

  const onRefresh = () => {
    useDataStore.getState().fetchApprovals();
    useDataStore.getState().fetchLedger();
  };

  return (
    <ScrollView
      style={[styles.container, {paddingTop: insets.top}]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <Text style={styles.title}>Healing</Text>
      <Text style={styles.subtitle}>
        {queue.length} pending approval{queue.length !== 1 ? 's' : ''}
      </Text>

      {queue.length > 0 ? (
        queue.map(item => <View key={item.id}>{renderApproval({item})}</View>)
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.empty}>No pending approvals</Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {/* History section */}
      <TouchableOpacity style={styles.historySectionHeader} onPress={() => setHistoryExpanded(v => !v)} activeOpacity={0.7}>
        <Text style={styles.historySectionTitle}>History</Text>
        <View style={styles.historyHeaderRight}>
          {ledger.length > 0 && <Text style={styles.historyCount}>{ledger.length} entries</Text>}
          <Text style={styles.chevron}>{historyExpanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {historyExpanded && (
        <>
          {ledger.length === 0 && !ledgerError && (
            <Text style={styles.historyEmpty}>No healing history yet</Text>
          )}
          {ledgerError && <Text style={styles.error}>{ledgerError}</Text>}
          {ledger.map((entry: LedgerEntry) => (
            <View key={entry.id} style={styles.ledgerCard}>
              <View style={styles.ledgerHeader}>
                <OutcomeBadge success={entry.action_success} />
                <Text style={styles.time}>{timeAgo(entry.created_at)}</Text>
              </View>
              <Text style={styles.actionType}>{entry.action_type}</Text>
              {entry.target ? <Text style={styles.ledgerTarget}>{entry.target}</Text> : null}
              {entry.rule_id ? <Text style={styles.ledgerRule}>{entry.rule_id}</Text> : null}
              {entry.duration_s != null && (
                <Text style={styles.ledgerDuration}>{entry.duration_s.toFixed(1)}s</Text>
              )}
            </View>
          ))}
        </>
      )}
      <View style={{height: spacing.xxl * 2}} />
    </ScrollView>
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
  emptyContainer: {alignItems: 'center', marginVertical: spacing.xl},
  emptyIcon: {fontSize: 36, color: colors.success, marginBottom: spacing.sm},
  empty: {color: colors.textMuted, fontSize: fontSize.md},
  error: {color: colors.danger, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.sm},
  // History
  historySectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
    marginTop: spacing.md,
  },
  historySectionTitle: {fontSize: fontSize.lg, fontWeight: '700', color: colors.text},
  historyHeaderRight: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  historyCount: {color: colors.textMuted, fontSize: fontSize.xs},
  chevron: {color: colors.textMuted, fontSize: fontSize.xs},
  historyEmpty: {color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.lg},
  ledgerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ledgerHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs},
  ledgerTarget: {color: colors.primaryLight, fontSize: fontSize.xs, marginTop: 2},
  ledgerRule: {color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2},
  ledgerDuration: {color: colors.textDim, fontSize: fontSize.xs, marginTop: spacing.xs, textAlign: 'right'},
});
