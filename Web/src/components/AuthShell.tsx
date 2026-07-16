import { Box, Card, CardContent, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h4" color="primary" fontWeight={800} align="center">
            Inventra
          </Typography>
          <Typography variant="h6" align="center" sx={{ mt: 2 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              {subtitle}
            </Typography>
          )}
          <Box sx={{ mt: subtitle ? 0 : 3 }}>{children}</Box>
        </CardContent>
      </Card>
    </Box>
  );
}
