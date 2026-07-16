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

export async function fetchBranches(): Promise<Branch[]> {
  const { data } = await api.get('/branches/');
  return data.results;
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

export async function fetchWarehousesCrud(): Promise<Warehouse[]> {
  const { data } = await api.get('/warehouses/');
  return data.results;
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
  return data.results;
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
