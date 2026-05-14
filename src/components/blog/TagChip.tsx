import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing, borderRadius } from '../../lib/theme/spacing';
import { typography } from '../../lib/theme/typography';
import type { FrontendTag } from '../../types/frontend-blog';

interface TagChipProps {
  tag: FrontendTag;
  onPress?: (tag: FrontendTag) => void;
  /** Whether this tag is currently selected */
  selected?: boolean;
  /** Whether to show the article count badge */
  showCount?: boolean;
  /** Compact mode (smaller size for tag clouds) */
  compact?: boolean;
}

/**
 * Tag chip component.
 *
 * Used in:
 * - Tag cloud/list views
 * - Article detail page (tags section)
 * - Filter chips in search
 *
 * Features:
 * - Selected/unselected states
 * - Optional count badge
 * - Compact mode for wrapping layouts
 * - Accent color from tag.color or default primary
 */
export function TagChip({
  tag,
  onPress,
  selected = false,
  showCount = true,
  compact = false,
}: TagChipProps) {
  const { colors } = useTheme();
  const accentColor = tag.color || colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        compact && styles.compactContainer,
        selected
          ? {
              backgroundColor: accentColor + '20',
              borderColor: accentColor,
            }
          : {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
      ]}
      onPress={() => onPress?.(tag)}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <Text
        style={[
          styles.text,
          compact && styles.compactText,
          selected
            ? { color: accentColor, fontWeight: '600' }
            : { color: colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {tag.name}
      </Text>

      {showCount && tag.articleCount > 0 && (
        <View
          style={[
            styles.countBadge,
            selected
              ? { backgroundColor: accentColor + '25' }
              : { backgroundColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.countText,
              compact && styles.compactCountText,
              { color: selected ? accentColor : colors.textTertiary },
            ]}
          >
            {tag.articleCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing[1.5],
  },
  compactContainer: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  text: {
    fontSize: typography.small.fontSize,
    lineHeight: typography.small.lineHeight,
  },
  compactText: {
    fontSize: typography.xs.fontSize,
  },
  countBadge: {
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.25],
    borderRadius: borderRadius.full,
    minWidth: 20,
    alignItems: 'center',
  },
  countText: {
    fontSize: typography.xs.fontSize,
    fontWeight: '600',
  },
  compactCountText: {
    fontSize: 10,
  },
});
