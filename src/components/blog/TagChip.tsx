import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useModeColors } from '@/lib/theme/ThemeContext';
import { spacing, borderRadius } from '@/lib/theme/spacing';
import { typography } from '@/lib/theme/typography';
import type { FrontendTag } from '@/types/frontend-blog';

interface TagChipProps {
  tag: FrontendTag;
  onPress?: (tag: FrontendTag) => void;
  active?: boolean;
  showCount?: boolean;
  size?: 'small' | 'medium';
}

export function TagChip({
  tag,
  onPress,
  active = false,
  showCount = false,
  size = 'medium',
}: TagChipProps) {
  const colors = useModeColors();

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.surface,
          borderColor: active ? colors.primary : colors.border,
          borderWidth: 1,
        },
        size === 'small' && styles.chipSmall,
      ]}
      onPress={() => onPress?.(tag)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Tag: ${tag.name}`}
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[
          styles.label,
          { color: active ? '#fff' : colors.textSecondary },
          size === 'small' && styles.labelSmall,
        ]}
        numberOfLines={1}
      >
        {tag.name}
      </Text>

      {showCount && tag.articleCount > 0 && (
        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: active ? 'rgba(255,255,255,0.2)' : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.countText,
              { color: active ? '#fff' : colors.textTertiary },
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.button,
    fontSize: 14,
  },
  labelSmall: {
    fontSize: 12,
  },
  countBadge: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
