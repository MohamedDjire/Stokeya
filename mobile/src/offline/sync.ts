import NetInfo from '@react-native-community/netinfo';
import { syncOfflineSales } from '../api/sales';
import { unitPriceForQty } from '../utils/pricing';
import {
  getOfflineQueue,
  markOfflineSaleError,
  removeFromOfflineQueue,
  type OfflineSalePayload,
} from './storage';

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export type SyncResult = {
  attempted: number;
  synced: number;
  failed: number;
  errors: string[];
};

export async function flushOfflineQueue(): Promise<SyncResult> {
  const online = await isOnline();
  if (!online) {
    return { attempted: 0, synced: 0, failed: 0, errors: ['Hors ligne'] };
  }

  const queue = await getOfflineQueue();
  if (!queue.length) {
    return { attempted: 0, synced: 0, failed: 0, errors: [] };
  }

  const sales = queue.map((s) => ({
    client_reference: s.client_reference,
    branch_id: s.branch_id,
    warehouse_id: s.warehouse_id,
    customer_id: s.customer_id,
    cash_register_id: s.cash_register_id,
    payment_method: s.payment_method,
    items: s.items,
    discount_amount: s.discount_amount,
    notes: s.notes || `Vente offline ${s.created_at_local}`,
    is_offline: true as const,
  }));

  try {
    const response = await syncOfflineSales(sales);
    const okRefs = response.results.filter((r) => r.ok).map((r) => r.client_reference);
    await removeFromOfflineQueue(okRefs);

    for (const r of response.results.filter((r) => !r.ok)) {
      const detail = typeof r.detail === 'string'
        ? r.detail
        : 'Échec de synchronisation';
      if (r.client_reference) {
        await markOfflineSaleError(r.client_reference, detail);
      }
    }

    return {
      attempted: queue.length,
      synced: response.synced,
      failed: response.total - response.synced,
      errors: response.results
        .filter((r) => !r.ok)
        .map((r) => `${r.client_reference}: ${typeof r.detail === 'string' ? r.detail : 'erreur'}`),
    };
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message || 'Sync impossible';
    return { attempted: queue.length, synced: 0, failed: queue.length, errors: [message] };
  }
}

export function buildOfflineSaleFromCart(params: {
  branchId: number;
  warehouseId?: number | null;
  customerId?: number | null;
  cashRegisterId?: number | null;
  cart: Array<{
    product: {
      id: number;
      name: string;
      sale_price: string;
      wholesale_price?: string | null;
      wholesale_min_qty?: string | number | null;
    };
    quantity: number;
  }>;
}): OfflineSalePayload {
  const localTotal = params.cart.reduce(
    (sum, l) => sum + l.quantity * unitPriceForQty(l.product, l.quantity),
    0,
  );
  const label = params.cart.map((l) => `${l.product.name} x${l.quantity}`).join(', ');
  return {
    client_reference: `off-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    branch_id: params.branchId,
    warehouse_id: params.warehouseId || undefined,
    customer_id: params.customerId || undefined,
    cash_register_id: params.cashRegisterId || undefined,
    payment_method: 'cash',
    items: params.cart.map((l) => ({
      product_id: l.product.id,
      quantity: String(l.quantity),
      unit_price: String(unitPriceForQty(l.product, l.quantity)),
    })),
    is_offline: true,
    created_at_local: new Date().toISOString(),
    local_total: localTotal,
    local_label: label,
  };
}
