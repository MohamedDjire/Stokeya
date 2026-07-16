import { api } from './client';

export interface WarehouseItem {
  id: number;
  name: string;
  branch_id: number;
  branch_name: string;
  is_default: boolean;
}

export interface StockStatusItem {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  quantity: string;
  min_stock: string;
  max_stock: string | null;
  purchase_price: string;
  sale_price: string;
  status: string;
  updated_at: string;
}

export interface StockMovementItem {
  id: number;
  product_id: number;
  product_name: string;
  movement_type: string;
  quantity: string;
  reference: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface StockStats {
  total_products: number;
  stock_total: string;
  stock_value: string;
  in_stock: number;
  out_of_stock: number;
  low_stock: number;
  over_max: number;
  entries_month: string;
  exits_month: string;
}

export interface StockAlert {
  type: string;
  severity: string;
  product_name: string;
  message: string;
}

export interface StockTransfer {
  id: number;
  from_warehouse: string;
  to_warehouse: string;
  status: string;
  notes: string;
  items_count: number;
  items: Array<{ product_name: string; quantity: string }>;
  created_by: string;
  created_at: string;
}

export interface ProductRanking {
  product_id: number;
  name: string;
  qty_sold: string;
  revenue: string;
}

export const MOVEMENT_LABELS: Record<string, string> = {
  in: 'Entrée',
  out: 'Sortie',
  transfer: 'Transfert',
  adjustment: 'Ajustement',
  sale: 'Vente',
  purchase: 'Achat',
  return: 'Retour',
};

export async function fetchStockAlerts(warehouseId: number): Promise<StockAlert[]> {
  const { data } = await api.get(`/stock/alerts/${warehouseId}/`);
  return data;
}

export async function fetchStockTransfers(warehouseId?: number): Promise<StockTransfer[]> {
  const { data } = await api.get('/stock/transfers/', {
    params: warehouseId ? { warehouse: warehouseId } : undefined,
  });
  return data;
}

export async function fetchProductRankings(days = 90): Promise<{
  top_sold: ProductRanking[];
  least_sold: ProductRanking[];
}> {
  const { data } = await api.get('/stock/rankings/', { params: { days } });
  return data;
}

export async function fetchWarehouses(): Promise<WarehouseItem[]> {
  const { data } = await api.get('/warehouses-list/');
  return data;
}

export async function fetchStockStatus(warehouseId: number): Promise<StockStatusItem[]> {
  const { data } = await api.get(`/stock/status/${warehouseId}/`);
  return data;
}

export async function fetchStockMovements(warehouseId: number): Promise<StockMovementItem[]> {
  const { data } = await api.get(`/stock/movements/${warehouseId}/`);
  return data;
}

export async function fetchStockStats(warehouseId: number): Promise<StockStats> {
  const { data } = await api.get(`/stock/stats/${warehouseId}/`);
  return data;
}

export async function stockEntry(payload: {
  product_id: number;
  warehouse_id: number;
  quantity: string;
  notes?: string;
  reference?: string;
}) {
  const { data } = await api.post('/stock/entry/', payload);
  return data;
}

export async function stockExit(payload: {
  product_id: number;
  warehouse_id: number;
  quantity: string;
  notes?: string;
  reference?: string;
}) {
  const { data } = await api.post('/stock/exit/', payload);
  return data;
}

export async function stockTransfer(payload: {
  from_warehouse_id: number;
  to_warehouse_id: number;
  notes?: string;
  items: Array<{ product_id: number; quantity: string }>;
}) {
  const { data } = await api.post('/stock/transfer/', payload);
  return data;
}

export async function stockAdjust(payload: {
  warehouse_id: number;
  reason: string;
  notes?: string;
  items: Array<{ product_id: number; expected_quantity: string; actual_quantity: string }>;
}) {
  const { data } = await api.post('/stock/adjust/', payload);
  return data;
}
