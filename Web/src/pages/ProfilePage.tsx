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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import EditIcon from '@mui/icons-material/EditOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PageHeader from '../components/PageHeader';
import { updateProfile, uploadAvatar } from '../api/auth';
import { fetchCompany, type Company } from '../api/company';
import { getApiErrorMessage } from '../api/client';
import { mediaUrl } from '../utils/media';
import { hasFlag } from '../utils/permissions';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logoutThunk, setUser } from '../store/authSlice';
import { useLocale } from '../locale/useLocale';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Gérant',
  warehouse_manager: 'Responsable entrepôt',
  stock_keeper: 'Magasinier',
  pos_manager: 'Responsable point de vente',
  cashier: 'Caissier',
  accountant: 'Comptable',
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body1">{value?.trim() || '—'}</Typography>
    </Box>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { tr, version } = useLocale();
  void version;
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = !!user?.is_company_admin;
  const canEditPrefs = isAdmin || hasFlag(user, 'can_edit_settings');

  const [company, setCompany] = useState<Company | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [profile, setProfile] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => undefined);
  }, []);

  const openEdit = () => {
    setProfile({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
    });
    setError(null);
    setEditOpen(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile(profile);
      dispatch(setUser(updated));
      setEditOpen(false);
      setMessage(tr('Profil personnel mis à jour.'));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onAvatar = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const updated = await uploadAvatar(file);
      dispatch(setUser(updated));
      setMessage(tr('Photo de profil mise à jour.'));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const logout = async () => {
    if (!confirm(tr('Voulez-vous vraiment vous déconnecter ?'))) return;
    await dispatch(logoutThunk());
    navigate('/login');
  };

  const roleLabel = isAdmin
    ? tr('Administrateur entreprise')
    : (user?.role_code ? tr(ROLE_LABELS[user.role_code] || user.role_code) : tr('Utilisateur'));

  const companyLogo = mediaUrl(company?.logo || user?.company_logo);
  const userAvatar = mediaUrl(user?.avatar);
  const companyInitials = (company?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const userInitials = (user?.full_name || user?.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Box>
      <PageHeader
        title={tr('Mon profil')}
        subtitle={tr('Informations de l’entreprise et de votre compte')}
        action={(
          <Button variant="contained" startIcon={<EditIcon />} onClick={openEdit}>
            {tr('Modifier le profil')}
          </Button>
        )}
      />

      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>
      )}
      {error && !editOpen && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
                <Avatar
                  src={companyLogo}
                  variant="rounded"
                  sx={{
                    width: 96,
                    height: 96,
                    bgcolor: 'primary.main',
                    fontSize: 28,
                    fontWeight: 700,
                  }}
                >
                  {companyInitials}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="overline" color="text.secondary">{tr('Entreprise')}</Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {company?.name || tr('Chargement…')}
                  </Typography>
                  {company?.slogan && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {company.slogan}
                    </Typography>
                  )}
                </Box>
              </Stack>

              <Divider sx={{ mb: 1 }} />

              <InfoRow label={tr('Email')} value={company?.email} />
              <InfoRow label={tr('Téléphone')} value={company?.phone} />
              <InfoRow label={tr('Adresse')} value={company?.address} />
              <InfoRow label={tr('Site web')} value={company?.website} />
              <InfoRow label={tr('Identifiant fiscal')} value={company?.tax_id} />
              <InfoRow label={tr('Pays')} value={company?.country} />
              <InfoRow label={tr('Devise')} value={company?.currency} />
              <InfoRow label={tr('Taux de TVA')} value={company ? `${company.tax_rate} %` : null} />

              {canEditPrefs && (
                <Box sx={{ mt: 2.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {tr('Pour modifier le logo de l’entreprise ou les paramètres, ouvrez Préférences.')}
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<SettingsIcon />}
                    onClick={() => navigate('/preferences')}
                  >
                    {tr('Ouvrir les préférences')}
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <Avatar
                  src={userAvatar || companyLogo}
                  sx={{ width: 88, height: 88, bgcolor: 'primary.main', fontSize: 28 }}
                >
                  {userInitials}
                </Avatar>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  component="label"
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? tr('Envoi…') : tr('Changer ma photo')}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(e) => void onAvatar(e.target.files?.[0] || null)}
                  />
                </Button>
              </Stack>

              <Typography variant="overline" color="text.secondary">{tr('Compte connecté')}</Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>
                {user?.full_name || tr('Utilisateur')}
              </Typography>
              <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
              <Chip size="small" label={roleLabel} sx={{ mt: 1.5 }} color={isAdmin ? 'primary' : 'default'} />

              <Divider sx={{ my: 2 }} />

              <InfoRow label={tr('Téléphone')} value={user?.phone} />
              <InfoRow label={tr('Point de vente')} value={user?.assigned_branch_name} />
              <InfoRow label={tr('Caisse')} value={user?.assigned_cash_register_name} />

              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<LogoutIcon />}
                onClick={logout}
                sx={{ mt: 2.5 }}
              >
                {tr('Se déconnecter')}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{tr('Modifier mon profil')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack alignItems="center" spacing={1}>
              <Avatar src={userAvatar || companyLogo} sx={{ width: 72, height: 72 }}>
                {userInitials}
              </Avatar>
              <Button size="small" component="label" startIcon={<PhotoCameraIcon />} disabled={uploadingAvatar}>
                {tr('Photo de profil')}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onAvatar(e.target.files?.[0] || null)}
                />
              </Button>
            </Stack>
            <TextField label={tr('Email')} value={user?.email || ''} fullWidth disabled />
            <TextField
              label={tr('Prénom')}
              value={profile.first_name}
              onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
              fullWidth
            />
            <TextField
              label={tr('Nom')}
              value={profile.last_name}
              onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
              fullWidth
            />
            <TextField
              label={tr('Téléphone')}
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)}>{tr('Annuler')}</Button>
          <Button variant="contained" onClick={saveProfile} disabled={saving}>
            {tr('Enregistrer')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
