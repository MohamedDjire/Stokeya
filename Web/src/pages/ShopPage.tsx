import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, CircularProgress } from '@mui/material';
import {
  createShopOrder,
  fetchShopByCode,
  fetchShopBySlug,
  fetchShopHome,
  fetchShopProducts,
  lookupShopProduct,
  trackShopOrder,
  type ShopInfo,
  type ShopOrderResult,
  type ShopProduct,
} from '../api/shop';
import { getApiErrorMessage } from '../api/client';
import ShopShell from '../components/shop/ShopShell';
import ShopNavTabs from '../components/shop/ShopNavTabs';
import ShopCatalog from '../components/shop/ShopCatalog';
import ShopQuickOrder from '../components/shop/ShopQuickOrder';
import ShopTracking from '../components/shop/ShopTracking';
import {
  ShopCartDialog,
  ShopCheckoutDialog,
  ShopFloatingCartFab,
  ShopMobileCartBar,
  ShopOrderSuccessDialog,
  type CheckoutForm,
} from '../components/shop/ShopCartDialogs';
import { unitPrice, availablePaymentMethods } from '../components/shop/utils';
import { useLocale } from '../locale/useLocale';

const checkoutEmpty: CheckoutForm = {
  customer_name: '',
  customer_phone: '',
  customer_address: '',
  city: '',
  delivery_method: 'delivery',
  payment_method: 'cod',
  payment_reference: '',
  notes: '',
};

