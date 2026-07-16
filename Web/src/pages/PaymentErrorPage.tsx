import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PageHeader from '../components/PageHeader';

export default function PaymentErrorPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto' }}>
      <PageHeader title="Paiement échoué" subtitle="La transaction n'a pas pu être finalisée" />
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <ErrorOutlineIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h6" gutterBottom>Paiement annulé ou refusé</Typography>
          <Alert severity="error" sx={{ mb: 3 }}>
            Aucun montant n'a été débité. Vous pouvez réessayer depuis la caisse ou la page abonnement.
          </Alert>
          <Button variant="contained" onClick={() => navigate('/pos')} sx={{ mr: 1 }}>
            Retour à la caisse
          </Button>
          <Button variant="outlined" onClick={() => navigate('/subscription')}>
            Abonnement
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
