import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';
import { cacheInvalidate } from './cache';

const TOKEN_KEY = 'stokeya_access_token';
const REFRESH_KEY = 'stokeya_refresh_token';

let accessTokenMem: string | null | undefined;
let refreshTokenMem: string | null | undefined;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

async function readAccessToken() {
  if (accessTokenMem === undefined) {
    accessTokenMem = await SecureStore.getItemAsync(TOKEN_KEY);
  }
  return accessTokenMem;
}

async function readRefreshToken() {
  if (refreshTokenMem === undefined) {
    refreshTokenMem = await SecureStore.getItemAsync(REFRESH_KEY);
  }
  return refreshTokenMem;
}

api.interceptors.request.use(async (config) => {
  const token = await readAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await readRefreshToken();
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
          accessTokenMem = data.access;
          await SecureStore.setItemAsync(TOKEN_KEY, data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          await clearTokens();
        }
      }
    }
    return Promise.reject(error);
  }
);

export async function saveTokens(access: string, refresh: string) {
  accessTokenMem = access;
  refreshTokenMem = refresh;
  await SecureStore.setItemAsync(TOKEN_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  accessTokenMem = null;
  refreshTokenMem = null;
  cacheInvalidate();
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getAccessToken() {
  return readAccessToken();
}
