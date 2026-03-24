import React from 'react';
import {View, Text, StyleSheet, ViewStyle} from 'react-native';
import {colors, spacing, borderRadius, fontSize} from '../theme/colors';

interface Props {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: string;
}

export default function Card({title, children, style, accent}: Props) {
  return (
    <View style={[styles.card, accent ? {borderLeftColor: accent, borderLeftWidth: 3} : {}, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
});
