/**
 * ArticleDetailScreen — Full article view
 *
 * Sections:
 * 1. Cover image (with network-adaptive sizing)
 * 2. Article header (title, author, date, stats)
 * 3. Category badge + tags
 * 4. Markdown content (rendered via MarkdownRenderer)
 * 5. Action bar (like, bookmark, share, comments count)
 * 6. Related articles (horizontal scroll)
 * 7. Comments section
 *
 * Data:
 * - getArticleBySlug (RTK Query)
 * - getComments (RTK Query, separate call)
 * - createComment (RTK Query mutation)
 *
 * States:
 * - Loading: ArticleDetailSkeleton
 * - Error: EmptyState with retry
 * - Offline: NetworkStatusBar
 */
import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { typography } from '../lib/theme/typography';
import {
  useGetArticleBySlugQuery,
  useGetRelatedArticlesQuery,
} from '../api/endpoints/articles';
import { useGetCommentsQuery, useCreateCommentMutation } from '../api/endpoints/comments';
import { useAppSelector, useAppDispatch } from '../store';
import { toggleBookmarkOptimistic } from '../store/slices/bookmarksSlice';
import MarkdownRenderer from '../components/blog/MarkdownRenderer';
import CommentItem from '../components/blog/CommentItem';
import ArticleCard from '../components/blog/ArticleCard';
import Header from '../components/layout/Header';
import NetworkStatusBar from '../components/core/NetworkStatusBar';
import { ArticleDetailSkeleton } from '../components/core/Skeleton';
import EmptyState from '../components/core/EmptyState';
import SvgIcon from '../components/core/SvgIcon';
import type { RootStackScreenProps } from '../navigation/types';
import type { FrontendArticle } from '../types/frontend-blog';

const ArticleDetailScreen: React.FC<
  RootStackScreenProps<'ArticleDetail'>
