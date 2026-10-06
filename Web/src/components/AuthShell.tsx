import type { ReactNode } from 'react';
import { Box, Link, Stack, Typography, keyframes } from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { StokeyaMark } from '../brand/StokeyaLogo';
import { useLocale } from '../locale/useLocale';

export { StokeyaMark } from '../brand/StokeyaLogo';

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

/** Monogramme + wordmark Stokeya — voir brand/StokeyaLogo */

const STATS = [
  { icon: <StorefrontOutlinedIcon fontSize="small" />, value: '500+', label: 'Entreprises' },
  { icon: <Inventory2OutlinedIcon fontSize="small" />, value: '2M+', label: 'Mouvements stock' },
  { icon: <PointOfSaleOutlinedIcon fontSize="small" />, value: '24/7', label: 'Caisse & sync' },
];

export function AuthBrandPanel({
  headline,
  subtext,
}: {
  headline?: string;
  subtext?: string;
}) {
  const { tr, version } = useLocale();
  void version;
  const resolvedHeadline = headline ?? tr('Bon retour parmi nous');
  const resolvedSubtext = subtext ?? tr('Pilotez stock, ventes et points de vente depuis un seul espace sécurisé.');
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        color: '#F8FAFC',
        px: { xs: 3, md: 5 },
        py: { xs: 4, md: 5 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: { xs: 280, md: '100%' },
        height: '100%',
        background: `
          radial-gradient(ellipse 80% 60% at 10% 20%, rgba(37,99,235,0.42) 0%, transparent 55%),
          radial-gradient(ellipse 70% 50% at 90% 80%, rgba(34,197,94,0.18) 0%, transparent 50%),
          linear-gradient(165deg, #061525 0%, #0B1F3A 50%, #123A6B 100%)
        `,
      }}
    >
      {/* Motif topographique léger */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18,
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(255,255,255,0.06) 18px, rgba(255,255,255,0.06) 19px),
            repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(255,255,255,0.04) 18px, rgba(255,255,255,0.04) 19px)
          `,
          pointerEvents: 'none',
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.12)',
          top: -60,
          right: -40,
          animation: `${float} 7s ease-in-out infinite`,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: '50%',
          border: '1px dashed rgba(94,234,212,0.35)',
          bottom: 80,
          left: -30,
          animation: `${float} 9s ease-in-out infinite reverse`,
        }}
      />

      <Box sx={{ position: 'relative', animation: `${fadeUp} 0.6s ease both` }}>
        <StokeyaMark light size={44} tagline={tr('Gérez votre stock, développez votre activité')} />
      </Box>

      <Box sx={{ position: 'relative', my: { xs: 3, md: 4 }, animation: `${fadeUp} 0.7s 0.08s ease both` }}>
        <Typography
          sx={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontWeight: 700,
            fontSize: { xs: '1.85rem', md: '2.35rem' },
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            maxWidth: 360,
          }}
        >
          {resolvedHeadline}
        </Typography>
        <Typography
          sx={{
            mt: 1.5,
            fontFamily: '"Outfit", sans-serif',
            fontSize: '1rem',
            lineHeight: 1.55,
            color: 'rgba(248,250,252,0.82)',
            maxWidth: 380,
          }}
        >
          {resolvedSubtext}
        </Typography>

        <Stack direction="row" spacing={1.5} sx={{ mt: 3.5 }} flexWrap="wrap" useFlexGap>
          {STATS.map((s) => (
            <Box
              key={s.label}
              sx={{
                flex: '1 1 100px',
                minWidth: 100,
                px: 1.5,
                py: 1.25,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: '#5EEAD4', mb: 0.5 }}>
                {s.icon}
                <Typography sx={{ fontFamily: '"Fraunces", serif', fontWeight: 700, fontSize: '1.25rem', color: '#fff' }}>
                  {s.value}
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 12, color: 'rgba(248,250,252,0.7)', fontFamily: '"Outfit", sans-serif' }}>
                {tr(s.label)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ position: 'relative', animation: `${fadeUp} 0.7s 0.15s ease both` }}>
        <Typography sx={{ fontSize: 12, color: 'rgba(248,250,252,0.55)', mb: 0.75, fontFamily: '"Outfit", sans-serif' }}>
          {tr('Support & contact')}
        </Typography>
        <Link
          href="mailto:inventratechnologies@gmail.com"
          underline="hover"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            color: '#F8FAFC',
            fontFamily: '"Outfit", sans-serif',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <EmailOutlinedIcon sx={{ fontSize: 18, color: '#5EEAD4' }} />
          inventratechnologies@gmail.com
        </Link>
        <Typography sx={{ mt: 1, fontSize: 12, color: 'rgba(248,250,252,0.45)', fontFamily: '"Outfit", sans-serif' }}>
          {tr('Stokeya Technologies · Afrique de l’Ouest')}
        </Typography>
      </Box>
    </Box>
  );
}

/** Coquille auth split : panneau marque + formulaire */
export default function AuthShell({
  title,
  subtitle,
  children,
  brandHeadline,
  brandSubtext,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  brandHeadline?: string;
  brandSubtext?: string;
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        py: { xs: 2, sm: 3 },
        px: { xs: 1.5, sm: 2.5 },
        fontFamily: '"Outfit", sans-serif',
        background: `
          radial-gradient(ellipse at 20% 0%, rgba(13,148,136,0.12) 0%, transparent 45%),
          radial-gradient(ellipse at 90% 100%, rgba(11,31,58,0.08) 0%, transparent 40%),
          linear-gradient(180deg, #E8EEF2 0%, #F4F7F8 100%)
        `,
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 960,
          my: { xs: 0, md: 'auto' },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
          alignItems: 'stretch',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: '#fff',
          boxShadow: '0 24px 64px rgba(11,31,58,0.14)',
          border: '1px solid rgba(11,31,58,0.06)',
          animation: `${fadeUp} 0.5s ease both`,
        }}
      >
        <AuthBrandPanel headline={brandHeadline} subtext={brandSubtext} />

        <Box
          sx={{
            px: { xs: 2.5, sm: 4 },
            py: { xs: 3, sm: 4 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            animation: `${fadeUp} 0.55s 0.1s ease both`,
          }}
        >
          <Box sx={{ display: { xs: 'none', md: 'block' }, mb: 1.5 }}>
            <StokeyaMark size={32} />
          </Box>
          <Typography
            sx={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontWeight: 700,
              fontSize: { xs: '1.5rem', sm: '1.75rem' },
              color: '#0B1F3A',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              sx={{
                mt: 0.75,
                mb: 2.5,
                color: '#64748B',
                fontFamily: '"Outfit", sans-serif',
                fontSize: '0.95rem',
              }}
            >
              {subtitle}
            </Typography>
          )}
          {!subtitle && <Box sx={{ mb: 2.5 }} />}
          {children}
        </Box>
      </Box>
    </Box>
  );
}
