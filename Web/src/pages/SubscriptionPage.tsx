import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PageHeader from '../components/PageHeader';
import {
  changePlan,
  fetchPlans,
  fetchSubscription,
  type Plan,
  type Subscription,
} from '../api/subscription';
import { getApiErrorMessage } from '../api/client';
import { formatCurrency, formatDate } from '../utils/format';

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState<string | null>(null);

  const load = () => {
    fetchSubscription().then(setSubscription).catch(() => undefined);
    fetchPlans().then(setPlans).catch(() => undefined);
  };

  useEffect(() => { load(); }, []);

  const doChange = async (code: string) => {
    setError(null);
    setMessage(null);
    const plan = plans.find((p) => p.code === code);
    const price = cycle === 'annual' ? Number(plan?.price_annual || 0) : Number(plan?.price || 0);

    if (price > 0) {
      navigate(`/payment/subscription?plan=${code}&cycle=${cycle}`);
      return;
    }

    setChanging(code);
    try {
      const updated = await changePlan(code, cycle);
      setSubscription(updated);
      setMessage('Votre abonnement a été mis à jour.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setChanging(null);
    }
  };

  const usageBar = (label: string, item: { used: number; limit: number; unlimited: boolean }) => (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {item.used} / {item.unlimited ? '∞' : item.limit}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={item.unlimited ? 15 : Math.min((item.used / (item.limit || 1)) * 100, 100)}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );

  return (
    <Box>
      <PageHeader title="Abonnement" subtitle="Gérez votre pack et vos limites" />

      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {subscription && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Box>
                <Typography variant="h6">{subscription.plan_name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Statut : {subscription.status} · Échéance : {formatDate(subscription.end_date)}
                </Typography>
              </Box>
              <Chip
                label={subscription.is_valid ? 'Actif' : 'Expiré'}
                color={subscription.is_valid ? 'success' : 'error'}
              />
            </Stack>
            <Box sx={{ mt: 3, maxWidth: 480 }}>
              {usageBar('Utilisateurs', subscription.usage.users)}
              {usageBar('Boutiques', subscription.usage.branches)}
              {usageBar('Produits', subscription.usage.products)}
            </Box>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <ToggleButtonGroup exclusive size="small" value={cycle} onChange={(_, v) => v && setCycle(v)}>
          <ToggleButton value="monthly">Mensuel</ToggleButton>
          <ToggleButton value="annual">Annuel (-2 mois)</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Grid container spacing={2}>
        {plans.map((plan) => {
          const current = subscription?.plan_code === plan.code;
          const price = cycle === 'annual' ? plan.price_annual : plan.price;
          return (
            <Grid size={{ xs: 12, md: 4 }} key={plan.id}>
              <Card sx={{ height: '100%', border: current ? '2px solid' : undefined, borderColor: 'primary.main' }}>
                <CardContent>
                  <Typography variant="h6">{plan.name}</Typography>
                  <Typography variant="h4" color="primary" sx={{ my: 1 }}>
                    {formatCurrency(price)}
                    <Typography component="span" variant="body2" color="text.secondary">
                      /{cycle === 'annual' ? 'an' : 'mois'}
                    </Typography>
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
                    <Chip size="small" label={`${plan.unlimited_users ? '∞' : plan.max_users} utilisateur(s)`} variant="outlined" />
                    <Chip size="small" label={`${plan.unlimited_branches ? '∞' : plan.max_branches} boutique(s)`} variant="outlined" />
                    <Chip size="small" label={`${plan.unlimited_products ? '∞' : plan.max_products} produits`} variant="outlined" />
                  </Stack>
                  <List dense>
                    {plan.features_detail.map((f) => (
                      <ListItem key={f.code} disableGutters>
                        <ListItemIcon sx={{ minWidth: 30 }}>
                          <CheckCircleIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={f.label} primaryTypographyProps={{ variant: 'body2' }} />
                      </ListItem>
                    ))}
                  </List>
                  <Button
                    fullWidth
                    variant={current ? 'outlined' : 'contained'}
                    disabled={current || changing === plan.code}
                    onClick={() => doChange(plan.code)}
                    sx={{ mt: 2 }}
                  >
                    {current ? 'Plan actuel' : changing === plan.code ? 'Changement...' : Number(cycle === 'annual' ? plan.price_annual : plan.price) > 0 ? 'Payer avec Wave' : 'Choisir ce plan'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
