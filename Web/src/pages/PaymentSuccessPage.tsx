import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PageHeader from '../components/PageHeader';
import { capturePayPalOrder, fetchSasPayStatus } from '../api/payments';
import { getApiErrorMessage } from '../api/client';
import { useLocale } from '../locale/useLocale';

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tr, version } = useLocale();
  void version;

  const paypalToken = searchParams.get('token');
  const sasRef = searchParams.get('ref') || '';
  const isPayPalReturn = Boolean(paypalToken) && searchParams.get('mock') !== '1';
  const isSasPayReturn = sasRef.startsWith('SUB-') || sasRef.startsWith('SALE-');

  const [loading, setLoading] = useState(isPayPalReturn || isSasPayReturn);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(!isPayPalReturn && !isSasPayReturn);
  const [pendingNote, setPendingNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isPayPalReturn || !paypalToken) return;
    let cancelled = false;
    (async () => {
      try {
        await capturePayPalOrder(paypalToken);
        if (!cancelled) setConfirmed(true);
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, tr('La confirmation PayPal a échoué.')));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isPayPalReturn, paypalToken, tr]);

  useEffect(() => {
    if (!isSasPayReturn) return;
    let cancelled = false;
    let attempts = 0;
    let timer = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const status = await fetchSasPayStatus({ client_reference: sasRef });
        if (cancelled) return;
        if (status.status === 'completed' || status.payment_status === 'paid') {
          setConfirmed(true);
          setLoading(false);
          return;
        }
        if (status.status === 'failed' || status.status === 'expired') {
          setError(tr('Le paiement n’a pas été confirmé. L’abonnement n’a pas été activé.'));
          setLoading(false);
          return;
        }
        if (attempts >= 8) {
          setPendingNote(tr('SasPay n’a pas encore confirmé le paiement. L’abonnement s’activera automatiquement dès que le serveur reçoit la preuve.'));
          setLoading(false);
          return;
        }
        timer = window.setTimeout(() => { void tick(); }, 3000);
      } catch (err) {
        if (cancelled) return;
        setError(getApiErrorMessage(err, tr('Impossible de vérifier le paiement.')));
        setLoading(false);
      }
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isSasPayReturn, sasRef, tr]);

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto' }}>
      <PageHeader
        title={error ? tr('Paiement') : tr('Paiement réussi')}
        subtitle={loading ? tr('Vérification en cours') : tr('Votre transaction a été validée')}
      />
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          {loading ? (
            <>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography color="text.secondary">
                {isSasPayReturn
                  ? tr('Confirmation du paiement auprès de SasPay…')
                  : tr('Confirmation PayPal en cours…')}
              </Typography>
            </>
          ) : (
            <>
              <CheckCircleIcon color={error ? 'disabled' : 'success'} sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h6" gutterBottom>{tr('Merci !')}</Typography>
              {error ? (
                <Alert severity="warning" sx={{ mb: 3, textAlign: 'left' }}>{error}</Alert>
              ) : pendingNote ? (
                <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>{pendingNote}</Alert>
              ) : (
                <Alert severity="success" sx={{ mb: 3, textAlign: 'left' }}>
                  {isSasPayReturn
                    ? tr('Paiement confirmé par SasPay. STOKEYA a enregistré la transaction.')
                    : isPayPalReturn
                      ? tr('Votre paiement PayPal a été confirmé. Votre compte sera mis à jour automatiquement.')
                      : tr('Votre paiement a été confirmé. Votre compte sera mis à jour automatiquement.')}
                </Alert>
              )}
              <Button variant="contained" onClick={() => navigate('/')} sx={{ mr: 1 }}>
                {tr('Tableau de bord')}
              </Button>
              <Button variant="outlined" onClick={() => navigate('/subscription')}>
                {tr('Mon abonnement')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
