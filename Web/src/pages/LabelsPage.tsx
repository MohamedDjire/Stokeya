import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PageHeader from '../components/PageHeader';
import { fetchProducts, type Product } from '../api/auth';
import { formatCurrency } from '../utils/format';
import { useLocale } from '../locale/useLocale';

interface LabelItem {
  product: Product;
  quantity: number;
}

function barcodeText(product: Product): string {
  const primary = product.barcodes?.find((b) => b.is_primary)?.code;
  return primary || product.barcodes?.[0]?.code || product.sku;
}

export default function LabelsPage() {
  const { tr, version } = useLocale();
  void version;

  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState<LabelItem[]>([]);

  useEffect(() => {
    fetchProducts().then(setProducts);
  }, []);

  const labels = useMemo(() => {
    const out: LabelItem[] = [];
    items.forEach((item) => {
      for (let i = 0; i < item.quantity; i += 1) out.push({ product: item.product, quantity: 1 });
    });
    return out;
  }, [items]);

  const addItem = () => {
    if (!selected) return;
    const existing = items.find((i) => i.product.id === selected.id);
    if (existing) {
      setItems(items.map((i) => (i.product.id === selected.id ? { ...i, quantity: i.quantity + qty } : i)));
    } else {
      setItems([...items, { product: selected, quantity: qty }]);
    }
    setSelected(null);
    setQty(1);
  };

  const removeItem = (productId: number) => {
    setItems(items.filter((i) => i.product.id !== productId));
  };

  const handlePrint = () => window.print();

  return (
    <Box>
      <PageHeader
        title={tr('Étiquettes')}
        subtitle={tr("Impression d'étiquettes produits")}
        action={
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} disabled={labels.length === 0}>
            {tr('Imprimer')} ({labels.length})
          </Button>
        }
      />

      <Card sx={{ mb: 3, '@media print': { display: 'none' } }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
            <Autocomplete
              options={products}
              getOptionLabel={(p) => `${p.name} (${p.sku})`}
              value={selected}
              onChange={(_, v) => setSelected(v)}
              renderInput={(params) => <TextField {...params} label={tr('Produit')} fullWidth />}
              sx={{ flex: 1, minWidth: 240 }}
            />
            <TextField label={tr('Quantité')} type="number" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              sx={{ width: 120 }} inputProps={{ min: 1 }} />
            <Button variant="outlined" onClick={addItem} disabled={!selected}>{tr('Ajouter')}</Button>
          </Stack>

          {items.length > 0 && (
            <Stack spacing={1} sx={{ mt: 2 }}>
              {items.map((item) => (
                <Stack key={item.product.id} direction="row" alignItems="center" justifyContent="space-between"
                  sx={{ py: 0.5, borderBottom: '1px solid #EEF1F5' }}>
                  <Typography variant="body2">{item.product.name} — {item.quantity} {tr('étiquette(s)')}</Typography>
                  <IconButton size="small" onClick={() => removeItem(item.product.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Box className="labels-print-area" sx={{ '@media print': { p: 0 } }}>
        {labels.length === 0 ? (
          <Typography color="text.secondary" sx={{ '@media print': { display: 'none' } }}>
            {tr('Ajoutez des produits pour générer des étiquettes.')}
          </Typography>
        ) : (
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            '@media print': { gap: '4mm' },
          }}>
            {labels.map((label, idx) => (
              <Box
                key={`${label.product.id}-${idx}`}
                className="product-label"
                sx={{
                  width: 200,
                  minHeight: 120,
                  p: 1.5,
                  border: '1px dashed #ccc',
                  borderRadius: 1,
                  bgcolor: '#fff',
                  '@media print': {
                    width: '63mm',
                    minHeight: '38mm',
                    p: '3mm',
                    border: '1px solid #000',
                    borderRadius: 0,
                    pageBreakInside: 'avoid',
                  },
                }}
              >
                <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: 13, lineHeight: 1.2, mb: 0.5 }}>
                  {label.product.name}
                </Typography>
                <Typography variant="caption" display="block">{tr('SKU')}: {label.product.sku}</Typography>
                <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
                  {formatCurrency(label.product.sale_price)}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1, fontFamily: 'monospace', letterSpacing: 1 }}>
                  {barcodeText(label.product)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .labels-print-area, .labels-print-area * { visibility: visible; }
          .labels-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </Box>
  );
}
