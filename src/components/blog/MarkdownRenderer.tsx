import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing } from '../../lib/theme/spacing';
import { typography } from '../../lib/theme/typography';

// react-native-markdown-display provides native Markdown rendering
import Markdown, {
  MarkdownProps,
  RenderRules,
} from 'react-native-markdown-display';

interface MarkdownRendererProps {
  /** Markdown content to render */
  content: string;
  /** Maximum width for the rendered content */
  maxWidth?: number;
  /** Whether to enable code highlighting */
  enableCodeHighlight?: boolean;
}

/**
 * Markdown renderer component using react-native-markdown-display.
 *
 * Handles:
 * - Headings (h1-h6)
 * - Paragraphs, line breaks
 * - Bold, italic, strikethrough
 * - Ordered/unordered lists
 * - Code blocks (inline + fenced)
 * - Blockquotes
 * - Links (external)
 * - Images (with network-aware sizing)
 * - Tables
 *
 * Styles are automatically adapted to the current theme.
 */
export function MarkdownRenderer({
  content,
  maxWidth,
  enableCodeHighlight = false,
}: MarkdownRendererProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const containerWidth = maxWidth ?? windowWidth - spacing[6] * 2;

  const markdownStyles: MarkdownProps['style'] = {
    // Headings
    heading1: {
      fontSize: typography.h2.fontSize,
      fontWeight: '700',
      color: colors.text,
      marginTop: spacing[6],
      marginBottom: spacing[3],
      lineHeight: typography.h2.lineHeight,
    },
    heading2: {
      fontSize: typography.h3.fontSize,
      fontWeight: '700',
      color: colors.text,
      marginTop: spacing[5],
      marginBottom: spacing[2],
      lineHeight: typography.h3.lineHeight,
    },
    heading3: {
      fontSize: typography.h4.fontSize,
      fontWeight: '600',
      color: colors.text,
      marginTop: spacing[4],
      marginBottom: spacing[2],
      lineHeight: typography.h4.lineHeight,
    },
    heading4: {
      fontSize: typography.h5.fontSize,
      fontWeight: '600',
      color: colors.text,
      marginTop: spacing[3],
      marginBottom: spacing[1],
      lineHeight: typography.h5.lineHeight,
    },
    heading5: {
      fontSize: typography.body.fontSize,
      fontWeight: '600',
      color: colors.text,
      marginTop: spacing[3],
      marginBottom: spacing[1],
    },
    heading6: {
      fontSize: typography.small.fontSize,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: spacing[2],
      marginBottom: spacing[1],
    },

    // Body text
    body: {
      fontSize: typography.body.fontSize,
      lineHeight: typography.body.lineHeight,
      color: colors.textSecondary,
      marginBottom: spacing[3],
    },
    paragraph: {
      marginBottom: spacing[3],
    },

    // Inline formatting
    strong: {
      fontWeight: '700',
    },
    em: {
      fontStyle: 'italic',
    },
    s: {
      textDecorationLine: 'line-through',
    },

    // Lists
    bullet_list: {
      marginBottom: spacing[3],
    },
    ordered_list: {
      marginBottom: spacing[3],
    },
    list_item: {
      marginBottom: spacing[1],
      flexDirection: 'row',
    },
    bullet_list_icon: {
      fontSize: typography.body.fontSize,
      lineHeight: typography.body.lineHeight,
      color: colors.primary,
      marginRight: spacing[2],
    },
    ordered_list_icon: {
      fontSize: typography.body.fontSize,
      lineHeight: typography.body.lineHeight,
      color: colors.primary,
      marginRight: spacing[2],
    },

    // Code blocks
    code_inline: {
      backgroundColor: colors.surface,
      color: colors.primary,
      fontSize: typography.small.fontSize,
      fontFamily: 'monospace',
      paddingHorizontal: spacing[1],
      paddingVertical: spacing[0.25],
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: typography.small.fontSize,
      fontFamily: 'monospace',
      padding: spacing[3],
      borderRadius: 8,
      marginBottom: spacing[3],
      borderWidth: 1,
      borderColor: colors.border,
    },
    fence: {
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: typography.small.fontSize,
      fontFamily: 'monospace',
      padding: spacing[3],
      borderRadius: 8,
      marginBottom: spacing[3],
      borderWidth: 1,
      borderColor: colors.border,
    },

    // Blockquotes
    blockquote: {
      backgroundColor: colors.primary + '08',
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      padding: spacing[3],
      marginBottom: spacing[3],
      borderRadius: 4,
    },

    // Links
    link: {
      color: colors.primary,
      textDecorationLine: 'underline',
    },

    // Images
    image: {
      width: containerWidth,
      height: containerWidth * 0.6,
      borderRadius: 8,
      marginBottom: spacing[3],
      resizeMode: 'cover',
    },

    // Tables
    table: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      marginBottom: spacing[3],
    },
    thead: {
      backgroundColor: colors.surface,
    },
    th: {
      padding: spacing[2],
      fontWeight: '600',
      color: colors.text,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    td: {
      padding: spacing[2],
      color: colors.textSecondary,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    tr: {
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },

    // Horizontal rule
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: spacing[4],
    },
  };

  return (
    <View style={{ maxWidth: containerWidth }}>
      <Markdown style={markdownStyles}>{content}</Markdown>
    </View>
  );
}
