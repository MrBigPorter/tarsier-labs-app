# Play Store Listing Content — Tarsier

> **App**: Tarsier
> **Package**: `com.tarsier.labs`
> **Purpose**: Fill in Google Play Console Store Listing (Item #13 from [`android-playstore-release-plan.md`](plans/android-playstore-release-plan.md))

---

## 1. Short Description (max 80 chars)

**Chosen (78 chars):**

```
Read, bookmark & discover tech articles. Multi-language, dark mode & more.
```

---

## 2. Full Description (max 4000 chars)

**Copy this into Google Play Console — Full Description field:**

```
Tarsier is a modern, feature-rich blog reader that puts your favorite tech articles at your fingertips. Built with a focus on reading experience, it offers a clean, distraction-free interface with powerful tools to discover, organize, and engage with content.

── KEY FEATURES ──

📖 BROWSE & DISCOVER
  • Infinite scroll article feed with smooth pagination
  • Browse by categories and tags for targeted content discovery
  • Featured articles section showcasing handpicked content
  • Powerful search with recent search history (persisted locally)
  • Pull-to-refresh for the latest content

🔖 BOOKMARKS & OFFLINE
  • Save articles to read later with one tap
  • Optimistic updates — bookmarks save instantly
  • Offline cache support — access your saved content without internet
  • Bookmarks sync seamlessly across devices

💬 COMMENTS & ENGAGEMENT
  • Inline comment system with reply threads
  • Real-time comment updates via SSE (Server-Sent Events)
  • Like articles and show appreciation for content creators
  • Share articles via system share sheet

🌐 MULTI-LANGUAGE SUPPORT
  • Full internationalization with 6 languages:
    English, Chinese (Simplified), Japanese, Korean, French, German
  • Language-specific content fetching from the API
  • Seamless language switching without app restart

🎨 THEMING & UI
  • Dark mode / Light mode with smooth animated transitions
  • Design token system for consistent visual language
  • Spring-based animated tab bar for fluid navigation
  • Adaptive UI — overlays hide on scroll for immersive reading
  • Skeleton loading states for a polished experience

🔐 AUTHENTICATION
  • Secure OAuth 2.0 login: Google, GitHub, and Apple Sign-In
  • Traditional email/password registration with form validation
  • Automatic token refresh with retry logic
  • Keychain-secured credential storage

⚡ PERFORMANCE
  • Image prefetching for instant article card rendering
  • MMKV-powered fast local storage (10x faster than AsyncStorage)
  • Hermes engine for optimized JavaScript performance
  • CodePush over-the-air updates — get new features without app store updates
  • Sentry crash reporting and performance monitoring

── WHAT MAKES TARSIER DIFFERENT ──

Tarsier is not just another RSS reader. It's designed as a complete blog platform experience, integrating seamlessly with a modern backend (NestJS) to provide real-time interactions, multi-language content delivery, and a premium reading experience.

The app showcases clean architecture principles: Redux Toolkit for predictable state management, RTK Query for intelligent API caching with automatic cache invalidation, and React Native Reanimated for silky-smooth 60fps UI thread animations.

── TECHNOLOGY ──

Built with React Native 0.85, TypeScript 5.x, Redux Toolkit 2.x, RTK Query, React Navigation 7.x, React Native Reanimated 4.x, and i18next.

── CONTACT & SUPPORT ──

Developer: Porter
GitHub: github.com/MrBigPorter
Email: mrporterdev@gmail.com
```

**Character count**: ~2300 characters (well within 4000 limit)

---

## 3. Screenshot Guide (for AI generation)

Generate **8 phone screenshots** at **9:16 aspect ratio** (1080×1920px recommended).

| #   | Screen              | Content to Show                                                                                                                          | Key Highlights                                                   |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | **Home Feed**       | Article list with featured hero section at top, article cards below with titles, excerpts, read time, and category chips                 | Clean list layout, featured section, category chips              |
| 2   | **Article Detail**  | A full article being read with rendered Markdown content, estimated read time, author info, and related articles at bottom               | Markdown rendering, reading progress, clean typography           |
| 3   | **Categories**      | Category grid showing article categories as cards with article counts, "Browse all article categories" subtitle                          | Category card grid layout, clean icons                           |
| 4   | **Tags**            | Tag cloud / tag list showing topic tags with article counts                                                                              | Tag browsing, topic discovery                                    |
| 5   | **Bookmarks**       | Saved articles list with bookmark icon indicators, showing article titles and excerpts                                                   | Bookmark management, saved content                               |
| 6   | **Search**          | Search bar with query text, search results showing matching articles, recent searches below                                              | Search functionality, recent search history                      |
| 7   | **Comments**        | Article detail scrolled to comments section showing a thread of comments with reply chains, like buttons on comments                     | Comment system, reply threads, social engagement                 |
| 8   | **Auth / Settings** | Login screen showing OAuth buttons (Google, GitHub, Apple) OR Settings screen showing dark mode toggle, language selector, theme options | OAuth login options, dark/light theme toggle, language selection |

**Design Style**: Dark theme (primary background: `#1a1a2e` to `#0f3460`, accent: `#e94560`/`#ff6b6b`). Use the Tarsier logo and brand colors. Show content in English.

---

## 4. Feature Graphic (1024×500px) — AI生成

Size: **1024×500px**

用 AI 生成一张新的 Feature Graphic，参考以下 Prompt：

> **Prompt (复制给 AI):**
>
> Create a modern mobile app feature graphic for Google Play Store, 1024x500px.
>
> **Brand:** Tarsier — a tech blog reading app.
>
> **Layout:**
>
> - Left side: Large bold text "Tarsier" in white with a subtle tagline below: "Read. Discover. Connect."
> - Below the tagline, show 3 small feature badges/pills: "Multi-language", "Dark Mode", "Bookmarks"
> - A small accent line (pink/red) separating title from badges
> - Right side: A realistic phone mockup showing a dark-mode blog article feed with article cards
>
> **Color scheme:**
>
> - Background: Dark navy blue gradient (#1a1a2e to #0f3460)
> - Accent color: Vibrant pink/red (#e94560)
> - Text: White for main title, light gray for subtitles
> - Phone UI: Dark mode with subtle card backgrounds
>
> **Style:** Clean, modern, premium tech feel. Subtle glow effects or decorative circles for depth. Minimalist.

---

## 5. Category

**Recommended**: **News & Magazines**

> Rationale: The app is a blog reader/aggregator that presents articles from various categories (tech, lifestyle, etc.), similar to news and magazine apps. "Books & Reference" is more suited for dictionary/reference apps or dedicated book readers like Kindle.

---

## 6. Tags

As specified:

| Tag       | Scope                                         |
| --------- | --------------------------------------------- |
| `blog`    | Core functionality — the app is a blog reader |
| `reading` | Primary use case — reading articles           |
| `tech`    | Content focus — tech articles and programming |

---

## 7. Additional Play Console Fields

| Field            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| App Name         | Tarsier                                              |
| Default Language | English (United States)                              |
| App or Game      | App                                                  |
| Free or Paid     | Free                                                 |
| Contains Ads     | No                                                   |
| Content Rating   | Everyone or Teen (complete questionnaire in console) |

---

## Execution Steps

1. Copy short description into Google Play Console
2. Copy full description into Google Play Console
3. Generate 8 screenshots using AI (use guide above) — upload to console
4. Generate 1 Feature Graphic using AI prompt above — upload to console
5. Select category: **News & Magazines**
6. Add tags: **blog**, **reading**, **tech**
7. Fill in additional fields (app name, language, etc.)
8. Complete Data Safety section (see existing plan for details)
9. Complete Content Rating questionnaire
