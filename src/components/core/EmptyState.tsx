import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing, borderRadius } from '../../lib/theme/spacing';
import { typography } from '../../lib/theme/typography';

interface EmptyStateProps {
  /** Emoji or text icon displayed above the title */
  icon?: string;
  /** Main title text */
  title: string;
  /** Descriptive subtitle */
  description?: string;
  /** Optional action button label */
  actionLabel?: string;
  /** Action button press handler */
  onAction?: () => void;
  /** Optional secondary action */
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}

/**
 * Empty state component.
 *
 * Usage:
 *   <EmptyState
 *     icon="📭"
 *     title="No articles found"
 *     description="Try adjusting your search or filter criteria."
 *     actionLabel="Browse All"
 *     onAction={() => navigation.navigate('Home')}
 *   />
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {icon && (
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.surface },
          ]}
        >
          <Text style={styles.icon}>{icon}</Text>
        </View>
      )}

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

      {description && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {description}
        </Text>
      )}

      {(actionLabel || secondaryLabel) && (
        <View style={styles.actions}>
          {actionLabel && onAction && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={onAction}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>{actionLabel}</Text>
            </TouchableOpacity>
          )}

          {secondaryLabel && onSecondaryAction && (
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              onPress={onSecondaryAction}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                {secondaryLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[12],
    minHeight: 300,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight as any,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
    marginBottom: spacing[6],
    paddingHorizontal: spacing[4],
  },
  actions: {
    gap: spacing[3],
    alignItems: 'center',
  },
  primaryButton: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    minWidth: 160,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    minWidth: 160,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
});
