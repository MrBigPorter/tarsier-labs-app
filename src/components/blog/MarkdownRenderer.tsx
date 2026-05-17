import React from 'react';
import { View, StyleSheet, useWindowDimensions, Text } from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';
import { spacing } from '@/lib/theme/spacing';
import { typography } from '@/lib/theme/typography';
import Video from 'react-native-video';

// react-native-markdown-display provides native Markdown rendering
import Markdown, {
  MarkdownProps,
} from 'react-native-markdown-display';

interface MarkdownRendererProps {
  /** Markdown content to render */
  content: string;
  /** Maximum width for the rendered content */
  maxWidth?: number;
  /** Whether to enable code highlighting */
  enableCodeHighlight?: boolean;
  /** Inline video mappings for <video> tags in markdown content */
  contentVideo?: Array<{
    videoKey: string;
    hlsUrl: string;
    poster?: string;
  }>;
}

/**
 * Parsed content segment — either markdown text or an inline video.
 */
type ContentSegment =
  | { type: 'markdown'; content: string }
  | { type: 'video'; hlsUrl: string; poster?: string };

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
 * - Inline <video> tags (via contentVideo mapping)
 *
 * Styles are automatically adapted to the current theme.
 */
export function MarkdownRenderer({
  content,
  maxWidth,
  enableCodeHighlight = false,
  contentVideo,
}: MarkdownRendererProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const containerWidth = maxWidth ?? windowWidth - spacing.xxl * 2;

  // ── Build content video lookup map ──────────────────────────────
  const contentVideoMap = React.useMemo(() => {
    const map = new Map<string, { hlsUrl: string; poster?: string }>();
    if (contentVideo) {
      for (const v of contentVideo) {
        map.set(v.videoKey, { hlsUrl: v.hlsUrl, poster: v.poster });
      }
    }
    return map;
  }, [contentVideo]);

  // ── Parse content into segments ─────────────────────────────────
  const segments = React.useMemo<ContentSegment[]>(() => {
    if (!contentVideo || contentVideo.length === 0) {
      return [{ type: 'markdown', content }];
    }

    const parts: ContentSegment[] = [];
    // Match <video src="..."> or <video src='...'>
    const videoTagRe = /<video\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = videoTagRe.exec(content)) !== null) {
      // Text before this tag
      if (match.index > lastIdx) {
        const textBefore = content.slice(lastIdx, match.index);
        if (textBefore.trim()) {
          parts.push({ type: 'markdown', content: textBefore });
        }
      }

      const videoKey = match[1];
      const info = contentVideoMap.get(videoKey);
      if (info) {
        parts.push({ type: 'video', hlsUrl: info.hlsUrl, poster: info.poster });
      }
      // If videoKey not in map, the tag is silently removed

      lastIdx = match.index + match[0].length;
    }

    // Remaining text after the last tag
    if (lastIdx < content.length) {
      const textAfter = content.slice(lastIdx);
      if (textAfter.trim()) {
        parts.push({ type: 'markdown', content: textAfter });
      }
    }

    // If nothing was parsed, return the original content as markdown
    return parts.length > 0 ? parts : [{ type: 'markdown', content }];
  }, [content, contentVideo, contentVideoMap]);
// ── Shared markdown styles ──────────────────────────────────────
const markdownStyles: MarkdownProps['style'] = {
  heading1: {
    fontSize: typography.h2.fontSize!,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    lineHeight: typography.h2.lineHeight,
  },
  heading2: {
    fontSize: typography.h3.fontSize!,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    lineHeight: typography.h3.lineHeight,
  },
  heading3: {
    fontSize: typography.h4.fontSize!,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    lineHeight: typography.h4.lineHeight,
  },
  heading4: {
    fontSize: typography.h5.fontSize!,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    lineHeight: typography.h5.lineHeight,
  },
  heading5: {
    fontSize: typography.body.fontSize!,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  heading6: {
    fontSize: typography.small.fontSize!,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: typography.body.fontSize!,
    lineHeight: typography.body.lineHeight!,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  paragraph: {
    marginBottom: spacing.md,
  },
  strong: {
    fontWeight: '700',
  },
  em: {
    fontStyle: 'italic',
  },
  s: {
    textDecorationLine: 'line-through',
  },
  bullet_list: {
    marginBottom: spacing.md,
  },
  ordered_list: {
    marginBottom: spacing.md,
  },
  list_item: {
    marginBottom: spacing.xs,
    flexDirection: 'row',
  },
  bullet_list_icon: {
    fontSize: typography.body.fontSize!,
    lineHeight: typography.body.lineHeight!,
    color: colors.primary,
    marginRight: spacing.sm,
  },
  ordered_list_icon: {
    fontSize: typography.body.fontSize!,
    lineHeight: typography.body.lineHeight!,
    color: colors.primary,
    marginRight: spacing.sm,
  },
  code_inline: {
    backgroundColor: colors.surface,
    color: colors.primary,
    fontSize: typography.small.fontSize!,
    fontFamily: 'monospace',
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.small.fontSize!,
    fontFamily: 'monospace',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fence: {
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.small.fontSize!,
    fontFamily: 'monospace',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blockquote: {
    backgroundColor: colors.primary + '08',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 4,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  image: {
    width: containerWidth,
    height: containerWidth * 0.6,
    borderRadius: 8,
    marginBottom: spacing.md,
    resizeMode: 'cover',
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  thead: {
    backgroundColor: colors.surface,
  },
  th: {
    padding: spacing.sm,
    fontWeight: '600',
    color: colors.text,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  td: {
    padding: spacing.sm,
    color: colors.textSecondary,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  tr: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  hr: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.lg,
  },
};


  return (
    <View style={{ maxWidth: containerWidth }}>
      {segments.map((seg, i) => {
        if (seg.type === 'video') {
          return (
            <View key={`v-${i}`} style={styles.inlineVideoContainer}>
              <Video
                source={{ uri: seg.hlsUrl }}
                style={styles.inlineVideo}
                poster={seg.poster}
                posterResizeMode="cover"
                controls
                resizeMode="contain"
              />
            </View>
          );
        }
        return (
          <Markdown key={`m-${i}`} style={markdownStyles}>
            {seg.content}
          </Markdown>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  inlineVideoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 8,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  inlineVideo: {
    width: '100%',
    height: '100%',
  },
});
