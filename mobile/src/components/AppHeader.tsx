import { Appbar } from 'react-native-paper';
import { colors } from '../theme/colors';
import type { ComponentProps } from 'react';

export const HEADER_BG = '#F7FBFA';

type Props = ComponentProps<typeof Appbar.Header>;

/** En-tête clair — même fond que le logo Stokeya (blanc + léger vert). */
export default function AppHeader({ style, children, ...rest }: Props) {
  return (
    <Appbar.Header
      elevated
      {...rest}
      style={[{ backgroundColor: HEADER_BG }, style]}
    >
      {children}
    </Appbar.Header>
  );
}

export const nativeHeaderOptions = {
  headerStyle: { backgroundColor: HEADER_BG },
  headerTintColor: colors.secondary,
  headerTitleStyle: { color: colors.secondary, fontWeight: '700' as const },
  headerShadowVisible: false,
  statusBarStyle: 'dark' as const,
};
