# Android Blurhash Crash Fix Plan — Fabric/Paper Delegate Type Mismatch

## Status

| Item                | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Crash**           | `ReadableNativeMap cannot be cast to java.lang.Double` |
| **Stack trace**     | `BlurhashViewManagerDelegate.java:45`                  |
| **Library**         | `react-native-blurhash` v2.1.3                         |
| **RN Architecture** | Fabric (New Architecture) — `newArchEnabled=true`      |
| **RN Version**      | 0.85.3                                                 |

---

## Root Cause Analysis

### The Delegate Code

The library ships with a **Paper** (old architecture) delegate at:

[`node_modules/react-native-blurhash/android/src/paper/java/com/facebook/react/viewmanagers/BlurhashViewManagerDelegate.java`](node_modules/react-native-blurhash/android/src/paper/java/com/facebook/react/viewmanagers/BlurhashViewManagerDelegate.java)

This delegate's `setProperty` method performs **unsafe `(Double)` casts** on lines 29, 32, and 35:

```java
case "decodeWidth":                          // line 28
    mViewManager.setDecodeWidth(view, value == null ? 32 : ((Double) value).intValue());  // line 29
    break;                                   // line 30
case "decodeHeight":                         // line 31
    mViewManager.setDecodeHeight(view, value == null ? 32 : ((Double) value).intValue()); // line 32
    break;                                   // line 33
case "decodePunch":                          // line 34
    mViewManager.setDecodePunch(view, value == null ? 1f : ((Double) value).doubleValue()); // line 35
    break;                                   // line 36
```

When running with **Fabric (New Architecture)**, the UIManager calls this same `setProperty` method but passes values from a `ReadableNativeMap`. If one of these numeric blurhash props (`decodeWidth`, `decodeHeight`, `decodePunch`) receives a non-numeric value (like a `ReadableNativeMap` object), the cast `(Double) value` throws a `ClassCastException`.

### Why is a Map Being Passed to a Numeric Prop?

The crash at line 45 (`}` closing the switch block) indicates the exception is thrown during prop iteration. In Fabric, the **`style` prop is flattened** into individual style properties, and Fabric tries to set each as a view prop through the delegate.

The [`AppImage.tsx`](src/components/core/AppImage.tsx:283) passes to `Blurhash`:

```tsx
<Blurhash
  blurhash={blurhash!}
  style={[StyleSheet.absoluteFill, style as ImageStyle]}
/>
```

Where `StyleSheet.absoluteFill` resolves to `{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0}` and `style as ImageStyle` resolves to `{width: '100%', height: '100%'}`.

In Fabric, **the merged style properties are individually sent through the delegate's `setProperty` pipeline**. If any style property's value is an object/`ReadableNativeMap` (e.g., complex style values like `shadowOffset`, `textShadowOffset`, or transform arrays), and Fabric mistakenly routes it to one of the blurhash-specific numeric prop handlers instead of `default`, the unsafe `(Double)` cast fails.

### Key Contributing Factor: No Explicit Blurhash Dimension Props

The [`Blurhash`](src/components/core/AppImage.tsx:283) component is used **without** passing `decodeWidth`, `decodeHeight`, or `decodePunch`:

```tsx
<Blurhash
  blurhash={blurhash!}
  style={[StyleSheet.absoluteFill, style as ImageStyle]}
/>
```

In Paper (old architecture), omitting these props means `value` is `null`, and the default fallback (`32`, `32`, `1.0`) kicks in. In Fabric, the props map might contain entries for these keys with unexpected value types from style flattening.

---

## Fix Strategy

### Fix 1: Pass Explicit `decodeWidth`/`decodeHeight`/`decodePunch` Props

Explicitly pass the Blurhash dimension props to bypass the risky `null`→default fallback path in Fabric.

**File:** [`src/components/core/AppImage.tsx`](src/components/core/AppImage.tsx:283)