export default function ShopPage() {
  const { tr, version } = useLocale();
  void version;
  const { slug, code } = useParams<{ slug?: string; code?: string }>();
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [cart, setCart] = useState<Record<number, number>>({});
  const [cartProducts, setCartProducts] = useState<Record<number, ShopProduct>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState(checkoutEmpty);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<ShopOrderResult | null>(null);
  const [quickCode, setQuickCode] = useState('');
  const [quickQty, setQuickQty] = useState('1');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [trackRef, setTrackRef] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [trackResult, setTrackResult] = useState<ShopOrderResult | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  const primary = shop?.primary_color || '#0E8A9A';

  useEffect(() => {
    setLoading(true);
    setShopError(null);
    const loader = slug ? fetchShopBySlug(slug) : code ? fetchShopByCode(code) : Promise.reject(new Error('missing'));
    loader
      .then(async (s) => {
        setShop(s);
        const [list, home] = await Promise.all([
          fetchShopProducts(s.slug),
          fetchShopHome(s.slug).catch(() => null),
        ]);
        setProducts(list);
        if (home?.categories) setCategories(home.categories);
        const init: Record<number, number> = {};
        list.forEach((p) => { init[p.id] = 1; });
        setQtys(init);
      })
      .catch((err) => setShopError(getApiErrorMessage(err, tr('Boutique introuvable ou indisponible.'))))
      .finally(() => setLoading(false));
  }, [slug, code]);

  useEffect(() => {
    if (!shop) return;
    const t = setTimeout(() => {
      fetchShopProducts(shop.slug, search, categoryId || undefined).then((list) => {
        setProducts(list);
        setQtys((prev) => {
          const next = { ...prev };
          list.forEach((p) => { if (next[p.id] == null) next[p.id] = 1; });
          return next;
        });
      }).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [search, categoryId, shop]);

  const lines = useMemo(() => (
    Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const pid = Number(id);
        const product = cartProducts[pid] || products.find((p) => p.id === pid);
        return product ? { product, qty } : null;
      })
      .filter(Boolean) as Array<{ product: ShopProduct; qty: number }>
  ), [cart, cartProducts, products]);

  const cartCount = lines.reduce((s, l) => s + l.qty, 0);
  const subtotalHt = lines.reduce((s, l) => s + unitPrice(l.product, l.qty) * l.qty, 0);
  const taxTotal = lines.reduce((s, l) => {
    const ht = unitPrice(l.product, l.qty) * l.qty;
    return s + ht * (Number(l.product.tax_rate || 0) / 100);
  }, 0);
  const grandTotal = subtotalHt + taxTotal;

  const addToCart = (product: ShopProduct, qty?: number) => {
    const q = Math.max(1, qty ?? qtys[product.id] ?? 1);
    setCartProducts((prev) => ({ ...prev, [product.id]: product }));
    setCart((prev) => ({ ...prev, [product.id]: (prev[product.id] || 0) + q }));
  };

  const setCartQty = (productId: number, qty: number) => {
    setCart((prev) => ({ ...prev, [productId]: Math.max(0, qty) }));
  };

  const addQuick = async () => {
    if (!shop || !quickCode.trim()) return;
    setQuickError(null);
    try {
      const product = await lookupShopProduct(shop.slug, quickCode.trim());
      addToCart(product, Math.max(1, Number(quickQty) || 1));
      setQuickCode('');
      setQuickQty('1');
    } catch (err) {
      setQuickError(getApiErrorMessage(err));
    }
  };

  const openCheckout = () => {
    if (!shop) return;
    const methods = availablePaymentMethods(shop);
    setCheckoutForm({ ...checkoutEmpty, payment_method: methods[0]?.value || 'cod' });
    setCheckoutOpen(true);
  };

  const submitOrder = async () => {
    if (!shop) return;
    setSubmitError(null);
    if (!checkoutForm.customer_name || !checkoutForm.customer_phone) {
      setSubmitError(tr('Nom et téléphone sont obligatoires.'));
      return;
    }
    if (checkoutForm.delivery_method === 'delivery' && !checkoutForm.customer_address) {
      setSubmitError(tr('Indiquez une adresse de livraison.'));
      return;
    }
    if (
      checkoutForm.payment_method !== 'cod'
      && shop.payment_timing === 'before_delivery'
      && !checkoutForm.payment_reference.trim()
    ) {
      setSubmitError(tr('Indiquez la référence de votre paiement mobile.'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await createShopOrder(shop.slug, {
        customer_name: checkoutForm.customer_name,
        customer_phone: checkoutForm.customer_phone,
        customer_address: checkoutForm.customer_address || undefined,
        city: checkoutForm.city || undefined,
        delivery_method: checkoutForm.delivery_method,
        payment_method: checkoutForm.payment_method,
        payment_reference: checkoutForm.payment_reference || undefined,
        notes: checkoutForm.notes || undefined,
        items: lines.map((l) => ({
          product_id: l.product.id,
          quantity: l.qty,
          unit_price: unitPrice(l.product, l.qty),
        })),
      });
      setOrderResult(result);
      setCart({});
      setCheckoutOpen(false);
      setCartOpen(false);
      setCheckoutForm(checkoutEmpty);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const doTrack = async () => {
    setTrackError(null);
    try {
      setTrackResult(await trackShopOrder(trackRef, trackPhone));
    } catch (err) {
      setTrackResult(null);
      setTrackError(getApiErrorMessage(err));
    }
  };

  const goToTrack = (ref: string) => {
    setTrackRef(ref);
    setTab(2);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: '#F0F2F5' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (shopError || !shop) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: '#F0F2F5' }}>
        <Alert severity="error" sx={{ maxWidth: 420, borderRadius: 2 }}>{shopError || tr('Boutique introuvable.')}</Alert>
      </Box>
    );
  }

  return (
    <>
      <ShopShell
        shop={shop}
        cartCount={cartCount}
        search={search}
        onSearchChange={setSearch}
        onCartOpen={() => setCartOpen(true)}
        showSearch={tab === 0}
        nav={<ShopNavTabs value={tab} onChange={setTab} primary={primary} />}
      >
        {tab === 0 && (
          <ShopCatalog
            shop={shop}
            products={products}
            categories={categories}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            qtys={qtys}
            onQtyChange={(id, qty) => setQtys((q) => ({ ...q, [id]: qty }))}
            onAddToCart={addToCart}
          />
        )}
        {tab === 1 && (
          <ShopQuickOrder
            shop={shop}
            lines={lines}
            quickCode={quickCode}
            quickQty={quickQty}
            quickError={quickError}
            subtotalHt={subtotalHt}
            taxTotal={taxTotal}
            grandTotal={grandTotal}
            onQuickCodeChange={setQuickCode}
            onQuickQtyChange={setQuickQty}
            onAddQuick={addQuick}
            onSetCartQty={setCartQty}
            onCheckout={openCheckout}
          />
        )}
        {tab === 2 && (
          <ShopTracking
            trackRef={trackRef}
            trackPhone={trackPhone}
            trackError={trackError}
            trackResult={trackResult}
            primary={primary}
            onRefChange={setTrackRef}
            onPhoneChange={setTrackPhone}
            onTrack={doTrack}
          />
        )}
      </ShopShell>

      <ShopMobileCartBar
        visible={cartCount > 0}
        cartCount={cartCount}
        grandTotal={grandTotal}
        primary={primary}
        onOpenCart={() => setCartOpen(true)}
      />

      <ShopFloatingCartFab
        visible={cartCount > 0}
        cartCount={cartCount}
        grandTotal={grandTotal}
        primary={primary}
        onOpenCart={() => setCartOpen(true)}
      />

      <ShopCartDialog
        open={cartOpen}
        lines={lines}
        subtotalHt={subtotalHt}
        taxTotal={taxTotal}
        grandTotal={grandTotal}
        totalQty={cartCount}
        primary={primary}
        onClose={() => setCartOpen(false)}
        onSetQty={setCartQty}
        onCheckout={() => { setCartOpen(false); openCheckout(); }}
      />

      <ShopCheckoutDialog
        open={checkoutOpen}
        shop={shop}
        form={checkoutForm}
        grandTotal={grandTotal}
        submitting={submitting}
        submitError={submitError}
        onClose={() => setCheckoutOpen(false)}
        onChange={setCheckoutForm}
        onSubmit={submitOrder}
      />

      <ShopOrderSuccessDialog
        order={orderResult}
        primary={primary}
        onClose={() => setOrderResult(null)}
        onTrack={goToTrack}
      />
    </>
  );
}
