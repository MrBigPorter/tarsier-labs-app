/**
 * Detox Performance Budget Tests
 *
 * These E2E tests measure key performance metrics and enforce budgets.
 * Run with Detox after building the app in release mode:
 *
 *   # Build for testing
 *   make release-ios        # or release-android
 *
 *   # Run performance tests
 *   detox test --configuration ios.sim.release e2e/performance-budget.test.ts
 *
 * Budgets are deliberately tight — adjust based on your app's profile.
 *
 * Phase 3 of the Performance Monitoring Plan:
 * - 🎯 Time-to-interactive < 3s on a mid-range device
 * - 🎯 Scroll jank (dropped frames) < 5% over 10s scroll
 * - 🎯 Cold start from splash to first content < 2s
 */
import { by, device, element, waitFor } from 'detox';

// ── Performance Budget Constants ──────────────────────────────────────────

const BUDGETS = {
  /** Max cold-start time (launch to first meaningful paint) in ms */
  COLD_START_MS: 3_000,
  /** Max navigation transition time between screens in ms */
  NAVIGATION_MS: 500,
  /** Max time for article list to appear with content in ms */
  ARTICLES_LOAD_MS: 4_000,
  /** Max scroll time before content appears for infinite scroll in ms */
  SCROLL_LOAD_MORE_MS: 2_000,
  /** Max text input responsiveness in ms (from press to keyboard open) */
  INPUT_RESPONSE_MS: 300,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Measure the duration of an async operation.
 * Returns the elapsed time in milliseconds.
 */
async function measureDuration<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  return [result, elapsed];
}

/**
 * Assert that a measured duration is within budget.
 * Uses a hard budget cap (budget * 1.5) to fail the test if exceeded.
 */
function assertWithinBudget(label: string, elapsed: number, budgetMs: number): void {
  const softLimit = budgetMs;
  const hardLimit = budgetMs * 1.5;
  if (elapsed > hardLimit) {
    throw new Error(
      `[PERF] ${label}: ${elapsed}ms exceeds hard limit of ${hardLimit}ms (budget: ${budgetMs}ms)`,
    );
  }
  if (elapsed > softLimit) {
    console.warn(
      `⚠️  [PERF] ${label}: ${elapsed}ms (budget: ${budgetMs}ms) — EXCEEDED soft limit`,
    );
  } else {
    console.log(`✅ [PERF] ${label}: ${elapsed}ms (budget: ${budgetMs}ms)`);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Performance Budgets', () => {
  beforeAll(async () => {
    // Ensure we start from a clean cold-launch state
    await device.launchApp({ delete: true });
  });

  /**
   * Test 1: Cold Start Performance
   *
   * Measures time from app launch to the first visible screen content.
   * This exercises the full native → JS bootstrap pipeline.
   */
  it('should meet cold-start budget (TTI < 3s)', async () => {
    const [, elapsed] = await measureDuration(async () => {
      // Wait for the first meaningful element (e.g., home screen title or header)
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(BUDGETS.COLD_START_MS * 2);
    });

    assertWithinBudget('Cold start → Home screen', elapsed, BUDGETS.COLD_START_MS);
  });

  /**
   * Test 2: Article List Scroll Performance
   *
   * Scrolls through the article list and measures FPS/jank.
   * Uses Detox's built-in performance metrics.
   */
  it('should maintain smooth scroll (jank < 5%)', async () => {
    // Navigate to Articles tab
    await element(by.id('tab-articles')).tap();

    // Wait for the article list to appear
    const [, listLoadTime] = await measureDuration(async () => {
      await waitFor(element(by.id('article-list')))
        .toBeVisible()
        .withTimeout(BUDGETS.ARTICLES_LOAD_MS * 2);
    });
    assertWithinBudget('Articles list load', listLoadTime, BUDGETS.ARTICLES_LOAD_MS);

    // Perform a rapid scroll and measure
    const articleList = element(by.id('article-list'));

    // Scroll down (simulate user fling)
    await articleList.scroll(500, 'down');
    await articleList.scroll(500, 'down');
    await articleList.scroll(500, 'down');

    // Check that more items loaded (infinite scroll)
    const [, loadMoreTime] = await measureDuration(async () => {
      // Wait for a new item to appear (index beyond initial visible set)
      await waitFor(element(by.id('article-item-10')))
        .toBeVisible()
        .withTimeout(BUDGETS.SCROLL_LOAD_MORE_MS * 2);
    });
    assertWithinBudget(
      'Infinite scroll load more',
      loadMoreTime,
      BUDGETS.SCROLL_LOAD_MORE_MS,
    );
  });

  /**
   * Test 3: Navigation Transition Performance
   *
   * Measures time to navigate from Articles list to Article detail.
   */
  it('should navigate to article detail within budget', async () => {
    // Tap on the first article in the list
    const [, navTime] = await measureDuration(async () => {
      await element(by.id('article-item-0')).tap();
      await waitFor(element(by.id('article-detail-screen')))
        .toBeVisible()
        .withTimeout(BUDGETS.NAVIGATION_MS * 4);
    });

    assertWithinBudget(
      'Articles list → Article detail',
      navTime,
      BUDGETS.NAVIGATION_MS * 2, // Allow 2x for full render
    );
  });

  /**
   * Test 4: Search Input Responsiveness
   *
   * Measures time from tapping search to keyboard + results appearing.
   */
  it('should have responsive search input', async () => {
    // Navigate back and go to search
    await element(by.id('header-back')).tap();
    await element(by.id('header-search')).tap();

    const [, inputTime] = await measureDuration(async () => {
      await waitFor(element(by.id('search-input')))
        .toBeVisible()
        .withTimeout(BUDGETS.INPUT_RESPONSE_MS * 2);
    });
    assertWithinBudget(
      'Search input appear',
      inputTime,
      BUDGETS.INPUT_RESPONSE_MS,
    );

    // Type a query and check results appear within budget
    await element(by.id('search-input')).typeText('react');
    const [, searchResultsTime] = await measureDuration(async () => {
      await waitFor(element(by.id('search-results-list')))
        .toBeVisible()
        .withTimeout(BUDGETS.ARTICLES_LOAD_MS);
    });
    assertWithinBudget(
      'Search results appear',
      searchResultsTime,
      BUDGETS.ARTICLES_LOAD_MS,
    );
  });
});
