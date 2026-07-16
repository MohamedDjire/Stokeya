import { api } from './client';

export interface CartItem {
  product_id: number;
  name: string;
  quantity: string;
  unit_price: string;
  total: number;
}

export interface Sale {
  id: number;
  reference: string;
  total: string;
  payment_status: string;
  items: Array<{
    id: number;
    product: number;
    product_name: string;
    quantity: string;
    unit_price: string;
    total: string;
  }>;
  payments: Array<{
    method: string;
    amount: string;
    status: string;
  }>;
  created_at: string;
}

export type CheckoutPayload = {
  branch_id: number;
  warehouse_id?: number;
  customer_id?: number;
  cash_register_id?: number;
  payment_method: 'cash' | 'mobile_money' | 'card' | 'credit';
  items: Array<{ product_id: number; quantity: string; unit_price?: string }>;
  discount_amount?: string;
  notes?: string;
  is_offline?: boolean;
  client_reference?: string;
};

export async function checkoutSale(payload: CheckoutPayload): Promise<Sale> {
  const { data } = await api.post('/sales/checkout/', payload);
  return data;
}

export type SyncSaleResult = {
  client_reference: string;
  ok: boolean;
  detail?: string | Record<string, unknown>;
  sale?: Sale;
};

export async function syncOfflineSales(sales: CheckoutPayload[]) {
  const { data } = await api.post('/sales/sync/', { sales });
  return data as { synced: number; total: number; results: SyncSaleResult[] };
}

export async function fetchSaleReceipt(saleId: number) {
  const { data } = await api.get(`/sales/${saleId}/receipt/`);
  return data as { reference: string; html: string; total: string };
}

export async function createWaveCheckout(saleId: number) {
  const { data } = await api.post('/payments/wave/checkout/', { sale_id: saleId });
  return data as { checkout: { wave_launch_url: string }; sale: Sale };
}

export async function fetchSales() {
  const { data } = await api.get('/sales/');
  return data.results as Sale[];
}

export async function fetchBranches() {
  const { data } = await api.get('/branches/');
  return data.results as Array<{ id: number; name: string }>;
}
