import { api } from './client';

export interface Batch {
  id: number;
  product: number;
  product_name: string;
  product_sku: string;
  batch_number: string;
  expiry_date: string | null;
  quantity: string;
  created_at: string;
  updated_at: string;
}

export async function fetchBatches(search?: string): Promise<Batch[]> {
  const { data } = await api.get('/batches/', {
    params: search ? { search } : undefined,
  });
  return data.results;
}

export async function createBatch(payload: {
  product: number;
  batch_number: string;
  expiry_date?: string | null;
  quantity: string;
}) {
  const { data } = await api.post('/batches/', payload);
  return data as Batch;
}
