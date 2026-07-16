import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: { main: '#1565C0', dark: '#0D47A1', light: '#42A5F5' },
    secondary: { main: '#00897B' },
    warning: { main: '#E65100' },
    success: { main: '#2E7D32' },
    error: { main: '#C62828' },
    background: { default: '#F4F6F9', paper: '#FFFFFF' },
    text: { primary: '#1A1A2E', secondary: '#64748B' },
    divider: '#E2E8F0',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, -apple-system, sans-serif',
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
          boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
          border: '1px solid #E2E8F0',
        },
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
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
        root: { borderBottom: '1px solid #E2E8F0' },
      },
    },
  },
});

export const CHART_COLORS = ['#1565C0', '#00897B', '#FF6F00', '#8E24AA', '#43A047', '#E53935'];
