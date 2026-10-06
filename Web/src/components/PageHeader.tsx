import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useLocale } from '../locale/useLocale';
import { tr } from '../locale/tr';
import { fadeUpSx } from '../theme/motion';

export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { version } = useLocale();
  void version;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2,
        mb: 3,
        ...fadeUpSx(0),
      }}
    >
      <Box>
        <Box
          sx={{
            width: 36,
            height: 4,
            borderRadius: 2,
            mb: 1.25,
            background: `linear-gradient(90deg, #2563EB, #22C55E)`,
          }}
        />
        <Typography variant="h5" sx={{ letterSpacing: '-0.02em' }}>{tr(title)}</Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {tr(subtitle)}
          </Typography>
        )}
      </Box>
      {action && (
        <Box sx={fadeUpSx(80)}>
          {action}
        </Box>
      )}
    </Box>
  );
}
