import { api } from './client';

export interface WarehouseItem {
  id: number;
  name: string;
  code?: string;
  branch_id: number;
  branch_name: string;
  branch_is_main?: boolean;
  is_default: boolean;
  is_pos_stock?: boolean;
  products_in_stock?: number;
}

export interface StockStatusItem {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  barcode?: string;
  category_id?: number | null;
  category_name?: string;
  quantity: string;
  reserved_quantity?: string;
  available?: string;
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

export interface StockTransferItemRow {
  id?: number;
  product_id: number;
  product_name: string;
  product_sku?: string;
  quantity: string | number;
  quantity_received?: string | number | null;
  variance_reason?: string;
  variance_notes?: string;
}

export interface StockTransfer {
  id: number;
  reference?: string;
  from_warehouse: string;
  from_warehouse_id?: number;
  to_warehouse: string;
  to_warehouse_id?: number;
  status: string;
  status_display?: string;
  notes: string;
  carrier?: string;
  items_count: number;
  total_quantity?: string | number;
  items: StockTransferItemRow[];
  created_by: string;
  received_by?: string | null;
  shipped_at?: string | null;
  received_at?: string | null;
  created_at: string;
  updated_at?: string;
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
  pending: 'Créé',
  preparing: 'En préparation',
  shipped: 'Expédié',
  in_transit: 'En transit',
  received: 'Reçu',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

export const TRANSFER_STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'default',
  preparing: 'warning',
  shipped: 'info',
  in_transit: 'info',
  received: 'success',
  completed: 'success',
  cancelled: 'error',
};

export const TRANSFER_VARIANCE_REASONS: Array<{ value: string; label: string }> = [
  { value: 'broken', label: 'Cassé' },
  { value: 'lost', label: 'Perdu' },
  { value: 'stolen', label: 'Volé' },
  { value: 'other', label: 'Autre' },
];

export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  validated: 'Validé',
  cancelled: 'Annulé',
};

export async function fetchWarehouses(): Promise<WarehouseItem[]> {
  const { data } = await api.get('/warehouses-list/');
  return data;
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

export async function fetchStockAlertsSummary(): Promise<{
  count: number;
  low_stock: number;
  out_of_stock: number;
}> {
  const { data } = await api.get('/stock/alerts-summary/');
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
  return data;
}

export async function stockExit(payload: {
  product_id: number;
  warehouse_id: number;
  quantity: string;
  reason: string;
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
  carrier?: string;
  auto_prepare?: boolean;
  items: Array<{ product_id: number; quantity: string }>;
}) {
  const { data } = await api.post('/stock/transfer/', payload);
  return data as StockTransfer;
}

export async function suggestReplenishment(payload: {
  to_warehouse_id: number;
  from_warehouse_id?: number;
  days?: number;
}) {
  const { data } = await api.post('/stock/transfer/suggest-replenishment/', payload);
  return data as {
    from_warehouse_id: number;
    from_warehouse_name: string;
    to_warehouse_id: number;
    to_warehouse_name: string;
    days: number;
    items_count: number;
    items: Array<{
      product_id: number;
      product_name: string;
      sku: string;
      category_id: number | null;
      category_name: string;
      current_stock: string | number;
      min_stock: string | number;
      target_stock: string | number;
      pending_inbound: string | number;
      sales_period: string | number;
      source_available: string | number;
      proposed_quantity: string | number;
      purchase_price: string | number;
      sale_price: string | number;
    }>;
  };
}

export async function parseTransferFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/stock/transfer/parse-file/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as {
    matched: Array<{
      product_id: number;
      product_name: string;
      sku: string;
      quantity: string | number;
      matched_key: string;
    }>;
    unmatched: Array<{ key: string; quantity: string | number }>;
  };
}