```diff
 <Blurhash
   blurhash={blurhash!}
+  decodeWidth={32}
+  decodeHeight={32}
+  decodePunch={1.0}
   style={[StyleSheet.absoluteFill, style as ImageStyle]}
 />
```

This ensures the delegate receives proper numeric `Double` values, preventing any map→Double cast from being reached.

### Fix 2: Simplify Style to a Flat Object (Defensive)

Replace the style array with a pre-merged flat object to avoid any Fabric style-array flattening issues:

**File:** [`src/components/core/AppImage.tsx`](src/components/core/AppImage.tsx:283)

```diff
+const absoluteFillStyle = StyleSheet.absoluteFill;
+
+// ...
+
 <Blurhash
   blurhash={blurhash!}
   decodeWidth={32}
   decodeHeight={32}
   decodePunch={1.0}
-  style={[StyleSheet.absoluteFill, style as ImageStyle]}
+  style={{...absoluteFillStyle, ...(style as object)}}
 />
```

This prevents Fabric from iterating over array elements individually.

### Fix 3: Add Blurhash String Validation

Add a defensive check to ensure `blurhash` is actually a string before passing it:

**File:** [`src/components/core/AppImage.tsx`](src/components/core/AppImage.tsx:240)

```diff
-const showBlurhash = Boolean(blurhash);
+const showBlurhash = typeof blurhash === 'string' && blurhash.length > 0;
```

This prevents non-string values from reaching the native `setBlurhash(view, (String) value)` cast.

### Fix 4: Add `resizeMode` Prop Explicitly

Since `ImageStyle` can contain `resizeMode` which might conflict with the Blurhash component's `resizeMode` prop:

**File:** [`src/components/core/AppImage.tsx`](src/components/core/AppImage.tsx:283)

```diff
 <Blurhash
   blurhash={blurhash!}
   decodeWidth={32}
   decodeHeight={32}
   decodePunch={1.0}
+  resizeMode="cover"
   style={{...absoluteFillStyle, ...(style as object)}}
 />
```

---

## Affected Files

| File                                                                   | Changes                                                                                                                                       |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/components/core/AppImage.tsx`](src/components/core/AppImage.tsx) | Add explicit `decodeWidth`, `decodeHeight`, `decodePunch`, `resizeMode` props to `<Blurhash>`; flatten style object; validate blurhash string |

No changes needed in `ArticleCard.tsx` or `VideoPlayer.tsx` — the blurhash path fix (`article.meta?.images?.blurhash ?? article.meta?.blurhash`) is already applied.

---

## Data Flow After Fix

```
API (meta.images.blurhash = "L75$Z3...")
  → ArticleCard → AppImage
    → blurhash validation: typeof string && length > 0
    → <Blurhash
         blurhash="L75$Z3..."
         decodeWidth={32}     ← explicit Double
         decodeHeight={32}    ← explicit Double
         decodePunch={1.0}    ← explicit Double
         resizeMode="cover"   ← explicit String
         style={flat object}  ← no array, no ReadableNativeMap confusion
       />
    → NativeBlurhashView ← Fabric receives correctly-typed props
    → Blurhash decodes and renders ✅
```

---

## Verification Steps

1. **Cold image load** — Blurhash visible → cross-fade → image appears ✅
2. **Cached image load (Android sync onLoad)** — no crash, blurhash cross-fades ✅
3. **Pagination** — new articles load with blurhash, no crash ✅
4. **No blurhash available** — falls through to skeleton, no crash ✅
5. **Image error** — error icon shown, no crash ✅
6. **R8/Proguard release build** — verify no obfuscation issues with explicit props ✅

---

## Rollback

If the fix doesn't resolve the crash, the fallback is to disable Fabric for this specific component by setting the `fabricEnabled` flag in the library's podspec/build.gradle, but this is not recommended as it requires forking the library.

A more robust long-term fix would be to:

1. Fork `react-native-blurhash` and update the delegate to use Fabric-compatible `ReadableMap` getters instead of unsafe `(Double)` casts
2. Or migrate to a different blurhash library that supports Fabric natively
