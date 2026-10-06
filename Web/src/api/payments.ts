import { api } from './client';
import type { Sale } from './sales';

export type PaymentProviderCode = 'wave' | 'orange_money' | 'mtn_money' | 'paypal' | 'saspay';

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
  months?: number;
  status_label?: string;
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

export interface SasPayMethodGroup {
  code: 'mobile_money' | 'card' | 'other' | string;
  label: string;
  methods: { code: string; label: string }[];
}

export async function fetchSasPayMethods(): Promise<{ country: string; groups: SasPayMethodGroup[] }> {
  const { data } = await api.get('/payments/saspay/methods/');
  return data as { country: string; groups: SasPayMethodGroup[] };
}

export async function createSasPaySaleCheckout(saleId: number) {
  const { data } = await api.post('/payments/saspay/checkout/', { sale_id: saleId });
  return data as { checkout: WaveCheckout; sale: Sale };
}

export async function createSasPaySubscriptionCheckout(
  planCode: string,
  billingCycle: 'monthly' | 'annual',
  months?: number,
) {
  const { data } = await api.post('/payments/saspay/checkout/', {
    plan_code: planCode,
    billing_cycle: billingCycle,
    months: months ?? (billingCycle === 'annual' ? 12 : 1),
  });
  return data as { checkout: SubscriptionWaveCheckout };
}

export async function fetchSasPayStatus(params: {
  subscription_checkout_id?: number;
  client_reference?: string;
}) {
  const { data } = await api.get('/payments/saspay/status/', { params });
  return data as PaymentStatus & { client_reference?: string; detail?: string };
}

export async function createSubscriptionWaveCheckout(
  planCode: string,
  billingCycle: 'monthly' | 'annual',
  provider: PaymentProviderCode = 'wave',
  phone?: string,
  months?: number,
) {
  const { data } = await api.post('/payments/wave/subscription/', {
    plan_code: planCode,
    billing_cycle: billingCycle,
    provider,
    phone,
    months: months ?? (billingCycle === 'annual' ? 12 : 1),
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

export async function capturePayPalOrder(orderId: string) {
  const { data } = await api.post('/payments/paypal/capture/', {
    order_id: orderId,
  }, { timeout: 45000 });
  return data as { status: string; order_id: string };
}

export async function fetchPayPalConfig() {
  const { data } = await api.get('/payments/paypal/config/');
  return data as {
    configured: boolean;
    client_id: string;
    mode: string;
    currency: string;
  };
}
