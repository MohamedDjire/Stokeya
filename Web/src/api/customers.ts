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

export const CUSTOMER_STATUS_COLORS: Record<string, 'success' | 'default' | 'info' | 'warning' | 'error'> = {
  actif: 'success',
  inactif: 'default',
  nouveau: 'info',
  a_risque: 'warning',
};

export interface CustomerTag {
  id: number;
  name: string;
  color: string;
  code?: string;
}

export interface CustomerDebt {
  id: number;
  reference: string;
  total: string;
  paid: string;
  due: string;
  payment_status: string;
  created_at: string;
}

export interface CustomerCreditPayment {
  id: number;
  amount: string;
  method: string;
  reference: string;
  notes?: string;
  created_at: string;
  created_by_name?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  whatsapp?: string;
  email: string;
  address: string;
  city?: string;
  commune?: string;
  quartier?: string;
  landmark?: string;
  gender?: string;
  profession?: string;
  company_name?: string;
  birth_date?: string | null;
  photo?: string | null;
  sales_count?: number;
  orders_count?: number;
  total_spent?: string;
  credit_limit?: string;
  balance?: string;
  loyalty_points?: number;
  loyalty_level?: string;
  score?: number;
  status?: string;
  tags?: CustomerTag[];
  last_order_at?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface CrmDashboard {
  total_customers: number;
  new_this_month: number;
  revenue: string;
  vip_count: number;
  active_count: number;
  inactive_count: number;
  abandoned_carts: number;
  reviews_count: number;
  retention_rate: number;
  avg_order_value: string;
  orders_count: number;
  birthdays_this_month: number;
  total_receivables?: string;
  debtors_count?: number;
}

export interface CustomerNote {
  id: number;
  content: string;
  created_at: string;
  created_by?: string;
  created_by_name?: string;
}

export interface CustomerProfile extends Customer {
  score_label?: string;
  avg_basket?: string;
  ltv?: string;
  purchase_frequency?: string | null;
  notes?: CustomerNote[];
  debts?: CustomerDebt[];
  credit_payments?: CustomerCreditPayment[];
  addresses?: Array<{
    id: number;
    label: string;
    address: string;
    city: string;
    commune: string;
    quartier: string;
    landmark: string;
    is_default: boolean;
  }>;
  preferred_products?: Array<{
    product_id: number;
    name: string;
    times: number;
    revenue: string;
    stars: number;
  }>;
  order_history?: Array<{
    id: number;
    reference: string;
    total: string;
    status: string;
    payment_status: string;
    created_at: string;
    source: string;
  }>;
  loyalty_transactions?: Array<{
    id: number;
    points: number;
    balance_after: number;
    reason: string;
    reference: string;
    created_at: string;
  }>;
  recommendations?: string[];
}

export const CREDIT_PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte',
  other: 'Autre',
};

export async function fetchCustomers(search?: string): Promise<Customer[]> {
  const { data } = await api.get('/customers/', { params: search ? { search } : undefined });
  return data.results ?? data;
}

export async function fetchCrmDashboard(): Promise<CrmDashboard> {
  const { data } = await api.get('/customers/dashboard/');
  return data;
}

export async function fetchCustomersEnriched(params?: Record<string, string | number | undefined>): Promise<Customer[]> {
  const { data } = await api.get('/customers/list-enriched/', { params });
  return data;
}

export async function fetchCustomerProfile(id: number): Promise<CustomerProfile> {
  const { data } = await api.get(`/customers/${id}/profile/`);
  return data;
}

export async function createCustomer(payload: Partial<Customer>): Promise<Customer> {
  const { data } = await api.post('/customers/', payload);
  return data;
}

export async function updateCustomer(id: number, payload: Partial<Customer>): Promise<Customer> {
  const { data } = await api.patch(`/customers/${id}/`, payload);
  return data;
}

export async function deleteCustomer(id: number): Promise<void> {
  await api.delete(`/customers/${id}/`);
}

export async function addCustomerNote(id: number, content: string): Promise<CustomerNote> {
  const { data } = await api.post(`/customers/${id}/notes/`, { content, is_private: true });
  return data;
}

export async function assignCustomerTag(id: number, payload: { tag_id?: number; name?: string; color?: string }) {
  const { data } = await api.post(`/customers/${id}/tags/`, payload);
  return data;
}

export async function backfillCustomerStats(): Promise<void> {
  await api.post('/customers/backfill-stats/');
}

export async function recordCustomerPayment(
  id: number,
  payload: {
    amount: number | string;
    method?: string;
    reference?: string;
    notes?: string;
    sale_id?: number;
  },
): Promise<{ payment: CustomerCreditPayment; balance: string; debts: CustomerDebt[] }> {
  const { data } = await api.post(`/customers/${id}/payments/`, payload);
  return data;
}
