import { api } from './client';

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  balance: string;
  is_active: boolean;
  orders_count: number;
}

export async function fetchSuppliers(search?: string): Promise<Supplier[]> {
  const { data } = await api.get('/suppliers/', {
    params: search ? { search } : undefined,
  });
  return data.results;
}

export async function createSupplier(payload: Partial<Supplier>) {
  const { data } = await api.post('/suppliers/', payload);
  return data as Supplier;
}

export async function updateSupplier(id: number, payload: Partial<Supplier>) {
  const { data } = await api.patch(`/suppliers/${id}/`, payload);
  return data as Supplier;
}