> = ({ navigation, route }) => {
  const { slug } = route.params;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;
  const { width: screenWidth } = useWindowDimensions();

  // ─── Redux ──────────────────────────────────────────────────────────
  const dispatch = useAppDispatch();
  const bookmarkedIds = useAppSelector(state => state.bookmarks.bookmarkedIds);
  const user = useAppSelector(state => state.auth.user);

  // ─── Data fetching ──────────────────────────────────────────────────
  const {
    data: article,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetArticleBySlugQuery({ slug });

  const {
    data: relatedArticles,
    isLoading: relatedLoading,
  } = useGetRelatedArticlesQuery(
    { articleId: article?.id || '', limit: 5 },
    { skip: !article?.id },
  );

  const {
    data: commentsData,
    isLoading: commentsLoading,
    refetch: refetchComments,
  } = useGetCommentsQuery(
    { articleId: article?.id || '', page: 1, pageSize: 20 },
    { skip: !article?.id },
  );

  const [createComment, { isLoading: isSubmittingComment }] =
    useCreateCommentMutation();

  // ─── Local state ────────────────────────────────────────────────────
  const [isBookmarked, setIsBookmarked] = useState(
    article ? !!bookmarkedIds[article.id] : false,
  );
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [replyTo, setReplyTo] = useState<{
    commentId: string;
    author: string;
  } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [showAuthorForm, setShowAuthorForm] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Like animation
  const likeScale = useRef(new Animated.Value(1)).current;

  // Sync bookmark state
  React.useEffect(() => {
    if (article) {
      setIsBookmarked(!!bookmarkedIds[article.id]);
    }
  }, [article, bookmarkedIds]);

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleBookmark = useCallback(() => {
    if (!article) return;
    dispatch(toggleBookmarkOptimistic(article.id));
    setIsBookmarked(prev => !prev);
    // TODO: Call API to persist bookmark (optimistic update handled by Redux)
  }, [article, dispatch]);

  const handleLike = useCallback(() => {
    Animated.sequence([
      Animated.timing(likeScale, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(likeScale, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 12,
      }),
    ]).start();
  }, [likeScale]);

  const handleShare = useCallback(async () => {
    if (!article) return;
    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\n${article.excerpt}`,
        url: `https://tarsierlabs.com/blog/${article.slug}`,
      });
    } catch {
      // User cancelled share
    }
  }, [article]);

  const handleReply = useCallback((commentId: string, author: string) => {
    setReplyTo({ commentId, author });
    setShowCommentInput(true);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
    setCommentText('');
  }, []);

  const handleSubmitComment = useCallback(async () => {
    if (!article || !commentText.trim()) return;

    if (!user && !authorName.trim()) {
      setShowAuthorForm(true);
      return;
    }

    try {
      await createComment({
        articleId: article.id,
        content: commentText.trim(),
        author: user?.nickname || authorName.trim() || 'Anonymous',
        email: user?.email || authorEmail || undefined,
        parentId: replyTo?.commentId || undefined,
      }).unwrap();

      setCommentText('');
      setReplyTo(null);
      setShowCommentInput(false);
      refetchComments();
    } catch {
      // Error handling via RTK Query
    }
  }, [
    article,
    commentText,
    user,
    authorName,
    authorEmail,
    replyTo,
    createComment,
    refetchComments,
  ]);

  const handleRelatedArticlePress = useCallback(
    (relatedArticle: FrontendArticle) => {
      navigation.replace('ArticleDetail', {
        slug: relatedArticle.slug,
        articleId: relatedArticle.id,
      });
    },
    [navigation],
  );

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack />
        <ArticleDetailSkeleton />
      </View>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────

  if (isError || !article) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack />
        <EmptyState
          icon="alert-circle"
          title="Failed to load article"
          description={(error as any)?.data?.message || 'An error occurred'}
          primaryAction={{ label: 'Retry', onPress: refetch }}
          secondaryAction={{
            label: 'Go back',
            onPress: () => navigation.goBack(),
          }}
        />
      </View>
    );
  }

  // ─── Format date ─────────────────────────────────────────────────────

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // ─── Extract image URL with fallback ────────────────────────────────

  const coverImageUrl =
    article.meta?.images?.large?.webp ||
    article.meta?.images?.large?.jpg ||
    article.coverImage ||
    '';

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showBack />

      <NetworkStatusBar />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={{
            paddingBottom: insets.bottom + spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Cover Image ─────────────────────────────────────────── */}
          {coverImageUrl ? (
            <View style={styles.coverImageContainer}>
              <View
                style={[
                  styles.coverImagePlaceholder,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Text
                  style={[
                    styles.coverImageText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {article.title.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>
          ) : null}

          {/* ─── Article Header ──────────────────────────────────────── */}
          <View style={styles.articleHeader}>
            {/* Category badge */}
            {article.category && (
              <TouchableOpacity
                style={[
                  styles.categoryBadge,
                  { backgroundColor: colors.primary + '15' },
                ]}
              >
                <Text
                  style={[
                    styles.categoryBadgeText,
                    { color: colors.primary },
                  ]}
                >
                  {article.category.name}
                </Text>
              </TouchableOpacity>
            )}

            {/* Title */}
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                  fontFamily: typography.h2.fontFamily,
                  fontSize: typography.h2.fontSize,
                  fontWeight: typography.h2.fontWeight,
                },
              ]}
            >
              {article.title}
            </Text>

            {/* Author & date */}
            <View style={styles.metaRow}>
              {article.author && (
                <View style={styles.authorContainer}>
                  <View
                    style={[
                      styles.authorAvatar,
                      { backgroundColor: colors.primary + '30' },
                    ]}
                  >
                    <Text
                      style={[styles.authorInitial, { color: colors.primary }]}
                    >
                      {article.author.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.authorName,
                      { color: colors.text },
                    ]}
                  >
                    {article.author.name}
                  </Text>
                </View>
              )}
              <Text
                style={[
                  styles.dateText,
                  { color: colors.textSecondary },
                ]}
              >
                {formatDate(article.publishedAt || article.updatedAt)}
              </Text>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <SvgIcon name="eye" size={16} color={colors.textSecondary} />
                <Text
                  style={[styles.statText, { color: colors.textSecondary }]}
                >
                  {article.views.toLocaleString()}
                </Text>
              </View>
              <View style={styles.stat}>
                <SvgIcon name="heart" size={16} color={colors.textSecondary} />
                <Text
                  style={[styles.statText, { color: colors.textSecondary }]}
                >
                  {article.likes}
                </Text>
              </View>
              <View style={styles.stat}>
                <SvgIcon name="message-circle" size={16} color={colors.textSecondary} />
                <Text
                  style={[styles.statText, { color: colors.textSecondary }]}
                >
                  {article.commentsCount}
                </Text>
              </View>
              <View style={styles.stat}>
                <SvgIcon name="clock" size={16} color={colors.textSecondary} />
                <Text
                  style={[styles.statText, { color: colors.textSecondary }]}
                >
                  {formatDate(article.publishedAt || article.updatedAt)}
                </Text>
              </View>
            </View>

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {article.tags.map(tag => (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.tag,
                      { backgroundColor: colors.surface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      #{tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ─── Action Bar ──────────────────────────────────────────── */}
          <View
            style={[
              styles.actionBar,
              {
                borderTopColor: colors.border,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleLike}
              style={styles.actionButton}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <SvgIcon
                  name="heart"
                  size={22}
                  color={colors.textSecondary}
                />
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBookmark}
              style={styles.actionButton}
            >
              <SvgIcon
                name="bookmark"
                size={22}
                color={isBookmarked ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowCommentInput(true)}
              style={styles.actionButton}
            >
              <SvgIcon
                name="message-circle"
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              style={styles.actionButton}
            >
              <SvgIcon
                name="share"
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* ─── Article Content (Markdown) ──────────────────────────── */}
          <View style={styles.contentContainer}>
            <MarkdownRenderer content={article.contentMd || article.content || ''} />
          </View>

          {/* ─── Related Articles ────────────────────────────────────── */}
          {relatedArticles && relatedArticles.length > 0 && (
            <View style={styles.relatedSection}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.text },
                ]}
              >
                Related Articles
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.relatedList}
              >
                {relatedArticles.map(related => (
                  <View
                    key={related.id}
                    style={{ width: screenWidth * 0.7, marginRight: spacing.sm }}
                  >
                    <ArticleCard
                      article={related}
                      onPress={handleRelatedArticlePress}
                      compact
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ─── Comments Section ─────────────────────────────────────── */}
          <View style={styles.commentsSection}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text },
              ]}
            >
              Comments ({article.commentsCount})
            </Text>

            {commentsLoading ? (
              <View style={styles.commentsLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : commentsData?.items && commentsData.items.length > 0 ? (
              commentsData.items.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onReply={handleReply}
                />
              ))
            ) : (
              <EmptyState
                icon="message-circle"
                title="No comments yet"
                description="Be the first to share your thoughts"
                primaryAction={{
                  label: 'Write a comment',
                  onPress: () => setShowCommentInput(true),
                }}
              />
            )}
          </View>
        </ScrollView>

        {/* ─── Comment Input (bottom) ────────────────────────────────── */}
        {showCommentInput && (
          <View
            style={[
              styles.commentInputContainer,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, spacing.sm),
              },
            ]}
          >
            {replyTo && (
              <View style={styles.replyIndicator}>
                <Text
                  style={[
                    styles.replyText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Replying to {replyTo.author}
                </Text>
                <TouchableOpacity onPress={handleCancelReply}>
                  <SvgIcon
                    name="x"
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            )}

            {showAuthorForm && !user && (
              <View style={styles.authorForm}>
                <TextInput
                  style={[
                    styles.authorInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Your name *"
                  placeholderTextColor={colors.textSecondary}
                  value={authorName}
                  onChangeText={setAuthorName}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[
                    styles.authorInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Email (optional)"
                  placeholderTextColor={colors.textSecondary}
                  value={authorEmail}
                  onChangeText={setAuthorEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            )}

            <View style={styles.commentInputRow}>
              <TextInput
                style={[
                  styles.commentInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    fontFamily: typography.base.fontFamily,
                    fontSize: typography.base.fontSize,
                  },
                ]}
                placeholder={
                  replyTo
                    ? `Reply to ${replyTo.author}...`
                    : 'Write a comment...'
                }
                placeholderTextColor={colors.textSecondary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                onPress={handleSubmitComment}
                disabled={
                  !commentText.trim() || isSubmittingComment
                }
                style={[
                  styles.sendButton,
                  {
                    backgroundColor:
                      commentText.trim() && !isSubmittingComment
                        ? colors.primary
                        : colors.surface,
                  },
                ]}
              >
                {isSubmittingComment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <SvgIcon
                    name="arrow-right"
                    size={20}
                    color={
                      commentText.trim()
                        ? '#FFFFFF'
                        : colors.textSecondary
                    }
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  coverImageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  coverImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImageText: {
    fontSize: 64,
    fontWeight: '700',
  },
  articleHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    marginBottom: spacing.sm,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    lineHeight: 36,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  authorInitial: {
    fontSize: 13,
    fontWeight: '600',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  actionButton: {
    padding: spacing.sm,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
  },
  relatedSection: {
    marginTop: spacing.xl,
    paddingLeft: spacing.lg,
  },
  sectionTitle: {
    fontFamily: typography.h4.fontFamily,
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight,
    marginBottom: spacing.sm,
  },
  relatedList: {
    paddingRight: spacing.lg,
  },
  commentsSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  commentsLoading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  commentInputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  replyIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  replyText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  authorForm: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  authorInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 14,
    height: 40,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ArticleDetailScreen;
