import { api } from './client';

export interface FeatureDetail {
  code: string;
  label: string;
}

export interface Plan {
  id: number;
  code: string;
  name: string;
  price: string;
  price_annual: string;
  max_users: number;
  max_branches: number;
  max_products: number;
  unlimited_users: boolean;
  unlimited_branches: boolean;
  unlimited_products: boolean;
  features: string[];
  features_detail: FeatureDetail[];
  is_public: boolean;
}

export interface UsageItem {
  used: number;
  limit: number;
  unlimited: boolean;
}

export interface Subscription {
  id: number;
  plan: Plan;
  plan_name: string;
  plan_code: string;
  status: string;
  billing_cycle: string;
  start_date: string;
  end_date: string | null;
  is_valid: boolean;
  usage: {
    users: UsageItem;
    branches: UsageItem;
    products: UsageItem;
  };
  features: string[];
}

export async function fetchPlans(): Promise<Plan[]> {
  const { data } = await api.get('/company/plans/');
  return data.results ?? data;
}

export async function fetchSubscription(): Promise<Subscription> {
  const { data } = await api.get('/company/subscription/');
  return data;
}

export async function changePlan(planCode: string, billingCycle: 'monthly' | 'annual') {
  const { data } = await api.post('/company/subscription/change/', {
    plan_code: planCode,
    billing_cycle: billingCycle,
  });
  return data as Subscription;
}

export function hasFeature(subscription: Subscription | null, feature: string): boolean {
  if (!subscription || !subscription.is_valid) return false;
  return subscription.features.includes('all') || subscription.features.includes(feature);
}
