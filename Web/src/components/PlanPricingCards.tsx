import {
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import type { Plan } from '../api/subscription';
import { formatNumber } from '../utils/format';
import { BRAND } from '../theme';

const PLAN_BLURBS: Record<string, string> = {
  starter: 'Pour démarrer un petit commerce',
  business: 'Pour les commerces en croissance',
  enterprise: 'Pour les réseaux et équipes',
  trial: 'Pour découvrir Stokeya',
};

/** Badge uniquement sur le pack recommandé. */
const PLAN_BADGES: Record<string, string> = {
  business: 'Recommandé',
};

function planLines(plan: Plan, tr: (s: string) => string): string[] {
  const lines = [
    plan.unlimited_users
      ? tr('Utilisateurs illimités')
      : tr(`${plan.max_users} utilisateur${plan.max_users > 1 ? 's' : ''}`),
    plan.unlimited_branches
      ? tr('Boutiques illimitées')
      : tr(`${plan.max_branches} boutique${Number(plan.max_branches) > 1 ? 's' : ''}`),
    plan.unlimited_warehouses
      ? tr('Entrepôts illimités')
      : tr(`${plan.max_warehouses ?? 0} entrepôt${Number(plan.max_warehouses) > 1 ? 's' : ''}`),
    plan.unlimited_products
      ? tr('Produits illimités')
      : tr(`Jusqu'à ${formatNumber(plan.max_products)} produits`),
  ];

  const hasOnlineShop =
    (plan.features || []).includes('online_shop')
    || (plan.features_detail || []).some((f) => f.code === 'online_shop');
  if (hasOnlineShop || plan.code === 'business' || plan.code === 'enterprise') {
    lines.push(tr('Boutique en ligne'));
  }

  const extras = (plan.features_detail || [])
    .filter((f) => !f.core && f.code !== 'online_shop')
    .slice(0, 3)
    .map((f) => f.label);
  return [...lines, ...extras];
}

type Props = {
  plans: Plan[];
  selectedCode?: string;
  currentCode?: string;
  recommendedCode?: string;
  loading?: boolean;
  tr: (s: string) => string;
  onSelect: (plan: Plan) => void;
  ctaLabel?: (plan: Plan, opts: { current: boolean; free: boolean }) => string;
};

export default function PlanPricingCards({
  plans,
  selectedCode,
  currentCode,
  recommendedCode = 'business',
  loading,
  tr,
  onSelect,
  ctaLabel,
}: Props) {
  const publicPlans = plans.filter((p) => p.is_public !== false && Number(p.price) >= 0);

  return (
    <Grid container spacing={2.5} alignItems="stretch">
      {publicPlans.map((plan) => {
        const current = currentCode === plan.code;
        const selected = selectedCode === plan.code;
        const featured = plan.code === recommendedCode;
        const free = Number(plan.price) <= 0;
        const accent = featured || selected || current;
        const badge = PLAN_BADGES[plan.code];
        const label = ctaLabel
          ? ctaLabel(plan, { current, free })
          : current
            ? tr('Renouveler')
            : free
              ? tr('Activer')
              : tr('Choisir');

        return (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={plan.id} sx={{ display: 'flex' }}>
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: '#fff',
                borderRadius: 3,
                px: 2.75,
                pt: badge ? 4.5 : 3,
                pb: 3,
                position: 'relative',
                border: '2px solid',
                borderColor: accent ? BRAND.primary : '#E8EEF2',
                boxShadow: accent
                  ? '0 12px 32px rgba(13,148,136,0.14)'
                  : '0 4px 16px rgba(11,31,58,0.04)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: { md: 'translateY(-3px)' },
                  boxShadow: '0 16px 36px rgba(11,31,58,0.08)',
                },
              }}
            >
              {badge && (
                <Chip
                  size="small"
                  label={tr(badge)}
                  sx={{
                    position: 'absolute',
                    top: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bgcolor: BRAND.primary,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    height: 24,
                    maxWidth: '90%',
                  }}
                />
              )}

              {current && (
                <Chip
                  size="small"
                  label={tr('Pack actuel')}
                  color="primary"
                  variant="outlined"
                  sx={{ alignSelf: 'center', mb: 1.25, fontWeight: 600 }}
                />
              )}

              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: BRAND.navy, textAlign: 'center' }}>
                {plan.name.replace(/^Pack\s+/i, '')}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, minHeight: 40, textAlign: 'center' }}
              >
                {tr(PLAN_BLURBS[plan.code] || 'Pack Stokeya')}
              </Typography>

              <Box sx={{ mt: 2, mb: 0.5, textAlign: 'center' }}>
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 800,
                    fontSize: '2.4rem',
                    letterSpacing: '-0.04em',
                    color: BRAND.navy,
                    lineHeight: 1,
                  }}
                >
                  {formatNumber(plan.price || 0)}
                </Typography>
                <Typography component="span" sx={{ ml: 0.75, fontWeight: 700, color: BRAND.navy }}>
                  F
                </Typography>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 2.5, display: 'block', textAlign: 'center' }}
              >
                {tr('HT / mois')} · {tr('Sans engagement')}
              </Typography>

              <Button
                fullWidth
                disabled={loading}
                variant={accent ? 'contained' : 'outlined'}
                color="primary"
                onClick={() => onSelect(plan)}
                sx={{
                  py: 1.2,
                  borderRadius: 2,
                  fontWeight: 700,
                  borderWidth: 2,
                  '&:hover': { borderWidth: 2 },
                }}
              >
                {label}
              </Button>

              <Stack spacing={1.15} sx={{ mt: 3, flex: 1 }}>
                {planLines(plan, tr).map((line) => (
                  <Stack key={line} direction="row" spacing={1} alignItems="flex-start">
                    <CheckCircleOutlineIcon
                      sx={{ fontSize: 18, color: BRAND.primary, mt: '1px', flexShrink: 0 }}
                    />
                    <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.4 }}>
                      {line}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
}
