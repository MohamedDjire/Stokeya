import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PageHeader from '../components/PageHeader';
import WebcamBarcodeScanner from '../components/WebcamBarcodeScanner';
import { fetchProductByBarcode } from '../api/batches';
import type { Product } from '../api/auth';
import { getApiErrorMessage } from '../api/client';
import { formatCurrency } from '../utils/format';
import { useLocale } from '../locale/useLocale';

export default function ScanPage() {
  const { tr, version } = useLocale();
  void version;

  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const focusInput = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const lookup = useCallback(async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setProduct(null);
    try {
      const p = await fetchProductByBarcode(trimmed);
      setProduct(p);
      setCode('');
      focusInput();
    } catch (err) {
      setError(getApiErrorMessage(err, tr('Produit introuvable pour ce code-barres.')));
      setCode('');
      focusInput();
    } finally {
      setLoading(false);
    }
  }, [focusInput, tr]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookup(code);
    }
  };

  const handleCameraScan = useCallback((scanned: string) => {
    setCameraOpen(false);
    setCode(scanned);
    lookup(scanned);
  }, [lookup]);

  const primaryBarcode = product?.barcodes?.find((b) => b.is_primary)?.code
    || product?.barcodes?.[0]?.code
    || '—';

  const stockQty = Number(product?.total_stock || 0);
  const stockStatus = product?.stock_status
    || (stockQty <= 0 ? 'out_of_stock' as const : 'ok' as const);
  const stockColor = stockStatus === 'out_of_stock' ? 'error' as const : stockStatus === 'low' ? 'warning' as const : 'success' as const;
  const stockLabel = stockStatus === 'out_of_stock' ? tr('Rupture') : stockStatus === 'low' ? tr('Stock faible') : tr('OK');

  return (
    <Box>
      <PageHeader
        title={tr('Scan direct')}
        subtitle={tr('Scanner USB/Bluetooth, caméra ou saisie manuelle')}
      />

      <Card sx={{ mb: 3, maxWidth: 640 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <QrCodeScannerIcon color="primary" sx={{ fontSize: 40, mt: 1 }} />
              <TextField
                inputRef={inputRef}
                label={tr('Code-barres')}
                placeholder={tr('Scannez ou saisissez le code puis Entrée')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                fullWidth
                autoFocus
                disabled={loading}
                helperText={tr('Compatible lecteurs USB/Bluetooth (mode clavier).')}
                inputProps={{ style: { fontSize: 24, letterSpacing: 2 } }}
              />
            </Stack>
            <Button
              variant="outlined"
              startIcon={<PhotoCameraIcon />}
              onClick={() => setCameraOpen(true)}
              sx={{ alignSelf: 'flex-start' }}
            >
              {tr('Scanner avec la caméra')}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2, maxWidth: 640 }}>{error}</Alert>}

      {product && (
        <Card sx={{ maxWidth: 640 }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5" fontWeight={700}>{product.name}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`${tr('SKU')}: ${product.sku}`} variant="outlined" />
                <Chip label={`${tr('Code')}: ${primaryBarcode}`} variant="outlined" />
                {product.category_name && <Chip label={product.category_name} size="small" />}
              </Stack>
              <Stack direction="row" spacing={4}>
                <Box>
                  <Typography variant="caption" color="text.secondary">{tr('Prix vente')}</Typography>
                  <Typography variant="h6" color="primary.main">{formatCurrency(product.sale_price)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{tr('Prix achat')}</Typography>
                  <Typography variant="h6">{formatCurrency(product.purchase_price)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{tr('Stock total')}</Typography>
                  <Typography variant="h6">
                    <Chip
                      size="small"
                      label={`${stockQty} · ${stockLabel}`}
                      color={stockColor}
                      variant="outlined"
                    />
                  </Typography>
                </Box>
              </Stack>
              {product.description && (
                <Typography variant="body2" color="text.secondary">{product.description}</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <WebcamBarcodeScanner
        open={cameraOpen}
        onClose={() => { setCameraOpen(false); focusInput(); }}
        onScan={handleCameraScan}
      />
    </Box>
  );
}
