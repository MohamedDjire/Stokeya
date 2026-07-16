import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import LogoutIcon from '@mui/icons-material/Logout';
import PageHeader from '../components/PageHeader';
import { updateProfile } from '../api/auth';
import { fetchCompany, updateCompany, type Company } from '../api/company';
import { getApiErrorMessage } from '../api/client';
import { PERMISSION_LABELS } from '../utils/permissions';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logoutThunk, setUser } from '../store/authSlice';

export default function ProfilePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = !!user?.is_company_admin;

  const [profile, setProfile] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
  });
  const [company, setCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({ name: '', phone: '', address: '', currency: '', tax_rate: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => {
    fetchCompany().then((c) => {
      setCompany(c);
      setCompanyForm({
        name: c.name,
        phone: c.phone || '',
        address: c.address || '',
        currency: c.currency || 'XOF',
        tax_rate: String(c.tax_rate ?? ''),
      });
    }).catch(() => undefined);
  }, []);

  const initials = (user?.full_name || user?.email || '?')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const saveProfile = async () => {
    setSavingProfile(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateProfile(profile);
      dispatch(setUser(updated));
      setMessage('Profil mis à jour.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const saveCompany = async () => {
    setSavingCompany(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateCompany({
        name: companyForm.name,
        phone: companyForm.phone,
        address: companyForm.address,
        currency: companyForm.currency || 'XOF',
        tax_rate: companyForm.tax_rate || '0',
      });
      setCompany(updated);
      setMessage('Informations entreprise enregistrées.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSavingCompany(false);
    }
  };

  const logout = async () => {
    if (!confirm('Voulez-vous vraiment vous déconnecter ?')) return;
    await dispatch(logoutThunk());
    navigate('/login');
  };

  const permissions = user?.permissions || [];

  return (
    <Box>
      <PageHeader title="Mon compte" subtitle="Profil, entreprise, accès et paramètres" />

      <Alert severity="info" sx={{ mb: 2 }}>
        Votre compte Inventra est unique : les mêmes identifiants fonctionnent sur la version web et l'application mobile.
        Les paiements Mobile Money (Wave, Orange Money, MTN Money) passent par la page de paiement sécurisée du site.
      </Alert>

      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ textAlign: 'center' }}>
            <CardContent>
              <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', mx: 'auto', mb: 2, fontSize: 28 }}>
                {initials}
              </Avatar>
              <Typography variant="h6">{user?.full_name || 'Utilisateur'}</Typography>
              <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
              <Chip sx={{ mt: 1 }} label={isAdmin ? 'Administrateur' : 'Utilisateur'} color={isAdmin ? 'primary' : 'default'} />
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Accès et autorisations</Typography>
              {permissions.includes('ALL') ? (
                <Typography variant="body2">Accès complet à tous les modules.</Typography>
              ) : permissions.length ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {permissions.map((code) => (
                    <Chip key={code} size="small" label={PERMISSION_LABELS[code] || code} variant="outlined" />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">Aucune autorisation spécifique.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Profil</Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="Prénom" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} fullWidth />
                  <TextField label="Nom" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} fullWidth />
                </Stack>
                <TextField label="Téléphone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} fullWidth />
                <Button variant="contained" onClick={saveProfile} disabled={savingProfile} sx={{ alignSelf: 'flex-start' }}>
                  Enregistrer
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {company && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Entreprise</Typography>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <TextField label="Nom de l'entreprise" value={companyForm.name} disabled={!isAdmin}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} fullWidth />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField label="Téléphone" value={companyForm.phone} disabled={!isAdmin}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} fullWidth />
                    <TextField label="Devise" value={companyForm.currency} disabled={!isAdmin}
                      onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })} fullWidth />
                    <TextField label="TVA (%)" value={companyForm.tax_rate} disabled={!isAdmin}
                      onChange={(e) => setCompanyForm({ ...companyForm, tax_rate: e.target.value })} fullWidth />
                  </Stack>
                  <TextField label="Adresse" value={companyForm.address} disabled={!isAdmin}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} fullWidth multiline rows={2} />
                  {isAdmin ? (
                    <Button variant="contained" onClick={saveCompany} disabled={savingCompany} sx={{ alignSelf: 'flex-start' }}>
                      Enregistrer
                    </Button>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Seul l'administrateur peut modifier ces informations.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          <Box sx={{ mt: 3 }}>
            <Button variant="outlined" color="error" startIcon={<LogoutIcon />} onClick={logout}>
              Se déconnecter
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
