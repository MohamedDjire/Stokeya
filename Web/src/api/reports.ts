import { api, getAccessToken } from './client';
import { API_BASE_URL } from '../config/api';

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

export async function fetchAnalytics(query: AnalyticsQuery = {}): Promise<Analytics> {
  const { data } = await api.get('/reports/analytics/', { params: buildParams(query) });
  return data;
}

export async function fetchAnalyticsFilters(): Promise<AnalyticsFilters> {
  const { data } = await api.get('/reports/analytics/filters/');
  return data;
}

export async function downloadAnalyticsExcel(query: AnalyticsQuery = {}) {
  const token = getAccessToken();
  const params = new URLSearchParams(
    Object.entries(buildParams(query)).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await fetch(`${API_BASE_URL}/reports/analytics/export/?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error('Export impossible');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventra_rapport_${query.period || 'month'}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
