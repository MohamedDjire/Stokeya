import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemText,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import PageHeader from '../components/PageHeader';
import WebcamBarcodeScanner from '../components/WebcamBarcodeScanner';
import { fetchProducts, type Product } from '../api/auth';
import { fetchProductByBarcode } from '../api/batches';
import { fetchBranches, checkoutSale, fetchSaleReceipt, syncOfflineSales } from '../api/sales';
import { fetchCustomers, type Customer } from '../api/customers';
import { fetchSubscription } from '../api/subscription';
import { getApiErrorMessage } from '../api/client';
import { API_BASE_URL } from '../config/api';
import {
  enqueueOfflineSale,
  getOfflineQueue,
  makeClientReference,
  removeSynced,
  clearOfflineQueue,
} from '../offline/queue';
import { formatCurrency, formatNumber } from '../utils/format';
import { unitPriceForQty } from '../utils/pricing';
import { FEATURE_CUSTOMER_CREDIT, hasPlanFeature } from '../utils/planFeatures';
import { STOCK_STATUS_COLORS, STOCK_STATUS_HEX, STOCK_STATUS_LABELS, resolveStockStatus, type StockStatus } from '../utils/stock';
import { useAppSelector } from '../store/hooks';
import { hasFlag } from '../utils/permissions';
import { cashierStockAlert } from '../api/stockRequests';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { useLocale } from '../locale/useLocale';
import { tr as trStatic } from '../locale/tr';

function formatSyncDetail(detail: unknown): string {
  if (!detail) return trStatic('Erreur inconnue');
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object') {
    try {
      const parts: string[] = [];
      for (const [key, val] of Object.entries(detail as Record<string, unknown>)) {
        if (Array.isArray(val)) parts.push(`${key}: ${val.join(', ')}`);
        else if (val && typeof val === 'object') parts.push(`${key}: ${formatSyncDetail(val)}`);
        else parts.push(`${key}: ${String(val)}`);
      }
      return parts.join(' · ') || JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }
  return String(detail);
}

function productImageUrl(image: string | null | undefined): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('http')) return image;
  return `${API_BASE_URL.replace(/\/api\/v1\/?$/, '')}${image.startsWith('/') ? '' : '/'}${image}`;
}

/** Impression auto via iframe (évite les bloqueurs de pop-up). */
function printReceiptHtml(html: string) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0',
  });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const trigger = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      /* imprimante indisponible */
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 1500);
    }
  };

  if (iframe.contentWindow?.document.readyState === 'complete') {
    window.setTimeout(trigger, 200);
  } else {
    iframe.onload = () => window.setTimeout(trigger, 200);
  }
}

interface CartLine {
  product: Product;
  quantity: number;
}

type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'credit';

/** Heuristique : code-barres typique (chiffres / alphanum compact). */
function looksLikeBarcode(value: string): boolean {
  const v = value.trim();
  if (v.length < 4) return false;
  return /^[0-9A-Za-z\-_.]+$/.test(v) && !/\s/.test(v);
}

