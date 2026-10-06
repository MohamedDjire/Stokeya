export type StockStatus = 'ok' | 'low' | 'out_of_stock';

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  ok: 'OK',
  low: 'Stock faible',
  out_of_stock: 'Rupture',
};

export const STOCK_STATUS_COLORS: Record<StockStatus, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  low: 'warning',
  out_of_stock: 'error',
};

/** Couleurs hex pour bordures / accents (orange = faible, rouge = rupture). */
export const STOCK_STATUS_HEX: Record<StockStatus, string> = {
  ok: '#2E7D32',
  low: '#E65100',
  out_of_stock: '#C62828',
};

export function resolveStockStatus(
  quantity: number | string | null | undefined,
  minStock: number | string | null | undefined,
  avgQuantity?: number | string | null,
): StockStatus {
  const qty = Number(quantity || 0);
  if (qty <= 0) return 'out_of_stock';
  let threshold = Number(minStock || 0);
  if (threshold <= 0) {
    const avg = Number(avgQuantity || 0);
    threshold = avg > 0 ? avg : 5;
  }
  if (qty <= threshold) return 'low';
  return 'ok';
}
