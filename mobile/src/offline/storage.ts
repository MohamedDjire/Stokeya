import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'inventra_offline_sales_queue';
const CATALOG_KEY = 'inventra_offline_catalog';
const CONTEXT_KEY = 'inventra_offline_pos_context';

export type OfflineSalePayload = {
  client_reference: string;
  branch_id: number;
  warehouse_id?: number;
  customer_id?: number;
  cash_register_id?: number;
  payment_method: 'cash' | 'mobile_money' | 'card' | 'credit';
  items: Array<{ product_id: number; quantity: string; unit_price?: string }>;
  discount_amount?: string;
  notes?: string;
  is_offline: true;
  created_at_local: string;
  /** Affichage local avant sync */
  local_total: number;
  local_label: string;
  last_error?: string;
};

export type OfflineCatalogProduct = {
  id: number;
  name: string;
  sku: string;
  sale_price: string;
  barcodes?: Array<{ code: string; is_primary: boolean }>;
  total_stock?: string;
};

export type OfflinePosContext = {
  branchId: number | null;
  warehouseId: number | null;
  cashRegisterId: number | null;
  savedAt: string;
};

export function makeClientReference(): string {
  return `off-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getOfflineQueue(): Promise<OfflineSalePayload[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineSalePayload[];
  } catch {
    return [];
  }
}

export async function saveOfflineQueue(queue: OfflineSalePayload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueOfflineSale(sale: OfflineSalePayload): Promise<void> {
  const queue = await getOfflineQueue();
  queue.unshift(sale);
  await saveOfflineQueue(queue);
}

export async function removeFromOfflineQueue(clientReferences: string[]): Promise<void> {
  if (!clientReferences.length) return;
  const set = new Set(clientReferences);
  const queue = await getOfflineQueue();
  await saveOfflineQueue(queue.filter((s) => !set.has(s.client_reference)));
}

export async function markOfflineSaleError(
  clientReference: string,
  error: string,
): Promise<void> {
  const queue = await getOfflineQueue();
  await saveOfflineQueue(
    queue.map((s) =>
      s.client_reference === clientReference ? { ...s, last_error: error } : s,
    ),
  );
}

export async function cacheCatalog(products: OfflineCatalogProduct[]): Promise<void> {
  await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify({
    savedAt: new Date().toISOString(),
    products,
  }));
}

export async function loadCachedCatalog(): Promise<OfflineCatalogProduct[]> {
  const raw = await AsyncStorage.getItem(CATALOG_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { products: OfflineCatalogProduct[] };
    return data.products || [];
  } catch {
    return [];
  }
}

export async function cachePosContext(ctx: Omit<OfflinePosContext, 'savedAt'>): Promise<void> {
  await AsyncStorage.setItem(CONTEXT_KEY, JSON.stringify({
    ...ctx,
    savedAt: new Date().toISOString(),
  }));
}

export async function loadPosContext(): Promise<OfflinePosContext | null> {
  const raw = await AsyncStorage.getItem(CONTEXT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OfflinePosContext;
  } catch {
    return null;
  }
}
