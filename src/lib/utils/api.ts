/**
 * API utility helpers
 *
 * Shared utilities for API error handling, response parsing,
 * and other common API patterns.
 */

import { logger } from '@/lib/logger';

// ─── Types ─────────────────────────────────────────────────────────────

/** Standard API error shape returned by the backend */
export interface ApiError {
  message: string;
  statusCode?: number;
  errors?: Record<string, string[]>;
}

/** Generic API success response wrapper */
export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

// ─── Error handling ────────────────────────────────────────────────────

/**
 * Extract a user-friendly error message from an unknown API error.
 *
 * Handles strings, Error objects, ApiError shapes, and generic objects.
 * Returns a fallback message when nothing matches.
 *
 * @example
 * const message = getApiErrorMessage(error);
 * toast.show(message);
 */
export function getApiErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;

    // RTK Query error shape
    if (typeof err.data === 'object' && err.data !== null) {
      const data = err.data as Record<string, unknown>;
      if (typeof data.message === 'string') {
        return data.message;
      }
    }

    // Standard API error shape
    if (typeof err.message === 'string') {
      return err.message;
    }
    if (typeof err.error === 'string') {
      return err.error;
    }

    // Axios/fetch error shape
    if (typeof err.statusText === 'string') {
      return err.statusText;
    }
  }

  logger.warn('[API] Unknown error format:', error);
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Log an API error to the logger with context.
 *
 * @example
 * handleApiError(error, 'Failed to load articles');
 */
export function handleApiError(
  error: unknown,
  context: string,
  extra?: Record<string, unknown>,
): string {
  const message = getApiErrorMessage(error);
  logger.error(`[API] ${context}: ${message}`, { error, ...extra });
  return message;
}

// ─── Response parsing ──────────────────────────────────────────────────

/**
 * Safely parse a JSON string with a fallback value.
 *
 * @example
 * const data = safeJsonParse(raw, defaultData);
 */
export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Extract pagination info from an API response.
 *
 * @example
 * const { items, totalPages } = extractPagination(response);
 */
export function extractPagination<T>(response: unknown): {
  items: T[];
  totalPages: number;
  total: number;
} {
  const defaultPagination = { items: [] as T[], totalPages: 0, total: 0 };

  if (!response || typeof response !== 'object') {
    return defaultPagination;
  }

  const data = (response as Record<string, unknown>).data as
    | Record<string, unknown>
    | undefined;

  if (!data) {
    return defaultPagination;
  }

  return {
    items: (data.items as T[]) || [],
    totalPages: (data.totalPages as number) || 0,
    total: (data.total as number) || 0,
  };
}

// ─── Retry / debounce ──────────────────────────────────────────────────

/**
 * Simple retry wrapper for async operations.
 *
 * @example
 * const data = await retry(() => fetchData(), { maxRetries: 3 });
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; delayMs?: number },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const delayMs = options?.delayMs ?? 1000;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        logger.debug(
          `[API] Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`,
        );
        await new Promise<void>(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
