import { useAppLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
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
  Animated,
  InteractionManager,
  Alert,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewRef,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModeColors, spacing, typography } from '@/lib/theme';
import {
  useGetArticleBySlugQuery,
  useGetRelatedArticlesQuery,
} from '@/api/endpoints/articles';
import {
  useCreateCommentMutation,
  useFlagCommentMutation,
  useBlockUserMutation,
} from '@/api/endpoints/comments';
import { useCommentsInfiniteQuery } from '@/lib/hooks/useCommentsInfiniteQuery';
import { useCommentSSE } from '@/lib/hooks/useCommentSSE';
import { useAppSelector, useAppDispatch } from '@/store';
import { toggleBookmarkOptimistic } from '@/store/slices/bookmarksSlice';
import { toggleLikeOptimistic } from '@/store/slices/likesSlice';
import {
  useAddBookmarkMutation,
  useRemoveBookmarkMutation,
} from '@/api/endpoints/bookmarks';
import {
  useLikeArticleMutation,
  useUnlikeArticleMutation,
} from '@/api/endpoints/likes';
import { shareArticle } from '@/lib/utils/share';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer';
import { CommentItem } from '@/components/blog/CommentItem';
import { ArticleCard } from '@/components/blog/ArticleCard';
import Header from '@/components/layout/Header';
import { NetworkStatusBar } from '@/components/core/NetworkStatusBar';
import { ArticleDetailSkeleton } from '@/components/core/Skeleton';
import { EmptyState } from '@/components/core/EmptyState';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import SvgIcon from '@/components/core/SvgIcon';
import type { RootStackScreenProps } from '@/navigation/types';
import type { FrontendArticle } from '@/types/frontend-blog';
import type { Comment } from '@/types/blog';

