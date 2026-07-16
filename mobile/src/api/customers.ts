import { api } from './client';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  credit_limit: string;
  balance: string;
  loyalty_points: number;
  is_active: boolean;
  sales_count: number;
}

export async function fetchCustomers(search?: string): Promise<Customer[]> {
  const { data } = await api.get('/customers/', {
    params: search ? { search } : undefined,
  });
  return data.results;
}

export async function createCustomer(payload: Partial<Customer>) {
  const { data } = await api.post('/customers/', payload);
  return data as Customer;
}

export async function updateCustomer(id: number, payload: Partial<Customer>) {
  const { data } = await api.patch(`/customers/${id}/`, payload);
  return data as Customer;
}

export async function deleteCustomer(id: number) {
  await api.delete(`/customers/${id}/`);
}
