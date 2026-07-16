import { api } from './client';

export interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

export interface Warehouse {
  id: number;
  branch: number;
  branch_name: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  locations_count: number;
  created_at: string;
}

export interface WarehouseLocation {
  id: number;
  warehouse: number;
  warehouse_name: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface WarehouseListItem {
  id: number;
  name: string;
  branch_id: number;
  branch_name: string;
  is_default: boolean;
}

export async function fetchBranches(search?: string): Promise<Branch[]> {
  const { data } = await api.get('/branches/', {
    params: search ? { search } : undefined,
  });
  return data.results;
}

export async function createBranch(payload: Partial<Branch>) {
  const { data } = await api.post('/branches/', payload);
  return data as Branch;
}

export async function fetchWarehouses(search?: string): Promise<Warehouse[]> {
  const { data } = await api.get('/warehouses/', {
    params: search ? { search } : undefined,
  });
  return data.results;
}

export async function createWarehouse(payload: {
  branch: number;
  name: string;
  is_default?: boolean;
}) {
  const { data } = await api.post('/warehouses/', payload);
  return data as Warehouse;
}

export async function fetchLocations(search?: string): Promise<WarehouseLocation[]> {
  const { data } = await api.get('/locations/', {
    params: search ? { search } : undefined,
  });
  return data.results;
}

export async function createLocation(payload: {
  warehouse: number;
  code: string;
  name: string;
}) {
  const { data } = await api.post('/locations/', payload);
  return data as WarehouseLocation;
}

export async function fetchWarehousesList(): Promise<WarehouseListItem[]> {
  const { data } = await api.get('/warehouses-list/');
  return data;
}
