import { api } from './client';

export interface FeatureDetail {
  code: string;
  label: string;
  core?: boolean;
}

export interface RenewalOption {
  months: number;
  label: string;
  amount: string;
  discount_label: string;
}

export interface Plan {
  id: number;
  code: string;
  name: string;
  price: string;
  price_annual: string;
  max_users: number;
  max_branches: number;
  max_warehouses?: number;
  max_products: number;
  unlimited_users: boolean;
  unlimited_branches: boolean;
  unlimited_warehouses?: boolean;
  unlimited_products: boolean;
  features: string[];
  features_detail: FeatureDetail[];
  renewal_options?: RenewalOption[];
  is_public: boolean;
}

export interface UsageItem {
  used: number;
  limit: number;
  unlimited: boolean;
}

export type DisplayStatus =
  | 'active'
  | 'trial'
  | 'expiring_soon'
  | 'expired'
  | 'suspended'
  | 'cancelled'
  | string;

export interface Subscription {
  id: number;
  plan: Plan;
  plan_name: string;
  plan_code: string;
  status: string;
  display_status?: DisplayStatus;
  billing_cycle: string;
  start_date: string;
  end_date: string | null;
  is_valid: boolean;
  days_remaining?: number | null;
  expiring_soon?: boolean;
  grace_day?: number;
  access_level?: 'full' | 'readonly' | 'sales_blocked' | 'suspended' | string;
  auto_renew?: boolean;
  preferred_payment_method?: string;
  preferred_payment_method_label?: string;
  monthly_amount?: string;
  usage: {
    users: UsageItem;
    branches: UsageItem;
    warehouses?: UsageItem;
    products: UsageItem;
  };
  features: string[];
  features_included?: FeatureDetail[];
}

export const DISPLAY_STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  trial: 'Période d\'essai',
  expiring_soon: 'Expire bientôt',
  expired: 'Expiré',
  suspended: 'Suspendu',
  cancelled: 'Annulé',
};

export const DISPLAY_STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  active: 'success',
  trial: 'info',
  expiring_soon: 'warning',
  expired: 'error',
  suspended: 'error',
  cancelled: 'default',
};

export async function fetchPlans(): Promise<Plan[]> {
  const { data } = await api.get('/company/plans/');
  return data.results ?? data;
}

export async function fetchSubscription(): Promise<Subscription> {
  const { data } = await api.get('/company/subscription/');
  return data;
}

export async function changePlan(
  planCode: string,
  billingCycle: 'monthly' | 'annual',
  months?: number,
) {
  const { data } = await api.post('/company/subscription/change/', {
    plan_code: planCode,
    billing_cycle: billingCycle,
    months: months ?? (billingCycle === 'annual' ? 12 : 1),
  });
  return data as Subscription;
}

export async function updateSubscriptionSettings(payload: {
  auto_renew?: boolean;
  preferred_payment_method?: string;
}) {
  const { data } = await api.patch('/company/subscription/settings/', payload);
  return data as Subscription;
}
