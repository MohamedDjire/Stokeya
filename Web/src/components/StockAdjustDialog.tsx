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
import { stockAdjust, type StockStatusItem } from '../api/stock';
import type { Product } from '../api/auth';
import { getApiErrorMessage } from '../api/client';
import { useLocale } from '../locale/useLocale';

interface Line { product_id: number | ''; expected_quantity: string; actual_quantity: string; }

export default function StockAdjustDialog({
  open,
  warehouseId,
  products,
  currentStock,
  onClose,
  onDone,
}: {
  open: boolean;
  warehouseId: number | '';
  products: Product[];
  currentStock: StockStatusItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { tr, version } = useLocale();
  void version;
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product_id: '', expected_quantity: '', actual_quantity: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addLine = () => setLines([...lines, { product_id: '', expected_quantity: '', actual_quantity: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const setProduct = (i: number, productId: number) => {
    const st = currentStock.find((s) => s.product_id === productId);
    setLines(lines.map((l, idx) => (idx === i
      ? { ...l, product_id: productId, expected_quantity: st ? st.quantity : '0' }
      : l)));
  };
  const setActual = (i: number, value: string) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, actual_quantity: value } : l)));

  const submit = async () => {
    setError(null);
    const valid = lines.filter((l) => l.product_id && l.actual_quantity !== '');
    if (!warehouseId || !reason || valid.length === 0) {
      setError(tr('Indiquez un motif et au moins un produit avec la quantité réelle.'));
      return;
    }
    setSaving(true);
    try {
      await stockAdjust({
        warehouse_id: Number(warehouseId),
        reason,
        notes,
        items: valid.map((l) => ({
          product_id: Number(l.product_id),
          expected_quantity: l.expected_quantity || '0',
          actual_quantity: l.actual_quantity,
        })),
      });
      setLines([{ product_id: '', expected_quantity: '', actual_quantity: '' }]);
      setReason('');
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
      <DialogTitle>{tr("Ajustement d'inventaire")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label={tr('Motif')} value={reason} onChange={(e) => setReason(e.target.value)} fullWidth
            placeholder={tr('Ex : inventaire physique, casse, péremption...')} />
          <Divider>{tr('Articles')}</Divider>
          {lines.map((l, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <TextField select label={tr('Produit')} value={l.product_id} size="small" sx={{ flex: 2 }}
                onChange={(e) => setProduct(i, Number(e.target.value))}>
                {products.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </TextField>
              <TextField label={tr('Théorique')} value={l.expected_quantity} size="small" sx={{ flex: 1 }} disabled />
              <TextField label={tr('Réel')} type="number" value={l.actual_quantity} size="small" sx={{ flex: 1 }}
                onChange={(e) => setActual(i, e.target.value)} />
              <IconButton size="small" color="error" onClick={() => removeLine(i)}><DeleteIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
          <Button startIcon={<AddIcon />} onClick={addLine} size="small" sx={{ alignSelf: 'flex-start' }}>
            {tr('Ajouter un article')}
          </Button>
          <TextField label={tr('Note (optionnel)')} value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{tr('Annuler')}</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{tr("Valider l'ajustement")}</Button>
      </DialogActions>
    </Dialog>
  );
}
