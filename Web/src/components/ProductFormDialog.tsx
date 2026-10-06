import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  createProduct,
  deleteProduct,
  fetchBrands,
  fetchCategories,
  fetchUnits,
  updateProduct,
  uploadProductImage,
  type OptionItem,
  type Product,
} from '../api/auth';
import { fetchWarehouses, type WarehouseItem } from '../api/stock';
import { getApiErrorMessage } from '../api/client';
import { useLocale } from '../locale/useLocale';
import { formatCurrency } from '../utils/format';
import { previewWholesalePrice, type WholesaleDiscountType } from '../utils/pricing';

interface Props {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

const empty = {
  name: '',
  sku: '',
  description: '',
  category: '' as number | '',
  brand: '' as number | '',
  unit: '' as number | '',
  purchase_price: '',
  sale_price: '',
  wholesale_min_qty: '10',
  wholesale_discount_type: 'price' as WholesaleDiscountType,
  wholesale_discount_value: '',
  wholesale_price: '',
  min_stock: '0',
  stock_quantity: '0',
  warehouse: '' as number | '',
  barcode: '',
};

export default function ProductFormDialog({ open, product, onClose, onSaved }: Props) {
  const { tr, version } = useLocale();
  void version;
  const [form, setForm] = useState(empty);
  const [units, setUnits] = useState<OptionItem[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetchUnits(),
      fetchCategories(),
      fetchBrands(),
      fetchWarehouses(),
    ]).then(([u, c, b, w]) => {
      setUnits(u);
      setCategories(c);
      setBrands(b);
      setWarehouses(w);
    });
  }, [open]);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku || '',
        description: product.description || '',
        category: product.category ?? '',
        brand: product.brand ?? '',
        unit: product.unit ?? '',
        purchase_price: product.purchase_price,
        sale_price: product.sale_price,
        wholesale_min_qty: String(product.wholesale_min_qty ?? '10'),
        wholesale_discount_type: (product.wholesale_discount_type || 'price') as WholesaleDiscountType,
        wholesale_discount_value: product.wholesale_discount_value || '',
        wholesale_price: product.wholesale_price || '',
        min_stock: product.min_stock,
        stock_quantity: String(product.total_stock ?? '0'),
        warehouse: '',
        barcode: product.barcodes?.[0]?.code || '',
      });
    } else {
      setForm(empty);
    }
    setImageFile(null);
    setError(null);
  }, [product, open]);

  useEffect(() => {
    if (!open || form.warehouse || warehouses.length === 0) return;
    const preferred = warehouses.find((w) => w.is_default) || warehouses[0];
    if (preferred) {
      setForm((prev) => ({ ...prev, warehouse: preferred.id }));
    }
  }, [open, warehouses, form.warehouse]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const save = async () => {
    setError(null);
    if (!form.name || !form.unit || !form.sale_price) {
      setError(tr('Nom, unité et prix de vente sont obligatoires.'));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        sku: form.sku || undefined,
        description: form.description,
        category: form.category || null,
        brand: form.brand || null,
        unit: form.unit,
        purchase_price: form.purchase_price || '0',
        sale_price: form.sale_price,
        wholesale_min_qty: form.wholesale_min_qty || '10',
        wholesale_discount_type: form.wholesale_discount_type,
        wholesale_discount_value: form.wholesale_discount_value || null,
        wholesale_price: form.wholesale_discount_type === 'price'
          ? (form.wholesale_price || null)
          : null,
        min_stock: form.min_stock || '0',
      };
      if (form.warehouse) {
        payload.warehouse = form.warehouse;
      }
      if (form.barcode) {
        payload.barcodes = [{ code: form.barcode, is_primary: true }];
      }
      let saved: Product;
      if (product) {
        payload.stock_quantity = form.stock_quantity === '' ? '0' : form.stock_quantity;
        saved = await updateProduct(product.id, payload);
      } else {
        payload.initial_stock = form.stock_quantity === '' ? '0' : form.stock_quantity;
        saved = await createProduct(payload);
      }
      if (imageFile) {
        await uploadProductImage(saved.id, imageFile);
      }
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, tr('Enregistrement impossible.')));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!product || !confirm(tr('Supprimer ce produit ?'))) return;
    setSaving(true);
    try {
      await deleteProduct(product.id);
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{product ? tr('Modifier le produit') : tr('Nouveau produit')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label={tr('Nom du produit')} value={form.name} onChange={set('name')} fullWidth required />
          <Stack direction="row" spacing={2}>
            <TextField label={tr('SKU')} value={form.sku} onChange={set('sku')} fullWidth />
            <TextField label={tr('Code-barres')} value={form.barcode} onChange={set('barcode')} fullWidth />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              select label={tr('Unité')} value={form.unit}
              onChange={(e) => setForm({ ...form, unit: Number(e.target.value) })}
              fullWidth required
            >
              {units.map((u) => <MenuItem key={u.id} value={u.id}>{tr(u.name)}</MenuItem>)}
            </TextField>
            <TextField
              select label={tr('Catégorie')} value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value ? Number(e.target.value) : '' })}
              fullWidth
            >
              <MenuItem value="">—</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{tr(c.name)}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField
            select label={tr('Marque')} value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value ? Number(e.target.value) : '' })}
            fullWidth
          >
            <MenuItem value="">—</MenuItem>
            {brands.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField label={tr("Prix d'achat")} type="number" value={form.purchase_price} onChange={set('purchase_price')} fullWidth />
            <TextField
              label={tr('Prix détail')}
              type="number"
              value={form.sale_price}
              onChange={set('sale_price')}
              fullWidth
              required
              helperText={tr('Prix à l’unité')}
            />
          </Stack>

          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(13,148,136,0.06)', border: '1px solid', borderColor: 'rgba(13,148,136,0.2)' }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
              {tr('Prix de gros / promo quantité')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {tr('Exemple : 10 000 F l’unité, dès 10 pièces → 9 300 F.')}
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label={tr('À partir de (quantité)')}
                type="number"
                value={form.wholesale_min_qty}
                onChange={set('wholesale_min_qty')}
                inputProps={{ min: 1 }}
                fullWidth
              />
              <TextField
                select
                label={tr('Type de promo')}
                value={form.wholesale_discount_type}
                onChange={(e) => setForm({ ...form, wholesale_discount_type: e.target.value as WholesaleDiscountType })}
                fullWidth
              >
                <MenuItem value="price">{tr('Nouveau prix unitaire')}</MenuItem>
                <MenuItem value="percent">{tr('Réduction en %')}</MenuItem>
                <MenuItem value="amount">{tr('Réduction en francs')}</MenuItem>
              </TextField>
              {form.wholesale_discount_type === 'price' && (
                <TextField
                  label={tr('Prix de gros (unitaire)')}
                  type="number"
                  value={form.wholesale_price}
                  onChange={set('wholesale_price')}
                  fullWidth
                  placeholder="9300"
                />
              )}
              {form.wholesale_discount_type === 'percent' && (
                <TextField
                  label={tr('Réduction (%)')}
                  type="number"
                  value={form.wholesale_discount_value}
                  onChange={set('wholesale_discount_value')}
                  fullWidth
                  placeholder="5"
                  helperText={tr('Ex. 5 = 5 % moins cher dès la quantité mini')}
                />
              )}
              {form.wholesale_discount_type === 'amount' && (
                <TextField
                  label={tr('Réduction (F par unité)')}
                  type="number"
                  value={form.wholesale_discount_value}
                  onChange={set('wholesale_discount_value')}
                  fullWidth
                  placeholder="700"
                />
              )}
              {(() => {
                const preview = previewWholesalePrice(
                  form.sale_price,
                  form.wholesale_discount_type,
                  form.wholesale_discount_value,
                  form.wholesale_price,
                );
                const minQ = Number(form.wholesale_min_qty || 10);
                if (!preview || !form.sale_price) return null;
                return (
                  <Alert severity="success" sx={{ py: 0.5 }}>
                    {tr('Détail')} {formatCurrency(form.sale_price)} · {tr('Gros dès')} {minQ} : {formatCurrency(preview)}
                  </Alert>
                );
              })()}
            </Stack>
          </Box>
          <Stack direction="row" spacing={2}>
            <TextField
              label={product ? tr('Stock actuel') : tr('Stock initial')}
              type="number"
              value={form.stock_quantity}
              onChange={set('stock_quantity')}
              fullWidth
              inputProps={{ min: 0, step: 'any' }}
              helperText={product ? tr('Modifiez pour ajuster le stock dans l\'entrepôt choisi.') : tr('Quantité disponible dès la création.')}
            />
            <TextField label={tr('Stock minimum')} type="number" value={form.min_stock} onChange={set('min_stock')} fullWidth />
          </Stack>
          <TextField
            select
            label={tr('Entrepôt')}
            value={form.warehouse}
            onChange={(e) => setForm({ ...form, warehouse: e.target.value ? Number(e.target.value) : '' })}
            fullWidth
            helperText={warehouses.length === 0 ? tr('Aucun entrepôt — créez-en un dans Sites.') : undefined}
          >
            {warehouses.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.name}{w.branch_name ? ` (${w.branch_name})` : ''}{w.is_default ? ` — ${tr('défaut')}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <Box>
            <Button variant="outlined" component="label" size="small">
              {imageFile ? imageFile.name : tr('Ajouter une image')}
              <input type="file" hidden accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            </Button>
            {product?.image && !imageFile && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                {tr('Image existante')}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {product && (
            <Button color="error" onClick={remove} disabled={saving}>
              {tr('Supprimer')}
            </Button>
          )}
        </Box>
        <Box>
          <Button onClick={onClose} disabled={saving}>{tr('Annuler')}</Button>
          <Button variant="contained" onClick={save} disabled={saving} sx={{ ml: 1 }}>
            {saving ? tr('Enregistrement…') : tr('Enregistrer')}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
