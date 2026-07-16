import { api } from './client';
import type { Sale } from './sales';

export type PaymentProviderCode = 'wave' | 'orange_money' | 'mtn_money';

export interface PaymentProvider {
  code: PaymentProviderCode;
  label: string;
  configured: boolean;
}

export interface WaveCheckout {
  id: number;
  provider: PaymentProviderCode;
  provider_label: string;
  session_id: string;
  client_reference: string;
  amount: string;
  currency: string;
  wave_launch_url: string;
  launch_url: string;
  status: string;
  created_at: string;
}

export interface SubscriptionWaveCheckout extends WaveCheckout {
  plan_code: string;
  plan_name: string;
  billing_cycle: string;
}

export interface PaymentStatus {
  type: 'sale' | 'subscription';
  provider?: PaymentProviderCode;
  provider_label?: string;
  status: string;
  sale_id?: number;
  reference?: string;
  amount: string;
  payment_status?: string;
  checkout_id?: number;
  plan_code?: string;
  plan_name?: string;
  billing_cycle?: string;
  wave_launch_url?: string;
  launch_url?: string;
}

export async function fetchPaymentProviders(): Promise<PaymentProvider[]> {
  const { data } = await api.get('/payments/providers/');
  return data.providers as PaymentProvider[];
}

export async function createWaveCheckout(
  saleId: number,
  provider: PaymentProviderCode = 'wave',
  phone?: string,
) {
  const { data } = await api.post('/payments/wave/checkout/', {
    sale_id: saleId,
    provider,
    phone,
  });
  return data as { checkout: WaveCheckout; sale: Sale };
}

export async function createSubscriptionWaveCheckout(
  planCode: string,
  billingCycle: 'monthly' | 'annual',
  provider: PaymentProviderCode = 'wave',
  phone?: string,
) {
  const { data } = await api.post('/payments/wave/subscription/', {
    plan_code: planCode,
    billing_cycle: billingCycle,
    provider,
    phone,
  });
  return data as { checkout: SubscriptionWaveCheckout };
}

export async function fetchPaymentStatus(params: {
  sale_id?: number;
  subscription_checkout_id?: number;
}) {
  const { data } = await api.get('/payments/wave/status/', { params });
  return data as PaymentStatus;
}

export async function mockCompletePayment(clientReference: string, provider: PaymentProviderCode) {
  const { data } = await api.post('/payments/mock/complete/', {
    client_reference: clientReference,
    provider,
  });
  return data;
}
