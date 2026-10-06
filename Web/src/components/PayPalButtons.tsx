import { useEffect, useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { capturePayPalOrder } from '../api/payments';
import { getApiErrorMessage } from '../api/client';

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void> };
    };
  }
}

export default function PayPalButtons({
  clientId,
  currency,
  orderId,
  onPaid,
  onError,
}: {
  clientId: string;
  currency: string;
  orderId: string;
  onPaid: () => void;
  onError: (message: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const renderedFor = useRef<string>('');

  useEffect(() => {
    if (!clientId || !orderId || !hostRef.current) return;
    if (renderedFor.current === `${clientId}:${orderId}`) return;

    let cancelled = false;
    const scriptId = 'stokeya-paypal-sdk';

    const renderButtons = () => {
      if (cancelled || !hostRef.current || !window.paypal) return;
      hostRef.current.innerHTML = '';
      renderedFor.current = `${clientId}:${orderId}`;
      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
        createOrder: () => orderId,
        onApprove: async (data: { orderID?: string }) => {
          try {
            await capturePayPalOrder(data.orderID || orderId);
            if (!cancelled) onPaid();
          } catch (err) {
            onError(getApiErrorMessage(err, 'La confirmation PayPal a échoué.'));
          }
        },
        onCancel: () => {
          onError('Paiement PayPal annulé.');
        },
        onError: () => {
          onError('Impossible de charger le paiement PayPal.');
        },
      }).render(hostRef.current);
    };

    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (window.paypal) {
      renderButtons();
      return () => { cancelled = true; };
    }

    if (existing) {
      existing.addEventListener('load', renderButtons);
      return () => {
        cancelled = true;
        existing.removeEventListener('load', renderButtons);
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency || 'EUR')}&intent=capture&components=buttons&enable-funding=card,paypal`;
    script.async = true;
    script.onload = renderButtons;
    script.onerror = () => onError('Impossible de charger PayPal.');
    document.body.appendChild(script);

    return () => { cancelled = true; };
  }, [clientId, currency, orderId, onPaid, onError]);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Payez avec PayPal ou une carte Visa / Mastercard.
      </Typography>
      <Box ref={hostRef} sx={{ minHeight: 48, '& iframe': { minHeight: 45 } }} />
      {!orderId && <CircularProgress size={20} />}
    </Box>
  );
}
