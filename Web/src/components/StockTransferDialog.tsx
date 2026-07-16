import { useState } from 'react';
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

interface Line { product_id: number | ''; quantity: string; }

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
  const [from, setFrom] = useState<number | ''>(defaultFrom);
  const [to, setTo] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addLine = () => setLines([...lines, { product_id: '', quantity: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const setLine = (i: number, key: keyof Line, value: string) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [key]: key === 'product_id' ? Number(value) : value } : l)));

  const submit = async () => {
    setError(null);
    const valid = lines.filter((l) => l.product_id && l.quantity);
    if (!from || !to || from === to || valid.length === 0) {
      setError('Choisissez deux entrepôts différents et au moins un produit.');
      return;
    }
    setSaving(true);
    try {
      await stockTransfer({
        from_warehouse_id: Number(from),
        to_warehouse_id: Number(to),
        notes,
        items: valid.map((l) => ({ product_id: Number(l.product_id), quantity: l.quantity })),
      });
      setLines([{ product_id: '', quantity: '' }]);
      setNotes('');
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Transfert entre entrepôts</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={2}>
            <TextField select label="Depuis" value={from} onChange={(e) => setFrom(Number(e.target.value))} fullWidth>
              {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
            </TextField>
            <TextField select label="Vers" value={to} onChange={(e) => setTo(Number(e.target.value))} fullWidth>
              {warehouses.filter((w) => w.id !== from).map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
            </TextField>
          </Stack>
          <Divider>Articles</Divider>
          {lines.map((l, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <TextField select label="Produit" value={l.product_id} size="small" sx={{ flex: 2 }}
                onChange={(e) => setLine(i, 'product_id', e.target.value)}>
                {products.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </TextField>
              <TextField label="Qté" type="number" value={l.quantity} size="small" sx={{ flex: 1 }}
                onChange={(e) => setLine(i, 'quantity', e.target.value)} />
              <IconButton size="small" color="error" onClick={() => removeLine(i)}><DeleteIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
          <Button startIcon={<AddIcon />} onClick={addLine} size="small" sx={{ alignSelf: 'flex-start' }}>
            Ajouter un article
          </Button>
          <TextField label="Note (optionnel)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>Transférer</Button>
      </DialogActions>
    </Dialog>
  );
}
