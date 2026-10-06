import { api } from './client';

export interface SubscriptionPaymentRow {
  id: number;
  provider: string;
  provider_label: string;
  client_reference: string;
  amount: string;
  currency: string;
  status: string;
  status_label: string;
  plan_code: string;
  plan_name: string;
  billing_cycle: string;
  months: number;
  created_at: string;
}

export async function fetchSubscriptionPaymentHistory(): Promise<SubscriptionPaymentRow[]> {
  const { data } = await api.get('/payments/subscription-history/');
  return data;
}

export async function fetchSubscriptionDocument(
  id: number,
  type: 'invoice' | 'receipt' = 'invoice',
): Promise<{ reference: string; html: string; type: string }> {
  const { data } = await api.get(`/payments/subscription-history/${id}/document/`, {
    params: { type },
  });
  return data;
}

export function openHtmlDocument(html: string, title: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.document.title = title;
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
  }, 300);
}
