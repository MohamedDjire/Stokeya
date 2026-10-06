import { useState, type FormEvent } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Link,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AuthShell from '../components/AuthShell';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearError, registerThunk } from '../store/authSlice';
import { useLocale } from '../locale/useLocale';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#F8FAFC',
    fontFamily: '"Outfit", sans-serif',
  },
};

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const { status, error, busy } = useAppSelector((s) => s.auth);
  const { tr, version } = useLocale();
  void version;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    company_name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    shop_slug: '',
    wave_number: '',
    orange_money_number: '',
    payment_timing: 'on_delivery',
    password: '',
    password_confirm: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const steps = [tr('Entreprise'), tr('Compte personnel')];

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const clearErrors = () => {
    setLocalError(null);
    dispatch(clearError());
  };

  const validateStep1 = () => {
    if (!form.company_name.trim()) {
      setLocalError(tr('Indiquez le nom de l’entreprise.'));
      return false;
    }
    return true;
  };

  const passwordMismatch =
    form.password_confirm.length > 0 && form.password !== form.password_confirm;

  const validateStep2 = () => {
    if (!form.email.trim()) {
      setLocalError(tr('L’email est obligatoire.'));
      return false;
    }
    if (form.password.length < 8) {
      setLocalError(tr('Le mot de passe doit contenir au moins 8 caractères.'));
      return false;
    }
    if (form.password !== form.password_confirm) {
      setLocalError(tr('Les mots de passe ne correspondent pas.'));
      return false;
    }
    return true;
  };

  const goNext = () => {
    clearErrors();
    if (step === 0 && validateStep1()) setStep(1);
  };

  const goBack = () => {
    clearErrors();
    setStep(0);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (step === 0) {
      goNext();
      return;
    }
    if (!validateStep2()) return;
    dispatch(registerThunk(form));
  };

  return (
    <AuthShell
      title={tr('Créer un compte')}
      subtitle={tr('7 jours d’essai gratuit — 2 étapes simples.')}
      brandHeadline={tr('Lancez Stokeya aujourd’hui')}
      brandSubtext={tr('Créez votre entreprise, puis votre compte administrateur. Vous pourrez configurer la boutique ensuite.')}
    >
      <Box component="form" onSubmit={submit}>
        <Stepper
          activeStep={step}
          alternativeLabel
          sx={{
            mb: 2,
            '& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed': {
              color: '#0D9488',
            },
            '& .MuiStepLabel-label': {
              fontFamily: '"Outfit", sans-serif',
              fontSize: 12,
            },
            '& .MuiStepLabel-labelContainer': {
              maxWidth: '100%',
            },
          }}
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Stack spacing={2}>
          {(error || localError) && (
            <Alert severity="error" onClose={clearErrors}>
              {localError || error}
            </Alert>
          )}

          {step === 0 && (
            <>
              <Typography variant="subtitle2" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
                {tr('Informations de l’entreprise')}
              </Typography>
              <TextField
                label={tr('Nom de l’entreprise')}
                value={form.company_name}
                onChange={set('company_name')}
                fullWidth
                required
                autoFocus
                sx={fieldSx}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label={tr('Adresse')} value={form.address} onChange={set('address')} fullWidth sx={fieldSx} />
                <TextField label={tr('Ville')} value={form.city} onChange={set('city')} fullWidth sx={fieldSx} />
              </Stack>
              <TextField
                label={tr('Lien boutique (slug)')}
                value={form.shop_slug}
                onChange={set('shop_slug')}
                fullWidth
                helperText={tr('Optionnel — ex. ma-boutique → /shop/ma-boutique')}
                sx={fieldSx}
              />
              <Typography variant="subtitle2" sx={{ color: '#0B1F3A', fontWeight: 700, pt: 0.5 }}>
                {tr('Paiements boutique (optionnel)')}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label={tr('Numéro Wave')}
                  value={form.wave_number}
                  onChange={set('wave_number')}
                  fullWidth
                  placeholder="77 XXX XX XX"
                  sx={fieldSx}
                />
                <TextField
                  label={tr('Orange Money')}
                  value={form.orange_money_number}
                  onChange={set('orange_money_number')}
                  fullWidth
                  placeholder="77 XXX XX XX"
                  sx={fieldSx}
                />
              </Stack>
              <TextField
                select
                label={tr('Quand le client paie')}
                value={form.payment_timing}
                onChange={set('payment_timing')}
                fullWidth
                sx={fieldSx}
              >
                <MenuItem value="on_delivery">{tr('À la livraison')}</MenuItem>
                <MenuItem value="before_delivery">{tr('Avant la livraison')}</MenuItem>
                <MenuItem value="both">{tr('Les deux (choix du client)')}</MenuItem>
              </TextField>
              <Typography variant="caption" color="text.secondary">
                {tr('Modifiable plus tard dans Sites & boutique.')}
              </Typography>

              <Button
                type="button"
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={goNext}
                sx={{
                  mt: 1,
                  py: 1.25,
                  borderRadius: 999,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 55%, #0B1F3A 130%)',
                }}
              >
                {tr('Continuer')}
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <Typography variant="subtitle2" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
                {tr('Informations personnelles')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {tr('Compte administrateur pour')}{' '}
                <strong>{form.company_name || tr('votre entreprise')}</strong>
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label={tr('Prénom')}
                  value={form.first_name}
                  onChange={set('first_name')}
                  fullWidth
                  autoFocus
                  sx={fieldSx}
                />
                <TextField label={tr('Nom')} value={form.last_name} onChange={set('last_name')} fullWidth sx={fieldSx} />
              </Stack>
              <TextField
                label={tr('Email')}
                type="email"
                value={form.email}
                onChange={set('email')}
                fullWidth
                required
                sx={fieldSx}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label={tr('Téléphone')} value={form.phone} onChange={set('phone')} fullWidth sx={fieldSx} />
                <TextField
                  label={tr('WhatsApp')}
                  value={form.whatsapp}
                  onChange={set('whatsapp')}
                  fullWidth
                  placeholder={tr('Si différent')}
                  sx={fieldSx}
                />
              </Stack>
              <TextField
                label={tr('Mot de passe')}
                type="password"
                value={form.password}
                onChange={set('password')}
                fullWidth
                required
                helperText={tr('8 caractères minimum')}
                sx={fieldSx}
              />
              <TextField
                label={tr('Confirmer le mot de passe')}
                type="password"
                value={form.password_confirm}
                onChange={set('password_confirm')}
                fullWidth
                required
                error={passwordMismatch}
                helperText={
                  passwordMismatch
                    ? tr('Les mots de passe ne correspondent pas.')
                    : ' '
                }
                sx={fieldSx}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
                <Button
                  type="button"
                  variant="outlined"
                  size="large"
                  startIcon={<ArrowBackIcon />}
                  onClick={goBack}
                  sx={{ borderRadius: 999, flex: 1, borderColor: '#CBD5E1', color: '#0B1F3A' }}
                >
                  {tr('Retour')}
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={busy || passwordMismatch}
                  sx={{
                    py: 1.25,
                    borderRadius: 999,
                    fontWeight: 700,
                    flex: 1.4,
                    background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 55%, #0B1F3A 130%)',
                  }}
                >
                  {busy ? tr('Création…') : tr('Créer mon compte')}
                </Button>
              </Stack>
            </>
          )}

          <Box sx={{ textAlign: 'center', pt: 0.5 }}>
            <Link
              component={RouterLink}
              to="/login"
              sx={{ fontSize: 14, fontWeight: 600, color: '#0D9488', textDecoration: 'none' }}
            >
              {tr('Déjà un compte ? Se connecter')}
            </Link>
          </Box>
        </Stack>
      </Box>
    </AuthShell>
  );
}
