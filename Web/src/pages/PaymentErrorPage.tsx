import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PageHeader from '../components/PageHeader';
import { useLocale } from '../locale/useLocale';

export default function PaymentErrorPage() {
  const navigate = useNavigate();
  const { tr, version } = useLocale();
  void version;

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto' }}>
      <PageHeader title={tr('Paiement échoué')} subtitle={tr("La transaction n'a pas pu être finalisée")} />
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <ErrorOutlineIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h6" gutterBottom>{tr('Paiement annulé ou refusé')}</Typography>
          <Alert severity="error" sx={{ mb: 3 }}>
            {tr("Aucun montant n'a été débité. Vous pouvez réessayer depuis la caisse ou la page abonnement.")}
          </Alert>
          <Button variant="contained" onClick={() => navigate('/pos')} sx={{ mr: 1 }}>
            {tr('Retour à la caisse')}
          </Button>
          <Button variant="outlined" onClick={() => navigate('/subscription')}>
            {tr('Abonnement')}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
