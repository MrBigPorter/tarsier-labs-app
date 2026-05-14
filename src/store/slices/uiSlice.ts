import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type ThemeMode = 'light' | 'dark';
type Language = 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'de';

interface UiState {
  theme: ThemeMode;
  language: Language;
  isGlobalLoading: boolean;
  isOnline: boolean;
  bottomSheetVisible: boolean;
  searchQuery: string;
}

const initialState: UiState = {
  theme: 'light',
  language: 'en',
  isGlobalLoading: false,
  isOnline: true,
  bottomSheetVisible: false,
  searchQuery: '',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.theme = action.payload;
    },
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    setLanguage(state, action: PayloadAction<Language>) {
      state.language = action.payload;
    },
    setGlobalLoading(state, action: PayloadAction<boolean>) {
      state.isGlobalLoading = action.payload;
    },
    setOnlineStatus(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
    setBottomSheetVisible(state, action: PayloadAction<boolean>) {
      state.bottomSheetVisible = action.payload;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
  },
});

export const {
  setTheme,
  toggleTheme,
  setLanguage,
  setGlobalLoading,
  setOnlineStatus,
  setBottomSheetVisible,
  setSearchQuery,
} = uiSlice.actions;
export default uiSlice.reducer;
