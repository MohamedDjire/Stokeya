import axios from 'axios';
import { api } from './client';
import { API_BASE_URL } from '../config/api';

const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

export interface ShopInfo {
  id: number;
  slug: string;
  code: string;
  name: string;
  description: string;
  whatsapp: string;
  hours: string;
  phone?: string;
  address?: string;
  show_prices: boolean;
  show_stock: boolean;
  payment_timing?: 'on_delivery' | 'before_delivery' | 'both';
  wave_number?: string;
  orange_money_number?: string;
  accept_cod?: boolean;
  accept_wave?: boolean;
  accept_orange_money?: boolean;
  logo?: string | null;
  cover_image?: string | null;
  primary_color?: string;
  secondary_color?: string;
  company_name?: string;
  shop_slug?: string;
  shop_code?: string;
  shop_description?: string;
  shop_banner?: string | null;
  shop_whatsapp?: string;
  shop_hours?: string;
  shop_show_prices?: boolean;
  shop_show_stock?: boolean;
}

export interface ShopProduct {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  packaging: string;
  image: string | null;
  price: string | null;
  wholesale_price: string | null;
  wholesale_min_qty?: number | string | null;
  tax_rate?: string;
  stock_available: number | null;
  min_stock?: number | null;
  stock_status?: 'ok' | 'low' | 'out_of_stock' | string | null;
  reserved?: number | null;
  category_name?: string | null;
  category_id?: number | null;
  description?: string;
  in_stock?: boolean;
  location_hint?: string;
}

export interface ShopOrderItemPayload {
  product_id: number;
  quantity: number;
  unit_price?: number;
  discount?: number;
}

export interface ShopOrderPayload {
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  city?: string;
  delivery_method: 'delivery' | 'pickup';
  payment_method: 'cod' | 'wave' | 'orange_money';
  payment_reference?: string;
  notes?: string;
  items: ShopOrderItemPayload[];
}

export interface ShopOrderItem {
  id: number;
  product: number;
  product_name: string;
  sku: string;
  barcode: string;
  packaging: string;
  location_hint: string;
  quantity: string;
  unit_price: string;
  discount: string;
  tax_rate: string;
  total: string;
}

export interface ShopOrderResult {
  id: number;
  reference: string;
  status: string;
  status_display?: string;
  total: string;
  subtotal?: string;
  tax_amount?: string;
  delivery_fee?: string;
  discount_amount?: string;
  customer_name?: string;
  customer_phone?: string;
  phone?: string;
  address?: string;
  city?: string;
  delivery_method?: string;
  payment_method?: string;
  payment_status?: string;
  payment_reference?: string;
  sale?: number | null;
  comment?: string;
  client_note?: string;
  items?: ShopOrderItem[];
  items_count?: number;
  total_quantity?: string;
  stock_reserved?: boolean;
  stock_deducted?: boolean;
  status_history?: Array<{ status: string; at: string; by: string; note?: string }>;
  created_at?: string;
}

function normalizeShop(data: ShopInfo): ShopInfo {
  return {
    ...data,
    slug: data.slug || data.shop_slug || '',
    code: data.code || data.shop_code || '',
    name: data.name || data.company_name || 'Boutique',
    description: data.description || data.shop_description || '',
    whatsapp: data.whatsapp || data.shop_whatsapp || '',
    hours: data.hours || data.shop_hours || '',
    show_prices: data.show_prices ?? data.shop_show_prices ?? true,
    show_stock: data.show_stock ?? data.shop_show_stock ?? false,
    cover_image: data.cover_image || data.shop_banner || null,
    payment_timing: data.payment_timing || 'on_delivery',
    wave_number: data.wave_number || '',
    orange_money_number: data.orange_money_number || '',
    accept_cod: data.accept_cod !== false,
    accept_wave: data.accept_wave !== false,
    accept_orange_money: data.accept_orange_money !== false,
  };
}

function normalizeProduct(p: Record<string, unknown>): ShopProduct {
  return {
    id: Number(p.id),
    name: String(p.name || ''),
    sku: String(p.sku || ''),
    barcode: String(p.barcode || ''),
    packaging: String(p.packaging || 'unité'),
    image: (p.image as string) || null,
    price: p.sale_price != null ? String(p.sale_price) : (p.price != null ? String(p.price) : null),
    wholesale_price: p.wholesale_price != null ? String(p.wholesale_price) : null,
    wholesale_min_qty: p.wholesale_min_qty != null ? Number(p.wholesale_min_qty) : 10,
    tax_rate: p.tax_rate != null ? String(p.tax_rate) : '0',
    stock_available: p.available_quantity != null
      ? Number(p.available_quantity)
      : (p.stock_quantity != null ? Number(p.stock_quantity) : null),
    min_stock: p.min_stock != null ? Number(p.min_stock) : null,
    stock_status: (p.stock_status as ShopProduct['stock_status']) || null,
    reserved: p.reserved_quantity != null ? Number(p.reserved_quantity) : null,
    category_name: (p.category as string) || (p.category_name as string) || null,
    category_id: p.category_id != null ? Number(p.category_id) : null,
    description: (p.description as string) || '',
    in_stock: Boolean(p.in_stock ?? true),
    location_hint: String(p.location_hint || ''),
  };
}

