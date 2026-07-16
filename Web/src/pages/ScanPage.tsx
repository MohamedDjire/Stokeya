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

export default function ScanPage() {
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
      setError(getApiErrorMessage(err, 'Produit introuvable pour ce code-barres.'));
      setCode('');
      focusInput();
    } finally {
      setLoading(false);
    }
  }, [focusInput]);

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
  const minStock = Number(product?.min_stock || 0);

  return (
    <Box>
      <PageHeader
        title="Scan direct"
        subtitle="Scanner USB/Bluetooth, caméra ou saisie manuelle"
      />

      <Card sx={{ mb: 3, maxWidth: 640 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <QrCodeScannerIcon color="primary" sx={{ fontSize: 40, mt: 1 }} />
              <TextField
                inputRef={inputRef}
                label="Code-barres"
                placeholder="Scannez ou saisissez le code puis Entrée"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                fullWidth
                autoFocus
                disabled={loading}
                helperText="Compatible lecteurs USB/Bluetooth (mode clavier)."
                inputProps={{ style: { fontSize: 24, letterSpacing: 2 } }}
              />
            </Stack>
            <Button
              variant="outlined"
              startIcon={<PhotoCameraIcon />}
              onClick={() => setCameraOpen(true)}
              sx={{ alignSelf: 'flex-start' }}
            >
              Scanner avec la caméra
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
                <Chip label={`SKU: ${product.sku}`} variant="outlined" />
                <Chip label={`Code: ${primaryBarcode}`} variant="outlined" />
                {product.category_name && <Chip label={product.category_name} size="small" />}
              </Stack>
              <Stack direction="row" spacing={4}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Prix vente</Typography>
                  <Typography variant="h6" color="primary.main">{formatCurrency(product.sale_price)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Prix achat</Typography>
                  <Typography variant="h6">{formatCurrency(product.purchase_price)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Stock total</Typography>
                  <Typography variant="h6">
                    <Chip
                      size="small"
                      label={stockQty}
                      color={stockQty <= 0 ? 'error' : stockQty <= minStock ? 'warning' : 'success'}
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
