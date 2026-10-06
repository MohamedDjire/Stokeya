import { API_BASE_URL } from '../../config/api';
import type { ShopInfo, ShopProduct } from '../../api/shop';

export function shopImageUrl(image: string | null | undefined): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('blob:')) {
    return image;
  }
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${image.startsWith('/') ? '' : '/'}${image}`;
}

export function unitPrice(p: ShopProduct, qty: number): number {
  const wholesale = Number(p.wholesale_price || 0);
  const retail = Number(p.price || 0);
  const minQty = Number(p.wholesale_min_qty || 10);
  if (wholesale > 0 && qty >= minQty) return wholesale;
  return retail;
}

export type ShopPaymentChoice = 'cod' | 'wave' | 'orange_money';

export function availablePaymentMethods(
  shop: ShopInfo,
): Array<{ value: ShopPaymentChoice; label: string; hint?: string }> {
  const timing = shop.payment_timing || 'on_delivery';
  const options: Array<{ value: ShopPaymentChoice; label: string; hint?: string }> = [];
  if (shop.accept_cod !== false && timing !== 'before_delivery') {
    options.push({ value: 'cod', label: 'Paiement à la livraison', hint: 'Payez le livreur à réception' });
  }
  if (shop.accept_wave !== false && shop.wave_number) {
    options.push({ value: 'wave', label: 'Wave', hint: shop.wave_number });
  }
  if (shop.accept_orange_money !== false && shop.orange_money_number) {
    options.push({ value: 'orange_money', label: 'Orange Money', hint: shop.orange_money_number });
  }
  if (!options.length) {
    options.push({ value: 'cod', label: 'Paiement à la livraison' });
  }
  return options;
}

export const TRACK_STEPS = [
  { key: 'pending', label: 'Commande reçue', desc: 'Votre commande est enregistrée' },
  { key: 'validated', label: 'Validée', desc: 'Confirmée par le vendeur' },
  { key: 'preparing', label: 'Préparation', desc: 'Articles en cours de préparation' },
  { key: 'ready', label: 'Prête', desc: 'Prête pour livraison ou retrait' },
  { key: 'delivered', label: 'Livrée', desc: 'Commande remise au client' },
  { key: 'completed', label: 'Terminée', desc: 'Commande clôturée' },
] as const;

const STATUS_INDEX: Record<string, number> = {
  pending: 0, received: 0,
  validated: 1, accepted: 1,
  preparing: 2,
  ready: 3, shipped: 3, delivering: 3,
  delivered: 4,
  completed: 5,
  cancelled: -1, refused: -1,
};

export function trackStepIndex(status: string): number {
  return STATUS_INDEX[status] ?? 0;
}
