/**
 * EmptyContent — Minimal empty/error state placeholder
 *
 * Designed per EMPTY_STATE_UI_DESIGN.md spec:
 * - Emoji icon (no circular container, no background)
 * - Title + optional description
 * - Optional action button (plain text, no heavy button styling)
 * - No minHeight constraint
 *
 * Differences from EmptyState:
 *   Old EmptyState: 80×80 circular icon container, minHeight: 300, heavy button
 *   New EmptyContent: simple emoji text, paddingVertical: 80, plain text action
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useModeColors } from '@/lib/theme';

interface EmptyContentProps {
  /** Emoji icon string, e.g. "📚", "🏷️", "⚠️", "📭" */
  icon?: string;
  /** Primary message */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action button label */
  actionLabel?: string;
  /** Optional action callback */
  onAction?: () => void;
}

export function EmptyContent({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyContentProps) {
  const colors = useModeColors();

  return (
    <View style={styles.container}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text
        style={[styles.title, { color: colors.textPrimary ?? colors.text }]}
      >
        {title}
      </Text>
      {description && (
        <Text
          style={[
            styles.description,
            { color: colors.fgTertiary ?? colors.textTertiary },
          ]}
        >
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text
            style={[
              styles.actionText,
              { color: colors.fgBrandSecondary ?? colors.primary },
            ]}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
