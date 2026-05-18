# StatsScreen.tsx - Remove Unused Imports

## Problem

Three unused imports in [`src/screens/StatsScreen.tsx`](src/screens/StatsScreen.tsx) causing ESLint/TS6133 errors:

1. `RefreshControl` — imported from `react-native` but never used
2. `ActivityIndicator` — imported from `react-native` but never used
3. `EmptyState` — imported from `@/components/core/EmptyState` but never used

## Changes Required

### 1. Remove `RefreshControl` and `ActivityIndicator` from react-native import

**Before** (lines 21-29):

```typescript
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
```

**After**:

```typescript
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
```

> Note: `Platform` is still used on line 244 (`Platform.select`), so it stays.

### 2. Remove the entire `EmptyState` import line

**Before** (line 36):

```typescript
import { EmptyState } from '@/components/core/EmptyState';
```

**After**: (remove the line entirely)

## Verification

After applying the changes, run:

```bash
npx tsc --noEmit
```

Expected exit code: 0
