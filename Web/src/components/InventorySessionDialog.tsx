import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
  createInventorySession,
  fetchInventorySession,
  fetchStockStatus,
  INVENTORY_STATUS_LABELS,
  patchInventoryCount,
  validateInventorySession,
  type InventorySession,
  type InventorySessionItem,
  type WarehouseItem,
} from '../api/stock';
import { getApiErrorMessage } from '../api/client';
import { useLocale } from '../locale/useLocale';

export default function InventorySessionDialog({
  open,
  warehouses,
  defaultWarehouse,
  sessionId,
  onClose,
  onDone,
}: {
  open: boolean;
  warehouses: WarehouseItem[];
  defaultWarehouse: number | '';
  sessionId?: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { tr, version } = useLocale();
  void version;
  const [warehouseId, setWarehouseId] = useState<number | ''>(defaultWarehouse);
  const [notes, setNotes] = useState('');
  const [session, setSession] = useState<InventorySession | null>(null);
  const [items, setItems] = useState<InventorySessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = async (s: InventorySession) => {
    if (s.items && s.items.length) {
      setItems(s.items);
      return;
    }
    const status = await fetchStockStatus(s.warehouse);
    setItems(status.map((st) => ({
      id: st.id,
      product_id: st.product_id,
      product_name: st.name,
      sku: st.sku,
      expected_quantity: st.quantity,
      counted_quantity: null,
    })));
  };

  useEffect(() => {
    if (!open) {
      setSession(null);
      setItems([]);
      setError(null);
      setNotes('');
      return;
    }
    setWarehouseId(defaultWarehouse);
    if (sessionId) {
      setLoading(true);
      fetchInventorySession(sessionId)
        .then(async (s) => {
          setSession(s);
          await loadItems(s);
        })
        .catch((err) => setError(getApiErrorMessage(err)))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId]);

  const start = async () => {
    setError(null);
    if (!warehouseId) {
      setError(tr('Choisissez un entrepôt.'));
      return;
    }
    setSaving(true);
    try {
      const s = await createInventorySession({ warehouse_id: Number(warehouseId), notes: notes || undefined });
      setSession(s);
      await loadItems(s);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setCounted = (productId: number, value: string) => {
    setItems((prev) => prev.map((it) => (it.product_id === productId ? { ...it, counted_quantity: value } : it)));
  };

  const persistCounts = async () => {
    if (!session) return;
    const toSave = items.filter((it) => it.counted_quantity !== null && it.counted_quantity !== '');
    if (!toSave.length) return;
    await patchInventoryCount(session.id, {
      items: toSave.map((it) => ({ product_id: it.product_id, counted_quantity: it.counted_quantity as string })),
    });
  };

  const handleSaveCounts = async () => {
    setError(null);
    setSaving(true);
    try {
      await persistCounts();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      await persistCounts();
      await validateInventorySession(session.id);
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const readOnly = session ? !['draft', 'in_progress'].includes(session.status) : false;
  const statusLabel = session
    ? tr(INVENTORY_STATUS_LABELS[session.status] || session.status)
    : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {tr("Session d'inventaire")}{session ? ` — ${statusLabel}` : ''}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
        ) : !session ? (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select label={tr('Entrepôt')} value={warehouseId} fullWidth required
              onChange={(e) => setWarehouseId(Number(e.target.value))}>
              {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>)}
            </TextField>
            <TextField label={tr('Note (optionnel)')} value={notes} fullWidth multiline rows={2}
              onChange={(e) => setNotes(e.target.value)} />
            <Typography variant="body2" color="text.secondary">
              {tr("Une nouvelle session sera créée avec le stock théorique actuel de l'entrepôt. Vous pourrez ensuite saisir les quantités comptées physiquement.")}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {readOnly && (
              <Alert severity="info">
                {tr('Cette session est')}{' '}
                {tr(INVENTORY_STATUS_LABELS[session.status] || session.status).toLowerCase()}
                {' — '}{tr('lecture seule.')}
              </Alert>
            )}
            {items.map((it) => {
              const diff = it.counted_quantity !== null && it.counted_quantity !== ''
                ? Number(it.counted_quantity) - Number(it.expected_quantity)
                : null;
              return (
                <Stack key={it.product_id} direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 2, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{it.product_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{it.sku}</Typography>
                  </Box>
                  <TextField label={tr('Théorique')} value={it.expected_quantity} size="small" sx={{ flex: 1 }} disabled />
                  <TextField label={tr('Compté')} type="number" value={it.counted_quantity ?? ''} size="small" sx={{ flex: 1 }}
                    disabled={readOnly}
                    onChange={(e) => setCounted(it.product_id, e.target.value)} />
                  {diff !== null && (
                    <Chip size="small" label={diff === 0 ? tr('OK') : (diff > 0 ? `+${diff}` : diff)}
                      color={diff === 0 ? 'success' : 'warning'} variant="outlined" sx={{ minWidth: 56 }} />
                  )}
                </Stack>
              );
            })}
            {items.length === 0 && (
              <Typography variant="body2" color="text.secondary">{tr('Aucun produit en stock dans cet entrepôt.')}</Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{tr('Fermer')}</Button>
        {!session && <Button variant="contained" onClick={start} disabled={saving}>{tr('Démarrer la session')}</Button>}
        {session && !readOnly && (
          <>
            <Button variant="outlined" onClick={handleSaveCounts} disabled={saving}>{tr('Enregistrer les comptages')}</Button>
            <Button variant="contained" color="success" onClick={handleValidate} disabled={saving}>{tr("Valider l'inventaire")}</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
