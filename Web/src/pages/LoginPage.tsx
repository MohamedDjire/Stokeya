import { useEffect, useState, type FormEvent } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import AuthShell from '../components/AuthShell';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearError, loginThunk } from '../store/authSlice';
import { useLocale } from '../locale/useLocale';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const { status, error, busy } = useAppSelector((s) => s.auth);
  const { tr, version } = useLocale();
  void version;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem('stokeya_remember_email') || localStorage.getItem('inventra_remember_email');
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, []);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      if (remember) localStorage.setItem('stokeya_remember_email', email);
      else localStorage.removeItem('stokeya_remember_email');
    } catch {
      /* ignore */
    }
    dispatch(loginThunk({ email, password }));
  };

  return (
    <AuthShell
      title={tr('Connexion')}
      subtitle={tr('Accédez à votre espace Stokeya avec votre compte existant.')}
      brandHeadline={tr('Bon retour parmi nous !')}
      brandSubtext={tr('Connectez-vous pour gérer stock, caisses et points de vente en temps réel — où que vous soyez.')}
    >
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2.25}>
          {error && (
            <Alert severity="error" onClose={() => dispatch(clearError())}>
              {error}
            </Alert>
          )}
          <TextField
            placeholder={tr('Email professionnel')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon sx={{ color: '#94A3B8' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 999,
                bgcolor: '#F8FAFC',
                fontFamily: '"Outfit", sans-serif',
              },
            }}
          />
          <TextField
            placeholder={tr('Mot de passe')}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon sx={{ color: '#94A3B8' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label={showPassword ? tr('Masquer') : tr('Afficher')}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 999,
                bgcolor: '#F8FAFC',
                fontFamily: '"Outfit", sans-serif',
              },
            }}
          />
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <FormControlLabel
              control={(
                <Checkbox
                  size="small"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  sx={{ color: '#0D9488', '&.Mui-checked': { color: '#0D9488' } }}
                />
              )}
              label={<Box component="span" sx={{ fontSize: 14, color: '#64748B' }}>{tr('Se souvenir de moi')}</Box>}
            />
            <Link
              component={RouterLink}
              to="/forgot-password"
              variant="body2"
              sx={{
                color: '#0D9488',
                fontWeight: 600,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {tr('Mot de passe oublié ?')}
            </Link>
          </Stack>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={busy}
            sx={{
              py: 1.35,
              borderRadius: 999,
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 700,
              fontSize: '1rem',
              background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 55%, #0B1F3A 130%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 60%, #0B1F3A 140%)',
              },
            }}
          >
            {busy ? tr('Connexion…') : tr('Se connecter')}
          </Button>
          <Box sx={{ textAlign: 'center', pt: 0.5 }}>
            <Box component="span" sx={{ fontSize: 14, color: '#64748B' }}>
              {tr('Nouveau sur Stokeya ?')}{' '}
            </Box>
            <Link
              component={RouterLink}
              to="/register"
              sx={{
                fontSize: 14,
                fontWeight: 700,
                color: '#0B1F3A',
                textDecoration: 'none',
                '&:hover': { color: '#0D9488' },
              }}
            >
              {tr('Créer un compte')}
            </Link>
          </Box>
        </Stack>
      </Box>
    </AuthShell>
  );
}
