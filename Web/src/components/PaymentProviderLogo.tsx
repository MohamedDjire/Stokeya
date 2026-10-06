import { Box, type BoxProps } from '@mui/material';
import type { PaymentProviderCode } from '../api/payments';

const LOGO_SRC: Record<string, string> = {
  wave: '/payments/wave.webp',
  orange_money: '/payments/orange-money.webp',
};

type Props = {
  code: PaymentProviderCode | string;
  size?: number;
  sx?: BoxProps['sx'];
};

/** Logos officiels Wave / Orange Money. */
export default function PaymentProviderLogo({ code, size = 40, sx }: Props) {
  const src = LOGO_SRC[code] || LOGO_SRC.wave;
  const isWave = code === 'wave';

  return (
    <Box
      component="img"
      src={src}
      alt={code === 'orange_money' ? 'Orange Money' : 'Wave'}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        borderRadius: isWave ? '50%' : 1.25,
        bgcolor: '#fff',
        p: isWave ? 0 : 0.4,
        boxShadow: '0 1px 3px rgba(11,31,58,0.1)',
        ...sx,
      }}
    />
  );
}
