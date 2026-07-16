import { api } from './client';
import { API_BASE_URL } from '../config/api';
import type { Product } from './auth';

export interface ImportResult {
  created: number;
  skipped: number;
  total_rows: number;
  errors: string[];
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
}

export interface PickedImage {
  uri: string;
  name?: string;
  mimeType?: string;
}

export async function fetchProductByBarcode(code: string): Promise<Product> {
  const { data } = await api.get(`/products/by-barcode/${encodeURIComponent(code)}/`);
  return data;
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
  batches: Array<{
    id: number;
    product: number;
    product_name: string;
    product_sku: string;
    batch_number: string;
    expiry_date: string | null;
    quantity: string;
    created_at: string;
    updated_at: string;
  }>;
  movements: TraceabilityMovement[];
}

export async function fetchProductTraceability(productId: number): Promise<ProductTraceability> {
  const { data } = await api.get(`/products/${productId}/traceability/`);
  return data;
}

export async function updateProduct(id: number, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/products/${id}/`, payload);
  return data as Product;
}

export async function deleteProduct(id: number) {
  await api.delete(`/products/${id}/`);
}

export async function importProducts(file: PickedFile): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);

  const { data } = await api.post('/products/import/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data as ImportResult;
}

export async function uploadProductImage(id: number, image: PickedImage): Promise<Product> {
  const form = new FormData();
  const name = image.name || `product-${id}.jpg`;
  form.append('image', {
    uri: image.uri,
    name,
    type: image.mimeType || 'image/jpeg',
  } as unknown as Blob);

  const { data } = await api.post(`/products/${id}/upload-image/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data as Product;
}

export const IMPORT_TEMPLATE_URL = `${API_BASE_URL}/products/import-template/`;
