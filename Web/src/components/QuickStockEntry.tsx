import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import { stockEntry, type WarehouseItem } from '../api/stock';
import type { Product } from '../api/auth';
import { getApiErrorMessage } from '../api/client';
import { useLocale } from '../locale/useLocale';
import { BRAND } from '../theme';
import { fadeUpSx } from '../theme/motion';

export default function QuickStockEntry({
  warehouses,
  products,
  defaultWarehouse,
  onDone,
  onOpenAdvanced,
}: {
  warehouses: WarehouseItem[];
  products: Product[];
  defaultWarehouse: number | '';
  onDone: () => void;
  onOpenAdvanced: (productId?: number | '') => void;
}) {
  const { tr, version } = useLocale();
  void version;

  const [product, setProduct] = useState<Product | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | ''>(defaultWarehouse);
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (defaultWarehouse) setWarehouseId(defaultWarehouse);
  }, [defaultWarehouse]);

  const options = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [products],
  );

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!product || !warehouseId || !quantity || Number(quantity) <= 0) {
      setError(tr('Choisissez un produit, un entrepôt et une quantité.'));
      return;
    }
    setSaving(true);
    try {
      await stockEntry({
        product_id: product.id,
        warehouse_id: Number(warehouseId),
        quantity,
      });
      setSuccess(tr(`${quantity} ajouté(s) à « ${product.name} ».`));
      setQuantity('');
      setProduct(null);
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        mb: 3,
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        border: `2px solid ${BRAND.primary}`,
        background: `linear-gradient(135deg, rgba(13,148,136,0.08) 0%, #fff 45%, rgba(14,165,233,0.06) 100%)`,
        boxShadow: '0 10px 28px rgba(13,148,136,0.12)',
        ...fadeUpSx(0),
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ color: BRAND.navy }}>
            {tr('Ajouter du stock')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tr('Produit + quantité + entrepôt — c’est tout pour démarrer.')}
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<TuneIcon />}
          onClick={() => onOpenAdvanced(product?.id)}
          sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
        >
          {tr('Options avancées')}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'flex-start' }}>
        <Autocomplete
          options={options}
          value={product}
          onChange={(_, v) => setProduct(v)}
          getOptionLabel={(o) => `${o.name}${o.sku ? ` (${o.sku})` : ''}`}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          fullWidth
          sx={{ flex: 2, minWidth: 0 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={tr('Produit')}
              placeholder={tr('Tapez le nom ou le SKU…')}
              required
              autoFocus
            />
          )}
        />
        <TextField
          select
          label={tr('Entrepôt')}
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
          required
          sx={{ flex: 1.2, minWidth: { md: 200 } }}
        >
          {warehouses.map((w) => (
            <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>
          ))}
        </TextField>
        <TextField
          label={tr('Quantité')}
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          inputProps={{ min: 1, step: 1 }}
          sx={{ width: { xs: '100%', md: 140 } }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        <Button
          variant="contained"
          color="success"
          size="large"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
          onClick={() => void submit()}
          disabled={saving}
          sx={{
            px: 3,
            py: 1.6,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            minWidth: { md: 180 },
            boxShadow: '0 8px 20px rgba(46,125,50,0.28)',
          }}
        >
          {tr('Ajouter')}
        </Button>
      </Stack>
    </Box>
  );
}
