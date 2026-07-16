import { useState, type FormEvent } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { Alert, Box, Button, Link, Stack, TextField } from '@mui/material';
import AuthShell from '../components/AuthShell';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearError, registerThunk } from '../store/authSlice';

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((s) => s.auth);
  const [form, setForm] = useState({
    company_name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    password_confirm: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (form.password !== form.password_confirm) {
      setLocalError('Les mots de passe ne correspondent pas.');
      return;
    }
    dispatch(registerThunk(form));
  };

  return (
    <AuthShell title="Créer une entreprise" subtitle="14 jours d'essai gratuit, sans carte bancaire">
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          {(error || localError) && (
            <Alert severity="error" onClose={() => { dispatch(clearError()); setLocalError(null); }}>
              {localError || error}
            </Alert>
          )}
          <TextField label="Nom de l'entreprise" value={form.company_name} onChange={set('company_name')} fullWidth required />
          <Stack direction="row" spacing={2}>
            <TextField label="Prénom" value={form.first_name} onChange={set('first_name')} fullWidth />
            <TextField label="Nom" value={form.last_name} onChange={set('last_name')} fullWidth />
          </Stack>
          <TextField label="Email" type="email" value={form.email} onChange={set('email')} fullWidth required />
          <TextField label="Téléphone" value={form.phone} onChange={set('phone')} fullWidth />
          <TextField label="Mot de passe" type="password" value={form.password} onChange={set('password')} fullWidth required />
          <TextField label="Confirmer le mot de passe" type="password" value={form.password_confirm} onChange={set('password_confirm')} fullWidth required />
          <Button type="submit" variant="contained" size="large" disabled={status === 'loading'}>
            {status === 'loading' ? 'Création...' : 'Créer mon compte'}
          </Button>
          <Box sx={{ textAlign: 'center' }}>
            <Link component={RouterLink} to="/login" variant="body2">
              Déjà un compte ? Se connecter
            </Link>
          </Box>
        </Stack>
      </Box>
    </AuthShell>
  );
}
