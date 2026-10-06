import { api } from './client';

export interface Branch {
  id: number;
  name: string;
  code?: string;
  address: string;
  city?: string;
  phone: string;
  manager_name?: string;
  opening_hours?: string;
  currency?: string;
  is_active: boolean;
  is_main: boolean;
  site_type?: 'main' | 'pos';
  acts_as_warehouse?: boolean;
  default_supply_warehouse?: number | null;
  default_supply_warehouse_name?: string | null;
  allow_supplier_receipts?: boolean;
  pos_warehouse_id?: number | null;
  pos_warehouse_name?: string | null;
  created_at: string;
}

export interface BranchDashboard {
  branch_id: number;
  branch_name: string;
  site_type: 'main' | 'pos';
  pos_warehouse_id: number | null;
  default_supply_warehouse_id: number | null;
  allow_supplier_receipts: boolean;
  today: {
    revenue: string | number;
    sales_count: number;
    customers: number;
    items_sold: string | number;
  };
  stock_quantity: string | number;
  stock_alerts: number;
  pending_inbound: number;
  currency: string;
}

export interface Warehouse {
  id: number;
  branch: number;
  branch_name: string;
  name: string;
  code?: string;
  manager_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  is_pos_stock: boolean;
  locations_count?: number;
  created_at: string;
}

export interface Location {
  id: number;
  warehouse: number;
  warehouse_name: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface OnlineShop {
  id: number;
  slug: string;
  code: string;
  enabled: boolean;
  name: string;
  description: string;
  logo?: string | null;
  cover_image?: string | null;
  primary_color: string;
  secondary_color: string;
  phone: string;
  whatsapp: string;
  address: string;
  maps_url: string;
  hours: string;
  social_facebook: string;
  social_instagram: string;
  social_tiktok: string;
  terms_of_sale: string;
  return_policy: string;
  show_prices: boolean;
  show_stock: boolean;
  payment_timing: 'on_delivery' | 'before_delivery' | 'both';
  wave_number: string;
  orange_money_number: string;
  accept_cod: boolean;
  accept_wave: boolean;
  accept_orange_money: boolean;
  fulfillment_branch: number;
  fulfillment_branch_name: string;
  company_name: string;
  shop_url: string;
  short_url: string;
  feature_available?: boolean;
}

export async function fetchBranches(): Promise<Branch[]> {
  const { data } = await api.get('/branches/');
  return data.results ?? data;
}

export async function createBranch(payload: Partial<Branch>): Promise<Branch> {
  const { data } = await api.post('/branches/', payload);
  return data;
}

export async function updateBranch(id: number, payload: Partial<Branch>): Promise<Branch> {
  const { data } = await api.patch(`/branches/${id}/`, payload);
  return data;
}

export async function deleteBranch(id: number): Promise<void> {
  await api.delete(`/branches/${id}/`);
}

export async function fetchBranchDashboard(id: number): Promise<BranchDashboard> {
  const { data } = await api.get(`/branches/${id}/dashboard/`);
  return data;
}

export async function fetchWarehousesCrud(): Promise<Warehouse[]> {
  const { data } = await api.get('/warehouses/');
  return data.results ?? data;
}

export async function createWarehouse(payload: Partial<Warehouse>): Promise<Warehouse> {
  const { data } = await api.post('/warehouses/', payload);
  return data;
}

export async function updateWarehouse(id: number, payload: Partial<Warehouse>): Promise<Warehouse> {
  const { data } = await api.patch(`/warehouses/${id}/`, payload);
  return data;
}

export async function deleteWarehouse(id: number): Promise<void> {
  await api.delete(`/warehouses/${id}/`);
}

export async function fetchLocations(warehouseId?: number): Promise<Location[]> {
  const { data } = await api.get('/locations/', {
    params: warehouseId ? { warehouse: warehouseId } : undefined,
  });
  return data.results ?? data;
}

export async function createLocation(payload: Partial<Location>): Promise<Location> {
  const { data } = await api.post('/locations/', payload);
  return data;
}

export async function updateLocation(id: number, payload: Partial<Location>): Promise<Location> {
  const { data } = await api.patch(`/locations/${id}/`, payload);
  return data;
}

export async function deleteLocation(id: number): Promise<void> {
  await api.delete(`/locations/${id}/`);
}

export async function fetchOnlineShop(): Promise<OnlineShop> {
  const { data } = await api.get('/online-shop/');
  return data;
}

export async function updateOnlineShop(payload: Partial<OnlineShop> | FormData): Promise<OnlineShop> {
  const { data } = await api.patch('/online-shop/', payload);
  return data;
}
