import { api } from './client';

export interface StockRequestItem {
  id?: number;
  product: number;
  product_name?: string;
  product_sku?: string;
  quantity: string;
  quantity_fulfilled?: string;
}

export interface StockRequest {
  id: number;
  reference: string;
  from_warehouse: number | null;
  from_warehouse_name: string | null;
  to_warehouse: number;
  to_warehouse_name: string;
  status: string;
  status_display: string;
  notes: string;
  requested_by: number | null;
  requested_by_name: string | null;
  processed_by: number | null;
  items: StockRequestItem[];
  created_at: string;
  updated_at: string;
}

export async function fetchStockRequests(params?: {
  status?: string;
  from_warehouse?: number;
  to_warehouse?: number;
}): Promise<StockRequest[]> {
  const { data } = await api.get('/stock-requests/', { params });
  return data.results;
}

export async function createStockRequest(payload: {
  from_warehouse?: number | null;
  to_warehouse: number;
  notes?: string;
  items: Array<{ product: number; quantity: string }>;
}): Promise<StockRequest> {
  const { data } = await api.post('/stock-requests/', payload);
  return data;
}

export async function updateStockRequest(
  id: number,
  payload: Partial<{
    from_warehouse: number | null;
    to_warehouse: number;
    notes: string;
    items: Array<{ product: number; quantity: string }>;
  }>,
): Promise<StockRequest> {
  const { data } = await api.patch(`/stock-requests/${id}/`, payload);
  return data;
}

export async function approveStockRequest(id: number): Promise<StockRequest> {
  const { data } = await api.post(`/stock-requests/${id}/approve/`);
  return data;
}

export async function rejectStockRequest(id: number): Promise<StockRequest> {
  const { data } = await api.post(`/stock-requests/${id}/reject/`);
  return data;
}

export async function fulfillStockRequest(id: number): Promise<StockRequest> {
  const { data } = await api.post(`/stock-requests/${id}/fulfill/`);
  return data;
}

export async function cancelStockRequest(id: number): Promise<StockRequest> {
  const { data } = await api.post(`/stock-requests/${id}/cancel/`);
  return data;
}