const ArticleDetailScreen: React.FC<RootStackScreenProps<'ArticleDetail'>> = ({
  navigation,
  route,
}) => {
  const { slug } = route.params;
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { width: screenWidth } = useWindowDimensions();
  const { t } = useTranslation();
  const appLanguage = useAppLanguage();
  const lang = route.params?.locale ?? appLanguage;

  // ─── Redux ──────────────────────────────────────────────────────────
  const dispatch = useAppDispatch();
  const bookmarkedIds = useAppSelector(state => state.bookmarks.bookmarkedIds);
  const likedIds = useAppSelector(state => state.likes.likedIds);
  const user = useAppSelector(state => state.auth.user);

  // ─── Data fetching ──────────────────────────────────────────────────
  const {
    data: article,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetArticleBySlugQuery({ slug, lang });

  const { data: relatedArticles } = useGetRelatedArticlesQuery(
    { articleId: article?.id || '', limit: 5, lang },
    { skip: !article?.id },
  );

  // ─── Comments (infinite scroll + SSE) ────────────────────────────────
  // Note: comments API expects a slug, not a database ID
  //
  // Progressive loading: comments are deferred until after the navigation
  // transition has fully settled (InteractionManager).
  // This prevents the slow comments API (~1400ms) from blocking the UI on
  // screen entry.  We intentionally do NOT wait for the article query to
  // resolve first — the slug is available immediately from route.params, so
  // we can start the comments request in parallel with the article request,
  // right after the animation completes.
  const [commentsEnabled, setCommentsEnabled] = useState(false);

  // Reset and re-enable comments whenever the slug changes (new article).
  // InteractionManager fires after navigation animation + all queued JS
  // interactions settle, so the UI is already interactive by then.
  React.useEffect(() => {
    setCommentsEnabled(false);
    const task = InteractionManager.runAfterInteractions(() => {
      setCommentsEnabled(true);
    });
    return () => task.cancel();
  }, [slug]);

  const commentsQuery = useCommentsInfiniteQuery(slug, {
    enabled: commentsEnabled,
  });
  useCommentSSE(slug);

  const [createComment, { isLoading: isSubmittingComment }] =
    useCreateCommentMutation();
  const [flagComment] = useFlagCommentMutation();
  const [blockUser] = useBlockUserMutation();

  // ─── Local state ────────────────────────────────────────────────────
  const [isBookmarked, setIsBookmarked] = useState(
    article ? !!bookmarkedIds[article.id] : false,
  );
  const [isLiked, setIsLiked] = useState(
    article ? !!likedIds[article.id] : false,
  );
  const [replyTo, setReplyTo] = useState<{
    commentId: string;
    author: string;
  } | null>(null);
  const [commentText, setCommentText] = useState('');
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  // ─── Bookmark mutations ───────────────────────────────────────────────
  const [addBookmark] = useAddBookmarkMutation();
  const [removeBookmark] = useRemoveBookmarkMutation();

  // ─── Like mutations ───────────────────────────────────────────────────
  const [likeArticle] = useLikeArticleMutation();
  const [unlikeArticle] = useUnlikeArticleMutation();

  // Like animation
  const likeScale = useRef(new Animated.Value(1)).current;

  // Sync bookmark state
  React.useEffect(() => {
    if (article) {
      setIsBookmarked(!!bookmarkedIds[article.id]);
    }
  }, [article, bookmarkedIds]);

  // Sync like state
  React.useEffect(() => {
    if (article) {
      setIsLiked(!!likedIds[article.id]);
    }
  }, [article, likedIds]);

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleBookmark = useCallback(() => {
    if (!article) {
      return;
    }
    const newIsBookmarked = !isBookmarked;
    // Optimistic local update
    dispatch(toggleBookmarkOptimistic(article.id));
    setIsBookmarked(newIsBookmarked);
    // Persist to server
    if (newIsBookmarked) {
      addBookmark({ articleId: article.id }).catch(() => {
        // Rollback on failure — revert optimistic update
        dispatch(toggleBookmarkOptimistic(article.id));
        setIsBookmarked(false);
      });
    } else {
      removeBookmark({ articleId: article.id }).catch(() => {
        // Rollback on failure
        dispatch(toggleBookmarkOptimistic(article.id));
        setIsBookmarked(true);
      });
    }
  }, [article, dispatch, isBookmarked, addBookmark, removeBookmark]);

  const handleLike = useCallback(() => {
    if (!article) {
      return;
    }
    const newIsLiked = !isLiked;
    // Optimistic local update
    dispatch(toggleLikeOptimistic(article.id));
    setIsLiked(newIsLiked);
    // Animation
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
    // Persist to server
    // Note: backend uses slug (URL-friendly string), not database UUID
    if (newIsLiked) {
      likeArticle({ slug: article.slug }).catch(() => {
        // Rollback on failure
        dispatch(toggleLikeOptimistic(article.id));
        setIsLiked(false);
      });
    } else {
      unlikeArticle({ slug: article.slug }).catch(() => {
        // Rollback on failure
        dispatch(toggleLikeOptimistic(article.id));
        setIsLiked(true);
      });
    }
  }, [article, dispatch, isLiked, likeScale, likeArticle, unlikeArticle]);

  const handleShare = useCallback(async () => {
    if (!article) {
      return;
    }
    await shareArticle(article, lang);
  }, [article, lang]);

  const handleReply = useCallback(
    (comment: Comment) => {
      if (!user) {
        navigation.navigate('Auth');
        return;
      }
      setReplyTo({ commentId: comment.id, author: comment.author });
    },
    [user, navigation],
  );

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
    setCommentText('');
  }, []);

  const handleSubmitComment = useCallback(async () => {
    if (!article || !commentText.trim()) {
      return;
    }

    if (!user) {
      navigation.navigate('Auth');
      return;
    }

    try {
      const result = await createComment({
        articleId: slug,
        content: commentText.trim(),
        parentId: replyTo?.commentId || undefined,
      }).unwrap();

      // Insert into the correct position based on whether it's a reply or top-level
      if (replyTo?.commentId) {
        // Reply: insert into parent comment's children array
        commentsQuery.addReply(replyTo.commentId, result);
      } else {
        // Top-level comment: insert at the top of the list
        commentsQuery.prependComment(result);
      }

      setCommentText('');
      setReplyTo(null);
      scrollRef.current?.scrollToEnd({ animated: false });
    } catch (submissionError) {
      console.warn('[Comment] Failed to submit comment:', submissionError);
    }
  }, [
    article,
    commentText,
    user,
    replyTo,
    createComment,
    navigation,
    slug,
    commentsQuery,
  ]);

  // ─── Flag & Block handlers ────────────────────────────────────────

  const handleFlagComment = useCallback(
    async (comment: Comment) => {
      try {
        await flagComment({ commentId: comment.id }).unwrap();
        Alert.alert(t('common.success'), t('comment.flagSuccess'));
      } catch {
        Alert.alert(t('common.error'), t('comment.flagFailed'));
      }
    },
    [flagComment, t],
  );

  const handleBlockUser = useCallback(
    async (comment: Comment) => {
      try {
        await blockUser({ commentId: comment.id }).unwrap();
        // Instantly remove all comments by this author from UI
        commentsQuery.removeCommentsByAuthor(comment.author);
        Alert.alert(t('common.success'), t('comment.blockSuccess'));
      } catch {
        Alert.alert(t('common.error'), t('comment.blockFailed'));
      }
    },
    [blockUser, commentsQuery, t],
  );

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
        <Header showBack hideSearch hideSettings />
        <ArticleDetailSkeleton />
      </View>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────

  if (isError || !article) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack hideSearch hideSettings />
        <EmptyState
          icon="alert-circle"
          title={t('article.error.loadFailedSingle')}
          description={
            (error as any)?.data?.message || t('article.error.generic')
          }
          primaryAction={{ label: t('common.retry'), onPress: refetch }}
          secondaryAction={{
            label: t('common.goBack'),
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              }
            },
          }}
        />
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showBack hideSearch hideSettings />

      <NetworkStatusBar />

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
                style={[styles.categoryBadgeText, { color: colors.primary }]}
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

          {/* Author */}
          <View style={styles.metaRow}>
            {article.author?.name && (
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
                    {article.author.name?.charAt(0)?.toUpperCase() ?? ''}
                  </Text>
                </View>
                <Text style={[styles.authorName, { color: colors.text }]}>
                  {article.author.name}
                </Text>
              </View>
            )}
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <SvgIcon name="eye" size={16} color={colors.textSecondary} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {article.views.toLocaleString()}
              </Text>
            </View>
            <View style={styles.stat}>
              <SvgIcon name="heart" size={16} color={colors.textSecondary} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {article.likes}
              </Text>
            </View>
            <View style={styles.stat}>
              <SvgIcon
                name="message-circle"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {article.commentsCount}
              </Text>
            </View>
          </View>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {article.tags.map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.tag, { backgroundColor: colors.surface }]}
                >
                  <Text
                    style={[styles.tagText, { color: colors.textSecondary }]}
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
          <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <SvgIcon
                name="heart"
                size={22}
                color={isLiked ? colors.primary : colors.textSecondary}
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
            onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
            style={styles.actionButton}
          >
            <SvgIcon
              name="message-circle"
              size={22}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
            <SvgIcon name="share" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ─── Article Content (Markdown) ──────────────────────────── */}
        <View style={styles.contentContainer}>
          <MarkdownRenderer
            content={article.contentMd || article.content || ''}
          />
        </View>

        {/* ─── Related Articles ────────────────────────────────────── */}
        {relatedArticles && relatedArticles.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Related Articles
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedList}
            >
              {relatedArticles.map(related => (
                <View key={related.id} style={{ width: screenWidth * 0.7 }}>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Comments ({article.commentsCount})
          </Text>

          {!commentsEnabled ? (
            /* Deferred: show subtle loading indicator while waiting for
               navigation transition + InteractionManager to settle */
            <View style={styles.commentsDeferredPlaceholder}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : commentsQuery.error ? (
            <View style={styles.commentsError}>
              <Text style={[styles.commentsErrorText, { color: colors.error }]}>
                {t('common.loadFailed')}
              </Text>
              <TouchableOpacity onPress={commentsQuery.reload}>
                <Text style={[styles.retryText, { color: colors.primary }]}>
                  {t('common.retry')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : commentsQuery.items.length > 0 ? (
            <>
              {commentsQuery.items.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onReply={handleReply}
                  onFlag={handleFlagComment}
                  onBlock={handleBlockUser}
                  isAuthenticated={!!user}
                  articleId={slug}
                  onNavigateToAuth={() => navigation.navigate('Auth')}
                />
              ))}
              {commentsQuery.hasMore && (
                <TouchableOpacity
                  onPress={commentsQuery.loadMore}
                  style={styles.loadMoreButton}
                  disabled={commentsQuery.isLoadingMore}
                >
                  {commentsQuery.isLoadingMore ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text
                      style={[styles.loadMoreText, { color: colors.primary }]}
                    >
                      {t('common.loadMore')}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          ) : (
            <EmptyLogoContent
              title={t('comment.noComments')}
              description={t('comment.beFirst')}
            />
          )}
        </View>
      </KeyboardAwareScrollView>

      {/* ─── Floating Comment Input ────────────────────────────────── */}
      <KeyboardStickyView
        offset={{ closed: 0, opened: 0 }}
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
            <Text style={[styles.replyText, { color: colors.textSecondary }]}>
              Replying to {replyTo.author}
            </Text>
            <TouchableOpacity onPress={handleCancelReply}>
              <SvgIcon name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {!user && (
          <View style={styles.loginPrompt}>
            <Text
              style={[styles.loginPromptText, { color: colors.textSecondary }]}
            >
              {t('comment.loginToComment')}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Auth')}
              style={[
                styles.loginPromptButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.loginPromptButtonText}>
                {t('auth.login.title')}
              </Text>
            </TouchableOpacity>
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
              replyTo ? `Reply to ${replyTo.author}...` : 'Write a comment...'
            }
            placeholderTextColor={colors.textSecondary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || isSubmittingComment}
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
                color={commentText.trim() ? '#FFFFFF' : colors.textSecondary}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>
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
  coverImage: {
    width: '100%',
    height: '100%',
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
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  commentsSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  commentsDeferredPlaceholder: {
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
  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  loginPromptText: {
    fontSize: 13,
    flex: 1,
    marginRight: spacing.sm,
  },
  loginPromptButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 8,
  },
  loginPromptButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  commentsError: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  commentsErrorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadMoreButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '500',
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
