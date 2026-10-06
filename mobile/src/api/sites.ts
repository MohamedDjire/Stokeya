import { api } from './client';
import { Share } from 'react-native';

export interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
  is_main: boolean;
  site_type?: string;
  created_at: string;
}

export interface Warehouse {
  id: number;
  branch: number;
  branch_name: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  is_pos_stock: boolean;
  locations_count?: number;
}

export interface OnlineShop {
  id: number;
  slug: string;
  code: string;
  enabled: boolean;
  name: string;
  description: string;
  whatsapp: string;
  hours: string;
  phone: string;
  show_prices: boolean;
  show_stock: boolean;
  primary_color: string;
  secondary_color: string;
  shop_url: string;
  short_url: string;
  fulfillment_branch_name: string;
}

export async function fetchBranches(): Promise<Branch[]> {
  const { data } = await api.get('/branches/');
  return data.results ?? data;
}

export async function createBranch(payload: Partial<Branch>) {
  const { data } = await api.post('/branches/', payload);
  return data as Branch;
}

export async function updateBranch(id: number, payload: Partial<Branch>) {
  const { data } = await api.patch(`/branches/${id}/`, payload);
  return data as Branch;
}

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const { data } = await api.get('/warehouses/');
  return data.results ?? data;
}

export async function fetchWarehousesList(): Promise<Warehouse[]> {
  return fetchWarehouses();
}

export async function createWarehouse(payload: Partial<Warehouse>) {
  const { data } = await api.post('/warehouses/', payload);
  return data as Warehouse;
}

export async function updateWarehouse(id: number, payload: Partial<Warehouse>) {
  const { data } = await api.patch(`/warehouses/${id}/`, payload);
  return data as Warehouse;
}

export async function fetchOnlineShop(): Promise<OnlineShop> {
  const { data } = await api.get('/online-shop/');
  return data;
}

export async function updateOnlineShop(payload: Partial<OnlineShop>): Promise<OnlineShop> {
  const { data } = await api.patch('/online-shop/', payload);
  return data;
}

export async function shareShopLink(shop: OnlineShop, origin = 'https://stokeya.com') {
  const link = shop.shop_url?.startsWith('http') ? shop.shop_url : `${origin}${shop.shop_url}`;
  await Share.share({ message: `Découvrez notre boutique : ${link}` });
}
