import Grid from '@mui/material/Grid2';
import {
  Alert, Box, Button, Card, Chip, Divider, Stack, Step, StepLabel, Stepper, TextField, Typography, alpha,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import type { ShopOrderResult } from '../../api/shop';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SHOP_ORDER_STATUS_COLORS,
  SHOP_ORDER_STATUS_LABELS,
} from '../../api/shop';
import { formatCurrency, formatDate } from '../../utils/format';
import { TRACK_STEPS, trackStepIndex } from './utils';
import { useLocale } from '../../locale/useLocale';

interface Props {
  trackRef: string;
  trackPhone: string;
  trackError: string | null;
  trackResult: ShopOrderResult | null;
  primary: string;
  onRefChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onTrack: () => void;
}

export default function ShopTracking({
  trackRef, trackPhone, trackError, trackResult, primary,
  onRefChange, onPhoneChange, onTrack,
}: Props) {
  const { tr, version } = useLocale();
  void version;
  const activeStep = trackResult ? trackStepIndex(trackResult.status) : -1;
  const cancelled = trackResult && ['cancelled', 'refused'].includes(trackResult.status);

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid size={{ xs: 12, md: 8, lg: 7 }}>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ bgcolor: alpha(primary, 0.06), px: 3, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <ReceiptLongOutlinedIcon sx={{ color: primary, fontSize: 28 }} />
              <Box>
                <Typography variant="h6" fontWeight={800}>{tr('Suivi de commande')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {tr("Entrez votre numéro de commande et votre téléphone pour suivre l'avancement en temps réel.")}
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box sx={{ p: 3 }}>
            <Stack spacing={2}>
              <TextField
                label={tr('Numéro de commande')}
                placeholder={tr('Ex. CMD-20260717-0001')}
                value={trackRef}
                onChange={(e) => onRefChange(e.target.value)}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
              <TextField
                label={tr('Téléphone utilisé lors de la commande')}
                placeholder={tr('Ex. 77 123 45 67')}
                value={trackPhone}
                onChange={(e) => onPhoneChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onTrack(); }}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
              <Button
                variant="contained"
                size="large"
                startIcon={<SearchOutlinedIcon />}
                onClick={onTrack}
                sx={{
                  py: 1.25, bgcolor: primary, borderRadius: 1.5,
                  fontWeight: 700, boxShadow: 'none',
                }}
              >
                {tr('Rechercher ma commande')}
              </Button>
            </Stack>

            {trackError && (
              <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                {trackError}
              </Alert>
            )}

            {trackResult && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 3 }} />

                {cancelled ? (
                  <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>
                    {tr('Cette commande a été annulée.')}
                  </Alert>
                ) : (
                  <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
                    {TRACK_STEPS.map((step, idx) => (
                      <Step key={step.key} completed={idx < activeStep}>
                        <StepLabel
                          optional={
                            idx === activeStep ? (
                              <Typography variant="caption" color="primary" fontWeight={600}>
                                {tr('En cours')}
                              </Typography>
                            ) : undefined
                          }
                        >
                          {tr(step.label)}
                        </StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                )}

                <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: '#FAFBFC' }}>
                  <Box sx={{ p: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                      <Box>
                        <Typography variant="overline" color="text.secondary">{tr('Commande')}</Typography>
                        <Typography variant="h6" fontWeight={800}>{trackResult.reference}</Typography>
                        {trackResult.created_at && (
                          <Typography variant="caption" color="text.secondary">
                            {tr('Passée le')} {formatDate(trackResult.created_at)}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={tr(SHOP_ORDER_STATUS_LABELS[trackResult.status] || trackResult.status)}
                        color={SHOP_ORDER_STATUS_COLORS[trackResult.status] || 'default'}
                        sx={{ fontWeight: 700 }}
                      />
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6, sm: 4 }}>
                        <Typography variant="caption" color="text.secondary">{tr('Total')}</Typography>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ color: primary }}>
                          {formatCurrency(trackResult.total)}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 4 }}>
                        <Typography variant="caption" color="text.secondary">{tr('Paiement')}</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {tr(PAYMENT_METHOD_LABELS[trackResult.payment_method || ''] || trackResult.payment_method || '—')}
                        </Typography>
                        {trackResult.payment_status && (
                          <Typography variant="caption" color="text.secondary">
                            {tr(PAYMENT_STATUS_LABELS[trackResult.payment_status] || trackResult.payment_status)}
                          </Typography>
                        )}
                      </Grid>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Typography variant="caption" color="text.secondary">{tr('Articles')}</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {(() => {
                            const n = trackResult.items_count ?? trackResult.items?.length;
                            return n != null ? tr(`${n} ligne(s)`) : '—';
                          })()}
                        </Typography>
                      </Grid>
                    </Grid>

                    {(trackResult.items?.length ?? 0) > 0 && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>{tr('Détail')}</Typography>
                        <Stack spacing={0.75}>
                          {trackResult.items!.map((item) => (
                            <Stack key={item.id} direction="row" justifyContent="space-between">
                              <Typography variant="body2">
                                {item.product_name} × {item.quantity}
                              </Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {formatCurrency(item.total)}
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </>
                    )}
                  </Box>
                </Card>
              </Box>
            )}
          </Box>
        </Card>
      </Grid>
    </Grid>
  );
}
