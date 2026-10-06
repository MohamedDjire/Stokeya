import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Linking, Modal, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Card,
  IconButton,
  Menu,
  Searchbar,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import * as Print from 'expo-print';
import { fetchProducts, type Product } from '../api/auth';
import { fetchCustomers, type Customer } from '../api/customers';
import { openCashRegister, closeCashRegister, fetchCashRegisters, type CashRegister } from '../api/cashRegisters';
import { fetchProductByBarcode } from '../api/products';
import { checkoutSale, fetchBranches, fetchSaleReceipt } from '../api/sales';
import { fetchWarehouses } from '../api/stock';
import BarcodeScanner from '../components/BarcodeScanner';
import OfflineBanner from '../components/OfflineBanner';
import { cacheCatalog, cachePosContext, enqueueOfflineSale, loadCachedCatalog, loadPosContext } from '../offline/storage';
import { buildOfflineSaleFromCart, isOnline } from '../offline/sync';
import { API_BASE_URL } from '../config/api';
import { webPaymentUrl } from '../config/web';
import { colors, spacing } from '../theme/colors';
import { unitPriceForQty } from '../utils/pricing';

type CartLine = { product: Product; quantity: number };

function productImageUrl(image: string | null | undefined): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('http')) return image;
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${image.startsWith('/') ? '' : '/'}${image}`;
}

export default function POSScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [cashRegisterId, setCashRegisterId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [view, setView] = useState('catalog');
  const [showScanner, setShowScanner] = useState(false);
  const [customerMenu, setCustomerMenu] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await loadCachedCatalog();
      if (!cancelled && cached.length) {
        setProducts(cached as Product[]);
        setLoading(false);
        const ctx = await loadPosContext();
        if (ctx) {
          setBranchId(ctx.branchId);
          setWarehouseId(ctx.warehouseId);
          setCashRegisterId(ctx.cashRegisterId);
        }
      }
      try {
        const [productData, branches, warehouses, customerData, registers] = await Promise.all([
          fetchProducts(),
          fetchBranches(),
          fetchWarehouses(),
          fetchCustomers(),
          fetchCashRegisters(),
        ]);
        if (cancelled) return;
        setProducts(productData);
        setCustomers(customerData);
        setCashRegisters(registers);
        const nextBranch = branches[0]?.id || null;
        setBranchId(nextBranch);
        const wh = warehouses.find((w) => w.is_default) || warehouses[0];
        setWarehouseId(wh?.id || null);
        const openReg = registers.find((r) => r.is_open);
        if (openReg) setCashRegisterId(openReg.id);
        void cacheCatalog(productData.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          sale_price: p.sale_price,
          wholesale_price: p.wholesale_price,
          wholesale_min_qty: p.wholesale_min_qty,
          image: p.image,
          barcodes: p.barcodes,
          total_stock: p.total_stock,
        })));
        void cachePosContext({
          branchId: nextBranch,
          warehouseId: wh?.id || null,
          cashRegisterId: openReg?.id || null,
        });
      } catch {
        if (!cancelled && !cached.length) {
          Alert.alert('Erreur', 'Impossible de charger le catalogue (pas de cache).');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcodes?.some((b) => b.code.includes(q)),
    );
  }, [products, search]);

  const total = cart.reduce(
    (sum, line) => sum + line.quantity * unitPriceForQty(line.product, line.quantity),
    0,
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const activeRegister = cashRegisters.find((r) => r.id === cashRegisterId);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setView('cart');
  };

  const resolveBarcode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const product = await fetchProductByBarcode(trimmed);
      addToCart(product);
      setSearch('');
    } catch {
      Alert.alert('Introuvable', `Aucun produit pour le code ${trimmed}`);
    }
  };

  const handleScan = async (code: string) => {
    setShowScanner(false);
    await resolveBarcode(code);
  };

  /** Scanner USB/Bluetooth (mode clavier) ou Entrée après saisie. */
  const handleSearchSubmit = async () => {
    const value = search.trim();
    if (!value) return;
    if (/^[0-9A-Za-z\-_.]{4,}$/.test(value) && !/\s/.test(value)) {
      await resolveBarcode(value);
      return;
    }
    if (filtered.length === 1) {
      addToCart(filtered[0]);
      setSearch('');
    }
  };

  const updateQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.product.id === productId
            ? { ...l, quantity: Math.max(0, l.quantity + delta) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  };

  const printReceipt = async (saleId: number): Promise<boolean> => {
    try {
      const receipt = await fetchSaleReceipt(saleId);
      await Print.printAsync({ html: receipt.html });
      return true;
    } catch {
      return false;
    }
  };

  const saveOfflineCashSale = async () => {
    if (!branchId) return;
    const offlineSale = buildOfflineSaleFromCart({
      branchId,
      warehouseId,
      customerId,
      cashRegisterId,
      cart,
    });
    await enqueueOfflineSale(offlineSale);
    setCart([]);
    setCustomerId(null);
    setView('catalog');
    Alert.alert(
      'Vente enregistrée hors ligne',
      `${offlineSale.local_total.toLocaleString('fr-FR')} XOF\nElle sera synchronisée dès le retour du réseau.`,
    );
  };

  const processSale = async (paymentMethod: 'cash' | 'mobile_money') => {
    if (!branchId || !cart.length) {
      Alert.alert('Panier vide', 'Ajoutez des produits avant de vendre.');
      return;
    }

    const online = await isOnline();
    if (!online) {
      if (paymentMethod !== 'cash') {
        Alert.alert('Hors ligne', 'Le Mobile Money nécessite une connexion. Utilisez Espèces.');
        return;
      }
      setProcessing(true);
      try {
        await saveOfflineCashSale();
      } finally {
        setProcessing(false);
      }
      return;
    }

    setProcessing(true);
    try {
      const sale = await checkoutSale({
        branch_id: branchId,
        warehouse_id: warehouseId || undefined,
        customer_id: customerId || undefined,
        cash_register_id: cashRegisterId || undefined,
        payment_method: paymentMethod,
        items: cart.map((l) => ({
          product_id: l.product.id,
          quantity: String(l.quantity),
          unit_price: String(unitPriceForQty(l.product, l.quantity)),
        })),
      });
      if (paymentMethod === 'mobile_money') {
        const url = webPaymentUrl(`/payment/sale/${sale.id}`);
        setCart([]);
        setCustomerId(null);
        Alert.alert(
          'Paiement Mobile Money',
          `Vente ${sale.reference} créée. Payez sur la page sécurisée SasPay : mobile money, carte ou autre moyen.`,
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Ouvrir le paiement', onPress: () => Linking.openURL(url) },
          ],
        );
      } else {
        setCart([]);
        setView('catalog');
        const printed = await printReceipt(sale.id);
        Alert.alert(
          'Vente réussie',
          printed
            ? `${sale.reference}\n${Number(sale.total).toLocaleString('fr-FR')} XOF\nTicket envoyé à l'imprimante.`
            : `${sale.reference}\n${Number(sale.total).toLocaleString('fr-FR')} XOF\nImpression indisponible.`,
        );
        return;
      }
      setCart([]);
      setView('catalog');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail || 'Vente impossible';
      const noResponse = !(err as { response?: unknown }).response;
      if (paymentMethod === 'cash' && noResponse) {
        await saveOfflineCashSale();
        return;
      }
      Alert.alert('Erreur', message);
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenRegister = async () => {
    const reg = cashRegisters[0];
    if (!reg) return;
    try {
      const updated = await openCashRegister(reg.id, openingBalance || '0');
      setCashRegisters((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setCashRegisterId(updated.id);
      Alert.alert('Caisse ouverte', `Fond: ${openingBalance} XOF`);
    } catch {
      Alert.alert('Erreur', 'Ouverture impossible.');
    }
  };

  const handleCloseRegister = async () => {
    if (!activeRegister) return;
    try {
      const result = await closeCashRegister(activeRegister.id, String(total));
      Alert.alert(
        'Caisse fermée',
        `Ventes session: ${Number(result.session_sales_total || 0).toLocaleString('fr-FR')} XOF`,
      );
      setCashRegisterId(null);
      const regs = await fetchCashRegisters();
      setCashRegisters(regs);
    } catch {
      Alert.alert('Erreur', 'Clôture impossible.');
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />;
  }

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.Content
          title="Caisse"
          subtitle={`${total.toLocaleString('fr-FR')} XOF · ${activeRegister?.is_open ? 'Ouverte' : 'Fermée'}`}
        />
        <Appbar.Action icon="barcode-scan" onPress={() => setShowScanner(true)} />
        <Menu visible={customerMenu} onDismiss={() => setCustomerMenu(false)} anchor={
          <Appbar.Action icon="account" onPress={() => setCustomerMenu(true)} />
        }>
          <Menu.Item title="Sans client" onPress={() => { setCustomerId(null); setCustomerMenu(false); }} />
          {customers.map((c) => (
            <Menu.Item key={c.id} title={c.name} onPress={() => { setCustomerId(c.id); setCustomerMenu(false); }} />
          ))}
        </Menu>
      </AppHeader>

      <OfflineBanner />

      {selectedCustomer && (
        <Text style={styles.customerBadge}>Client: {selectedCustomer.name}</Text>
      )}

      {!activeRegister?.is_open && (
        <View style={styles.registerBar}>
          <TextInput label="Fond de caisse" mode="outlined" dense value={openingBalance}
            onChangeText={setOpeningBalance} keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Button mode="contained" onPress={handleOpenRegister}>Ouvrir</Button>
        </View>
      )}
      {activeRegister?.is_open && (
        <View style={styles.registerBar}>
          <Text variant="bodySmall">Caisse ouverte depuis {activeRegister.opened_at?.slice(11, 16)}</Text>
          <Button mode="outlined" onPress={handleCloseRegister}>Clôturer</Button>
        </View>
      )}

      <SegmentedButtons
        value={view}
        onValueChange={setView}
        style={styles.segment}
        buttons={[
          { value: 'catalog', label: 'Catalogue', icon: 'format-list-bulleted' },
          { value: 'cart', label: `Panier (${cart.length})`, icon: 'cart' },
        ]}
      />

      {view === 'catalog' ? (
        <>
          <Searchbar
            placeholder="Scannez ou recherchez un produit"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            onIconPress={handleSearchSubmit}
            style={styles.search}
            autoCapitalize="none"
          />
          <Button mode="outlined" icon="camera" onPress={() => setShowScanner(true)} style={styles.scanBtn}>
            Scanner avec la caméra
          </Button>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.productList}
            renderItem={({ item }) => {
              const img = productImageUrl(item.image);
              return (
                <Card style={styles.productCard} onPress={() => addToCart(item)} mode="elevated">
                  <Card.Content style={styles.productRow}>
                    {img ? (
                      <Image source={{ uri: img }} style={styles.thumb} />
                    ) : (
                      <Avatar.Icon size={48} icon="package-variant" style={styles.thumbPlaceholder} color={colors.primary} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text variant="titleSmall" style={styles.productName}>{item.name}</Text>
                      <Text variant="bodySmall" style={styles.productPrice}>
                        {Number(item.sale_price).toLocaleString('fr-FR')} F
                      </Text>
                      {Number(item.wholesale_price || 0) > 0 && (
                        <Text variant="labelSmall" style={{ color: '#2E7D32', fontWeight: '700' }}>
                          Gros {Number(item.wholesale_price).toLocaleString('fr-FR')} F dès {Number(item.wholesale_min_qty || 10)}
                        </Text>
                      )}
                    </View>
                    <IconButton icon="plus-circle" iconColor={colors.primary} size={28} onPress={() => addToCart(item)} />
                  </Card.Content>
                </Card>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>Aucun produit trouvé</Text>}
          />
        </>
      ) : (
        <View style={styles.cartContainer}>
          <FlatList
            data={cart}
            keyExtractor={(item) => item.product.id.toString()}
            contentContainerStyle={styles.cartList}
            ListEmptyComponent={<Text style={styles.empty}>Panier vide</Text>}
            renderItem={({ item }) => (
              <View style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLarge" style={styles.cartName}>{item.product.name}</Text>
                  <Text variant="bodySmall" style={styles.cartPrice}>
                    {(item.quantity * unitPriceForQty(item.product, item.quantity)).toLocaleString('fr-FR')} F
                  </Text>
                </View>
                <IconButton icon="minus-circle-outline" size={22} onPress={() => updateQty(item.product.id, -1)} />
                <Text variant="titleMedium" style={styles.qty}>{item.quantity}</Text>
                <IconButton icon="plus-circle-outline" size={22} onPress={() => updateQty(item.product.id, 1)} />
              </View>
            )}
          />
          <View style={styles.checkout}>
            <Text variant="headlineSmall" style={styles.total}>{total.toLocaleString('fr-FR')} XOF</Text>
            <Button mode="contained" icon="cash" loading={processing} onPress={() => processSale('cash')}
              style={styles.payBtn} contentStyle={styles.payBtnContent}>Espèces</Button>
            <Button mode="contained-tonal" icon="cellphone" loading={processing}
              onPress={() => processSale('mobile_money')} style={styles.payBtn} contentStyle={styles.payBtnContent}>
              Wave / Orange Money
            </Button>
          </View>
        </View>
      )}

      <Modal visible={showScanner} animationType="slide">
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  loader: { marginTop: 48 },
  customerBadge: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, color: colors.secondary, fontWeight: '600' },
  registerBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, paddingBottom: 0 },
  segment: { margin: spacing.md, marginBottom: spacing.sm },
  search: { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surface },
  scanBtn: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  productList: { padding: spacing.md, paddingTop: 0, paddingBottom: spacing.xl },
  productCard: { marginBottom: spacing.sm, backgroundColor: colors.surface },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#E5E7EB' },
  thumbPlaceholder: { backgroundColor: `${colors.primary}15` },
  productName: { fontWeight: '600' },
  productPrice: { color: colors.primary, marginTop: 2, fontWeight: '600' },
  cartContainer: { flex: 1 },
  cartList: { padding: spacing.md, flexGrow: 1 },
  cartRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 12, padding: spacing.sm, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  cartName: { fontWeight: '600' },
  cartPrice: { color: colors.textMuted },
  qty: { minWidth: 24, textAlign: 'center', fontWeight: '700' },
  checkout: { padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  total: { fontWeight: '800', color: colors.primary, textAlign: 'center', marginBottom: spacing.md },
  payBtn: { marginBottom: spacing.sm },
  payBtnContent: { paddingVertical: 6 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
});
