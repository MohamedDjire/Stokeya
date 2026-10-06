import { api } from './client';
import type { Company } from './company';

export type { Company };

export interface CompanyPreferences {
  regional: {
    language: string;
    timezone: string;
    date_format: string;
    time_format: string;
    number_format: string;
    amount_format: string;
    fx_base?: string;
    fx_rates?: Record<string, number>;
  };
  commercial: {
    allow_sales_without_stock: boolean;
    show_purchase_price: boolean;
    show_margin: boolean;
    confirm_before_sale: boolean;
    auto_invoice_after_sale: boolean;
    auto_print_receipt: boolean;
    low_stock_alerts: boolean;
    global_alert_threshold: number | null;
    allow_negative_stock: boolean;
    cost_method: 'fifo' | 'last_purchase' | 'average' | string;
    auto_product_code: boolean;
    auto_product_reference: boolean;
    show_variants: boolean;
    track_expiry_dates: boolean;
  };
  display: {
    theme: 'light' | 'dark' | 'auto' | string;
    primary_color: string;
    show_logo_in_menu: boolean;
    dashboard_style: string;
    page_size: number;
  };
  notifications: {
    channels: Record<string, boolean>;
    events: Record<string, boolean>;
  };
  documents: {
    invoice_auto_number: boolean;
    invoice_prefix: string;
    receipt_show_logo: boolean;
    receipt_show_address: boolean;
    receipt_show_phone: boolean;
    receipt_show_qr: boolean;
    receipt_footer: string;
  };
  security: {
    auto_logout_minutes: number;
    session_duration_hours: number;
    confirm_before_delete: boolean;
    hide_sensitive_info: boolean;
    multi_device_login: boolean;
    two_factor_auth: boolean;
  };
  backup: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | string;
    hour: string;
    last_backup_at: string | null;
    last_backup_size: string | null;
  };
  automation: {
    low_stock_notify: boolean;
    low_stock_create_alert: boolean;
    low_stock_auto_request: boolean;
    sale_generate_invoice: boolean;
    sale_send_to_customer: boolean;
    online_order_notify_manager: boolean;
    online_order_update_stock: boolean;
  };
  advanced: {
    maintenance_mode: boolean;
  };
}

export interface PreferencesAbout {
  product: string;
  version: string;
  updated_at: string;
  license: string;
  support_email: string;
  terms_url: string;
  privacy_url: string;
}

export interface PreferencesPayload {
  company: Company & { slogan?: string; website?: string; tax_id?: string };
  preferences: CompanyPreferences;
  about: PreferencesAbout;
  defaults?: CompanyPreferences;
}

export async function fetchPreferences(): Promise<PreferencesPayload> {
  const { data } = await api.get('/company/preferences/');
  return data;
}

export async function updatePreferences(payload: {
  company?: Partial<Company & { slogan?: string; website?: string; tax_id?: string }>;
  preferences?: Partial<CompanyPreferences>;
}): Promise<PreferencesPayload> {
  const { data } = await api.patch('/company/preferences/', payload);
  return data;
}

export async function uploadCompanyLogo(file: File): Promise<Company> {
  const form = new FormData();
  form.append('logo', file);
  const { data } = await api.post('/company/me/logo/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
