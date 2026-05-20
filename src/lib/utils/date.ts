/**
 * Date formatting and grouping utilities
 *
 * Centralizes all date-related formatting to avoid inline duplication
 * across screens (ArticleDetailScreen, ArchiveScreen, etc.)
 */

/**
 * Month names for archive grouping and display
 */
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Short month names
 */
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Safely create a Date object from a string, with fallback
 */
function safeParseDate(dateString: string): Date | null {
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Format an ISO date string to a human-readable format.
 *
 * @example formatDate('2024-01-15') // "January 15, 2024"
 *
 * Used in: ArticleDetailScreen, ArticleCard, ArchiveScreen
 */
export function formatDate(
  dateString: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = safeParseDate(dateString);
  if (!date) {
    return dateString;
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  });
}

/**
 * Format an ISO date string to a short format.
 *
 * @example formatShortDate('2024-01-15') // "Jan 15, 2024"
 *
 * Used in: ArticleCard timestamps, comment dates
 */
export function formatShortDate(dateString: string): string {
  const date = safeParseDate(dateString);
  if (!date) {
    return dateString;
  }

  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Format an ISO date string to relative time.
 *
 * @example formatRelativeTime('2024-01-15T10:00:00Z') // "2 hours ago"
 *
 * Used in: CommentItem timestamps, article meta
 */
export function formatRelativeTime(dateString: string): string {
  const date = safeParseDate(dateString);
  if (!date) {
    return dateString;
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  if (diffWeeks < 5) {
    return `${diffWeeks}w ago`;
  }
  if (diffMonths < 12) {
    return `${diffMonths}mo ago`;
  }
  return formatShortDate(dateString);
}

/**
 * Format an ISO date string to "YYYY-MM-DD" format.
 *
 * @example formatISODate('2024-01-15T10:00:00Z') // "2024-01-15"
 *
 * Used in: API params, date comparisons
 */
export function formatISODate(dateString: string): string {
  const date = safeParseDate(dateString);
  if (!date) {
    return dateString;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the year from an ISO date string.
 */
export function getYear(dateString: string): number {
  const date = safeParseDate(dateString);
  return date ? date.getFullYear() : 0;
}

/**
 * Get the month index (0-11) from an ISO date string.
 */
export function getMonthIndex(dateString: string): number {
  const date = safeParseDate(dateString);
  return date ? date.getMonth() : 0;
}

/**
 * Get the month name from an ISO date string.
 */
export function getMonthName(dateString: string): string {
  const date = safeParseDate(dateString);
  return date ? MONTH_NAMES[date.getMonth()] : '';
}

/**
 * Extract the date field from an article-like object.
 * Falls back to `updatedAt` if `publishedAt` is not available.
 */
export function getArticleDate<
  T extends { publishedAt?: string; updatedAt?: string },
>(article: T): string {
  return article.publishedAt || article.updatedAt || '';
}

/**
 * Group articles by year → month for archive view.
 *
 * The source of this logic is ArchiveScreen.tsx.
 * Returns an array suitable for use with SectionList.
 *
 * @example
 * const sections = groupArticlesByYearMonth(articles);
 * // [
 * //   { title: "2024", data: [{ month: "January", monthIndex: 0, articles: [...] }] },
 * //   ...
 * // ]
 */
export function groupArticlesByYearMonth<
  T extends { publishedAt?: string; updatedAt?: string },
>(
  articles: T[],
): Array<{
  title: string;
  data: Array<{
    month: string;
    monthIndex: number;
    articles: T[];
  }>;
}> {
  if (!articles?.length) {
    return [];
  }

  const grouped: Record<number, Record<number, T[]>> = {};

  articles.forEach(article => {
    const dateStr = getArticleDate(article);
    const date = safeParseDate(dateStr);
    if (!date) {
      return;
    }

    const year = date.getFullYear();
    const month = date.getMonth();

    if (!grouped[year]) {
      grouped[year] = {};
    }
    if (!grouped[year][month]) {
      grouped[year][month] = [];
    }
    grouped[year][month].push(article);
  });

  return Object.entries(grouped)
    .sort(([a], [b]) => Number(b) - Number(a)) // Descending years
    .map(([yearStr, months]) => {
      const year = Number(yearStr);
      const monthEntries = Object.entries(months)
        .sort(([a], [b]) => Number(b) - Number(a)) // Descending months
        .map(([monthStr, groupedArticles]) => ({
          month: MONTH_NAMES[Number(monthStr)],
          monthIndex: Number(monthStr),
          articles: groupedArticles,
        }));

      return {
        title: String(year),
        data: monthEntries,
      };
    });
}
