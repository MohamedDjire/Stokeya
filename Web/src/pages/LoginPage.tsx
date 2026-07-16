import { useState, type FormEvent } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { Alert, Box, Button, Link, Stack, TextField } from '@mui/material';
import AuthShell from '../components/AuthShell';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearError, loginThunk } from '../store/authSlice';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((s) => s.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    dispatch(loginThunk({ email, password }));
  };

  return (
    <AuthShell title="Connexion" subtitle="Accédez à votre espace de gestion">
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          {error && <Alert severity="error" onClose={() => dispatch(clearError())}>{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            autoFocus
          />
          <TextField
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
          />
          <Box sx={{ textAlign: 'right' }}>
            <Link component={RouterLink} to="/forgot-password" variant="body2">
              Mot de passe oublié ?
            </Link>
          </Box>
          <Button type="submit" variant="contained" size="large" disabled={status === 'loading'}>
            {status === 'loading' ? 'Connexion...' : 'Se connecter'}
          </Button>
          <Box sx={{ textAlign: 'center' }}>
            <Link component={RouterLink} to="/register" variant="body2">
              Pas de compte ? Créer une entreprise
            </Link>
          </Box>
        </Stack>
      </Box>
    </AuthShell>
  );
}
