# Design Token System Analysis

Source: [`src/lib/theme/design_tokens.g.ts`](src/lib/theme/design_tokens.g.ts) (1455 lines, auto-generated from [`assets/variables.tokens.json`](assets/variables.tokens.json))

---

## 1. TokensLight — Light mode colors (lines 15–396)

**~190 color tokens** across these groups:

| Group | Count | Examples |
|-------|-------|---------|
| `text*` | 18 | `textPrimary: '#181d27'`, `textTertiary: '#535862'`, `textBrandPrimary: '#fc7701'` |
| `border*` | 9 | `borderSecondary: '#e9eaeb'`, `borderBrand: '#fc7701'`, `borderPrimary: '#d5d7da'` |
| `bg*` | 28 | `bgPrimary: '#ffffff'`, `bgBrandSolid: '#fc7701'`, `bgSecondary: '#fafafa'`, `bgOverlay: '#0a0d12'` |
| `fg*` | 19 | `fgPrimary: '#181d27'`, `fgBrandPrimary: '#fc7701'`, `fgTertiary: '#535862'` |
| `shadow*` | 22 | `shadowXs` through `shadowGridMd` — all rgba shadow colors |
| `focus*` | 2 | `focusRing: '#fc7701'`, `focusRingError: '#f04438'` |
| `utility*` | ~60 | `utilityBrand500: '#fc7701'`, `utilityGray700: '#414651'`, branded utility colors for accessories, errors, warnings, info |
| `button*` | ~40 | `buttonPrimaryBg: '#fc7701'`, `buttonSecondaryBorder: '#d5d7da'`, all button role colors |
| Component | ~30 | `avatar*`, `breadcrumb*`, `icon*`, `nav*`, `slider*`, `header*`, `footer*`, `toggle*`, `tooltip*`, `wysiwyg*` |
| `alpha*` | 22 | `alphaWhite90` through `alphaBlack2` — white/black alpha overlays |

**Key brand colors in light mode:**
- `utilityBrand500: '#fc7701'` ← main brand primary
- `textBrandPrimary: '#fc7701'`
- `fgBrandPrimary: '#fc7701'`
- `bgBrandSolid: '#fc7701'`
- `borderBrand: '#fc7701'`
- `buttonPrimaryBg: '#fc7701'`

---

## 2. TokensDark — Dark mode colors (lines 406–787)

Same ~190 tokens, but with dark-adapted values.

**Key brand colors in dark mode:**
- `utilityBrand500: '#fc7701'` (brand stays same)
- `textBrandPrimary: '#fc7701'`
- `bgBrandSolid: '#fc7701'`
- `bgBrandPrimary: '#511c10'` (darkened background)
- `borderBrand: '#f38744'` (softer border in dark)

---

## 3. `front` — Static tokens (lines 805–903)

**~97 tokens** that don't change with theme:

| Group | Count | Values |
|-------|-------|--------|
| `spacing*` | 18 | none(0), xxs(2), xs(4), sm(6), md(8), lg(12), xl(16), 2xl(20), 3xl(24), 4xl(32), 5xl(40), 6xl(48), 7xl(64), 8xl(80), 9xl(96), 10xl(128), 11xl(160) |
| `radius*` | 11 | none(0), xxs(2), xs(4), sm(6), md(8), lg(10), xl(12), 2xl(16), 3xl(20), 4xl(24), full(9999) |
| `text*` | 13 | 3xs(8), 2xs(10), xs(12), sm(14), md(16), lg(18), xl(20), displayXs(24), displaySm(30), displayMd(36), displayLg(48), displayXl(60), display2xl(72) |
| `leading*` | 13 | 3xs(10), 2xs(14), xs(18), sm(20), md(24), lg(28), xl(30), displayXs(32), displaySm(38), displayMd(44), displayLg(60), displayXl(72), display2xl(90) |
| `width*` | 11 | xs(384) through 6xl(1920) |
| `container*` | 3 | maxWidthDesktop(1280), paddingDesktop(32), paddingMobile(16) |
| `fontFamily*` | 2 | display:'Inter', body:'Inter' |
| `fontWeight*` | 10 | regular, regularItalic, medium, semibold, extraBold, black, etc. |

---

## 4. Primitive color families (lines 917–end)

Backward-compatible exports of raw color scales:

| Family | Scale | Brand 500 |
|--------|-------|-----------|
| `primitiveColors_brand` | 25–950 | **`#fc7701`** 🟠 |
| `primitiveColors_base` | white, black, transparent | — |
| `primitiveColors_grayLightMode` | 25–950 | — |
| `primitiveColors_grayBlue` | 25–950 | — |
| `primitiveColors_grayCool` | 25–950 | — |
| `primitiveColors_grayModern` | 25–950 | — |
| `primitiveColors_grayNeutral` | 25–950 | — |
| `primitiveColors_error` | 25–950 | — |
| `primitiveColors_warning` | 25–950 | — |
| `primitiveColors_success` | 25–950 | — |
| `primitiveColors_green` | 25–950 | — |
| (+ more: grayIron, grayTrue, grayWarm, moss, greenLight, teal, cyan, blueLight, blue, blueDark, indigo, violet, purple, fuchsia, pink, rosé, orangeDark, orange, yellow) | | |

---

## 5. How hooks expose tokens

### `useTheme()` (deprecated, backward compat)
Returns `{ mode, isDark, colors }` where `colors` is a flat map with aliases:
```ts
colors.background = colors.bgPrimary
colors.text = colors.textPrimary
colors.primary = colors.utilityBrand500 ?? colors.fgBrandPrimary  // → '#fc7701'
colors.border = colors.borderSecondary
colors.surface = colors.bgSecondary
```

### `useFront()` (recommended for new code)
Returns `{ front, colors }` where:
- `front` = all static tokens (spacing, radius, font sizes, etc.)
- `colors` = raw TokensLight/TokensDark object (not flattened)

### `useModeColors()`
Returns flat `Record<string, string>` of current mode colors (same as `useTheme().colors`).

---

## 6. Key issue: Web app vs Design Token brand color

| Source | primary-500 value |
|--------|------------------|
| **Design tokens** (`variables.tokens.json`) | **`#fc7701`** |
| **Mobile app** (via `useFront/useTheme`) | ✅ Uses `#fc7701` correctly |
| **Web app** (`globals.css`) | ❌ **`#d68a29`** (hardcoded, different palette) |

The web app's entire primary color scale (50–900) is different. The design tokens define the source of truth.
