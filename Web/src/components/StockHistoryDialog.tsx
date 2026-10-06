import { useEffect, useState } from 'react';
import {
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { fetchStockMovements, MOVEMENT_LABELS, type StockMovementItem } from '../api/stock';
import { formatDate } from '../utils/format';
import { useLocale } from '../locale/useLocale';

export default function StockHistoryDialog({
  open,
  productId,
  productName,
  warehouseId,
  onClose,
}: {
  open: boolean;
  productId: number | null;
  productName?: string;
  warehouseId: number | '';
  onClose: () => void;
}) {
  const { tr, version } = useLocale();
  void version;
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && productId && warehouseId) {
      setLoading(true);
      fetchStockMovements(Number(warehouseId), { product: productId })
        .then(setMovements)
        .finally(() => setLoading(false));
    } else if (!open) {
      setMovements([]);
    }
  }, [open, productId, warehouseId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {tr('Historique')} — {productName || tr('Produit')}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
        ) : movements.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {tr('Aucun mouvement enregistré pour ce produit dans cet entrepôt.')}
          </Typography>
        ) : (
          <List dense disablePadding>
            {movements.map((m) => (
              <ListItem key={m.id} divider disableGutters sx={{ py: 1 }}>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" variant="outlined" label={tr(MOVEMENT_LABELS[m.movement_type] || m.movement_type)} />
                      <Typography variant="body2" fontWeight={600}>{m.quantity}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatDate(m.created_at)}</Typography>
                    </Stack>
                  }
                  secondary={
                    <>
                      {m.notes && <span>{m.notes}</span>}
                      {m.created_by && <span> — {m.created_by}</span>}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
