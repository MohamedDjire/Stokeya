import { api } from './client';

export const LOYALTY_LEVEL_LABELS: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Argent',
  gold: 'Or',
  platinum: 'Platine',
};

export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  actif: 'Actif',
  inactif: 'Inactif',
  nouveau: 'Nouveau',
  a_risque: 'À risque',
};

export interface CustomerTag {
  id: number;
  name: string;
  color: string;
  code?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  whatsapp?: string;
  email: string;
  address: string;
  city?: string;
  credit_limit?: string;
  balance?: string;
  loyalty_points: number;
  loyalty_level?: string;
  score?: number;
  status?: string;
  tags?: CustomerTag[];
  orders_count?: number;
  total_spent?: string;
  last_order_at?: string | null;
  is_active: boolean;
  sales_count?: number;
}

export interface CrmDashboard {
  total_customers: number;
  new_this_month: number;
  revenue: string;
  vip_count: number;
  active_count: number;
  inactive_count: number;
  abandoned_carts: number;
  retention_rate: number;
  avg_order_value: string;
  orders_count: number;
  birthdays_this_month: number;
}

export interface CustomerProfile extends Customer {
  score_label?: string;
  avg_basket?: string;
  ltv?: string;
  purchase_frequency?: string | null;
  commune?: string;
  quartier?: string;
  birth_date?: string | null;
  created_at?: string;
  notes?: Array<{ id: number; content: string; created_at: string; created_by?: string }>;
  preferred_products?: Array<{ product_id: number; name: string; times: number; stars: number }>;
  order_history?: Array<{
    id: number; reference: string; total: string; status: string;
    payment_status: string; created_at: string; source: string;
  }>;
  recommendations?: string[];
}

export async function fetchCustomers(search?: string): Promise<Customer[]> {
  const { data } = await api.get('/customers/', { params: search ? { search } : undefined });
  return data.results ?? data;
}

export async function fetchCrmDashboard(): Promise<CrmDashboard> {
  const { data } = await api.get('/customers/dashboard/');
  return data;
}

export async function fetchCustomersEnriched(params?: Record<string, string | undefined>): Promise<Customer[]> {
  const { data } = await api.get('/customers/list-enriched/', { params });
  return data;
}

export async function fetchCustomerProfile(id: number): Promise<CustomerProfile> {
  const { data } = await api.get(`/customers/${id}/profile/`);
  return data;
}

export async function createCustomer(payload: Partial<Customer>) {
  const { data } = await api.post('/customers/', payload);
  return data as Customer;
}

export async function updateCustomer(id: number, payload: Partial<Customer>) {
  const { data } = await api.patch(`/customers/${id}/`, payload);
  return data as Customer;
}

export async function addCustomerNote(id: number, content: string) {
  const { data } = await api.post(`/customers/${id}/notes/`, { content, is_private: true });
  return data;
}

export async function backfillCustomerStats() {
  await api.post('/customers/backfill-stats/');
}
