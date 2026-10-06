import { api } from './client';

export const SHOP_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export const SHOP_ORDER_STATUS_COLORS: Record<string, string> = {
  pending: '#E65100',
  confirmed: '#0D9488',
  preparing: '#0D9488',
  ready: '#2E7D32',
  delivered: '#2E7D32',
  cancelled: '#C62828',
};

export const SHOP_ORDER_STATUS_OPTIONS = Object.entries(SHOP_ORDER_STATUS_LABELS);

export interface ShopOrder {
  id: number;
  reference: string;
  branch_name: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  delivery_method: string;
  payment_method: string;
  status: string;
  total: string;
  notes: string;
  items_count: number;
  created_at: string;
}

export async function fetchShopOrders(params?: { status?: string; branch?: number }): Promise<ShopOrder[]> {
  const { data } = await api.get('/shop-orders/', { params });
  return data.results ?? data;
}

export async function updateShopOrderStatus(id: number, status: string): Promise<ShopOrder> {
  const { data } = await api.post(`/shop-orders/${id}/update-status/`, { status });
  return data;
}
