import { MD3LightTheme } from 'react-native-paper';
import { colors } from './colors';

export const theme = {
  ...MD3LightTheme,
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: '#E3F2FD',
    secondary: colors.secondary,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: '#F8FAFC',
    outline: colors.border,
  },
};
