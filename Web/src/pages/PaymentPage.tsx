import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/PaymentsOutlined';
import PageHeader from '../components/PageHeader';
import {
  createSubscriptionWaveCheckout,
  createWaveCheckout,
  fetchPaymentProviders,
  fetchPaymentStatus,
  mockCompletePayment,
  type PaymentProvider,
  type PaymentProviderCode,
  type SubscriptionWaveCheckout,
  type WaveCheckout,
} from '../api/payments';
import { fetchSale } from '../api/sales';
import { getApiErrorMessage } from '../api/client';
import { formatCurrency } from '../utils/format';

type PaymentMode = 'sale' | 'subscription';

const PROVIDER_COLORS: Record<PaymentProviderCode, string> = {
  wave: '#1DC8FF',
  orange_money: '#FF7900',
  mtn_money: '#FFCC00',
};

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { saleId } = useParams();
  const [searchParams] = useSearchParams();
  const mode: PaymentMode = location.pathname.includes('/payment/subscription') ? 'subscription' : 'sale';

  const planCode = searchParams.get('plan') || '';
  const billingCycle = (searchParams.get('cycle') || 'monthly') as 'monthly' | 'annual';
  const preferredProvider = (searchParams.get('provider') || 'wave') as PaymentProviderCode;

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [provider, setProvider] = useState<PaymentProviderCode>(preferredProvider);
  const [phone, setPhone] = useState('');
  const [checkout, setCheckout] = useState<WaveCheckout | SubscriptionWaveCheckout | null>(null);
  const [summary, setSummary] = useState<{ title: string; amount: string; details: string[] } | null>(null);
  const [paid, setPaid] = useState(false);
  const [saleReady, setSaleReady] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPaymentProviders();
      setProviders(list);
      setProvider((current) => (
        list.find((p) => p.code === current) ? current : (list[0]?.code || 'wave')
      ));

      if (mode === 'sale' && saleId) {
        const sale = await fetchSale(Number(saleId));
        setSummary({
          title: `Vente ${sale.reference}`,
          amount: sale.total,
          details: sale.items.map((i) => `${i.product_name} × ${i.quantity}`),
        });
        if (sale.payment_status === 'paid') {
          setPaid(true);
        }
        setSaleReady(true);
      } else if (mode === 'subscription' && planCode) {
        setSummary({
          title: 'Abonnement Inventra',
          amount: '—',
          details: [
            `Pack : ${planCode}`,
            `Facturation : ${billingCycle === 'annual' ? 'Annuelle' : 'Mensuelle'}`,
          ],
        });
        setSaleReady(true);
      } else {
        setError('Paramètres de paiement invalides.');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de préparer le paiement.'));
    } finally {
      setLoading(false);
    }
  }, [mode, saleId, planCode, billingCycle]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!checkout || paid) return;
    const interval = setInterval(async () => {
      try {
        const status = await fetchPaymentStatus(
          mode === 'sale'
            ? { sale_id: Number(saleId) }
            : { subscription_checkout_id: checkout.id },
        );
        if (status.status === 'completed' || status.payment_status === 'paid') {
          setPaid(true);
          clearInterval(interval);
        }
      } catch {
        /* polling silencieux */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [checkout, paid, mode, saleId]);

  const startCheckout = async () => {
    setCreating(true);
    setError(null);
    try {
      if (mode === 'sale' && saleId) {
        const wave = await createWaveCheckout(Number(saleId), provider, phone || undefined);
        setCheckout(wave.checkout);
        setSummary({
          title: `Vente ${wave.sale.reference}`,
          amount: wave.sale.total,
          details: wave.sale.items.map((i) => `${i.product_name} × ${i.quantity}`),
        });
      } else if (mode === 'subscription' && planCode) {
        const wave = await createSubscriptionWaveCheckout(planCode, billingCycle, provider, phone || undefined);
        setCheckout(wave.checkout);
        setSummary({
          title: `Abonnement ${wave.checkout.plan_name}`,
          amount: wave.checkout.amount,
          details: [
            `Pack : ${wave.checkout.plan_name}`,
            `Facturation : ${billingCycle === 'annual' ? 'Annuelle' : 'Mensuelle'}`,
            `Moyen : ${wave.checkout.provider_label}`,
          ],
        });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de créer la session de paiement.'));
    } finally {
      setCreating(false);
    }
  };

  const openProvider = () => {
    const url = checkout?.launch_url || checkout?.wave_launch_url;
    if (url) window.location.href = url;
  };

  const simulatePaid = async () => {
    if (!checkout) return;
    try {
      await mockCompletePayment(checkout.client_reference, checkout.provider);
      setPaid(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Simulation impossible.'));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const selectedLabel = providers.find((p) => p.code === provider)?.label || 'Mobile Money';
  const needsPhone = provider === 'mtn_money';

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      <PageHeader
        title="Paiement sécurisé"
        subtitle="Wave · Orange Money · MTN Money"
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {paid ? (
        <Card>
          <CardContent>
            <Alert severity="success" sx={{ mb: 2 }}>
              Paiement confirmé avec succès.
            </Alert>
            <Button variant="contained" fullWidth onClick={() => navigate(mode === 'sale' ? '/sales' : '/subscription')}>
              {mode === 'sale' ? 'Voir les ventes' : "Retour à l'abonnement"}
            </Button>
          </CardContent>
        </Card>
      ) : summary && saleReady ? (
        <Card>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <PaymentIcon color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h6">{summary.title}</Typography>
                <Typography variant="h5" color="primary" fontWeight={700}>
                  {summary.amount === '—' ? 'Selon le pack choisi' : formatCurrency(summary.amount)}
                </Typography>
              </Box>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <List dense>
              {summary.details.map((line) => (
                <ListItem key={line} disableGutters>
                  <ListItemText primary={line} />
                </ListItem>
              ))}
            </List>

            {!checkout && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  Choisissez votre moyen de paiement
                </Typography>
                <Stack spacing={1} sx={{ mb: 2 }}>
                  {providers.map((p) => (
                    <ListItemButton
                      key={p.code}
                      selected={provider === p.code}
                      onClick={() => setProvider(p.code)}
                      sx={{
                        border: '1px solid',
                        borderColor: provider === p.code ? 'primary.main' : 'divider',
                        borderRadius: 2,
                      }}
                    >
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: PROVIDER_COLORS[p.code],
                          mr: 1.5,
                        }}
                      />
                      <ListItemText
                        primary={p.label}
                        secondary={p.configured ? 'Prêt' : 'Mode test (clés API à configurer)'}
                      />
                    </ListItemButton>
                  ))}
                </Stack>

                {needsPhone && (
                  <TextField
                    label="Numéro MTN Money"
                    placeholder="ex: 770000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    fullWidth
                    sx={{ mb: 2 }}
                    helperText="Requis pour initier le paiement MTN"
                  />
                )}

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={startCheckout}
                  disabled={creating || (needsPhone && phone.length < 8)}
                >
                  {creating ? 'Préparation...' : `Continuer avec ${selectedLabel}`}
                </Button>
              </>
            )}

            {checkout && (
              <>
                <Alert severity="info" sx={{ my: 2 }}>
                  Session {checkout.provider_label} créée. Validez le paiement pour finaliser.
                </Alert>
                <Stack spacing={1.5}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={openProvider}
                    disabled={!checkout.launch_url && !checkout.wave_launch_url}
                    sx={{ bgcolor: PROVIDER_COLORS[checkout.provider], color: '#111', '&:hover': { bgcolor: PROVIDER_COLORS[checkout.provider], filter: 'brightness(0.95)' } }}
                  >
                    Payer avec {checkout.provider_label}
                  </Button>
                  {!providers.find((p) => p.code === checkout.provider)?.configured && (
                    <Button variant="outlined" color="warning" fullWidth onClick={simulatePaid}>
                      Simuler le paiement (mode test)
                    </Button>
                  )}
                  <Button variant="text" fullWidth onClick={() => setCheckout(null)}>
                    Changer de moyen de paiement
                  </Button>
                </Stack>
              </>
            )}

            <Button variant="outlined" fullWidth sx={{ mt: 2 }} onClick={() => navigate(-1)}>
              Annuler
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
