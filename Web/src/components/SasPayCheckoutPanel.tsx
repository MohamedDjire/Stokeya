import CreditCardIcon from '@mui/icons-material/CreditCard';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import TollIcon from '@mui/icons-material/Toll';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { SasPayMethodGroup } from '../api/payments';
import { BRAND } from '../theme';

const ICONS = {
  mobile_money: SmartphoneIcon,
  card: CreditCardIcon,
  other: TollIcon,
} as const;

type Props = {
  groups: SasPayMethodGroup[];
  payLabel: string;
  creating: boolean;
  disabled?: boolean;
  onPay: () => void;
  tr: (value: string) => string;
};

export default function SasPayCheckoutPanel({
  groups,
  payLabel,
  creating,
  disabled,
  onPay,
  tr,
}: Props) {
  return (
    <Box
      sx={{
        bgcolor: '#fff',
        borderRadius: 3,
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2.5, py: 1.5, bgcolor: BRAND.navy, color: '#fff' }}>
        <Typography fontWeight={800}>{tr('SasPay Checkout')}</Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          {tr('Un seul paiement, tous les moyens disponibles')}
        </Typography>
      </Box>
      <Stack spacing={0} divider={<Box sx={{ borderTop: '1px solid #EEF2F6' }} />}>
        {groups.map((group) => {
          const Icon = ICONS[group.code as keyof typeof ICONS] || TollIcon;
          return (
            <Box key={group.code} sx={{ px: 2.5, py: 1.75 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                <Icon sx={{ fontSize: 18, color: BRAND.primary }} />
                <Typography fontWeight={700}>{tr(group.label)}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {group.methods.map((method) => method.label).join(' · ') || tr('Disponible sur la page SasPay')}
              </Typography>
            </Box>
          );
        })}
      </Stack>
      <Box sx={{ p: 2.5 }}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          sx={{ py: 1.4, borderRadius: 2, fontWeight: 700 }}
          onClick={onPay}
          disabled={creating || disabled}
        >
          {creating ? tr('Préparation...') : payLabel}
        </Button>
      </Box>
    </Box>
  );
}
