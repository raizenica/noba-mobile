import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, fontSize, borderRadius, spacing} from '../theme/colors';

interface Props {
  status: 'online' | 'offline' | 'degraded' | 'ok' | 'unknown' | string;
  label?: string;
  size?: 'sm' | 'md';
}

const statusColors: Record<string, string> = {
  online: colors.success,
  ok: colors.success,
  healthy: colors.success,
  offline: colors.danger,
  down: colors.danger,
  degraded: colors.warning,
  stalled: colors.warning,
  warning: colors.warning,
  unknown: colors.textMuted,
};

export default function StatusBadge({status, label, size = 'sm'}: Props) {
  const color = statusColors[status.toLowerCase()] || colors.textMuted;
  const isMd = size === 'md';

  return (
    <View style={[styles.badge, {backgroundColor: color + '22', borderColor: color}]}>
      <View style={[styles.dot, {backgroundColor: color, width: isMd ? 8 : 6, height: isMd ? 8 : 6}]} />
      <Text style={[styles.text, {color, fontSize: isMd ? fontSize.sm : fontSize.xs}]}>
        {label || status.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  text: {
    fontWeight: '600',
  },
});
