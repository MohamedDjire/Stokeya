import {
  Alert, Avatar, Badge, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Fab, IconButton, MenuItem, Paper, Stack, TextField, Typography, alpha, Zoom,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import type { ShopInfo, ShopOrderResult } from '../../api/shop';
import { formatCurrency, formatNumber } from '../../utils/format';
import { availablePaymentMethods, shopImageUrl, unitPrice, type ShopPaymentChoice } from './utils';
import type { CartLine } from './ShopQuickOrder';
import { shopPrimary } from './shopTheme';
import { useLocale } from '../../locale/useLocale';

export interface CheckoutForm {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  city: string;
  delivery_method: 'delivery' | 'pickup';
  payment_method: ShopPaymentChoice;
  payment_reference: string;
  notes: string;
}

interface CartProps {
  open: boolean;
  lines: CartLine[];
  subtotalHt: number;
  taxTotal: number;
  grandTotal: number;
  totalQty: number;
  primary: string;
  onClose: () => void;
  onSetQty: (productId: number, qty: number) => void;
  onCheckout: () => void;
}

export function ShopCartDialog({
  open, lines, subtotalHt, taxTotal, grandTotal, totalQty, primary, onClose, onSetQty, onCheckout,
}: CartProps) {
  const { tr, version } = useLocale();
  void version;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ShoppingCartCheckoutIcon sx={{ color: primary }} />
          <Typography variant="h6" fontWeight={800}>{tr('Mon panier')}</Typography>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: 2 }}>
        {lines.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">{tr('Votre panier est vide')}</Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {lines.map((l) => (
              <Stack key={l.product.id} direction="row" spacing={1.5} alignItems="center">
                <Avatar src={shopImageUrl(l.product.image)} variant="rounded" sx={{ width: 52, height: 52 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>{l.product.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {l.product.sku || '—'} · {formatCurrency(unitPrice(l.product, l.qty))}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center">
                  <IconButton size="small" onClick={() => onSetQty(l.product.id, l.qty - 1)}><RemoveIcon fontSize="small" /></IconButton>
                  <Typography sx={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{formatNumber(l.qty)}</Typography>
                  <IconButton size="small" onClick={() => onSetQty(l.product.id, l.qty + 1)}><AddIcon fontSize="small" /></IconButton>
                </Stack>
                <Typography variant="body2" fontWeight={700} sx={{ minWidth: 72, textAlign: 'right' }}>
                  {formatCurrency(unitPrice(l.product, l.qty) * l.qty)}
                </Typography>
                <IconButton size="small" color="error" onClick={() => onSetQty(l.product.id, 0)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Divider sx={{ my: 1 }} />
            <Stack spacing={0.5}>
              <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{tr('Articles')}</Typography><Typography variant="body2">{formatNumber(lines.length)}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{tr('Quantité')}</Typography><Typography variant="body2">{formatNumber(totalQty)}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{tr('HT')}</Typography><Typography variant="body2">{formatCurrency(subtotalHt)}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{tr('TVA')}</Typography><Typography variant="body2">{formatCurrency(taxTotal)}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5 }}>
                <Typography fontWeight={800}>{tr('Total TTC')}</Typography>
                <Typography fontWeight={800} sx={{ color: primary }}>{formatCurrency(grandTotal)}</Typography>
              </Stack>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ flex: 1 }}>{tr('Continuer')}</Button>
        <Button
          variant="contained"
          disabled={!lines.length}
          onClick={onCheckout}
          sx={{ flex: 1, bgcolor: primary, fontWeight: 700, boxShadow: 'none' }}
        >
          {tr('Commander')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface CheckoutProps {
  open: boolean;
  shop: ShopInfo;
  form: CheckoutForm;
  grandTotal: number;
  submitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onChange: (form: CheckoutForm) => void;
  onSubmit: () => void;
}

export function ShopCheckoutDialog({
  open, shop, form, grandTotal, submitting, submitError, onClose, onChange, onSubmit,
}: CheckoutProps) {
  const { tr, version } = useLocale();
  void version;
  const primary = shopPrimary(shop.primary_color);
  const paymentOptions = availablePaymentMethods(shop);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle fontWeight={800}>{tr('Finaliser la commande')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {submitError && <Alert severity="error" sx={{ borderRadius: 2 }}>{submitError}</Alert>}

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, bgcolor: alpha(primary, 0.04) }}>
            <Typography variant="caption" color="text.secondary">{tr('Total à payer')}</Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color: primary }}>{formatCurrency(grandTotal)}</Typography>
          </Paper>

          <TextField label={tr('Nom ou société')} value={form.customer_name} required fullWidth
            onChange={(e) => onChange({ ...form, customer_name: e.target.value })} />
          <TextField label={tr('Téléphone')} value={form.customer_phone} required fullWidth
            onChange={(e) => onChange({ ...form, customer_phone: e.target.value })} />
          <TextField label={tr('Ville')} value={form.city} fullWidth
            onChange={(e) => onChange({ ...form, city: e.target.value })} />
          <TextField select label={tr('Mode de livraison')} value={form.delivery_method} fullWidth
            onChange={(e) => onChange({ ...form, delivery_method: e.target.value as 'delivery' | 'pickup' })}>
            <MenuItem value="delivery">{tr('Livraison à domicile')}</MenuItem>
            <MenuItem value="pickup">{tr('Retrait en boutique')}</MenuItem>
          </TextField>
          {form.delivery_method === 'delivery' && (
            <TextField label={tr('Adresse de livraison')} value={form.customer_address} required fullWidth multiline rows={2}
              onChange={(e) => onChange({ ...form, customer_address: e.target.value })} />
          )}
          <TextField select label={tr('Mode de paiement')} value={form.payment_method} fullWidth
            onChange={(e) => onChange({ ...form, payment_method: e.target.value as ShopPaymentChoice })}>
            {paymentOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {tr(opt.label)}{opt.hint && opt.value !== 'cod' ? ` — ${opt.hint}` : ''}
              </MenuItem>
            ))}
          </TextField>
          {form.payment_method === 'wave' && shop.wave_number && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {tr('Envoyez')} <strong>{formatCurrency(grandTotal)}</strong> {tr('au Wave')} <strong>{shop.wave_number}</strong>
            </Alert>
          )}
          {form.payment_method === 'orange_money' && shop.orange_money_number && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {tr('Envoyez')} <strong>{formatCurrency(grandTotal)}</strong> {tr("à l'Orange Money")} <strong>{shop.orange_money_number}</strong>
            </Alert>
          )}
          {form.payment_method !== 'cod' && (
            <TextField
              label={tr('Référence de transaction')}
              value={form.payment_reference}
              fullWidth
              required={shop.payment_timing === 'before_delivery'}
              helperText={tr('Numéro reçu après votre paiement mobile')}
              onChange={(e) => onChange({ ...form, payment_reference: e.target.value })}
            />
          )}
          <TextField label={tr('Instructions (optionnel)')} value={form.notes} fullWidth multiline rows={2}
            placeholder={tr("Ex. Livraison le matin, appeler avant d'arriver…")}
            onChange={(e) => onChange({ ...form, notes: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{tr('Annuler')}</Button>
        <Button variant="contained" disabled={submitting} onClick={onSubmit}
          sx={{ bgcolor: primary, fontWeight: 700, minWidth: 160, boxShadow: 'none' }}>
          {submitting ? tr('Envoi...') : tr('Confirmer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface SuccessProps {
  order: ShopOrderResult | null;
  primary: string;
  onClose: () => void;
  onTrack: (ref: string) => void;
}

export function ShopOrderSuccessDialog({ order, primary, onClose, onTrack }: SuccessProps) {
  const { tr, version } = useLocale();
  void version;
  return (
    <Dialog open={!!order} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogContent sx={{ textAlign: 'center', py: 4, px: 3 }}>
        <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: alpha('#2E7D32', 0.1), mx: 'auto', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 40, color: 'success.main' }} />
        </Box>
        <Typography variant="h5" fontWeight={800} gutterBottom>{tr('Commande confirmée')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {tr('Merci ! Votre commande a été transmise au vendeur. Conservez votre numéro de suivi.')}
        </Typography>
        {order && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, bgcolor: '#FAFBFC' }}>
            <Typography variant="overline" color="text.secondary">{tr('Numéro de commande')}</Typography>
            <Typography variant="h6" fontWeight={800} sx={{ color: primary }}>{order.reference}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {tr('Total')} : {formatCurrency(order.total)}
            </Typography>
          </Paper>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 3, gap: 1 }}>
        {order && (
          <Button variant="outlined" onClick={() => { onTrack(order.reference); onClose(); }}>
            {tr('Suivre ma commande')}
          </Button>
        )}
        <Button variant="contained" sx={{ bgcolor: primary, fontWeight: 700, boxShadow: 'none' }} onClick={onClose}>
          {tr('Continuer mes achats')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface StickyBarProps {
  visible: boolean;
  cartCount: number;
  grandTotal: number;
  primary: string;
  onOpenCart: () => void;
}

export function ShopMobileCartBar({ visible, cartCount, grandTotal, primary, onOpenCart }: StickyBarProps) {
  const { tr, version } = useLocale();
  void version;
  if (!visible) return null;
  return (
    <Paper
      elevation={8}
      sx={{
        display: { xs: 'flex', md: 'none' },
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200,
        p: 1.5, alignItems: 'center', gap: 2, borderRadius: 0,
      }}
    >
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary">{tr(`${cartCount} article(s)`)}</Typography>
        <Typography variant="subtitle1" fontWeight={800} sx={{ color: primary }}>
          {formatCurrency(grandTotal)}
        </Typography>
      </Box>
      <Button variant="contained" onClick={onOpenCart}
        sx={{ bgcolor: primary, fontWeight: 700, px: 3, boxShadow: 'none' }}>
        {tr('Voir le panier')}
      </Button>
    </Paper>
  );
}

interface FabProps {
  visible: boolean;
  cartCount: number;
  grandTotal: number;
  primary: string;
  onOpenCart: () => void;
}

/** Bouton panier flottant — visible dès qu'il y a des articles */
export function ShopFloatingCartFab({ visible, cartCount, grandTotal, primary, onOpenCart }: FabProps) {
  const { tr, version } = useLocale();
  void version;
  return (
    <Zoom in={visible}>
      <Box
        sx={{
          position: 'fixed',
          bottom: { xs: 76, md: 24 },
          right: { xs: 16, md: 24 },
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 1,
        }}
      >
        <Paper
          elevation={4}
          onClick={onOpenCart}
          sx={{
            display: { xs: 'none', sm: 'block' },
            px: 1.5, py: 0.75, borderRadius: 2, cursor: 'pointer',
            bgcolor: '#fff', border: '1px solid', borderColor: 'divider',
            '&:hover': { boxShadow: 6 },
          }}
        >
          <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>
            {tr(`${cartCount} article(s)`)}
          </Typography>
          <Typography variant="body2" fontWeight={800} sx={{ color: primary }}>
            {formatCurrency(grandTotal)}
          </Typography>
        </Paper>
        <Fab
          color="primary"
          aria-label={tr('Ouvrir le panier')}
          onClick={onOpenCart}
          sx={{
            bgcolor: primary,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            '&:hover': { bgcolor: primary, filter: 'brightness(0.92)' },
          }}
        >
          <Badge badgeContent={cartCount} color="error" max={99}>
            <ShoppingCartCheckoutIcon />
          </Badge>
        </Fab>
      </Box>
    </Zoom>
  );
}
