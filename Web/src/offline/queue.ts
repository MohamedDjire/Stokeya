const QUEUE_KEY = 'inventra_offline_sales_queue';

export type WebOfflineSale = {
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
  local_total: number;
};

export function getOfflineQueue(): WebOfflineSale[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as WebOfflineSale[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: WebOfflineSale[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueOfflineSale(sale: WebOfflineSale) {
  const queue = getOfflineQueue();
  queue.unshift(sale);
  saveQueue(queue);
}

export function removeSynced(refs: string[]) {
  if (!refs.length) return;
  const set = new Set(refs);
  saveQueue(getOfflineQueue().filter((s) => !set.has(s.client_reference)));
}

export function makeClientReference() {
  return `off-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
