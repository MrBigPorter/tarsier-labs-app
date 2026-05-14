import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import bookmarksReducer from './slices/bookmarksSlice';
import { blogApi } from '../api/baseApi';

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  bookmarks: bookmarksReducer,
  [blogApi.reducerPath]: blogApi.reducer,
});

export function createStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore non-serializable values in specific paths
          ignoredActions: ['auth/login/fulfilled', 'auth/setCredentials'],
        },
      }).concat(blogApi.middleware),
  });
}

export const store = createStore();

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

/** Typed useDispatch hook */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/** Typed useSelector hook */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