export async function fetchShopBySlug(slug: string): Promise<ShopInfo> {
  const { data } = await publicApi.get(`/shop/${slug}/`);
  return normalizeShop(data);
}

export async function fetchShopByCode(code: string): Promise<ShopInfo> {
  const { data } = await publicApi.get(`/shop/${code}/`);
  return normalizeShop(data);
}

export async function fetchShopHome(slug: string) {
  const { data } = await publicApi.get(`/shop/${slug}/home/`);
  return {
    ...data,
    newest: (data.newest || []).map(normalizeProduct),
    bestsellers: (data.bestsellers || []).map(normalizeProduct),
    promotions: (data.promotions || []).map(normalizeProduct),
  };
}

export async function fetchShopProducts(slug: string, search?: string, category?: number): Promise<ShopProduct[]> {
  const { data } = await publicApi.get(`/shop/${slug}/products/`, {
    params: { search: search || undefined, category: category || undefined },
  });
  return (data.results ?? data).map(normalizeProduct);
}

export async function lookupShopProduct(slug: string, code: string): Promise<ShopProduct> {
  const { data } = await publicApi.get(`/shop/${slug}/lookup/`, { params: { code } });
  return normalizeProduct(data);
}

export async function createShopOrder(slug: string, payload: ShopOrderPayload): Promise<ShopOrderResult> {
  const { data } = await publicApi.post(`/shop/${slug}/orders/`, payload);
  return data;
}

export async function trackShopOrder(reference: string, phone: string): Promise<ShopOrderResult> {
  const { data } = await publicApi.get('/shop/track/', { params: { reference, phone } });
  return data;
}

export const SHOP_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  validated: 'Validée',
  preparing: 'Préparation',
  ready: 'Prête',
  delivered: 'Livrée',
  completed: 'Terminée',
  cancelled: 'Annulée',
  received: 'En attente',
  accepted: 'Validée',
  shipped: 'Prête',
  delivering: 'Prête',
  refused: 'Annulée',
};

export const SHOP_ORDER_STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'warning',
  validated: 'info',
  preparing: 'info',
  ready: 'success',
  delivered: 'success',
  completed: 'success',
  cancelled: 'error',
};

export const SHOP_ORDER_NEXT: Record<string, string[]> = {
  pending: ['validated', 'cancelled'],
  validated: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: ['completed'],
  received: ['validated', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
};

export type ShopOrder = ShopOrderResult & {
  branch_name?: string;
  customer_phone?: string;
  notes?: string;
  adjustment_note?: string;
  requires_client_approval?: boolean;
};

export async function fetchShopOrders(params?: { status?: string; branch?: number }): Promise<ShopOrder[]> {
  const { data } = await api.get('/shop-orders/', { params });
  const rows = data.results ?? data;
  return rows.map((o: ShopOrder & { first_name?: string; last_name?: string; phone?: string }) => ({
    ...o,
    customer_name: o.customer_name || `${o.first_name || ''} ${o.last_name || ''}`.trim(),
    customer_phone: o.customer_phone || o.phone || '',
  }));
}

export async function fetchPendingShopOrdersCount(): Promise<number> {
  const { data } = await api.get('/shop-orders/pending-count/');
  return data.count ?? 0;
}

export async function fetchShopOrder(id: number): Promise<ShopOrder> {
  const { data } = await api.get(`/shop-orders/${id}/`);
  return {
    ...data,
    customer_name: data.customer_name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
    customer_phone: data.customer_phone || data.phone || '',
  };
}

export async function updateShopOrderStatus(id: number, status: string): Promise<ShopOrder> {
  const { data } = await api.post(`/shop-orders/${id}/update-status/`, { status });
  return data;
}

export async function fetchPickingList(id: number) {
  const { data } = await api.get(`/shop-orders/${id}/picking-list/`);
  return data as {
    reference: string;
    customer: string;
    status: string;
    lines: Array<{
      product_name: string; sku: string; quantity: string; location: string; packaging: string;
    }>;
  };
}

export async function updateShopOrderItems(id: number, items: ShopOrderItemPayload[]) {
  const { data } = await api.post(`/shop-orders/${id}/update-items/`, { items, notify_client: true });
  return data as ShopOrder;
}

export async function markShopOrderPaid(id: number, payment_reference?: string): Promise<ShopOrder> {
  const { data } = await api.post(`/shop-orders/${id}/mark-paid/`, {
    payment_reference: payment_reference || '',
  });
  return data;
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Non payé',
  pending: 'En attente',
  paid: 'Payé',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'À la livraison',
  wave: 'Wave',
  orange_money: 'Orange Money',
  mtn_money: 'MTN Money',
  card: 'Carte',
  mixed: 'Mixte',
};