export async function importFromMain(payload: {
  to_warehouse_id: number;
  notes?: string;
  complete_now?: boolean;
  items: Array<{ product_id: number; quantity: string }>;
}) {
  const { data } = await api.post('/stock/transfer/import-from-main/', payload);
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

export async function prepareTransfer(id: number) {
  const { data } = await api.post(`/stock/transfer/${id}/prepare/`);
  return data;
}

export async function shipTransfer(id: number) {
  const { data } = await api.post(`/stock/transfer/${id}/ship/`);
  return data;
}

export async function receiveTransfer(
  id: number,
  payload?: {
    items?: Array<{
      item_id?: number;
      product_id?: number;
      quantity_received: string;
      variance_reason?: string;
      variance_notes?: string;
    }>;
  },
) {
  const { data } = await api.post(`/stock/transfer/${id}/receive/`, payload || {});
  return data;
}

export async function cancelTransfer(id: number) {
  const { data } = await api.post(`/stock/transfer/${id}/cancel/`);
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
  const { data } = await api.get('/stock/dashboard/', {
    params: warehouseId ? { warehouse: warehouseId } : undefined,
  });
  return data;
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
  const { data } = await api.get('/stock/list-items/', { params });
  if (Array.isArray(data)) return { results: data, count: data.length };
  return { results: data.results ?? [], count: data.count ?? data.results?.length ?? 0 };
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

function normalizeInventoryItem(raw: any): InventorySessionItem {
  return {
    id: raw.id,
    product_id: raw.product_id ?? raw.product,
    product_name: raw.product_name,
    sku: raw.sku ?? raw.product_sku ?? '',
    expected_quantity: String(raw.expected_quantity ?? raw.system_quantity ?? '0'),
    counted_quantity: raw.counted_quantity == null ? null : String(raw.counted_quantity),
  };
}

function normalizeInventorySession(raw: any): InventorySession {
  const items = Array.isArray(raw.items) ? raw.items.map(normalizeInventoryItem) : undefined;
  const counted = items
    ? items.filter((i: { counted_quantity: string | number | null }) => i.counted_quantity !== null && i.counted_quantity !== '').length
    : (raw.counted_count ?? 0);
  return {
    id: raw.id,
    warehouse: raw.warehouse,
    warehouse_name: raw.warehouse_name,
    status: raw.status,
    notes: raw.notes || '',
    items_count: raw.items_count ?? items?.length ?? 0,
    counted_count: counted,
    created_by: raw.created_by || raw.created_by_name || 'Système',
    created_at: raw.created_at,
    items,
  };
}

export async function fetchInventorySessions(warehouseId?: number): Promise<InventorySession[]> {
  const { data } = await api.get('/inventory-sessions/', {
    params: warehouseId ? { warehouse: warehouseId } : undefined,
  });
  const rows = data.results ?? data;
  return Array.isArray(rows) ? rows.map(normalizeInventorySession) : [];
}

export async function fetchInventorySession(id: number): Promise<InventorySession> {
  const { data } = await api.get(`/inventory-sessions/${id}/`);
  return normalizeInventorySession(data);
}

export async function createInventorySession(payload: {
  warehouse_id: number;
  notes?: string;
}): Promise<InventorySession> {
  const { data } = await api.post('/inventory-sessions/', payload);
  return normalizeInventorySession(data);
}

export async function patchInventoryCount(
  id: number,
  payload: { items: Array<{ product_id: number; counted_quantity: string }> },
): Promise<InventorySession> {
  let last: InventorySession | null = null;
  for (const item of payload.items) {
    const { data } = await api.post(`/inventory-sessions/${id}/count-item/`, {
      product_id: item.product_id,
      counted_quantity: item.counted_quantity,
    });
    last = normalizeInventorySession(data);
  }
  if (!last) return fetchInventorySession(id);
  return last;
}

export async function validateInventorySession(id: number): Promise<InventorySession> {
  const { data } = await api.post(`/inventory-sessions/${id}/validate/`);
  return normalizeInventorySession(data);
}

export async function exportStock(params: {
  format?: 'csv';
  warehouse?: number;
  branch?: number;
  status?: string;
} = {}): Promise<Blob> {
  const { data } = await api.get('/stock/export/', {
    params: { format: 'csv', ...params },
    responseType: 'blob',
  });
  return data;
}
