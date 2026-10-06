import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { stockTransfer, type WarehouseItem } from '../api/stock';
import type { Product } from '../api/auth';
import { getApiErrorMessage } from '../api/client';
import { useLocale } from '../locale/useLocale';

interface Line { product_id: number | ''; quantity: string; }

function isPosOutlet(w: WarehouseItem) {
  return Boolean(w.is_pos_stock && w.branch_is_main === false);
}

export default function StockTransferDialog({
  open,
  warehouses,
  products,
  defaultFrom,
  onClose,
  onDone,
}: {
  open: boolean;
  warehouses: WarehouseItem[];
  products: Product[];
  defaultFrom: number | '';
  onClose: () => void;
  onDone: () => void;
}) {
  const { tr, version } = useLocale();
  void version;
  const [from, setFrom] = useState<number | ''>(defaultFrom);
  const [to, setTo] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [carrier, setCarrier] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const warehouseLabel = (w: WarehouseItem) => {
    const kind = !w.is_pos_stock
      ? tr('Entrepôt')
      : w.branch_is_main
        ? tr('Siège')
        : tr('Point de vente');
    return `${w.name} — ${w.branch_name} (${kind})`;
  };

  useEffect(() => {
    if (open) setFrom(defaultFrom);
  }, [open, defaultFrom]);

  const destinations = useMemo(() => {
    const source = warehouses.find((w) => w.id === from);
    return warehouses.filter((w) => {
      if (w.id === from) return false;
      if (source && isPosOutlet(source) && isPosOutlet(w)) return false;
      return true;
    });
  }, [warehouses, from]);

  const addLine = () => setLines([...lines, { product_id: '', quantity: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const setLine = (i: number, key: keyof Line, value: string) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [key]: key === 'product_id' ? Number(value) : value } : l)));

  const submit = async () => {
    setError(null);
    const valid = lines.filter((l) => l.product_id && l.quantity);
    if (!from || !to || from === to || valid.length === 0) {
      setError(tr('Choisissez deux emplacements différents et au moins un produit.'));
      return;
    }
    setSaving(true);
    try {
      await stockTransfer({
        from_warehouse_id: Number(from),
        to_warehouse_id: Number(to),
        notes,
        carrier,
        items: valid.map((l) => ({ product_id: Number(l.product_id), quantity: l.quantity })),
      });
      setLines([{ product_id: '', quantity: '' }]);
      setNotes('');
      setCarrier('');
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{tr('Transfert de stock')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label={tr('Source')}
              value={from}
              onChange={(e) => {
                setFrom(Number(e.target.value));
                setTo('');
              }}
              fullWidth
            >
              {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{warehouseLabel(w)}</MenuItem>)}
            </TextField>
            <TextField select label={tr('Destination')} value={to} onChange={(e) => setTo(Number(e.target.value))} fullWidth>
              {destinations.map((w) => <MenuItem key={w.id} value={w.id}>{warehouseLabel(w)}</MenuItem>)}
            </TextField>
          </Stack>
          <Divider>{tr('Articles')}</Divider>
          {lines.map((l, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <TextField select label={tr('Produit')} value={l.product_id} size="small" sx={{ flex: 2 }}
                onChange={(e) => setLine(i, 'product_id', e.target.value)}>
                {products.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </TextField>
              <TextField label={tr('Qté')} type="number" value={l.quantity} size="small" sx={{ flex: 1 }}
                onChange={(e) => setLine(i, 'quantity', e.target.value)} />
              <IconButton size="small" color="error" onClick={() => removeLine(i)}><DeleteIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
          <Button startIcon={<AddIcon />} onClick={addLine} size="small" sx={{ alignSelf: 'flex-start' }}>
            {tr('Ajouter un article')}
          </Button>
          <TextField label={tr('Transporteur (optionnel)')} value={carrier} onChange={(e) => setCarrier(e.target.value)} fullWidth />
          <TextField label={tr('Commentaire')} value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{tr('Annuler')}</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{tr('Créer le transfert')}</Button>
      </DialogActions>
    </Dialog>
  );
}
