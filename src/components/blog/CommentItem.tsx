import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useModeColors } from '@/lib/theme/ThemeContext';
import { spacing, borderRadius } from '@/lib/theme/spacing';
import { typography } from '@/lib/theme/typography';
import { useTranslation } from 'react-i18next';
import type { Comment } from '@/types/blog';

interface CommentItemProps {
  comment: Comment;
  /** Nesting level (for recursive replies) */
  depth?: number;
  /** Maximum nesting depth before flattening */
  maxDepth?: number;
  /** Reply button handler */
  onReply?: (comment: Comment) => void;
  /** Whether user can reply */
  canReply?: boolean;
  /** Whether user is authenticated */
  isAuthenticated?: boolean;
  /** Article ID for reply submission */
  articleId?: string;
  /** Navigate to auth screen */
  onNavigateToAuth?: () => void;
}

/**
 * Comment item component with recursive reply rendering.
 *
 * Features:
 * - Author avatar (with initials fallback)
 * - Author name + relative date
 * - Comment content
 * - Recursive replies (up to maxDepth)
 * - Reply button with auth gate
 */
export function CommentItem({
  comment,
  depth = 0,
  maxDepth = 3,
  onReply,
  canReply = true,
  isAuthenticated = false,
  articleId,
  onNavigateToAuth,
}: CommentItemProps) {
  const colors = useModeColors();
  const { t } = useTranslation();
  const [showReplies, setShowReplies] = useState(true);
  const hasReplies = comment.children && comment.children.length > 0;
  const isDeepNested = depth >= maxDepth;

  const handleReplyPress = () => {
    if (!isAuthenticated) {
      onNavigateToAuth?.();
      return;
    }

    onReply?.(comment);
  };

  // ─── Avatar initials ────────────────────────────────────────────
  const initials = comment.author
    ? comment.author
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  // Relative time
  const timeAgo = React.useMemo(() => {
    const now = Date.now();
    const created = new Date(comment.createdAt).getTime();
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return new Date(comment.createdAt).toLocaleDateString();
  }, [comment.createdAt]);

  const isCommentLoaded =
    comment.id && (comment.approved || !comment.id.startsWith('temp-'));

  return (
    <View style={depth > 0 && styles.nestedMargin}>
      <View
        style={[
          styles.container,
          // eslint-disable-next-line react-native/no-inline-styles
          {
            backgroundColor: depth > 0 ? 'transparent' : colors.card,
            borderColor: colors.border,
          },
          depth > 0 &&
            // eslint-disable-next-line react-native/no-inline-styles
            {
              borderLeftWidth: 2,
              borderLeftColor: colors.border,
              paddingLeft: spacing.md,
            },
        ]}
      >
        {/* Author row */}
        <View style={styles.header}>
          {/* Avatar */}
          <View
            style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}
          >
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {initials}
            </Text>
          </View>

          {/* Name + date */}
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, { color: colors.text }]}>
              {comment.author || 'Anonymous'}
            </Text>
            <Text style={[styles.date, { color: colors.textTertiary }]}>
              {timeAgo}
            </Text>
          </View>
        </View>

        {/* Comment content */}
        <Text style={[styles.content, { color: colors.textSecondary }]}>
          {comment.content}
        </Text>

        {/* Actions row */}
        <View style={styles.actions}>
          <Text style={[styles.likes, { color: colors.textTertiary }]}>
            {comment.likes ? `${comment.likes} likes` : ''}
          </Text>

          {(canReply || isAuthenticated) && (
            <TouchableOpacity
              onPress={handleReplyPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={!isCommentLoaded}
            >
              <Text
                style={[
                  styles.replyButton,
                  { color: colors.primary },
                  !isCommentLoaded && styles.replyButtonDisabled,
                ]}
              >
                {t('comment.reply')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Recursive replies */}
      {hasReplies && showReplies && (
        <View>
          {comment.children!.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              maxDepth={maxDepth}
              onReply={onReply}
              canReply={canReply}
              isAuthenticated={isAuthenticated}
              articleId={articleId}
              onNavigateToAuth={onNavigateToAuth}
            />
          ))}
        </View>
      )}

      {/* "Show replies" toggle for collapsed replies */}
      {hasReplies && !showReplies && (
        <TouchableOpacity
          onPress={() => setShowReplies(true)}
          style={styles.showRepliesButton}
        >
          <Text style={[styles.showRepliesText, { color: colors.primary }]}>
            Show {comment.children!.length} replies
          </Text>
        </TouchableOpacity>
      )}

      {/* Flattened replies indicator */}
      {isDeepNested && hasReplies && (
        <TouchableOpacity
          onPress={() => setShowReplies(!showReplies)}
          style={styles.showRepliesButton}
        >
          <Text style={[styles.showRepliesText, { color: colors.primary }]}>
            {showReplies ? 'Hide' : 'Show'} replies
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  nestedMargin: {
    marginLeft: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.small.fontSize,
    fontWeight: '700',
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  date: {
    fontSize: typography.xs.fontSize,
  },
  content: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  likes: {
    fontSize: typography.xs.fontSize,
  },
  replyButton: {
    fontSize: typography.small.fontSize,
    fontWeight: '600',
  },
  replyButtonDisabled: {
    opacity: 0.5,
  },
  showRepliesButton: {
    paddingVertical: spacing.xs,
    paddingLeft: spacing.lg,
    marginBottom: spacing.xs,
  },
  showRepliesText: {
    fontSize: typography.small.fontSize,
    fontWeight: '600',
  },
});
