import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Link, Stack, TextField } from '@mui/material';
import AuthShell from '../components/AuthShell';
import { confirmPasswordReset, requestPasswordReset } from '../api/auth';
import { getApiErrorMessage } from '../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState<{ uid: string; token: string } | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  const requestReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await requestPasswordReset(email);
      setMessage(res.message || 'Si un compte existe, un lien de réinitialisation a été envoyé.');
      if (res.reset) setResetToken(res.reset);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetToken) return;
    setError(null);
    if (newPassword !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset({
        uid: resetToken.uid,
        token: resetToken.token,
        new_password: newPassword,
        new_password_confirm: confirm,
      });
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Mot de passe oublié" subtitle="Réinitialisez votre accès">
      {done ? (
        <Stack spacing={2}>
          <Alert severity="success">Mot de passe réinitialisé. Vous pouvez vous connecter.</Alert>
          <Button component={RouterLink} to="/login" variant="contained">
            Retour à la connexion
          </Button>
        </Stack>
      ) : resetToken ? (
        <Box component="form" onSubmit={submitNewPassword}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Nouveau mot de passe" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} fullWidth required />
            <TextField label="Confirmer" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} fullWidth required />
            <Button type="submit" variant="contained" disabled={loading}>
              Réinitialiser
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box component="form" onSubmit={requestReset}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {message && <Alert severity="info">{message}</Alert>}
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required autoFocus />
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/login" variant="body2">
                Retour à la connexion
              </Link>
            </Box>
          </Stack>
        </Box>
      )}
    </AuthShell>
  );
}
