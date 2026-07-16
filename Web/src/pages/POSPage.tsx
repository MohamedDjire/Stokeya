import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
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
import { getApiErrorMessage } from '../api/client';
import {
  enqueueOfflineSale,
  getOfflineQueue,
  makeClientReference,
  removeSynced,
} from '../offline/queue';
import { formatCurrency } from '../utils/format';

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
  const navigate = useNavigate();
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

  const focusSearch = useCallback(() => {
    window.setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const refreshPending = useCallback(() => {
    setPendingOffline(getOfflineQueue().length);
  }, []);

  const flushOffline = useCallback(async () => {
    const queue = getOfflineQueue();
    if (!queue.length || !navigator.onLine) return;
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
      const okRefs = response.results.filter((r) => r.ok).map((r) => r.client_reference);
      removeSynced(okRefs);
      refreshPending();
      if (response.synced > 0) {
        setToast(`${response.synced} vente(s) offline synchronisée(s)`);
      }
    } catch {
      /* retry later */
    }
  }, [refreshPending]);

  useEffect(() => {
    fetchProducts().then(setProducts).catch(() => undefined);
    fetchBranches().then((b) => {
      setBranches(b);
      if (b[0]) setBranch(b[0].id);
    }).catch(() => undefined);
    fetchCustomers().then(setCustomers).catch(() => undefined);
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
  }, [focusSearch, flushOffline, refreshPending]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return products.slice(0, 50);
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcodes?.some((b) => b.code.toLowerCase().includes(q)),
    ).slice(0, 50);
  }, [products, search]);

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1 }];
    });
    setToast(`${product.name} ajouté`);
  }, []);

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
      setError(`Aucun produit pour le code ${value}`);
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
      setError(`Aucun produit pour le code ${code}`);
      focusSearch();
    }
  }, [resolveBarcode, focusSearch]);

  const changeQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const removeLine = (id: number) => setCart((prev) => prev.filter((l) => l.product.id !== id));

  const total = cart.reduce((sum, l) => sum + Number(l.product.sale_price) * l.quantity, 0);

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
        unit_price: l.product.sale_price,
      })),
      is_offline: true,
      created_at_local: new Date().toISOString(),
      local_total: total,
      notes: 'Vente offline web',
    });
    refreshPending();
    setCart([]);
    setCustomer('');
    setToast('Vente enregistrée hors ligne — sync au retour du réseau');
    focusSearch();
  };

  const checkout = async () => {
    if (!branch || cart.length === 0) return;
    setError(null);

    if (!navigator.onLine) {
      if (method !== 'cash') {
        setError('Hors ligne : seul le paiement espèces est disponible.');
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
        payment_method: method,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: String(l.quantity) })),
      });

      if (method === 'mobile_money') {
        setCart([]);
        setCustomer('');
        navigate(`/payment/sale/${sale.id}`);
        return;
      }

      setToast(`Vente ${sale.reference} enregistrée`);
      try {
        const receipt = await fetchSaleReceipt(sale.id);
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(receipt.html);
          win.document.close();
          win.focus();
          win.print();
        }
      } catch {
        /* impression optionnelle */
      }
      setCart([]);
      setCustomer('');
      focusSearch();
    } catch (err) {
      const axiosErr = err as { response?: unknown };
      if (method === 'cash' && !axiosErr.response) {
        saveOfflineCash();
        return;
      }
      setError(getApiErrorMessage(err, 'Encaissement impossible.'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Caisse (POS)"
        subtitle="Scanner USB, caméra ou recherche manuelle"
      />
      {!online && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Mode hors ligne — les ventes espèces sont enregistrées localement
          {pendingOffline > 0 ? ` (${pendingOffline} en attente)` : ''}.
        </Alert>
      )}
      {online && pendingOffline > 0 && (
        <Alert severity="info" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={() => void flushOffline()}>Synchroniser</Button>
        }>
          {pendingOffline} vente(s) offline en attente de synchronisation.
        </Alert>
      )}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <TextField
            inputRef={searchRef}
            placeholder="Scannez un code-barres ou recherchez un produit…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setError(null); }}
            onKeyDown={handleSearchKeyDown}
            fullWidth
            autoFocus
            disabled={scanning}
            sx={{ mb: 1.5 }}
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
                    aria-label="Scanner avec la caméra"
                    onClick={() => setCameraOpen(true)}
                    disabled={scanning}
                  >
                    <PhotoCameraIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            helperText="Scanner USB/Bluetooth : placez le curseur ici, scannez — le produit s’ajoute automatiquement."
          />

          {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}

          <Grid container spacing={1.5}>
            {filtered.map((p) => (
              <Grid size={{ xs: 6, sm: 4 }} key={p.id}>
                <Card sx={{ cursor: 'pointer', height: '100%' }} onClick={() => { addToCart(p); focusSearch(); }}>
                  <CardContent sx={{ p: 1.5 }}>
                    <Avatar variant="rounded" sx={{ width: '100%', height: 60, bgcolor: '#EEF1F5', mb: 1 }}>📦</Avatar>
                    <Typography variant="body2" fontWeight={600} noWrap>{p.name}</Typography>
                    <Typography variant="caption" color="primary" fontWeight={700}>
                      {formatCurrency(p.sale_price)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Panier</Typography>
              <Stack spacing={1.5}>
                <TextField select size="small" label="Boutique" value={branch}
                  onChange={(e) => setBranch(Number(e.target.value))} fullWidth>
                  {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Client (optionnel)" value={customer}
                  onChange={(e) => setCustomer(e.target.value ? Number(e.target.value) : '')} fullWidth>
                  <MenuItem value="">Client de passage</MenuItem>
                  {customers.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
              </Stack>

              <Divider sx={{ my: 2 }} />

              {cart.length === 0 ? (
                <Typography color="text.secondary" variant="body2" align="center" sx={{ py: 3 }}>
                  Scannez un produit ou cliquez dans le catalogue.
                </Typography>
              ) : (
                <List dense sx={{ maxHeight: 280, overflow: 'auto' }}>
                  {cart.map((l) => (
                    <Box key={l.product.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                      <ListItemText
                        primary={l.product.name}
                        secondary={formatCurrency(Number(l.product.sale_price) * l.quantity)}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      />
                      <IconButton size="small" onClick={() => changeQty(l.product.id, -1)}><RemoveIcon fontSize="small" /></IconButton>
                      <Typography sx={{ minWidth: 20, textAlign: 'center' }}>{l.quantity}</Typography>
                      <IconButton size="small" onClick={() => changeQty(l.product.id, 1)}><AddIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => removeLine(l.product.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                  ))}
                </List>
              )}

              <Divider sx={{ my: 2 }} />

              <TextField select size="small" label="Mode de paiement" value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)} fullWidth sx={{ mb: 2 }}>
                <MenuItem value="cash">Espèces</MenuItem>
                <MenuItem value="mobile_money">Mobile Money (Wave / Orange / MTN)</MenuItem>
                <MenuItem value="card">Carte bancaire</MenuItem>
                <MenuItem value="credit">Crédit</MenuItem>
              </TextField>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Total</Typography>
                <Typography variant="h6" color="primary">{formatCurrency(total)}</Typography>
              </Box>

              <Button variant="contained" size="large" fullWidth disabled={cart.length === 0 || processing || !branch} onClick={checkout}>
                {processing ? 'Encaissement...' : 'Encaisser'}
              </Button>
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
