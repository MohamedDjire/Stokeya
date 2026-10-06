import { Card, CardContent, Box, Typography, Tooltip } from '@mui/material';
import type { ReactNode } from 'react';
import { formatNumber } from '../locale/runtime';
import { softPulse, staggerFadeUp } from '../theme/motion';

export default function StatCard({
  label,
  value,
  icon,
  color = '#0D9488',
  growth,
  subtitle,
  index = 0,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  growth?: number;
  subtitle?: string;
  index?: number;
}) {
  const positive = (growth ?? 0) >= 0;
  const display = typeof value === 'number' ? formatNumber(value) : String(value ?? '');

  return (
    <Card
      sx={{
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        ...staggerFadeUp(index),
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 28px ${color}22`,
          borderColor: `${color}55`,
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
        },
      }}
    >
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={500}
              noWrap
              sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}
            >
              {label}
            </Typography>
            <Tooltip title={display} arrow placement="top">
              <Typography
                variant="h5"
                sx={{
                  mt: 0.5,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'default',
                }}
              >
                {display}
              </Typography>
            </Tooltip>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }} noWrap>
                {subtitle}
              </Typography>
            )}
            {growth !== undefined && (
              <Typography variant="caption" sx={{ color: positive ? 'success.main' : 'error.main', mt: 0.5, display: 'block', fontWeight: 600 }}>
                {positive ? '▲' : '▼'} {formatNumber(Math.abs(growth))}% vs période préc.
              </Typography>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `${color}14`,
                color,
                flexShrink: 0,
                ml: 1,
                transition: 'transform 0.25s ease',
                '.MuiCard-root:hover &': {
                  animation: `${softPulse} 1.2s ease infinite`,
                },
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
