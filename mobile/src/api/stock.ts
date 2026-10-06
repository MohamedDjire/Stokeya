import { api } from './client';
import { cached, cacheInvalidate } from './cache';

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
  status: 'out_of_stock' | 'low' | 'ok' | string;
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
  severity: 'error' | 'warning' | 'info';
  product_id: number;
  product_name: string;
  message: string;
  quantity?: string;
  batch_number?: string;
  expiry_date?: string;
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

export const EXIT_REASONS: Array<{ value: string; label: string }> = [
  { value: 'loss', label: 'Perte' },
  { value: 'breakage', label: 'Casse' },
  { value: 'theft', label: 'Vol' },
  { value: 'donation', label: 'Don' },
  { value: 'internal', label: 'Usage interne' },
  { value: 'return_supplier', label: 'Retour fournisseur' },
];

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  shipped: 'Expédié',
  in_transit: 'En transit',
  received: 'Reçu',
  cancelled: 'Annulé',
};

export const TRANSFER_STATUS_COLORS: Record<string, string> = {
  pending: '#6B7280',
  shipped: '#0D9488',
  in_transit: '#0D9488',
  received: '#2E7D32',
  cancelled: '#C62828',
};

export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  validated: 'Validé',
  cancelled: 'Annulé',
};

export async function fetchWarehouses(): Promise<WarehouseItem[]> {
  return cached('warehouses', async () => {
    const { data } = await api.get('/warehouses-list/');
    return data;
  }, 60_000);
}

export async function fetchStockStatus(warehouseId: number): Promise<StockStatusItem[]> {
  const { data } = await api.get(`/stock/status/${warehouseId}/`);
  return data;
}

export async function fetchStockMovements(
  warehouseId: number,
  params?: { product?: number },
): Promise<StockMovementItem[]> {
  const { data } = await api.get(`/stock/movements/${warehouseId}/`, { params });
  return data;
}

export async function fetchStockStats(warehouseId: number): Promise<StockStats> {
  const { data } = await api.get(`/stock/stats/${warehouseId}/`);
  return data;
}

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

function bustStockCache() {
  cacheInvalidate('stock:');
  cacheInvalidate('dashboard');
}

export async function stockEntry(payload: {
  product_id: number;
  warehouse_id: number;
  quantity: string;
  notes?: string;
  reference?: string;
  supplier_id?: number;
  cost_price?: string;
  invoice_number?: string;
  batch_number?: string;
  expiry_date?: string;
}) {
  const { data } = await api.post('/stock/entry/', payload);
  bustStockCache();
  return data;
}

export async function stockExit(payload: {
  product_id: number;
  warehouse_id: number;
  quantity: string;
  notes?: string;
  reference?: string;
  reason: string;
}) {
  const { data } = await api.post('/stock/exit/', payload);
  bustStockCache();
  return data;
}

export async function stockTransfer(payload: {
  from_warehouse_id: number;
  to_warehouse_id: number;
  notes?: string;
  items: Array<{ product_id: number; quantity: string }>;
}) {
  const { data } = await api.post('/stock/transfer/', payload);
  bustStockCache();
  return data;
}

export async function stockAdjust(payload: {
  warehouse_id: number;
  reason: string;
  notes?: string;
  items: Array<{ product_id: number; expected_quantity: string; actual_quantity: string }>;
}) {
  const { data } = await api.post('/stock/adjust/', payload);
  bustStockCache();
  return data;
}

export async function shipTransfer(id: number) {
  const { data } = await api.post(`/stock/transfer/${id}/ship/`);
  bustStockCache();
  return data;
}

export async function receiveTransfer(id: number) {
  const { data } = await api.post(`/stock/transfer/${id}/receive/`);
  bustStockCache();
  return data;
}

export async function cancelTransfer(id: number) {
  const { data } = await api.post(`/stock/transfer/${id}/cancel/`);
  bustStockCache();
  return data;
}

export interface StockDashboardData {
  products_count: number;
  stock_qty: string | number;
  stock_value: string | number;
  out_of_stock: number;
  low_stock: number;
  movements_today: number;
  shops_count: number;
  warehouses_count: number;
}

export async function fetchStockDashboard(warehouseId?: number): Promise<StockDashboardData> {
  return cached(`stock:dashboard:${warehouseId || 'all'}`, async () => {
    const { data } = await api.get('/stock/dashboard/', {
      params: warehouseId ? { warehouse: warehouseId } : undefined,
    });
    return data;
  }, 20_000);
}

export interface StockListItem {
  id: number;
  product_id: number;
  name: string;
  image: string | null;
  barcode: string | null;
  sku: string;
  category_name: string | null;
  brand_name: string | null;
  warehouse_id: number;
  warehouse_name: string;
  branch_id: number;
  branch_name: string;
  quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  min_stock: string;
  max_stock: string | null;
  purchase_price: string;
  sale_price: string;
  value: string;
  status: 'out_of_stock' | 'low' | 'ok' | string;
}

export interface StockListParams {
  search?: string;
  status?: string;
  warehouse?: number;
  branch?: number;
  category?: number;
  brand?: number;
  page?: number;
  page_size?: number;
}

export async function fetchStockListItems(
  params: StockListParams,
): Promise<{ results: StockListItem[]; count: number }> {
  return cached(`stock:list:${JSON.stringify(params)}`, async () => {
    const { data } = await api.get('/stock/list-items/', { params });
    if (Array.isArray(data)) return { results: data, count: data.length };
    return { results: data.results ?? [], count: data.count ?? data.results?.length ?? 0 };
  }, 15_000);
}

export interface InventorySessionItem {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  expected_quantity: string;
  counted_quantity: string | null;
}

export interface InventorySession {
  id: number;
  warehouse: number;
  warehouse_name: string;
  status: string;
  notes: string;
  items_count: number;
  counted_count: number;
  created_by: string;
  created_at: string;
  items?: InventorySessionItem[];
}

export async function fetchInventorySessions(warehouseId?: number): Promise<InventorySession[]> {
  const { data } = await api.get('/inventory-sessions/', {
    params: warehouseId ? { warehouse: warehouseId } : undefined,
  });
  return data.results ?? data;
}

export async function fetchInventorySession(id: number): Promise<InventorySession> {
  const { data } = await api.get(`/inventory-sessions/${id}/`);
  return data;
}

export async function createInventorySession(payload: {
  warehouse_id: number;
  notes?: string;
}): Promise<InventorySession> {
  const { data } = await api.post('/inventory-sessions/', payload);
  return data;
}

export async function patchInventoryCount(
  id: number,
  payload: { items: Array<{ product_id: number; counted_quantity: string }> },
): Promise<InventorySession> {
  let last: any = null;
  for (const item of payload.items) {
    const { data } = await api.post(`/inventory-sessions/${id}/count-item/`, {
      product_id: item.product_id,
      counted_quantity: item.counted_quantity,
    });
    last = data;
  }
  return last ?? (await fetchInventorySession(id));
}

export async function validateInventorySession(id: number): Promise<InventorySession> {
  const { data } = await api.post(`/inventory-sessions/${id}/validate/`);
  return data;
}
