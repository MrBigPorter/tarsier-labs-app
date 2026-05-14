import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { storage } from '../../lib/storage';
import { env } from '../../lib/env';

interface User {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

const AUTH_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

export const login = createAsyncThunk(
  'auth/login',
  async (
    { email, password }: { email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await fetch(
        `${env.API_URL}/api/v1/frontend/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        return rejectWithValue(data.message || 'Login failed');
      }
      return data.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>,
    ) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
      state.error = null;
      // Persist to MMKV
      storage.set(AUTH_TOKEN_KEY, action.payload.accessToken);
      storage.set(REFRESH_TOKEN_KEY, action.payload.refreshToken);
      storage.set(USER_KEY, JSON.stringify(action.payload.user));
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      // Clear MMKV
      storage.delete(AUTH_TOKEN_KEY);
      storage.delete(REFRESH_TOKEN_KEY);
      storage.delete(USER_KEY);
    },
    restoreSession(state) {
      const accessToken = storage.getString(AUTH_TOKEN_KEY);
      const userStr = storage.getString(USER_KEY);
      if (accessToken && userStr) {
        state.accessToken = accessToken;
        state.user = JSON.parse(userStr);
        state.isAuthenticated = true;
      }
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(login.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        const { user, accessToken, refreshToken } = action.payload;
        state.user = user;
        state.accessToken = accessToken;
        state.refreshToken = refreshToken;
        state.isAuthenticated = true;
        storage.set(AUTH_TOKEN_KEY, accessToken);
        storage.set(REFRESH_TOKEN_KEY, refreshToken);
        storage.set(USER_KEY, JSON.stringify(user));
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setCredentials, logout, restoreSession, clearError } =
  authSlice.actions;
export default authSlice.reducer;
