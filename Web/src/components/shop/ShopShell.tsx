import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Container,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Toolbar,
  Typography,
  alpha,
  keyframes,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhoneIcon from '@mui/icons-material/Phone';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import type { ReactNode } from 'react';
import type { ShopInfo } from '../../api/shop';
import { StokeyaMark } from '../AuthShell';
import { shopImageUrl } from './utils';
import { SHOP, shopHeroGradient, shopPageBackground, shopPrimary, shopSecondary } from './shopTheme';
import { useLocale } from '../../locale/useLocale';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

interface Props {
  shop: ShopInfo;
  cartCount: number;
  search: string;
  onSearchChange: (v: string) => void;
  onCartOpen: () => void;
  children: ReactNode;
  nav: ReactNode;
  showSearch?: boolean;
}

export default function ShopShell({
  shop, cartCount, search, onSearchChange, onCartOpen, children, nav, showSearch = true,
}: Props) {
  const { tr, version } = useLocale();
  void version;
  const primary = shopPrimary(shop.primary_color);
  const secondary = shopSecondary(shop.secondary_color);
  const cover = shopImageUrl(shop.cover_image);
  const logo = shopImageUrl(shop.logo);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', ...shopPageBackground() }}>
      {/* Barre Stokeya — toujours visible */}
      <Box
        sx={{
          bgcolor: SHOP.ink,
          color: '#fff',
          py: 1,
          borderBottom: `2px solid ${SHOP.cyan}`,
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <StokeyaMark size={36} light />
            <Typography
              variant="caption"
              sx={{
                display: { xs: 'none', sm: 'block' },
                color: alpha('#fff', 0.7),
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              {tr('Boutique en ligne')}
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* Hero boutique */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        {cover && (
          <Box
            sx={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${cover})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.28,
            }}
          />
        )}
        {/* Texture dégradé cyan → teal → marine */}
        <Box
          sx={{
            position: 'absolute', inset: 0,
            background: shopHeroGradient(primary, secondary),
            opacity: cover ? 0.94 : 1,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 320,
            height: 320,
            borderRadius: '50%',
            bgcolor: alpha(SHOP.mint, 0.18),
            top: -120,
            right: -80,
            filter: 'blur(2px)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: '50%',
            bgcolor: alpha(SHOP.sky, 0.2),
            bottom: -60,
            left: -40,
          }}
        />

        <Box
          sx={{
            position: 'relative',
            color: '#fff',
            pt: { xs: 3.5, md: 5 },
            pb: { xs: 3, md: 4 },
            animation: `${fadeIn} 0.5s ease-out`,
          }}
        >
          <Container maxWidth="lg">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems={{ md: 'center' }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
                <Avatar
                  src={logo}
                  sx={{
                    width: { xs: 72, md: 88 },
                    height: { xs: 72, md: 88 },
                    border: `3px solid ${alpha('#fff', 0.85)}`,
                    boxShadow: `0 8px 28px ${alpha(SHOP.ink, 0.35)}`,
                    bgcolor: '#fff',
                    color: primary,
                    fontWeight: 800,
                    fontSize: '1.75rem',
                  }}
                >
                  {shop.name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    sx={{
                      lineHeight: 1.15,
                      fontSize: { xs: '1.65rem', md: '2rem' },
                      letterSpacing: '-0.02em',
                      textShadow: `0 2px 12px ${alpha(SHOP.ink, 0.25)}`,
                    }}
                  >
                    {shop.name}
                  </Typography>
                  {shop.description && (
                    <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 520, lineHeight: 1.5 }}>
                      {shop.description.length > 140 ? `${shop.description.slice(0, 140)}…` : shop.description}
                    </Typography>
                  )}
                  {shop.hours && (
                    <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 0.75 }}>
                      {shop.hours}
                    </Typography>
                  )}
                </Box>
              </Stack>
              <Stack direction="row" spacing={1}>
                {shop.phone && (
                  <IconButton
                    href={`tel:${shop.phone}`}
                    sx={{
                      bgcolor: alpha('#fff', 0.16),
                      color: '#fff',
                      border: `1px solid ${alpha('#fff', 0.25)}`,
                      '&:hover': { bgcolor: alpha('#fff', 0.28) },
                    }}
                  >
                    <PhoneIcon />
                  </IconButton>
                )}
                {shop.whatsapp && (
                  <IconButton
                    href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    sx={{
                      bgcolor: alpha('#fff', 0.16),
                      color: '#fff',
                      border: `1px solid ${alpha('#fff', 0.25)}`,
                      '&:hover': { bgcolor: alpha('#fff', 0.28) },
                    }}
                  >
                    <WhatsAppIcon />
                  </IconButton>
                )}
                <IconButton
                  onClick={onCartOpen}
                  sx={{
                    bgcolor: alpha('#fff', 0.22),
                    color: '#fff',
                    border: `1px solid ${alpha('#fff', 0.35)}`,
                    '&:hover': { bgcolor: alpha('#fff', 0.35) },
                  }}
                >
                  <Badge badgeContent={cartCount} color="error">
                    <ShoppingCartOutlinedIcon />
                  </Badge>
                </IconButton>
              </Stack>
            </Stack>
          </Container>
        </Box>
      </Box>

      {/* Trust strip */}
      <Box
        sx={{
          bgcolor: '#fff',
          borderBottom: '1px solid',
          borderColor: alpha(SHOP.cyan, 0.2),
          py: 1.25,
          backgroundImage: `linear-gradient(90deg, ${alpha(SHOP.ice, 0.9)} 0%, #fff 40%, ${alpha(SHOP.mist, 0.8)} 100%)`,
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            spacing={{ xs: 2, md: 4 }}
            justifyContent="center"
            flexWrap="wrap"
            useFlexGap
          >
            {[
              { icon: <LocalShippingOutlinedIcon fontSize="small" />, text: 'Livraison ou retrait' },
              { icon: <VerifiedUserOutlinedIcon fontSize="small" />, text: 'Commande sécurisée' },
              { icon: <SupportAgentOutlinedIcon fontSize="small" />, text: 'Support WhatsApp' },
            ].map((item) => (
              <Stack key={item.text} direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
                <Box sx={{ color: SHOP.cyan, display: 'flex' }}>{item.icon}</Box>
                <Typography variant="caption" fontWeight={600}>{tr(item.text)}</Typography>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* Sticky search + nav */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: alpha('#fff', 0.96),
          backdropFilter: 'blur(10px)',
          color: 'text.primary',
          borderBottom: `1px solid ${alpha(SHOP.cyan, 0.18)}`,
        }}
      >
        <Container maxWidth="lg" disableGutters sx={{ px: { xs: 1, sm: 2 } }}>
          <Toolbar disableGutters sx={{ flexDirection: 'column', alignItems: 'stretch', py: 1, gap: 1 }}>
            {showSearch && (
              <TextField
                size="small"
                fullWidth
                placeholder={tr('Rechercher un produit, une référence ou un code-barres…')}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: SHOP.ice,
                    '& fieldset': { borderColor: 'transparent' },
                    '&:hover fieldset': { borderColor: alpha(SHOP.cyan, 0.35) },
                    '&.Mui-focused fieldset': { borderColor: primary },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: SHOP.cyan }} />
                    </InputAdornment>
                  ),
                }}
              />
            )}
            {nav}
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3, flex: 1, pb: { xs: 10, md: 4 } }}>
        {children}
      </Container>

      {/* Footer avec Stokeya bien visible */}
      <Box
        component="footer"
        sx={{
          mt: 'auto',
          background: `linear-gradient(160deg, ${SHOP.ink} 0%, ${SHOP.primaryDeep} 55%, ${SHOP.cyan} 100%)`,
          color: '#fff',
          pt: 4,
          pb: 3,
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={800} sx={{ letterSpacing: '-0.01em' }}>
                  {shop.name}
                </Typography>
                {shop.address && (
                  <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5, maxWidth: 360 }}>
                    {shop.address}
                  </Typography>
                )}
                {shop.phone && (
                  <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.75 }}>
                    {shop.phone}
                  </Typography>
                )}
              </Box>
              <Box
                sx={{
                  px: 2.5,
                  py: 2,
                  borderRadius: 2,
                  bgcolor: alpha('#fff', 0.1),
                  border: `1px solid ${alpha('#fff', 0.22)}`,
                  backdropFilter: 'blur(6px)',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mb: 1,
                    opacity: 0.75,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    fontSize: '0.65rem',
                  }}
                >
                  {tr('Propulsé par')}
                </Typography>
                <StokeyaMark size={48} light />
              </Box>
            </Stack>

            <Box sx={{ borderTop: `1px solid ${alpha('#fff', 0.15)}`, pt: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                <Typography variant="caption" sx={{ opacity: 0.65 }}>
                  © {new Date().getFullYear()} {shop.name}
                </Typography>
                <Link
                  href="mailto:inventratechnologies@gmail.com"
                  underline="hover"
                  sx={{ color: SHOP.mint, fontSize: '0.75rem', fontWeight: 600 }}
                >
                  inventratechnologies@gmail.com
                </Link>
              </Stack>
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
