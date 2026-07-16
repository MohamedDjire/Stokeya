import { api, clearTokens, saveTokens } from './client';

export interface User {
  id: number;
  username: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
  company: number;
  is_company_admin: boolean;
  is_active: boolean;
  permissions?: string[];
}

export interface DashboardAlertItem {
  id: number;
  name: string;
  quantity: string | number;
  min_stock: string | number;
  warehouse: string;
}

export interface DashboardData {
  revenue_today: string | number;
  revenue_month: string | number;
  sales_count_today: number;
  products_count: number;
  low_stock_count: number;
  low_stock_products: DashboardAlertItem[];
  stock_overview?: {
    products: number;
    stock_qty: string | number;
    stock_value: string | number;
    stock_age_avg: number;
    rotation: number;
    branches: number;
    warehouses: number;
    inventories: number;
    in_stock: number;
    out_of_stock: number;
    low_stock: number;
    negative_stock: number;
    over_max: number;
  };
  purchases_summary?: {
    to_validate: number;
    to_receive: number;
    partial: number;
    suppliers_count: number;
  };
  customer_orders?: {
    awaiting_payment: number;
    partial_payment: number;
    draft: number;
    customers_count: number;
  };
  alerts?: {
    automatic: number;
    untreated: number;
    to_restock: number;
    negative: number;
    over_max: number;
    low_stock: number;
    out_of_stock: number;
  };
  alert_lists?: {
    to_restock: DashboardAlertItem[];
    negative: DashboardAlertItem[];
    low_stock: DashboardAlertItem[];
  };
  charts?: {
    labels: string[];
    stock_qty: number[];
    stock_value: number[];
    purchases: number[];
    sales: number[];
    margin: number[];
  };
}

export interface OptionItem {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  description: string;
  category: number | null;
  category_name: string | null;
  brand: number | null;
  brand_name: string | null;
  unit: number;
  unit_name: string;
  purchase_price: string;
  sale_price: string;
  tax_rate: string;
  min_stock: string;
  max_stock: string | null;
  total_stock: string;
  image: string | null;
  track_batches: boolean;
  is_active: boolean;
  barcodes: Array<{
    id?: number;
    code: string;
    is_primary: boolean;
  }>;
}

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login/', { email, password });
  await saveTokens(data.access, data.refresh);
  return data;
}

export async function register(payload: {
  company_name: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}) {
  const { data } = await api.post('/auth/register/', payload);
  return data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get('/auth/me/');
  return data;
}

export async function updateProfile(payload: {
  first_name?: string;
  last_name?: string;
  phone?: string;
}): Promise<User> {
  const { data } = await api.patch('/auth/me/', payload);
  return data;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await api.get('/dashboard/');
  return data;
}

export async function logout() {
  try {
    await api.post('/auth/logout/');
  } finally {
    await clearTokens();
  }
}

export async function requestPasswordReset(email: string) {
  const { data } = await api.post('/auth/password-reset/', { email });
  return data as { message: string; reset?: { uid: string; token: string } };
}

export async function confirmPasswordReset(payload: {
  uid: string;
  token: string;
  new_password: string;
  new_password_confirm: string;
}) {
  const { data } = await api.post('/auth/password-reset/confirm/', payload);
  return data;
}

export async function fetchProducts(search?: string): Promise<Product[]> {
  const { data } = await api.get('/products/', {
    params: search ? { search } : undefined,
  });
  return data.results;
}

export async function fetchUnits(): Promise<OptionItem[]> {
  const { data } = await api.get('/units/');
  return data.results;
}

export async function fetchCategories(): Promise<OptionItem[]> {
  const { data } = await api.get('/categories/');
  return data.results;
}

export async function fetchBrands(): Promise<OptionItem[]> {
  const { data } = await api.get('/brands/');
  return data.results;
}

export async function createProduct(payload: {
  name: string;
  sku?: string;
  description?: string;
  category?: number | null;
  brand?: number | null;
  unit: number;
  purchase_price: string;
  sale_price: string;
  tax_rate?: string;
  min_stock?: string;
  max_stock?: string;
  track_batches?: boolean;
  barcodes?: Array<{ code: string; is_primary: boolean }>;
}) {
  const { data } = await api.post('/products/', payload);
  return data as Product;
}
