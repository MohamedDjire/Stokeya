import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const TOKEN_KEY = 'stokeya_access_token';
const REFRESH_KEY = 'stokeya_refresh_token';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

/** Charge toutes les pages d'un endpoint DRF paginé. */
export async function fetchAllPages<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  // Une seule requête large (FlexiblePagination côté backend)
  const { data } = await api.get(url, {
    params: { ...params, page: 1, page_size: 500 },
    timeout: 30000,
  });
  if (Array.isArray(data)) return data as T[];

  const items = [...((data?.results ?? []) as T[])];
  let page = 2;
  let next = data?.next as string | null | undefined;

  while (next && page <= 8) {
    const res = await api.get(url, {
      params: { ...params, page, page_size: 500 },
      timeout: 30000,
    });
    if (Array.isArray(res.data)) {
      items.push(...(res.data as T[]));
      break;
    }
    const batch = (res.data?.results ?? []) as T[];
    items.push(...batch);
    next = res.data?.next;
    if (batch.length === 0) break;
    page += 1;
  }
  return items;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
          localStorage.setItem(TOKEN_KEY, data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          clearTokens();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getApiErrorMessage(error: unknown, fallback = 'Une erreur est survenue.'): string {
  const err = error as {
    response?: { data?: Record<string, unknown>; status?: number };
    message?: string;
  };
  const data = err.response?.data;
  if (!err.response) return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (/^<!DOCTYPE|<html/i.test(trimmed) || trimmed.includes('<title>')) {
      return fallback;
    }
    return trimmed.length > 280 ? fallback : trimmed;
  }
  if (data) {
    if (typeof data.detail === 'string') return data.detail;
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = data[firstKey];
      if (Array.isArray(val)) return `${firstKey}: ${val[0]}`;
      if (typeof val === 'string') return val;
    }
  }
  return fallback;
}
