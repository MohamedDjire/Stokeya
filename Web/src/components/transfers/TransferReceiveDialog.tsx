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
  receiveTransfer,
  TRANSFER_VARIANCE_REASONS,
  type StockTransfer,
} from '../../api/stock';
import { getApiErrorMessage } from '../../api/client';

interface ReceiveLine {
  item_id: number;
  product_id: number;
  product_name: string;
  quantity: string;
  quantity_received: string;
  variance_reason: string;
  variance_notes: string;
}

export default function TransferReceiveDialog({
  open,
  transfer,
  onClose,
  onDone,
}: {
  open: boolean;
  transfer: StockTransfer | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !transfer) return;
    setStarted(false);
    setError(null);
    setLines(
      (transfer.items || []).map((item) => ({
        item_id: item.id || 0,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: String(item.quantity),
        quantity_received: String(item.quantity),
        variance_reason: '',
        variance_notes: '',
      })),
    );
  }, [open, transfer]);

  const submit = async () => {
    if (!transfer) return;
    setError(null);
    for (const line of lines) {
      const shipped = Number(line.quantity);
      const received = Number(line.quantity_received);
      if (Number.isNaN(received) || received < 0 || received > shipped) {
        setError(`Quantité reçue invalide pour ${line.product_name}.`);
        return;
      }
      if (received < shipped && !line.variance_reason) {
        setError(`Indiquez le motif d'écart pour ${line.product_name}.`);
        return;
      }
    }
    setSaving(true);
    try {
      await receiveTransfer(transfer.id, {
        items: lines.map((l) => ({
          item_id: l.item_id || undefined,
          product_id: l.product_id,
          quantity_received: l.quantity_received,
          variance_reason: Number(l.quantity_received) < Number(l.quantity) ? l.variance_reason : '',
          variance_notes: l.variance_notes,
        })),
      });
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const ref = transfer
    ? (transfer.reference || `TRF-${String(transfer.id).padStart(6, '0')}`)
    : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Transfert entrant {ref}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {transfer && (
            <Typography variant="body2" color="text.secondary">
              {transfer.from_warehouse} → {transfer.to_warehouse} · {(transfer.items || []).length} produit(s)
            </Typography>
          )}

          {!started ? (
            <Alert severity="info">
              Vérifiez le contenu à l&apos;arrivée, puis démarrez la réception ligne par ligne.
            </Alert>
          ) : (
            lines.map((line, i) => {
              const variance = Number(line.quantity) - Number(line.quantity_received || 0);
              return (
                <Box
                  key={line.item_id || i}
                  sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                >
                  <Typography fontWeight={600} sx={{ mb: 1 }}>{line.product_name}</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField label="Envoyé" value={line.quantity} size="small" disabled sx={{ width: 120 }} />
                    <TextField
                      label="Reçu"
                      type="number"
                      size="small"
                      value={line.quantity_received}
                      onChange={(e) => setLines(lines.map((r, idx) => (
                        idx === i ? { ...r, quantity_received: e.target.value } : r
                      )))}
                      sx={{ width: 120 }}
                    />
                    {variance > 0 && (
                      <>
                        <TextField
                          select
                          label="Pourquoi ?"
                          size="small"
                          value={line.variance_reason}
                          onChange={(e) => setLines(lines.map((r, idx) => (
                            idx === i ? { ...r, variance_reason: e.target.value } : r
                          )))}
                          sx={{ minWidth: 160 }}
                        >
                          {TRANSFER_VARIANCE_REASONS.map((r) => (
                            <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Détail"
                          size="small"
                          value={line.variance_notes}
                          onChange={(e) => setLines(lines.map((r, idx) => (
                            idx === i ? { ...r, variance_notes: e.target.value } : r
                          )))}
                          sx={{ flex: 1 }}
                        />
                      </>
                    )}
                  </Stack>
                  {variance > 0 && (
                    <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                      Écart constaté : {variance}
                    </Typography>
                  )}
                  {variance === 0 && Number(line.quantity_received) === Number(line.quantity) && (
                    <Typography variant="caption" color="success.main">✓ Conforme</Typography>
                  )}
                </Box>
              );
            })
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Fermer</Button>
        {!started ? (
          <Button variant="contained" onClick={() => setStarted(true)}>
            Commencer la réception
          </Button>
        ) : (
          <Button variant="contained" color="success" onClick={submit} disabled={saving}>
            Confirmer la réception
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
