import { Card, CardContent, Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export default function StatCard({
  label,
  value,
  icon,
  color = '#1565C0',
  growth,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  growth?: number;
  subtitle?: string;
}) {
  const positive = (growth ?? 0) >= 0;
  const text = String(value ?? '');
  const longValue = text.length > 10;

  return (
    <Card sx={{ height: '100%', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 12px rgba(15,23,42,0.08)' } }}>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0, flex: 1, pr: icon ? 0.5 : 0 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {label}
            </Typography>
            <Typography
              component="div"
              sx={{
                mt: 0.5,
                fontWeight: 700,
                lineHeight: 1.2,
                fontSize: longValue ? '0.95rem' : { xs: '1.1rem', sm: '1.35rem' },
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
            {growth !== undefined && (
              <Typography variant="caption" sx={{ color: positive ? 'success.main' : 'error.main', mt: 0.5, display: 'block', fontWeight: 600 }}>
                {positive ? '▲' : '▼'} {Math.abs(growth)}% vs période préc.
              </Typography>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `${color}14`,
                color,
                flexShrink: 0,
                ml: 1,
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
