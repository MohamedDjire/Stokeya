import Grid from '@mui/material/Grid2';
import {
  Alert, Box, Button, Card, Divider, IconButton, InputAdornment, Stack, TextField, Typography, alpha,
} from '@mui/material';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import type { ShopInfo, ShopProduct } from '../../api/shop';
import { formatCurrency, formatNumber } from '../../utils/format';
import { shopImageUrl, unitPrice } from './utils';
import { shopPrimary } from './shopTheme';
import { useLocale } from '../../locale/useLocale';

export type CartLine = { product: ShopProduct; qty: number };

interface Props {
  shop: ShopInfo;
  lines: CartLine[];
  quickCode: string;
  quickQty: string;
  quickError: string | null;
  subtotalHt: number;
  taxTotal: number;
  grandTotal: number;
  onQuickCodeChange: (v: string) => void;
  onQuickQtyChange: (v: string) => void;
  onAddQuick: () => void;
  onSetCartQty: (productId: number, qty: number) => void;
  onCheckout: () => void;
}

export default function ShopQuickOrder({
  shop, lines, quickCode, quickQty, quickError, subtotalHt, taxTotal, grandTotal,
  onQuickCodeChange, onQuickQtyChange, onAddQuick, onSetCartQty, onCheckout,
}: Props) {
  const { tr, version } = useLocale();
  void version;
  const primary = shopPrimary(shop.primary_color);

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ bgcolor: alpha(primary, 0.06), px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight={800}>{tr('Commande rapide B2B')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {tr('Idéal pour les grossistes : scannez ou saisissez une référence, ajoutez les quantités, validez.')}
            </Typography>
          </Box>
          <Box sx={{ p: 3 }}>
            {quickError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{quickError}</Alert>}

            <Box
              sx={{
                p: 2.5, borderRadius: 2, border: '2px dashed', borderColor: alpha(primary, 0.35),
                bgcolor: alpha(primary, 0.02), mb: 3,
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-end' }}>
                <TextField
                  label={tr('Référence produit ou code-barres')}
                  value={quickCode}
                  onChange={(e) => onQuickCodeChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onAddQuick(); }}
                  fullWidth
                  autoFocus
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <QrCodeScannerOutlinedIcon sx={{ color: primary }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
                <TextField
                  label={tr('Quantité')}
                  value={quickQty}
                  onChange={(e) => onQuickQtyChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onAddQuick(); }}
                  sx={{ width: { xs: '100%', sm: 100 } }}
                />
                <Button
                  variant="contained"
                  onClick={onAddQuick}
                  sx={{
                    minWidth: 120, height: 56, bgcolor: primary, borderRadius: 1.5,
                    fontWeight: 700, boxShadow: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  {tr('Ajouter')}
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                {tr('Appuyez sur Entrée pour ajouter rapidement · Prix de gros appliqué automatiquement à partir de 10 unités')}
              </Typography>
            </Box>

            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              {tr('Articles ajoutés')} ({lines.length})
            </Typography>
            {lines.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                <QrCodeScannerOutlinedIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2">{tr('Scannez ou saisissez une référence pour commencer')}</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {lines.map((l) => (
                  <Stack
                    key={l.product.id}
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{
                      p: 1.5, borderRadius: 1.5, bgcolor: '#FAFBFC',
                      border: '1px solid', borderColor: 'divider',
                    }}
                  >
                    <Box
                      component="img"
                      src={shopImageUrl(l.product.image)}
                      alt=""
                      sx={{
                        width: 48, height: 48, borderRadius: 1, objectFit: 'cover',
                        bgcolor: alpha(primary, 0.08),
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>{l.product.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {l.product.sku || '—'} · {formatCurrency(unitPrice(l.product, l.qty))} / {tr(l.product.packaging || 'u')}
                      </Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      <IconButton size="small" onClick={() => onSetCartQty(l.product.id, l.qty - 1)}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography sx={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{formatNumber(l.qty)}</Typography>
                      <IconButton size="small" onClick={() => onSetCartQty(l.product.id, l.qty + 1)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} sx={{ minWidth: 80, textAlign: 'right' }}>
                      {formatCurrency(unitPrice(l.product, l.qty) * l.qty)}
                    </Typography>
                    <IconButton size="small" color="error" onClick={() => onSetCartQty(l.product.id, 0)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 5 }}>
        <Card
          elevation={0}
          sx={{
            border: '1px solid', borderColor: 'divider', borderRadius: 2,
            position: { md: 'sticky' }, top: 88,
          }}
        >
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={800}>{tr('Récapitulatif')}</Typography>
          </Box>
          <Box sx={{ p: 3 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">{tr('Lignes')}</Typography>
                <Typography variant="body2" fontWeight={600}>{lines.length}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">{tr('Montant HT')}</Typography>
                <Typography variant="body2">{formatCurrency(subtotalHt)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">{tr('TVA')}</Typography>
                <Typography variant="body2">{formatCurrency(taxTotal)}</Typography>
              </Stack>
              <Divider />
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="subtitle1" fontWeight={800}>{tr('Total TTC')}</Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color: primary }}>
                  {formatCurrency(grandTotal)}
                </Typography>
              </Stack>
            </Stack>
            <Button
              fullWidth
              variant="contained"
              size="large"
              disabled={!lines.length}
              endIcon={<ArrowForwardIcon />}
              onClick={onCheckout}
              sx={{
                mt: 3, py: 1.5, bgcolor: primary, borderRadius: 1.5,
                fontWeight: 700, boxShadow: 'none',
                '&:hover': { bgcolor: primary, filter: 'brightness(0.92)' },
              }}
            >
              {tr('Passer la commande')}
            </Button>
          </Box>
        </Card>
      </Grid>
    </Grid>
  );
}