export default function POSPage() {
  const { tr, version } = useLocale();
  void version;

  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const searchRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [branch, setBranch] = useState<number | ''>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<number | ''>('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [processing, setProcessing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingOffline, setPendingOffline] = useState(0);
  const [canCredit, setCanCredit] = useState(false);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<number | null>(null);

  const lockedBranch = user?.assigned_branch || user?.scope?.branch_id || null;
  const lockedRegister = user?.assigned_cash_register || user?.scope?.cash_register_id || null;
  const branchLocked = Boolean(lockedBranch && (user?.role_code === 'cashier' || user?.scope?.is_cashier || user?.role_code === 'pos_manager'));
  const canRequestStock = hasFlag(user, 'can_request_stock');
  const canPrint = hasFlag(user, 'can_print_receipt');
  const registerLabel = user?.assigned_cash_register_name;

  const focusSearch = useCallback(() => {
    window.setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const refreshPending = useCallback(() => {
    setPendingOffline(getOfflineQueue().length);
  }, []);

  const flushOffline = useCallback(async () => {
    const queue = getOfflineQueue();
    if (!queue.length) {
      refreshPending();
      return;
    }
    if (!navigator.onLine) {
      setSyncError(tr('Pas de connexion réseau — impossible de synchroniser.'));
      return;
    }

    setSyncingOffline(true);
    setSyncError(null);
    setError(null);
    try {
      const response = await syncOfflineSales(
        queue.map((s) => ({
          client_reference: s.client_reference,
          branch_id: s.branch_id,
          warehouse_id: s.warehouse_id,
          customer_id: s.customer_id,
          cash_register_id: s.cash_register_id,
          payment_method: s.payment_method,
          items: s.items,
          discount_amount: s.discount_amount,
          notes: s.notes,
          is_offline: true,
        })),
      );
      const results = response.results || [];
      const okRefs = results.filter((r) => r.ok && r.client_reference).map((r) => r.client_reference);
      removeSynced(okRefs);
      refreshPending();

      const failed = results.filter((r) => !r.ok);
      if (response.synced > 0) {
        setToast(tr(`${response.synced} vente(s) offline synchronisée(s)`));
      }
      if (failed.length > 0) {
        const first = formatSyncDetail(failed[0].detail);
        setSyncError(
          failed.length === 1
            ? tr(`Synchronisation échouée : ${first}`)
            : tr(`${failed.length} vente(s) non synchronisée(s). Ex. : ${first}`),
        );
      } else if (response.synced === 0 && queue.length > 0) {
        setSyncError(tr('Aucune vente synchronisée. Réessayez ou écartez la file.'));
      }
    } catch (err) {
      setSyncError(getApiErrorMessage(err, tr('Synchronisation impossible. Vérifiez la connexion.')));
    } finally {
      setSyncingOffline(false);
      refreshPending();
    }
  }, [refreshPending, tr]);

  const discardOfflineQueue = () => {
    clearOfflineQueue();
    refreshPending();
    setSyncError(null);
    setToast(tr('Ventes offline écartées'));
  };

  useEffect(() => {
    fetchProducts()
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]));
    fetchBranches().then((b) => {
      setBranches(b);
      if (lockedBranch && b.some((x) => x.id === lockedBranch)) {
        setBranch(lockedBranch);
      } else if (b[0]) {
        setBranch(b[0].id);
      }
    }).catch(() => undefined);
    fetchCustomers().then(setCustomers).catch(() => undefined);
    fetchSubscription()
      .then((s) => setCanCredit(hasPlanFeature(s.features, FEATURE_CUSTOMER_CREDIT)))
      .catch(() => setCanCredit(false));
    focusSearch();
    refreshPending();

    const onOnline = () => { setOnline(true); void flushOffline(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (navigator.onLine) void flushOffline();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [focusSearch, flushOffline, refreshPending, lockedBranch]);

  const requestReplenish = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canRequestStock) return;
    setRequestingId(product.id);
    try {
      await cashierStockAlert({ product_id: product.id });
      setToast(tr(`Demande de réapprovisionnement envoyée — ${product.name}`));
    } catch (err) {
      setError(getApiErrorMessage(err, tr('Demande impossible.')));
    } finally {
      setRequestingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcodes?.some((b) => b.code.toLowerCase().includes(q)),
    );
  }, [products, search]);

  const addToCart = useCallback((product: Product) => {
    const status = (product.stock_status || resolveStockStatus(product.total_stock, product.min_stock)) as StockStatus;
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1 }];
    });
    if (status === 'out_of_stock') {
      setToast(tr(`${product.name} ajouté — attention : rupture de stock`));
    } else if (status === 'low') {
      setToast(tr(`${product.name} ajouté — stock faible`));
    } else {
      setToast(tr(`${product.name} ajouté`));
    }
  }, [tr]);

  const resolveBarcode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return false;
    setScanning(true);
    setError(null);
    try {
      const product = await fetchProductByBarcode(trimmed);
      addToCart(product);
      setSearch('');
      focusSearch();
      return true;
    } catch {
      return false;
    } finally {
      setScanning(false);
    }
  }, [addToCart, focusSearch]);

  const handleSearchKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = search.trim();
    if (!value) return;

    // Scanner USB/Bluetooth : envoie le code puis Entrée
    if (looksLikeBarcode(value)) {
      const found = await resolveBarcode(value);
      if (found) return;
      setError(tr(`Aucun produit pour le code ${value}`));
      setSearch('');
      focusSearch();
      return;
    }

    // Recherche texte : si un seul résultat, l'ajouter
    if (filtered.length === 1) {
      addToCart(filtered[0]);
      setSearch('');
      focusSearch();
    }
  };

  const handleCameraScan = useCallback(async (code: string) => {
    setCameraOpen(false);
    const found = await resolveBarcode(code);
    if (!found) {
      setError(tr(`Aucun produit pour le code ${code}`));
      focusSearch();
    }
  }, [resolveBarcode, focusSearch, tr]);

  const changeQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const removeLine = (id: number) => setCart((prev) => prev.filter((l) => l.product.id !== id));

  const total = cart.reduce((sum, l) => sum + unitPriceForQty(l.product, l.quantity) * l.quantity, 0);

  const saveOfflineCash = () => {
    if (!branch) return;
    enqueueOfflineSale({
      client_reference: makeClientReference(),
      branch_id: Number(branch),
      customer_id: customer ? Number(customer) : undefined,
      payment_method: 'cash',
      items: cart.map((l) => ({
        product_id: l.product.id,
        quantity: String(l.quantity),
        unit_price: String(unitPriceForQty(l.product, l.quantity)),
      })),
      is_offline: true,
      created_at_local: new Date().toISOString(),
      local_total: total,
      notes: 'Vente offline web',
    });
    refreshPending();
    setCart([]);
    setCustomer('');
    setToast(tr('Vente enregistrée hors ligne — sync au retour du réseau'));
    focusSearch();
  };

  const selectedCustomer = customers.find((c) => c.id === customer);

  const checkout = async () => {
    if (!branch || cart.length === 0) return;
    setError(null);

    if (method === 'credit') {
      if (!canCredit) {
        setError(tr('Les ventes à crédit nécessitent le pack Business ou supérieur.'));
        return;
      }
      if (!customer) {
        setError(tr('Sélectionnez un client pour une vente à crédit.'));
        return;
      }
    }

    if (!navigator.onLine) {
      if (method !== 'cash') {
        setError(tr('Hors ligne : seul le paiement espèces est disponible.'));
        return;
      }
      setProcessing(true);
      try { saveOfflineCash(); } finally { setProcessing(false); }
      return;
    }

    setProcessing(true);
    try {
      const sale = await checkoutSale({
        branch_id: Number(branch),
        customer_id: customer ? Number(customer) : undefined,
        cash_register_id: lockedRegister ? Number(lockedRegister) : undefined,
        payment_method: method,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: String(l.quantity) })),
      });

      if (method === 'mobile_money') {
        setCart([]);
        setCustomer('');
        navigate(`/payment/sale/${sale.id}`);
        return;
      }

      if (method === 'credit') {
        setCart([]);
        setCustomer('');
        setMethod('cash');
        setToast(tr('Vente à crédit enregistrée — dette client mise à jour'));
        focusSearch();
        return;
      }

      setCart([]);
      setCustomer('');
      focusSearch();
      try {
        if (canPrint) {
          const { fetchPreferences } = await import('../api/preferences');
          let shouldPrint = true;
          try {
            const pref = await fetchPreferences();
            shouldPrint = Boolean(pref.preferences?.commercial?.auto_print_receipt);
          } catch {
            /* garder impression par défaut */
          }
          if (shouldPrint) {
            const receipt = await fetchSaleReceipt(sale.id);
            printReceiptHtml(receipt.html);
            setToast(tr(`Vente ${sale.reference} — impression du ticket…`));
          } else {
            setToast(tr(`Vente ${sale.reference} enregistrée`));
          }
        } else {
          setToast(tr(`Vente ${sale.reference} enregistrée`));
        }
      } catch {
        setToast(tr(`Vente ${sale.reference} enregistrée`));
      }
    } catch (err) {
      const axiosErr = err as { response?: unknown };
      if (method === 'cash' && !axiosErr.response) {
        saveOfflineCash();
        return;
      }
      setError(getApiErrorMessage(err, tr('Encaissement impossible.')));
    } finally {
      setProcessing(false);
    }
  };

  const subtitle = registerLabel
    ? `${user?.assigned_branch_name || 'Point de vente'} · ${registerLabel}`
    : 'Scanner USB, caméra ou recherche manuelle';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // Desktop : hauteur viewport sous AppBar + padding page → seuls les produits défilent
        height: { md: 'calc(100vh - 64px - 48px)' },
        minHeight: 0,
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title="Caisse (POS)"
          subtitle={subtitle}
        />
        {!online && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {tr(`Mode hors ligne — les ventes espèces sont enregistrées localement${pendingOffline > 0 ? ` (${pendingOffline} en attente)` : ''}.`)}
          </Alert>
        )}
        {online && pendingOffline > 0 && (
          <Alert
            severity={syncError ? 'warning' : 'info'}
            sx={{ mb: 2 }}
            action={(
              <Stack direction="row" spacing={0.5}>
                <Button
                  color="inherit"
                  size="small"
                  disabled={syncingOffline}
                  onClick={() => void flushOffline()}
                >
                  {syncingOffline ? tr('Sync…') : tr('Synchroniser')}
                </Button>
                {syncError && (
                  <Button color="inherit" size="small" disabled={syncingOffline} onClick={discardOfflineQueue}>
                    {tr('Écarter')}
                  </Button>
                )}
              </Stack>
            )}
          >
            {tr(`${pendingOffline} vente(s) offline en attente de synchronisation.`)}
            {syncError ? ` ${syncError}` : ''}
          </Alert>
        )}
        {online && pendingOffline === 0 && syncError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSyncError(null)}>
            {syncError}
          </Alert>
        )}
      </Box>

      <Grid
        container
        spacing={2}
        alignItems="stretch"
        sx={{
          flex: { md: 1 },
          minHeight: 0,
          overflow: { md: 'hidden' },
        }}
      >
        <Grid
          size={{ xs: 12, md: 7 }}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            height: { md: '100%' },
          }}
        >
          <TextField
            inputRef={searchRef}
            placeholder={tr('Scannez un code-barres ou recherchez un produit…')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setError(null); }}
            onKeyDown={handleSearchKeyDown}
            fullWidth
            autoFocus
            disabled={scanning}
            sx={{ mb: 1.5, flexShrink: 0 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <QrCodeScannerIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <SearchIcon color="action" sx={{ mr: 0.5 }} />
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label={tr('Scanner avec la caméra')}
                    onClick={() => setCameraOpen(true)}
                    disabled={scanning}
                  >
                    <PhotoCameraIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            helperText={tr('Scanner USB/Bluetooth : placez le curseur ici, scannez — le produit s’ajoute automatiquement.')}
          />

          {error && <Alert severity="error" sx={{ mb: 1.5, flexShrink: 0 }} onClose={() => setError(null)}>{error}</Alert>}

          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', pr: 0.5 }}>
            <Grid container spacing={1.5}>
              {filtered.map((p) => {
                const img = productImageUrl(p.image);
                const raw = (p.stock_status || resolveStockStatus(p.total_stock, p.min_stock)) as StockStatus;
                const status: StockStatus = raw in STOCK_STATUS_LABELS ? raw : 'ok';
                return (
                  <Grid size={{ xs: 6, sm: 4 }} key={p.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        height: '100%',
                        borderTop: `3px solid ${STOCK_STATUS_HEX[status] || STOCK_STATUS_HEX.ok}`,
                      }}
                      onClick={() => { addToCart(p); focusSearch(); }}
                    >
                      <CardContent sx={{ p: 1.5 }}>
                        <Avatar
                          variant="rounded"
                          src={img}
                          alt={p.name}
                          sx={{ width: '100%', height: 72, bgcolor: '#EEF1F5', mb: 1 }}
                        >
                          📦
                        </Avatar>
                        <Typography variant="body2" fontWeight={600} noWrap>{p.name}</Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                          <Typography variant="caption" color="primary" fontWeight={700}>
                            {formatCurrency(p.sale_price)}
                          </Typography>
                          {Number(p.wholesale_price || 0) > 0 && (
                            <Typography variant="caption" color="success.main" fontWeight={700}>
                              {tr('Gros')} {formatCurrency(p.wholesale_price)} {tr('dès')} {Number(p.wholesale_min_qty || 10)}
                            </Typography>
                          )}
                          <Chip
                            size="small"
                            label={`${formatNumber(p.total_stock ?? 0)} · ${tr(STOCK_STATUS_LABELS[status])}`}
                            color={STOCK_STATUS_COLORS[status]}
                            variant="outlined"
                            sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 10 } }}
                          />
                        </Stack>
                        {canRequestStock && (status === 'low' || status === 'out_of_stock') && (
                          <Button
                            size="small"
                            fullWidth
                            sx={{ mt: 1 }}
                            startIcon={<LocalShippingOutlinedIcon fontSize="small" />}
                            disabled={requestingId === p.id}
                            onClick={(e) => void requestReplenish(p, e)}
                          >
                            {tr('Demander un réappro')}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        </Grid>

        <Grid
          size={{ xs: 12, md: 5 }}
          sx={{
            height: { md: '100%' },
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Card
            sx={{
              height: { md: '100%' },
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <CardContent
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                '&:last-child': { pb: 2 },
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ flexShrink: 0 }}>{tr('Panier')}</Typography>
              <Stack spacing={1.5} sx={{ flexShrink: 0 }}>
                <TextField
                  select
                  size="small"
                  label={tr('Boutique')}
                  value={branch}
                  onChange={(e) => setBranch(Number(e.target.value))}
                  fullWidth
                  disabled={branchLocked}
                  helperText={branchLocked ? tr('Point de vente assigné') : undefined}
                >
                  {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </TextField>
                <TextField
                  select
                  size="small"
                  label={method === 'credit' ? tr('Client (obligatoire)') : tr('Client (optionnel)')}
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value ? Number(e.target.value) : '')}
                  fullWidth
                  required={method === 'credit'}
                  error={method === 'credit' && !customer}
                >
                  <MenuItem value="">{tr('Client de passage')}</MenuItem>
                  {customers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                      {canCredit && Number(c.balance) > 0 ? ` · ${tr('dette')} ${formatCurrency(c.balance)}` : ''}
                    </MenuItem>
                  ))}
                </TextField>
                {canCredit && method === 'credit' && selectedCustomer && (
                  <Typography variant="caption" color="text.secondary">
                    {tr('Dette')} : {formatCurrency(selectedCustomer.balance || 0)}
                    {Number(selectedCustomer.credit_limit) > 0
                      ? ` · ${tr('plafond')} ${formatCurrency(selectedCustomer.credit_limit)}`
                      : ` · ${tr('plafond illimité')}`}
                  </Typography>
                )}
              </Stack>

              <Divider sx={{ my: 2, flexShrink: 0 }} />

              {cart.length === 0 ? (
                <Typography color="text.secondary" variant="body2" align="center" sx={{ py: 3, flex: 1 }}>
                  {tr('Scannez un produit ou cliquez dans le catalogue.')}
                </Typography>
              ) : (
                <List dense sx={{ flex: 1, minHeight: 0, overflow: 'auto', py: 0 }}>
                  {cart.map((l) => (
                    <Box key={l.product.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                      <Avatar
                        variant="rounded"
                        src={productImageUrl(l.product.image)}
                        sx={{ width: 36, height: 36, bgcolor: '#EEF1F5' }}
                      >
                        📦
                      </Avatar>
                      <ListItemText
                        primary={l.product.name}
                        secondary={
                          Number(l.product.wholesale_price || 0) > 0 && l.quantity >= Number(l.product.wholesale_min_qty || 10)
                            ? `${formatCurrency(unitPriceForQty(l.product, l.quantity))} × ${formatNumber(l.quantity)} · ${tr('prix gros')}`
                            : formatCurrency(unitPriceForQty(l.product, l.quantity) * l.quantity)
                        }
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      />
                      <IconButton size="small" onClick={() => changeQty(l.product.id, -1)}><RemoveIcon fontSize="small" /></IconButton>
                      <Typography sx={{ minWidth: 20, textAlign: 'center' }}>{formatNumber(l.quantity)}</Typography>
                      <IconButton size="small" onClick={() => changeQty(l.product.id, 1)}><AddIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => removeLine(l.product.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                  ))}
                </List>
              )}

              <Divider sx={{ my: 2, flexShrink: 0 }} />

              <Box sx={{ flexShrink: 0 }}>
                <TextField select size="small" label={tr('Mode de paiement')} value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)} fullWidth sx={{ mb: 2 }}>
                  <MenuItem value="cash">{tr('Espèces')}</MenuItem>
                  <MenuItem value="mobile_money">{tr('Mobile Money (Wave / Orange)')}</MenuItem>
                  <MenuItem value="card">{tr('Carte bancaire')}</MenuItem>
                  {canCredit && <MenuItem value="credit">{tr('Crédit (dette client)')}</MenuItem>}
                </TextField>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">{tr('Total')}</Typography>
                  <Typography variant="h6" color="primary">{formatCurrency(total)}</Typography>
                </Box>

                <Button variant="contained" size="large" fullWidth disabled={cart.length === 0 || processing || !branch} onClick={checkout}>
                  {processing ? tr('Encaissement...') : tr('Encaisser')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <WebcamBarcodeScanner
        open={cameraOpen}
        onClose={() => { setCameraOpen(false); focusSearch(); }}
        onScan={handleCameraScan}
      />

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast(null)} message={toast || ''} />
    </Box>
  );
}
