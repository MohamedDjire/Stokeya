export type WholesaleDiscountType = 'price' | 'percent' | 'amount';

export type PricedProduct = {
  sale_price?: string | number | null;
  wholesale_price?: string | number | null;
  wholesale_min_qty?: string | number | null;
};

export function unitPriceForQty(product: PricedProduct, qty: number): number {
  const retail = Number(product.sale_price || 0);
  const wholesale = Number(product.wholesale_price || 0);
  const minQty = Number(product.wholesale_min_qty || 10);
  if (wholesale > 0 && qty >= minQty) return wholesale;
  return retail;
}

export function previewWholesalePrice(
  salePrice: string,
  type: WholesaleDiscountType,
  value: string,
  directPrice: string,
): number | null {
  const retail = Number(salePrice || 0);
  if (type === 'percent') {
    const pct = Number(value || 0);
    if (pct <= 0 || pct >= 100 || retail <= 0) return null;
    return Math.round((retail * (100 - pct) / 100) * 100) / 100;
  }
  if (type === 'amount') {
    const amount = Number(value || 0);
    if (amount <= 0 || amount >= retail) return null;
    return Math.round((retail - amount) * 100) / 100;
  }
  const price = Number(directPrice || 0);
  return price > 0 ? price : null;
}
