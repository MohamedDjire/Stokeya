import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import PageHeader from '../components/PageHeader';
import PlanPricingCards from '../components/PlanPricingCards';
import PaymentProviderLogo from '../components/PaymentProviderLogo';
import {
  DISPLAY_STATUS_COLORS,
  DISPLAY_STATUS_LABELS,
  changePlan,
  fetchPlans,
  fetchSubscription,
  updateSubscriptionSettings,
  type Plan,
  type Subscription,
  type UsageItem,
} from '../api/subscription';
import {
  fetchSubscriptionDocument,
  fetchSubscriptionPaymentHistory,
  openHtmlDocument,
  type SubscriptionPaymentRow,
} from '../api/subscriptionBilling';
import { getApiErrorMessage } from '../api/client';
import { formatCurrency, formatDate } from '../utils/format';
import { useLocale } from '../locale/useLocale';

function usageBar(label: string, item?: UsageItem) {
  if (!item) return null;
  const pct = item.unlimited ? 15 : Math.min((item.used / (item.limit || 1)) * 100, 100);
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {item.used} / {item.unlimited ? '∞' : item.limit}
        </Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3 }} />
    </Box>
  );
}

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { tr, version } = useLocale();
  void version;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<SubscriptionPaymentRow[]>([]);
  const [renewMonths, setRenewMonths] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [sub, planList, history] = await Promise.all([
        fetchSubscription(),
        fetchPlans(),
        fetchSubscriptionPaymentHistory().catch(() => []),
      ]);
      setSubscription(sub);
      setPlans(planList);
      setPayments(history);
      const opts = sub.plan?.renewal_options;
      if (opts?.length) setRenewMonths(opts[0].months);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  useEffect(() => { void load(); }, []);

  const renewOptions = subscription?.plan?.renewal_options || [];
  const selectedRenew = renewOptions.find((o) => o.months === renewMonths) || renewOptions[0];
  const statusKey = subscription?.display_status || (subscription?.is_valid ? 'active' : 'expired');
  const statusLabel = tr(DISPLAY_STATUS_LABELS[statusKey] || statusKey);

  const startRenew = (planCode?: string, months?: number) => {
    const code = planCode || subscription?.plan_code;
    if (!code) return;
    const m = months ?? renewMonths;
    const cycle = m >= 12 ? 'annual' : 'monthly';
    const provider = subscription?.preferred_payment_method || 'wave';
    const allowed = ['wave', 'orange_money'];
    const q = new URLSearchParams({
      plan: code,
      cycle,
      months: String(m),
      provider: allowed.includes(provider) ? provider : 'wave',
    });
    navigate(`/payment/subscription?${q.toString()}`);
  };

  const activateFree = async (code: string) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await changePlan(code, 'monthly', 1);
      setSubscription(updated);
      setMessage(tr(`Pack ${updated.plan_name} activé.`));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (patch: { auto_renew?: boolean; preferred_payment_method?: string }) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateSubscriptionSettings(patch);
      setSubscription(updated);
      setMessage(tr('Paramètres enregistrés.'));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openDoc = async (id: number, type: 'invoice' | 'receipt') => {
    try {
      const doc = await fetchSubscriptionDocument(id, type);
      openHtmlDocument(doc.html, doc.reference);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Box>
      <PageHeader title={tr('Mon abonnement')} subtitle={tr('Pack actuel et renouvellement')} />

      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {subscription && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              justifyContent="space-between"
              alignItems={{ md: 'center' }}
            >
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h5" fontWeight={700}>{subscription.plan_name}</Typography>
                  <Chip
                    size="small"
                    label={statusLabel}
                    color={DISPLAY_STATUS_COLORS[statusKey] || 'default'}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {tr('Expire le')} {formatDate(subscription.end_date)}
                  {subscription.days_remaining != null && subscription.days_remaining >= 0 && (
                    <> · {tr(`${subscription.days_remaining} j restants`)}</>
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatCurrency(subscription.monthly_amount || subscription.plan.price)} {tr('/ mois')}
                </Typography>
              </Box>

              <Stack spacing={1.5} sx={{ minWidth: { md: 280 } }}>
                {renewOptions.length > 0 && (
                  <TextField
                    select
                    size="small"
                    label={tr('Durée')}
                    value={renewMonths}
                    onChange={(e) => setRenewMonths(Number(e.target.value))}
                  >
                    {renewOptions.map((opt) => (
                      <MenuItem key={opt.months} value={opt.months}>
                        {opt.label}
                        {opt.discount_label ? ` (${opt.discount_label})` : ''}
                        {' — '}
                        {formatCurrency(opt.amount)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <Button
                  variant="contained"
                  size="large"
                  disabled={Number(subscription.plan.price) <= 0}
                  onClick={() => startRenew(subscription.plan_code, renewMonths)}
                >
                  {tr('Renouveler')}
                  {selectedRenew ? ` — ${formatCurrency(selectedRenew.amount)}` : ''}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {subscription && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              {tr('Utilisation')}
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                {usageBar(tr('Produits'), subscription.usage.products)}
                {usageBar(tr('Employés'), subscription.usage.users)}
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                {usageBar(tr('Entrepôts'), subscription.usage.warehouses)}
                {usageBar(tr('Points de vente'), subscription.usage.branches)}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Typography variant="h6" sx={{ mb: 2 }}>{tr('Changer de pack')}</Typography>
      <Box sx={{ mb: 3 }}>
        <PlanPricingCards
          plans={plans}
          currentCode={subscription?.plan_code}
          recommendedCode="business"
          loading={saving}
          tr={tr}
          onSelect={(plan) => {
            if (Number(plan.price) <= 0) void activateFree(plan.code);
            else startRenew(plan.code, 1);
          }}
          ctaLabel={(_plan, { current, free }) => (
            current ? tr('Renouveler') : free ? tr('Activer') : tr("S'abonner")
          )}
        />
      </Box>

      {subscription && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              {tr('Paramètres')}
            </Typography>
            <FormControlLabel
              control={(
                <Checkbox
                  checked={Boolean(subscription.auto_renew)}
                  disabled={saving}
                  onChange={(e) => void saveSettings({ auto_renew: e.target.checked })}
                />
              )}
              label={tr('Renouvellement automatique')}
            />
            <TextField
              select
              fullWidth
              size="small"
              label={tr('Moyen de paiement préféré')}
              value={subscription.preferred_payment_method || ''}
              sx={{ mt: 1.5, maxWidth: 360 }}
              onChange={(e) => void saveSettings({ preferred_payment_method: e.target.value })}
            >
              <MenuItem value="">
                <em>{tr('Non défini')}</em>
              </MenuItem>
              <MenuItem value="wave">
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <PaymentProviderLogo code="wave" size={22} sx={{ borderRadius: 0.75 }} />
                  <span>Wave</span>
                </Stack>
              </MenuItem>
              <MenuItem value="orange_money">
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <PaymentProviderLogo code="orange_money" size={22} sx={{ borderRadius: 0.75 }} />
                  <span>{tr('Orange Money')}</span>
                </Stack>
              </MenuItem>
            </TextField>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            {tr('Paiements')}
          </Typography>
          {payments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {tr('Aucun paiement pour le moment.')}
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{tr('Date')}</TableCell>
                  <TableCell>{tr('Montant')}</TableCell>
                  <TableCell>{tr('Moyen')}</TableCell>
                  <TableCell>{tr('Statut')}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.slice(0, 8).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.created_at)}</TableCell>
                    <TableCell>{formatCurrency(p.amount)}</TableCell>
                    <TableCell>{p.provider_label}</TableCell>
                    <TableCell>{p.status_label || p.status}</TableCell>
                    <TableCell align="right">
                      {p.status === 'completed' && (
                        <Button size="small" onClick={() => void openDoc(p.id, 'invoice')}>
                          {tr('Facture')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
