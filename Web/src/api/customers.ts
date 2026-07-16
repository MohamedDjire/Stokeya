import { api } from './client';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  sales_count?: number;
  is_active: boolean;
}

export async function fetchCustomers(search?: string): Promise<Customer[]> {
  const { data } = await api.get('/customers/', { params: search ? { search } : undefined });
  return data.results;
}

export async function createCustomer(payload: Partial<Customer>): Promise<Customer> {
  const { data } = await api.post('/customers/', payload);
  return data;
}

export async function updateCustomer(id: number, payload: Partial<Customer>): Promise<Customer> {
  const { data } = await api.patch(`/customers/${id}/`, payload);
  return data;
}

export async function deleteCustomer(id: number): Promise<void> {
  await api.delete(`/customers/${id}/`);
}
