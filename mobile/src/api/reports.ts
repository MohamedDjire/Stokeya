import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { api, getAccessToken } from './client';
import { API_BASE_URL } from '../config/api';

export interface SalesReport {
  period: string;
  revenue: string | number;
  sales_count: number;
  average_sale: number;
  top_products: Array<{
    id: number;
    name: string;
    quantity_sold: string;
    revenue: string;
  }>;
}

export interface FinanceReport {
  revenue_month: string | number;
  expenses_month: string | number;
  profit_month: string | number;
  products_count: number;
}

export async function fetchSalesReport(period: 'today' | 'month' | 'year' = 'month') {
  const { data } = await api.get('/reports/sales/', { params: { period } });
  return data as SalesReport;
}

export async function fetchFinanceReport() {
  const { data } = await api.get('/reports/finance/');
  return data as FinanceReport;
}

export interface Analytics {
  period: 'week' | 'month' | 'year';
  kpis: {
    revenue: number;
    revenue_growth: number;
    sales_count: number;
    sales_growth: number;
    average_basket: number;
    active_products: number;
  };
  sales_trend: { labels: string[]; revenue: number[]; counts: number[] };
  revenue_vs_expenses: {
    labels: string[];
    revenue: number[];
    expenses: number[];
    profit: number[];
  };
  payment_methods: Array<{ method: string; label: string; total: number; count: number }>;
  category_breakdown: Array<{ name: string; revenue: number }>;
  top_products: Array<{ id: number; name: string; quantity: number; revenue: number }>;
  low_stock_count: number;
}

export interface AnalyticsFilters {
  branches: Array<{ id: number; name: string }>;
  sellers: Array<{ id: number; name: string }>;
}

export interface AnalyticsQuery {
  period?: 'week' | 'month' | 'year';
  branch?: number | null;
  seller?: number | null;
}

function buildParams(q: AnalyticsQuery) {
  const params: Record<string, string | number> = { period: q.period || 'month' };
  if (q.branch) params.branch = q.branch;
  if (q.seller) params.seller = q.seller;
  return params;
}

export async function fetchAnalytics(
  period: 'week' | 'month' | 'year' = 'month',
  filters: { branch?: number | null; seller?: number | null } = {},
) {
  const { data } = await api.get('/reports/analytics/', {
    params: buildParams({ period, ...filters }),
  });
  return data as Analytics;
}

export async function fetchAnalyticsFilters() {
  const { data } = await api.get('/reports/analytics/filters/');
  return data as AnalyticsFilters;
}

export async function exportAnalyticsExcel(query: AnalyticsQuery) {
  const token = await getAccessToken();
  const params = new URLSearchParams(
    Object.entries(buildParams(query)).map(([k, v]) => [k, String(v)]),
  ).toString();
  const url = `${API_BASE_URL}/reports/analytics/export/?${params}`;
  const fileUri = `${FileSystem.cacheDirectory}stokeya_rapport_${query.period || 'month'}.xlsx`;

  const result = await FileSystem.downloadAsync(url, fileUri, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (result.status !== 200) {
    throw new Error('Export impossible.');
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Rapport Stokeya',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
  return result.uri;
}
