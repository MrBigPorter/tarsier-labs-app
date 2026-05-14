import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({
  id: 'tarsier-blog-storage',
});

export const secureStorage = {
  set: (key: string, value: string) => {
    storage.set(key, value);
  },
  get: (key: string) => {
    return storage.getString(key) ?? null;
  },
  remove: (key: string) => {
    storage.delete(key);
  },
  clearAll: () => {
    storage.clearAll();
  },
};

export const mmkvStorage = {
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  getItem: (key: string) => {
    return storage.getString(key) ?? null;
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
};
