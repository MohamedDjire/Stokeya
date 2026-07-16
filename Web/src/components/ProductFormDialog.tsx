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
import { getApiErrorMessage } from '../api/client';

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
  min_stock: '0',
  barcode: '',
};

export default function ProductFormDialog({ open, product, onClose, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [units, setUnits] = useState<OptionItem[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([fetchUnits(), fetchCategories(), fetchBrands()]).then(([u, c, b]) => {
      setUnits(u);
      setCategories(c);
      setBrands(b);
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
        min_stock: product.min_stock,
        barcode: product.barcodes?.[0]?.code || '',
      });
    } else {
      setForm(empty);
    }
    setImageFile(null);
    setError(null);
  }, [product, open]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const save = async () => {
    setError(null);
    if (!form.name || !form.unit || !form.sale_price) {
      setError('Nom, unité et prix de vente sont obligatoires.');
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
        min_stock: form.min_stock || '0',
      };
      if (form.barcode) {
        payload.barcodes = [{ code: form.barcode, is_primary: true }];
      }
      let saved: Product;
      if (product) {
        saved = await updateProduct(product.id, payload);
      } else {
        saved = await createProduct(payload);
      }
      if (imageFile) {
        await uploadProductImage(saved.id, imageFile);
      }
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, "Enregistrement impossible."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!product || !confirm('Supprimer ce produit ?')) return;
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
      <DialogTitle>{product ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Nom du produit" value={form.name} onChange={set('name')} fullWidth required />
          <Stack direction="row" spacing={2}>
            <TextField label="SKU" value={form.sku} onChange={set('sku')} fullWidth />
            <TextField label="Code-barres" value={form.barcode} onChange={set('barcode')} fullWidth />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              select label="Unité" value={form.unit}
              onChange={(e) => setForm({ ...form, unit: Number(e.target.value) })}
              fullWidth required
            >
              {units.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </TextField>
            <TextField
              select label="Catégorie" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value ? Number(e.target.value) : '' })}
              fullWidth
            >
              <MenuItem value="">—</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField
            select label="Marque" value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value ? Number(e.target.value) : '' })}
            fullWidth
          >
            <MenuItem value="">—</MenuItem>
            {brands.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField label="Prix d'achat" type="number" value={form.purchase_price} onChange={set('purchase_price')} fullWidth />
            <TextField label="Prix de vente" type="number" value={form.sale_price} onChange={set('sale_price')} fullWidth required />
          </Stack>
          <TextField label="Stock minimum" type="number" value={form.min_stock} onChange={set('min_stock')} fullWidth />
          <Box>
            <Button variant="outlined" component="label" size="small">
              {imageFile ? imageFile.name : 'Ajouter une image'}
              <input type="file" hidden accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            </Button>
            {product?.image && !imageFile && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                Image existante
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {product && (
            <Button color="error" onClick={remove} disabled={saving}>
              Supprimer
            </Button>
          )}
        </Box>
        <Box>
          <Button onClick={onClose} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={save} disabled={saving} sx={{ ml: 1 }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
