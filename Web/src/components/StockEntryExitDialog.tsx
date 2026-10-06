import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { EXIT_REASONS, stockEntry, stockExit, type WarehouseItem } from '../api/stock';
import type { Product } from '../api/auth';
import { fetchSuppliers, type Supplier } from '../api/suppliers';
import { getApiErrorMessage } from '../api/client';
import { useLocale } from '../locale/useLocale';

const emptyForm = {
  product_id: '' as number | '',
  warehouse_id: '' as number | '',
  quantity: '',
  notes: '',
  reference: '',
  supplier_id: '' as number | '',
  cost_price: '',
  invoice_number: '',
  batch_number: '',
  expiry_date: '',
  reason: '',
};

export default function StockEntryExitDialog({
  open,
  mode,
  warehouses,
  products,
  defaultWarehouse,
  defaultProductId,
  onClose,
  onDone,
}: {
  open: boolean;
  mode: 'entry' | 'exit';
  warehouses: WarehouseItem[];
  products: Product[];
  defaultWarehouse: number | '';
  defaultProductId?: number | '';
  onClose: () => void;
  onDone: () => void;
}) {
  const { tr, version } = useLocale();
  void version;
  const [form, setForm] = useState(emptyForm);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const productOptions = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [products],
  );
  const selectedProduct = productOptions.find((p) => p.id === form.product_id) || null;

  useEffect(() => {
    if (open) {
      setForm({ ...emptyForm, warehouse_id: defaultWarehouse, product_id: defaultProductId ?? '' });
      setError(null);
      setShowMore(false);
      if (mode === 'entry') fetchSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const submit = async () => {
    setError(null);
    if (!form.warehouse_id || !form.product_id || !form.quantity) {
      setError(tr('Entrepôt, produit et quantité sont obligatoires.'));
      return;
    }
    if (mode === 'exit' && !form.reason) {
      setError(tr('Le motif de sortie est obligatoire.'));
      return;
    }
    setSaving(true);
    try {
      if (mode === 'entry') {
        await stockEntry({
          product_id: Number(form.product_id),
          warehouse_id: Number(form.warehouse_id),
          quantity: form.quantity,
          notes: form.notes || undefined,
          reference: form.reference || undefined,
          supplier_id: form.supplier_id ? Number(form.supplier_id) : undefined,
          cost_price: form.cost_price || undefined,
          invoice_number: form.invoice_number || undefined,
          batch_number: form.batch_number || undefined,
          expiry_date: form.expiry_date || undefined,
        });
      } else {
        await stockExit({
          product_id: Number(form.product_id),
          warehouse_id: Number(form.warehouse_id),
          quantity: form.quantity,
          reason: form.reason,
          notes: form.notes || undefined,
          reference: form.reference || undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const isEntry = mode === 'entry';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        {isEntry ? tr('Ajouter du stock') : tr('Retirer du stock')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
          {isEntry
            ? tr('Choisissez le produit, l’entrepôt et la quantité à ajouter.')
            : tr('Indiquez le produit, la quantité et le motif du retrait.')}
        </Typography>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Autocomplete
            options={productOptions}
            value={selectedProduct}
            onChange={(_, v) => setForm({ ...form, product_id: v?.id ?? '' })}
            getOptionLabel={(o) => `${o.name}${o.sku ? ` (${o.sku})` : ''}`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} label={tr('Produit')} required placeholder={tr('Rechercher…')} />
            )}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label={tr('Entrepôt')}
              value={form.warehouse_id}
              fullWidth
              required
              onChange={(e) => setForm({ ...form, warehouse_id: Number(e.target.value) })}
            >
              {warehouses.map((w) => (
                <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>
              ))}
            </TextField>
            <TextField
              label={tr('Quantité')}
              type="number"
              value={form.quantity}
              required
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              fullWidth
              inputProps={{ min: 1, step: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
          </Stack>

          {!isEntry && (
            <TextField
              select
              label={tr('Motif')}
              value={form.reason}
              required
              fullWidth
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            >
              {EXIT_REASONS.map((r) => (
                <MenuItem key={r.value} value={r.value}>{tr(r.label)}</MenuItem>
              ))}
            </TextField>
          )}

          <Button size="small" onClick={() => setShowMore((v) => !v)} sx={{ alignSelf: 'flex-start' }}>
            {showMore ? tr('Masquer les options') : tr('Plus d’options (fournisseur, lot…)')}
          </Button>

          <Collapse in={showMore}>
            <Stack spacing={2}>
              {isEntry && (
                <>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      select
                      label={tr('Fournisseur (optionnel)')}
                      value={form.supplier_id}
                      fullWidth
                      onChange={(e) => setForm({ ...form, supplier_id: e.target.value ? Number(e.target.value) : '' })}
                    >
                      <MenuItem value="">—</MenuItem>
                      {suppliers.map((s) => (
                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label={tr("Prix d'achat")}
                      type="number"
                      value={form.cost_price}
                      fullWidth
                      onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label={tr('N° facture')}
                      value={form.invoice_number}
                      fullWidth
                      onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                    />
                    <TextField
                      label={tr('N° lot')}
                      value={form.batch_number}
                      fullWidth
                      onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                    />
                  </Stack>
                  <TextField
                    label={tr("Date d'expiration")}
                    type="date"
                    value={form.expiry_date}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  />
                </>
              )}
              <TextField
                label={tr('Référence (optionnel)')}
                value={form.reference}
                fullWidth
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
              <TextField
                label={tr('Note (optionnel)')}
                value={form.notes}
                fullWidth
                multiline
                rows={2}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Stack>
          </Collapse>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{tr('Annuler')}</Button>
        <Button
          variant="contained"
          color={isEntry ? 'success' : 'error'}
          onClick={() => void submit()}
          disabled={saving}
          sx={{ fontWeight: 700, minWidth: 140 }}
        >
          {isEntry ? tr('Ajouter') : tr('Retirer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
