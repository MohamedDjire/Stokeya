import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PageHeader from '../components/PageHeader';

export default function PaymentSuccessPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto' }}>
      <PageHeader title="Paiement réussi" subtitle="Votre transaction a été validée" />
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h6" gutterBottom>Merci !</Typography>
          <Alert severity="success" sx={{ mb: 3 }}>
            Votre paiement Mobile Money a été confirmé. Votre compte sera mis à jour automatiquement.
          </Alert>
          <Button variant="contained" onClick={() => navigate('/')} sx={{ mr: 1 }}>
            Tableau de bord
          </Button>
          <Button variant="outlined" onClick={() => navigate('/subscription')}>
            Mon abonnement
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
