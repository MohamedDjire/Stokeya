import { api } from './client';
import type { Product } from './auth';

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

export interface TraceabilityStockLevel {
  warehouse_id: number;
  warehouse_name: string;
  branch_name: string;
  quantity: string;
}

export interface TraceabilityMovement {
  id: number;
  warehouse_name: string;
  movement_type: string;
  quantity: string;
  reference: string;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export interface ProductTraceability {
  product: Product;
  stock_levels: TraceabilityStockLevel[];
  batches: Batch[];
  movements: TraceabilityMovement[];
}

export async function fetchBatches(productId?: number): Promise<Batch[]> {
  const { data } = await api.get('/batches/', {
    params: productId ? { product: productId } : undefined,
  });
  return data.results;
}

export async function createBatch(payload: Partial<Batch>): Promise<Batch> {
  const { data } = await api.post('/batches/', payload);
  return data;
}

export async function updateBatch(id: number, payload: Partial<Batch>): Promise<Batch> {
  const { data } = await api.patch(`/batches/${id}/`, payload);
  return data;
}

export async function deleteBatch(id: number): Promise<void> {
  await api.delete(`/batches/${id}/`);
}

export async function fetchProductTraceability(productId: number): Promise<ProductTraceability> {
  const { data } = await api.get(`/products/${productId}/traceability/`);
  return data;
}

export async function fetchProductByBarcode(code: string): Promise<Product> {
  const { data } = await api.get(`/products/by-barcode/${encodeURIComponent(code)}/`);
  return data;
}
