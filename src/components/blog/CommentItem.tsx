import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing, borderRadius } from '../../lib/theme/spacing';
import { typography } from '../../lib/theme/typography';
import type { Comment } from '../../types/blog';

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
}

/**
 * Comment item component with recursive reply rendering.
 *
 * Features:
 * - Author avatar (with initials fallback)
 * - Author name + website link
 * - Relative publish date
 * - Comment content (with basic formatting)
 * - Recursive replies (up to maxDepth)
 * - Reply button
 */
export function CommentItem({
  comment,
  depth = 0,
  maxDepth = 3,
  onReply,
  canReply = true,
}: CommentItemProps) {
  const { colors } = useTheme();
  const [showReplies, setShowReplies] = useState(true);
  const hasReplies = comment.children && comment.children.length > 0;
  const isDeepNested = depth >= maxDepth;

  // Generate initials for avatar fallback
  const initials = comment.author
    ? comment.author
        .split(' ')
        .map((n) => n[0])
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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(comment.createdAt).toLocaleDateString();
  }, [comment.createdAt]);

  return (
    <View style={depth > 0 && styles.nestedMargin}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: depth > 0 ? 'transparent' : colors.card,
            borderColor: colors.border,
          },
          depth > 0 && {
            borderLeftWidth: 2,
            borderLeftColor: colors.border,
            paddingLeft: spacing[3],
          },
        ]}
      >
        {/* Author row */}
        <View style={styles.header}>
          {/* Avatar */}
          {comment.author ? (
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.primary + '20' },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {initials}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.textTertiary }]}>
                ?
              </Text>
            </View>
          )}

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

          {canReply && onReply && (
            <TouchableOpacity
              onPress={() => onReply(comment)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.replyButton, { color: colors.primary }]}>
                Reply
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Recursive replies */}
      {hasReplies && showReplies && (
        <View>
          {comment.children!.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              maxDepth={maxDepth}
              onReply={onReply}
              canReply={canReply}
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
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing[2],
  },
  nestedMargin: {
    marginLeft: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
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
    marginBottom: spacing[2],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  likes: {
    fontSize: typography.xs.fontSize,
  },
  replyButton: {
    fontSize: typography.small.fontSize,
    fontWeight: '600',
  },
  showRepliesButton: {
    paddingVertical: spacing[1],
    paddingLeft: spacing[4],
    marginBottom: spacing[1],
  },
  showRepliesText: {
    fontSize: typography.small.fontSize,
    fontWeight: '600',
  },
});
