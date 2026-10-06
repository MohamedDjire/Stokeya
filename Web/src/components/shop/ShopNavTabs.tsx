import { Tab, Tabs } from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { useLocale } from '../../locale/useLocale';

interface Props {
  value: number;
  onChange: (v: number) => void;
  primary: string;
}

export default function ShopNavTabs({ value, onChange, primary }: Props) {
  const { tr, version } = useLocale();
  void version;
  return (
    <Tabs
      value={value}
      onChange={(_, v) => onChange(v)}
      variant="fullWidth"
      sx={{
        minHeight: 48,
        '& .MuiTab-root': {
          minHeight: 48,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          gap: 0.75,
        },
        '& .Mui-selected': { color: `${primary} !important` },
        '& .MuiTabs-indicator': { bgcolor: primary, height: 3, borderRadius: '3px 3px 0 0' },
      }}
    >
      <Tab icon={<StorefrontOutlinedIcon fontSize="small" />} iconPosition="start" label={tr('Catalogue')} />
      <Tab icon={<QrCodeScannerOutlinedIcon fontSize="small" />} iconPosition="start" label={tr('Commande rapide')} />
      <Tab icon={<LocalShippingOutlinedIcon fontSize="small" />} iconPosition="start" label={tr('Suivi')} />
    </Tabs>
  );
}
