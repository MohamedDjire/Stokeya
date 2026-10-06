import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PageHeader from '../components/PageHeader';
import PlanPricingCards from '../components/PlanPricingCards';
import SasPayCheckoutPanel from '../components/SasPayCheckoutPanel';
import {
  createSasPaySaleCheckout,
  createSasPaySubscriptionCheckout,
  fetchSasPayMethods,
  type SasPayMethodGroup,
} from '../api/payments';
import { fetchPlans, type Plan } from '../api/subscription';
import { fetchSale } from '../api/sales';
import { getApiErrorMessage } from '../api/client';
import { formatCurrency, formatNumber } from '../utils/format';
import { useLocale } from '../locale/useLocale';
import { BRAND } from '../theme';

type PaymentMode = 'sale' | 'subscription';
type Step = 'plans' | 'pay';

const FALLBACK_GROUPS: SasPayMethodGroup[] = [
  { code: 'mobile_money', label: 'Mobile Money', methods: [{ code: 'mobile_money', label: 'Wave, Orange Money, Free Money…' }] },
  { code: 'card', label: 'Carte bancaire', methods: [{ code: 'card', label: 'Visa / Mastercard' }] },
  { code: 'other', label: 'Autres moyens', methods: [{ code: 'crypto', label: 'Crypto / stablecoins' }] },
];

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { saleId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tr, version } = useLocale();
  void version;
  const mode: PaymentMode = location.pathname.includes('/payment/subscription') ? 'subscription' : 'sale';

  const planFromUrl = searchParams.get('plan') || '';
  const billingCycle = (searchParams.get('cycle') || 'monthly') as 'monthly' | 'annual';
  const monthsParam = Number(searchParams.get('months') || (billingCycle === 'annual' ? 12 : 1));
  const months = [1, 3, 6, 12].includes(monthsParam) ? monthsParam : 1;

  const [step, setStep] = useState<Step>(mode === 'subscription' && !planFromUrl ? 'plans' : 'pay');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [renewMonths, setRenewMonths] = useState(months);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [methodGroups, setMethodGroups] = useState<SasPayMethodGroup[]>(FALLBACK_GROUPS);
  const [summary, setSummary] = useState<{ title: string; amount: string; details: string[] } | null>(null);
  const [paid, setPaid] = useState(false);
  const [saleReady, setSaleReady] = useState(false);

  const activePlanCode = selectedPlan?.code || planFromUrl;

  const renewOptions = useMemo(() => {
    const opts = selectedPlan?.renewal_options;
    if (opts?.length) return opts;
    const price = Number(selectedPlan?.price || 0);
    return [
      { months: 1, label: tr('1 mois'), amount: String(price), discount_label: '' },
      { months: 3, label: tr('3 mois'), amount: String(price * 3), discount_label: '' },
      { months: 12, label: tr('12 mois'), amount: String(selectedPlan?.price_annual || price * 12), discount_label: '' },
    ];
  }, [selectedPlan, tr]);

  const selectedRenew = renewOptions.find((o) => o.months === renewMonths) || renewOptions[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      try {
        const methods = await fetchSasPayMethods();
        if (methods.groups?.length) setMethodGroups(methods.groups);
      } catch {
        setMethodGroups(FALLBACK_GROUPS);
      }

      if (mode === 'subscription') {
        const planList = await fetchPlans();
        const publicPlans = planList.filter((p) => p.is_public !== false);
        setPlans(publicPlans);
        const matched = publicPlans.find((p) => p.code === planFromUrl) || null;
        setSelectedPlan(matched);
        if (matched) {
          setStep('pay');
          const opts = matched.renewal_options;
          const initialMonths = opts?.some((o) => o.months === months)
            ? months
            : (opts?.[0]?.months || months);
          setRenewMonths(initialMonths);
          setSummary({
            title: matched.name,
            amount: String(matched.price),
            details: [
              tr(`Pack : ${matched.name}`),
              tr(`Durée : ${initialMonths} mois`),
            ],
          });
        } else {
          setStep('plans');
        }
        setSaleReady(true);
      } else if (mode === 'sale' && saleId) {
        const sale = await fetchSale(Number(saleId));
        setSummary({
          title: tr(`Vente ${sale.reference}`),
          amount: sale.total,
          details: sale.items.map((i) => `${i.product_name} × ${i.quantity}`),
        });
        if (sale.payment_status === 'paid') setPaid(true);
        setSaleReady(true);
        setStep('pay');
      } else {
        setError(tr('Paramètres de paiement invalides.'));
      }
    } catch (err) {
      setError(getApiErrorMessage(err, tr('Impossible de préparer le paiement.')));
    } finally {
      setLoading(false);
    }
  }, [mode, saleId, planFromUrl, months, tr]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setPaid(false);
    setError(null);
    const opts = plan.renewal_options;
    const nextMonths = opts?.length ? opts[0].months : 1;
    setRenewMonths(nextMonths);
    setSummary({
      title: plan.name,
      amount: String(plan.price),
      details: [tr(`Pack : ${plan.name}`), tr(`Durée : ${nextMonths} mois`)],
    });
    setSearchParams((prev) => {
      const q = new URLSearchParams(prev);
      q.set('plan', plan.code);
      q.set('months', String(nextMonths));
      q.set('cycle', nextMonths >= 12 ? 'annual' : 'monthly');
      return q;
    }, { replace: true });
    setStep('pay');
  };

  const startCheckout = async () => {
    setCreating(true);
    setError(null);
    try {
      if (mode === 'sale' && saleId) {
        const session = await createSasPaySaleCheckout(Number(saleId));
        const url = session.checkout.launch_url || session.checkout.wave_launch_url;
        if (!url) {
          setError(tr('SasPay n’a pas renvoyé de page de paiement.'));
          return;
        }
        window.location.href = url;
        return;
      } else if (mode === 'subscription' && activePlanCode) {
        const cycle = renewMonths >= 12 ? 'annual' : 'monthly';
        const session = await createSasPaySubscriptionCheckout(
          activePlanCode, cycle, renewMonths,
        );
        const url = session.checkout.launch_url || session.checkout.wave_launch_url;
        if (!url) {
          setError(tr('SasPay n’a pas renvoyé de page de paiement.'));
          return;
        }
        window.location.href = url;
        return;
      }
    } catch (err) {
      setError(getApiErrorMessage(err, tr('Impossible de créer la session de paiement.')));
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const displayAmount = selectedRenew?.amount || summary?.amount || '0';

  return (
    <Box sx={{ maxWidth: step === 'plans' ? 1100 : 720, mx: 'auto', pb: 4 }}>
      <PageHeader
        title={mode === 'subscription' ? tr('Choisir un abonnement') : tr('Paiement sécurisé')}
        subtitle={
          step === 'plans'
            ? tr('Des formules claires, sans engagement')
            : mode === 'subscription'
              ? tr('Paiement sécurisé par SasPay')
              : tr('Mobile money, carte, autres moyens')
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {paid ? (
        <Box
          sx={{
            bgcolor: '#fff',
            borderRadius: 3,
            border: '1px solid #E2E8F0',
            p: { xs: 3, md: 4 },
            textAlign: 'center',
          }}
        >
          <Alert severity="success" sx={{ mb: 2, textAlign: 'left' }}>
            {tr('Paiement confirmé avec succès.')}
          </Alert>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate(mode === 'sale' ? '/sales' : '/subscription')}
          >
            {mode === 'sale' ? tr('Voir les ventes') : tr("Retour à l'abonnement")}
          </Button>
        </Box>
      ) : mode === 'subscription' && step === 'plans' ? (
        <Box>
          <Typography
            sx={{
              textAlign: 'center',
              color: 'text.secondary',
              mb: 3,
              maxWidth: 520,
              mx: 'auto',
            }}
          >
            {tr('Choisissez le pack adapté à votre commerce, puis payez en toute sécurité.')}
          </Typography>
          <PlanPricingCards
            plans={plans}
            recommendedCode="business"
            tr={tr}
            onSelect={pickPlan}
            ctaLabel={(_plan, { free }) => (free ? tr('Activer') : tr('Choisir'))}
          />
        </Box>
      ) : summary && saleReady ? (
        <Stack spacing={2.5}>
          {mode === 'subscription' && (
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => {
                setCheckout(null);
                setStep('plans');
              }}
              sx={{ alignSelf: 'flex-start' }}
            >
              {tr('Changer de pack')}
            </Button>
          )}

          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 3,
              border: `2px solid ${BRAND.primary}`,
              p: { xs: 2.5, md: 3 },
              boxShadow: '0 10px 28px rgba(13,148,136,0.1)',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ sm: 'center' }}
              spacing={2}
            >
              <Box>
                <Typography variant="overline" sx={{ color: BRAND.primary, fontWeight: 700 }}>
                  {tr('Récapitulatif')}
                </Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color: BRAND.navy }}>
                  {summary.title}
                </Typography>
                {mode === 'subscription' && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {tr('Sans engagement')} · {tr(`${renewMonths} mois`)}
                  </Typography>
                )}
              </Box>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: '2rem',
                  letterSpacing: '-0.03em',
                  color: BRAND.navy,
                }}
              >
                {displayAmount === '—'
                  ? tr('Selon le pack')
                  : `${formatNumber(displayAmount)} F`}
              </Typography>
            </Stack>

            {mode === 'subscription' && renewOptions.length > 1 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
                {renewOptions.map((opt) => (
                  <Chip
                    key={opt.months}
                    clickable
                    color={renewMonths === opt.months ? 'primary' : 'default'}
                    variant={renewMonths === opt.months ? 'filled' : 'outlined'}
                    label={`${opt.label} — ${formatCurrency(opt.amount)}`}
                    onClick={() => {
                      setRenewMonths(opt.months);
                      setSearchParams((prev) => {
                        const q = new URLSearchParams(prev);
                        q.set('months', String(opt.months));
                        q.set('cycle', opt.months >= 12 ? 'annual' : 'monthly');
                        return q;
                      }, { replace: true });
                    }}
                  />
                ))}
              </Stack>
            )}
          </Box>

          <SasPayCheckoutPanel
            groups={methodGroups}
            tr={tr}
            creating={creating}
            disabled={mode === 'subscription' && !activePlanCode}
            payLabel={tr(`Payer ${formatNumber(displayAmount)} F`)}
            onPay={() => void startCheckout()}
          />

          <Button variant="outlined" fullWidth onClick={() => navigate(-1)} sx={{ borderRadius: 2 }}>
            {tr('Annuler')}
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}
