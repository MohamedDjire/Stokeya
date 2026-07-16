import { api } from './client';

export interface Sale {
  id: number;
  reference: string;
  total: string;
  status: string;
  payment_status: string;
  branch_name: string;
  customer_name: string;
  seller_name: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  items: Array<{
    id: number;
    product: number;
    product_name: string;
    quantity: string;
    unit_price: string;
    total: string;
  }>;
  payments: Array<{ method: string; amount: string; status: string }>;
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

export async function syncOfflineSales(sales: CheckoutPayload[]) {
  const { data } = await api.post('/sales/sync/', { sales });
  return data as {
    synced: number;
    total: number;
    results: Array<{ client_reference: string; ok: boolean; detail?: unknown; sale?: Sale }>;
  };
}

export async function fetchSale(saleId: number): Promise<Sale> {
  const { data } = await api.get(`/sales/${saleId}/`);
  return data;
}

export async function fetchSaleReceipt(saleId: number) {
  const { data } = await api.get(`/sales/${saleId}/receipt/`);
  return data as { reference: string; html: string; total: string };
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte bancaire',
  credit: 'Crédit',
  other: 'Autre',
};

export async function fetchSales(params?: { search?: string }): Promise<Sale[]> {
  const { data } = await api.get('/sales/', { params });
  return data.results as Sale[];
}

export async function fetchBranches(): Promise<Array<{ id: number; name: string }>> {
  const { data } = await api.get('/branches/');
  return data.results;
}
