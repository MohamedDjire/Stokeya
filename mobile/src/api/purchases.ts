import { api } from './client';

export interface PurchaseOrderItem {
  id: number;
  product: number;
  product_name: string;
  quantity: string;
  unit_price: string;
  total: string;
  quantity_received: string;
}

export interface PurchaseOrder {
  id: number;
  reference: string;
  supplier: number;
  supplier_name: string;
  status: string;
  total: string;
  items: PurchaseOrderItem[];
  created_at: string;
}

export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data } = await api.get('/purchase-orders/');
  return data.results;
}

export async function createPurchaseOrder(payload: {
  supplier_id: number;
  notes?: string;
  items: Array<{ product_id: number; quantity: string; unit_price?: string }>;
}) {
  const { data } = await api.post('/purchase-orders/', payload);
  return data as PurchaseOrder;
}

export async function receivePurchaseOrder(
  orderId: number,
  payload: {
    warehouse_id: number;
    items: Array<{ order_item_id: number; quantity_received: string }>;
    notes?: string;
  },
) {
  const { data } = await api.post(`/purchase-orders/${orderId}/receive/`, payload);
  return data;
}
