import { useMemo, type ReactNode } from 'react';
import { ThemeProvider, createTheme, Box } from '@mui/material';
import { theme as baseTheme } from '../theme';
import { useLocale } from './useLocale';

/**
 * Direction thème + dir HTML.
 * Pas de stylis-plugin-rtl : il inversait mal le Drawer (restait à gauche).
 * Le shell (Layout) gère sidebar/marges à la main.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { rtl, language, currency, version } = useLocale();
  const theme = useMemo(
    () => createTheme(baseTheme, { direction: rtl ? 'rtl' : 'ltr' }),
    [rtl, language],
  );

  return (
    <ThemeProvider theme={theme}>
      <Box
        component="div"
        sx={{ display: 'contents' }}
        data-stokeya-locale={`${language}-${currency}-${version}`}
      >
        {children}
      </Box>
    </ThemeProvider>
  );
}
