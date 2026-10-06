import { api, clearTokens, fetchAllPages, saveTokens } from './client';

export interface User {
  id: number;
  username: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar?: string | null;
  company: number;
  company_name?: string | null;
  company_logo?: string | null;
  is_company_admin: boolean;
  is_active: boolean;
  permissions?: string[];
  role_code?: string | null;
  flags?: Record<string, boolean>;
  scope?: {
    role_code?: string | null;
    branch_id?: number | null;
    warehouse_id?: number | null;
    cash_register_id?: number | null;
    is_cashier?: boolean;
    is_pos_manager?: boolean;
    is_warehouse_staff?: boolean;
    flags?: Record<string, boolean>;
  };
  assigned_branch?: number | null;
  assigned_branch_name?: string | null;
  assigned_warehouse?: number | null;
  assigned_cash_register?: number | null;
  assigned_cash_register_name?: string | null;
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
    out_of_stock?: DashboardAlertItem[];
  };
  charts?: {
    labels: string[];
    stock_qty: number[];
    stock_value: number[];
    purchases: number[];
    sales: number[];
    margin: number[];
  };
  sites_overview?: Array<{
    warehouse_id: number;
    warehouse_name: string;
    branch_id: number;
    branch_name: string;
    is_pos_stock: boolean;
    is_main: boolean;
    kind: 'main' | 'warehouse' | 'pos' | string;
    stock_qty: number;
    stock_value: number;
    pending_requests: number;
  }>;
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
  wholesale_price?: string | null;
  wholesale_min_qty?: string | number | null;
  wholesale_discount_type?: 'price' | 'percent' | 'amount';
  wholesale_discount_value?: string | null;
  tax_rate: string;
  min_stock: string;
  max_stock: string | null;
  total_stock: string;
  stock_status?: 'ok' | 'low' | 'out_of_stock';
  image: string | null;
  track_batches: boolean;
  is_active: boolean;
  barcodes: Array<{ id?: number; code: string; is_primary: boolean }>;
}

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login/', { email, password });
  saveTokens(data.access, data.refresh);
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
  address?: string;
  city?: string;
  whatsapp?: string;
  shop_slug?: string;
  wave_number?: string;
  orange_money_number?: string;
  payment_timing?: string;
}) {
  const { data } = await api.post('/auth/register/', payload);
  if (data.access && data.refresh) saveTokens(data.access, data.refresh);
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

export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append('avatar', file);
  const { data } = await api.post('/auth/me/avatar/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await api.get('/dashboard/');
  return data;
}

export async function logout() {
  try {
    await api.post('/auth/logout/');
  } catch {
    /* ignore */
  } finally {
    clearTokens();
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
  return fetchAllPages<Product>('/products/', search ? { search } : undefined);
}

export async function fetchUnits(): Promise<OptionItem[]> {
  return fetchAllPages<OptionItem>('/units/');
}

export async function fetchCategories(): Promise<OptionItem[]> {
  return fetchAllPages<OptionItem>('/categories/');
}

export async function fetchBrands(): Promise<OptionItem[]> {
  return fetchAllPages<OptionItem>('/brands/');
}

export async function createProduct(payload: Record<string, unknown>) {
  const { data } = await api.post('/products/', payload);
  return data as Product;
}

export async function updateProduct(id: number, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/products/${id}/`, payload);
  return data as Product;
}

export async function deleteProduct(id: number) {
  await api.delete(`/products/${id}/`);
}

export async function uploadProductImage(id: number, file: File) {
  const form = new FormData();
  form.append('image', file);
  const { data } = await api.post(`/products/${id}/upload-image/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as Product;
}

export interface ImportResult {
  created: number;
  skipped: number;
  updated?: number;
  errors: string[];
  batch_id?: number;
}

export type DuplicatePolicy = 'ignore' | 'update' | 'ask';

export interface ImportTargetField {
  key: string;
  label: string;
  required: boolean;
}

export interface ImportRow {
  line: number;
  name: string;
  sale_price: string;
  purchase_price: string;
  sku: string;
  barcode: string;
  quantity: string;
  category: string;
  brand: string;
  unit: string;
  tax_rate: string;
  description: string;
  issues: string[];
}

export interface ImportAnalyzeResult {
  batch_id: number;
  filename: string;
  total_rows: number;
  headers: string[];
  suggested_mapping: Record<string, number>;
  unmapped_columns: { index: number; header: string }[];
  target_fields: ImportTargetField[];
  missing_required: string[];
  rows: ImportRow[];
  incomplete_count: number;
  preview?: ImportRow[];
}

export interface ImportPrepareResult {
  batch_id: number;
  headers: string[];
  column_mapping: Record<string, number>;
  unmapped_columns: { index: number; header: string }[];
  missing_required: string[];
  target_fields: ImportTargetField[];
  total_rows: number;
  rows: ImportRow[];
  incomplete_count: number;
}

export interface ImportExecuteResult {
  batch_id: number;
  created: number;
  updated: number;
  skipped: number;
  total_rows: number;
  errors: Array<{ line: number; name: string; message: string }>;
  can_undo_until: string | null;
}

export interface ImportHistoryItem {
  id: number;
  filename: string;
  status: string;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  errors_count: number;
  created_at: string;
  can_undo_until: string | null;
  can_undo: boolean;
  created_by: string | null;
}

export async function importProducts(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/products/import/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function analyzeProductImport(file: File): Promise<ImportAnalyzeResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/products/import-analyze/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function prepareProductImport(
  batchId: number,
  column_mapping: Record<string, number>,
): Promise<ImportPrepareResult> {
  const { data } = await api.post(`/products/import-batches/${batchId}/prepare/`, {
    column_mapping,
  });
  return data;
}

export async function executeProductImport(
  batchId: number,
  payload: { rows: ImportRow[] },
): Promise<ImportExecuteResult> {
  const { data } = await api.post(`/products/import-batches/${batchId}/execute/`, payload);
  return data;
}

export async function undoProductImport(batchId: number): Promise<{ deleted: number; batch_id: number }> {
  const { data } = await api.post(`/products/import-batches/${batchId}/undo/`);
  return data;
}

export async function fetchImportHistory(): Promise<ImportHistoryItem[]> {
  const { data } = await api.get('/products/import-history/');
  return data;
}

export const IMPORT_TEMPLATE_URL = '/products/import-template/';
