import { api } from './client';

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  contact_name?: string;
  orders_count?: number;
  is_active: boolean;
}

export async function fetchSuppliers(search?: string): Promise<Supplier[]> {
  const { data } = await api.get('/suppliers/', { params: search ? { search } : undefined });
  return data.results;
}

export async function createSupplier(payload: Partial<Supplier>): Promise<Supplier> {
  const { data } = await api.post('/suppliers/', payload);
  return data;
}

export async function updateSupplier(id: number, payload: Partial<Supplier>): Promise<Supplier> {
  const { data } = await api.patch(`/suppliers/${id}/`, payload);
  return data;
}

export async function deleteSupplier(id: number): Promise<void> {
  await api.delete(`/suppliers/${id}/`);
}
