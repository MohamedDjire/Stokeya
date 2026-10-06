import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { fetchStockStatus, importFromMain } from '../api/stock';
import { fetchProducts, type Product } from '../api/auth';
import { getApiErrorMessage } from '../api/client';
import { useLocale } from '../locale/useLocale';

interface Line {
  product_id: number | '';
  quantity: string;
  stock_main: string;
}

export default function ImportFromMainDialog({
  open,
  toWarehouseId,
  toWarehouseName,
  onClose,
  onDone,
}: {
  open: boolean;
  toWarehouseId: number;
  toWarehouseName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { tr, version } = useLocale();
  void version;
  const [products, setProducts] = useState<Product[]>([]);
  const [mainStock, setMainStock] = useState<Record<number, string>>({});
  const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: '', stock_main: '' }]);
  const [completeNow, setCompleteNow] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLines([{ product_id: '', quantity: '', stock_main: '' }]);
    setCompleteNow(true);
    setNotes('');
    fetchProducts().then(setProducts);
    setLoadingStock(true);
    // Stock boutique principale = premier entrepôt POS du siège via liste produits + status
    // On charge tous les status via warehouses-list côté parent idéalement ;
    // ici on récupère le stock via un endpoint status une fois le WH siège connu côté API import.
    fetchProducts()
      .then(async (plist) => {
        setProducts(plist);
      })
      .finally(() => setLoadingStock(false));
  }, [open]);

  // Charge le stock principal via import endpoint validation côté client:
  // on utilise fetchStockStatus sur un warehouse passé en prop optionnel n'existe pas —
  // L'API import lit le WH siège. Pour afficher le stock, on demande la liste warehouses.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { fetchWarehouses } = await import('../api/stock');
        const warehouses = await fetchWarehouses();
        const main = warehouses.find((w) => w.branch_is_main && w.is_pos_stock)
          || warehouses.find((w) => w.branch_is_main);
        if (!main || cancelled) return;
        const status = await fetchStockStatus(main.id);
        if (cancelled) return;
        const map: Record<number, string> = {};
        status.forEach((s) => { map[s.product_id] = s.quantity; });
        setMainStock(map);
      } catch {
        if (!cancelled) setMainStock({});
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const addLine = () => setLines([...lines, { product_id: '', quantity: '', stock_main: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const setProduct = (i: number, productId: number) => {
    setLines(lines.map((l, idx) => (
      idx === i
        ? { ...l, product_id: productId, stock_main: mainStock[productId] ?? '0' }
        : l
    )));
  };

  const submit = async () => {
    setError(null);
    const valid = lines.filter((l) => l.product_id && l.quantity);
    if (valid.length === 0) {
      setError(tr('Sélectionnez au moins un produit à transférer.'));
      return;
    }
    setSaving(true);
    try {
      await importFromMain({
        to_warehouse_id: toWarehouseId,
        notes: notes || `Import boutique principale → ${toWarehouseName}`,
        complete_now: completeNow,
        items: valid.map((l) => ({
          product_id: Number(l.product_id),
          quantity: l.quantity,
        })),
      });
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{tr('Approvisionnement depuis la boutique principale')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            {tr('Approvisionner')} <strong>{toWarehouseName}</strong> {tr('à partir du stock du siège.')}
            {loadingStock ? ` ${tr('Chargement du stock…')}` : ''}
          </Typography>
          {lines.map((l, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <TextField
                select
                label={tr('Produit')}
                value={l.product_id}
                size="small"
                sx={{ flex: 2 }}
                onChange={(e) => setProduct(i, Number(e.target.value))}
              >
                {products.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name} ({tr('stock siège')}: {mainStock[p.id] ?? '0'})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={tr('À transférer')}
                type="number"
                size="small"
                value={l.quantity}
                sx={{ flex: 1 }}
                onChange={(e) => setLines(lines.map((row, idx) => (
                  idx === i ? { ...row, quantity: e.target.value } : row
                )))}
                helperText={l.product_id ? `${tr('Siège')}: ${mainStock[Number(l.product_id)] ?? '0'}` : undefined}
              />
              <IconButton size="small" color="error" onClick={() => removeLine(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button startIcon={<AddIcon />} onClick={addLine} size="small" sx={{ alignSelf: 'flex-start' }}>
            {tr('Ajouter un produit')}
          </Button>
          <FormControlLabel
            control={<Checkbox checked={completeNow} onChange={(e) => setCompleteNow(e.target.checked)} />}
            label={tr('Exécuter immédiatement (expédier + recevoir)')}
          />
          <TextField
            label={tr('Commentaire')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{tr('Annuler')}</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {tr('Valider le transfert')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
