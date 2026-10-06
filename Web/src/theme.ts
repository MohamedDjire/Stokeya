import { createTheme } from '@mui/material/styles';

/** Palette Stokeya — teal / blanc / marine (alignée login & inscription) */
export const BRAND = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryLight: '#2DD4BF',
  navy: '#0B1F3A',
  amber: '#F59E0B',
  mint: '#5EEAD4',
  coral: '#F97316',
  sky: '#0EA5E9',
  bg: '#F0F5F6',
};

export const theme = createTheme({
  palette: {
    primary: {
      main: BRAND.primary,
      dark: BRAND.primaryDark,
      light: BRAND.primaryLight,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: BRAND.navy,
      dark: '#061525',
      light: '#1E3A5F',
      contrastText: '#FFFFFF',
    },
    warning: { main: BRAND.amber },
    success: { main: '#0F766E' },
    error: { main: '#C62828' },
    info: { main: BRAND.sky },
    background: { default: BRAND.bg, paper: '#FFFFFF' },
    text: { primary: BRAND.navy, secondary: '#64748B' },
    divider: '#E2E8F0',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Outfit", "Segoe UI", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 2px rgba(11,31,58,0.05), 0 4px 16px rgba(11,31,58,0.04)',
          border: '1px solid rgba(226,232,240,0.9)',
          transition: 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, border-color 0.2s ease',
          '&:hover': {
            boxShadow: '0 8px 28px rgba(11,31,58,0.08)',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          transition: 'transform 0.18s ease, box-shadow 0.18s ease, background 0.2s ease',
          '&:active': { transform: 'scale(0.98)' },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%)`,
          boxShadow: '0 6px 16px rgba(13,148,136,0.28)',
          '&:hover': {
            background: `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 100%)`,
            boxShadow: '0 8px 22px rgba(13,148,136,0.35)',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, minHeight: 48 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: '1px solid #E2E8F0' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #E2E8F0',
          backdropFilter: 'blur(12px)',
          backgroundColor: '#FAFBFC',
          backgroundImage: 'linear-gradient(90deg, #FFFFFF 0%, #F3FAF8 42%, #F4F9FC 100%)',
          color: '#0B1F3A',
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: '"Outfit", "Segoe UI", sans-serif',
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 0% -10%, rgba(45,212,191,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(14,165,233,0.08), transparent 50%)',
          backgroundAttachment: 'fixed',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
  },
});

export const CHART_COLORS = [
  BRAND.primary,
  BRAND.navy,
  BRAND.amber,
  BRAND.sky,
  '#14B8A6',
  BRAND.coral,
];
