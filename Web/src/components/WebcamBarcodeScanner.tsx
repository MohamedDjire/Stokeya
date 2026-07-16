import { useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { Html5Qrcode } from 'html5-qrcode';

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
};

const SCANNER_ID = 'inventra-webcam-scanner';

export default function WebcamBarcodeScanner({ open, onClose, onScan }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    let cancelled = false;

    const onDecoded = (decoded: string) => {
      if (handledRef.current || cancelled) return;
      handledRef.current = true;
      onScanRef.current(decoded.trim());
    };

    const start = async () => {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      const config = { fps: 10, qrbox: { width: 280, height: 160 } };
      try {
        await scanner.start({ facingMode: 'environment' }, config, onDecoded, () => undefined);
      } catch {
        try {
          await scanner.start({ facingMode: 'user' }, config, onDecoded, () => undefined);
        } catch {
          /* permissions / no camera */
        }
      }
    };

    const timer = window.setTimeout(start, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner?.isScanning) {
        scanner.stop().then(() => scanner.clear()).catch(() => undefined);
      } else if (scanner) {
        try { scanner.clear(); } catch { /* noop */ }
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Scanner avec la caméra</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Présentez le code-barres devant la webcam. Autorisez l’accès caméra si demandé.
        </Typography>
        <Box
          id={SCANNER_ID}
          sx={{
            width: '100%',
            minHeight: 280,
            bgcolor: '#111',
            borderRadius: 1,
            overflow: 'hidden',
            '& video': { width: '100% !important' },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
}
