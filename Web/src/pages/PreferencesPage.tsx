import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import SaveIcon from '@mui/icons-material/Save';
import PageHeader from '../components/PageHeader';
import {
  fetchPreferences,
  updatePreferences,
  uploadCompanyLogo,
  type CompanyPreferences,
  type PreferencesAbout,
  type PreferencesPayload,
} from '../api/preferences';
import type { Company } from '../api/company';
import { getApiErrorMessage } from '../api/client';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setUser } from '../store/authSlice';
import { applyPreferencesPayload, syncRuntimeFromPayload } from '../store/prefsSlice';
import { fetchMe } from '../api/auth';
import { hasFlag } from '../utils/permissions';
import { formatCurrency, formatDate, localizeDigits } from '../utils/format';
import { mediaUrl } from '../utils/media';
import { useLocale } from '../locale/useLocale';
import {
  CURRENCY_OPTIONS,
  DEFAULT_FX_RATES,
  FX_BASE_DEFAULT,
  languageToLocale,
  type AppLanguage,
} from '../locale/currencies';
import { applyLocaleRuntime, getLocaleRuntime } from '../locale/runtime';

type SectionId =
  | 'locale'
  | 'general'
  | 'commercial'
  | 'display'
  | 'notifications'
  | 'documents'
  | 'security'
  | 'backup'
  | 'automation'
  | 'advanced'
  | 'about';

const SECTION_IDS: SectionId[] = [
  'locale', 'general', 'commercial', 'display', 'notifications', 'documents',
  'security', 'backup', 'automation', 'advanced', 'about',
];

const NOTIF_EVENTS: Array<{ key: string; label: string }> = [
  { key: 'low_stock', label: 'Stock faible' },
  { key: 'out_of_stock', label: 'Rupture de stock' },
  { key: 'new_sale', label: 'Nouvelle vente' },
  { key: 'new_expense', label: 'Nouvelle dépense' },
  { key: 'new_customer', label: 'Nouveau client' },
  { key: 'new_supplier', label: 'Nouveau fournisseur' },
  { key: 'new_transfer', label: 'Nouveau transfert' },
  { key: 'new_online_order', label: 'Nouvelle commande en ligne' },
  { key: 'payment_received', label: 'Paiement reçu' },
  { key: 'subscription_expiry', label: 'Expiration abonnement' },
];

const NOTIF_CHANNELS: Array<{ key: string; label: string }> = [
  { key: 'in_app', label: 'Notification dans l’application' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'sms', label: 'SMS' },
];

function logoUrl(logo: string | null | undefined) {
  return mediaUrl(logo);
}

function prefsSnapshot(
  company: PreferencesPayload['company'],
  prefs: CompanyPreferences,
) {
  return JSON.stringify({
    company: {
      name: company.name,
      slogan: company.slogan || '',
      email: company.email,
      phone: company.phone,
      address: company.address,
      website: company.website || '',
      tax_id: company.tax_id || '',
      country: company.country,
      currency: company.currency,
      tax_rate: company.tax_rate,
    },
    preferences: prefs,
  });
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { tr: translate } = useLocale();
  return (
    <Box
      sx={{
        p: 2.5,
        mb: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="h6" sx={{ mb: 0.5 }}>{translate(title)}</Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{translate(hint)}</Typography>
      )}
      {children}
    </Box>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { tr: translate } = useLocale();
  return (
    <FormControlLabel
      control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />}
      label={<Typography variant="body2">{translate(label)}</Typography>}
      sx={{ display: 'flex', m: 0, py: 0.25 }}
    />
  );
}

export default function PreferencesPage() {
  const dispatch = useAppDispatch();
  const { t, tr, version } = useLocale();
  void version;
  const user = useAppSelector((s) => s.auth.user);
  const canEdit = Boolean(user?.is_company_admin || hasFlag(user, 'can_edit_settings'));
  const isAdmin = Boolean(user?.is_company_admin);

  const [section, setSection] = useState<SectionId>('locale');
  const [company, setCompany] = useState<PreferencesPayload['company'] | null>(null);
  const [prefs, setPrefs] = useState<CompanyPreferences | null>(null);
  const [about, setAbout] = useState<PreferencesAbout | null>(null);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commitLoaded = useCallback((data: PreferencesPayload, opts?: { forceLocale?: boolean }) => {
    syncRuntimeFromPayload(data, { force: Boolean(opts?.forceLocale) });
    const liveLang = getLocaleRuntime().language;
    let nextPrefs = data.preferences;
    // Garder la langue choisie à l’écran si un reload API arrive juste après
    if (!opts?.forceLocale && liveLang && liveLang !== nextPrefs.regional.language) {
      nextPrefs = {
        ...nextPrefs,
        regional: {
          ...nextPrefs.regional,
          language: liveLang,
          number_format: languageToLocale(liveLang),
        },
      };
    }
    setCompany(data.company);
    setPrefs(nextPrefs);
    setAbout(data.about);
    setBaseline(prefsSnapshot(data.company, opts?.forceLocale ? data.preferences : nextPrefs));
    dispatch(applyPreferencesPayload(data));
  }, [dispatch]);

  const load = useCallback(() => {
    setLoading(true);
    fetchPreferences()
      .then((data) => commitLoaded(data))
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [commitLoaded]);

  useEffect(() => { load(); }, [load]);

  const isDirty = useMemo(() => {
    if (!company || !prefs || !baseline) return false;
    return prefsSnapshot(company, prefs) !== baseline;
  }, [company, prefs, baseline]);

  const visibleSections = useMemo(
    () => SECTION_IDS.filter((id) => id !== 'advanced' || isAdmin),
    [isAdmin],
  );

  const setCompanyField = <K extends keyof Company>(key: K, value: Company[K]) => {
    if (!company) return;
    setCompany({ ...company, [key]: value });
  };

  const setPref = <S extends keyof CompanyPreferences>(
    sectionKey: S,
    key: keyof CompanyPreferences[S],
    value: unknown,
  ) => {
    if (!prefs) return;
    setPrefs({
      ...prefs,
      [sectionKey]: {
        ...prefs[sectionKey],
        [key]: value,
      },
    });
  };

  const setRegional = (patch: Partial<CompanyPreferences['regional']>) => {
    if (!prefs) return;
    setPrefs({
      ...prefs,
      regional: { ...prefs.regional, ...patch },
    });
  };

  /** Applique langue / devise / taux tout de suite (sans attendre Enregistrer ni F5). */
  const pushLocaleLive = (next: {
    language?: string;
    currency?: string;
    fx_base?: string;
    fx_rates?: Record<string, number>;
    date_format?: string;
  }) => {
    if (!prefs || !company) return;
    const language = (next.language ?? prefs.regional.language) as AppLanguage;
    applyLocaleRuntime({
      language,
      locale: languageToLocale(language),
      currency: next.currency ?? company.currency,
      fxBase: next.fx_base ?? prefs.regional.fx_base ?? FX_BASE_DEFAULT,
      fxRates: { ...DEFAULT_FX_RATES, ...(next.fx_rates ?? prefs.regional.fx_rates ?? {}) },
      dateFormat: next.date_format ?? prefs.regional.date_format,
    });
  };

  const setFxRate = (code: string, value: number) => {
    if (!prefs) return;
    const current = { ...DEFAULT_FX_RATES, ...(prefs.regional.fx_rates || {}) };
    const fx_rates = { ...current, [code]: value };
    const fx_base = prefs.regional.fx_base || FX_BASE_DEFAULT;
    setRegional({ fx_base, fx_rates });
    pushLocaleLive({ fx_base, fx_rates });
  };

  const setNested = (
    _sectionKey: 'notifications',
    group: 'channels' | 'events',
    key: string,
    value: boolean,
  ) => {
    if (!prefs) return;
    setPrefs({
      ...prefs,
      notifications: {
        ...prefs.notifications,
        [group]: {
          ...prefs.notifications[group],
          [key]: value,
        },
      },
    });
  };

  const save = async () => {
    if (!company || !prefs || !canEdit || !isDirty) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const regional = {
        ...prefs.regional,
        number_format: languageToLocale(prefs.regional.language),
        fx_base: prefs.regional.fx_base || FX_BASE_DEFAULT,
        fx_rates: { ...DEFAULT_FX_RATES, ...(prefs.regional.fx_rates || {}) },
      };
      const payloadPrefs = { ...prefs, regional };
      const data = await updatePreferences({
        company: {
          name: company.name,
          slogan: company.slogan || '',
          email: company.email,
          phone: company.phone,
          address: company.address,
          website: company.website || '',
          tax_id: company.tax_id || '',
          country: company.country,
          currency: company.currency,
          tax_rate: company.tax_rate,
        },
        preferences: isAdmin
          ? payloadPrefs
          : {
              regional: payloadPrefs.regional,
              commercial: prefs.commercial,
              display: prefs.display,
              notifications: prefs.notifications,
              documents: prefs.documents,
              security: prefs.security,
              backup: prefs.backup,
              automation: prefs.automation,
            },
      });
      commitLoaded(data, { forceLocale: true });
      setMessage(t('prefs.saved'));
      try {
        localStorage.setItem('stokeya_page_size', String(data.preferences.display.page_size));
        localStorage.setItem('stokeya_theme', data.preferences.display.theme);
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (file: File | null) => {
    if (!file || !canEdit) return;
    try {
      const updated = await uploadCompanyLogo(file);
      setCompany((prev) => (prev ? { ...prev, logo: updated.logo } : prev));
      setMessage(tr('Logo mis à jour — visible dans le menu et la boutique.'));
      try {
        const me = await fetchMe();
        dispatch(setUser(me));
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  if (loading || !company || !prefs) {
    return (
      <Box>
        <PageHeader title={t('prefs.title')} subtitle={t('prefs.subtitleLoading')} />
        {error && <Alert severity="error">{error}</Alert>}
        {!error && <Typography color="text.secondary">{t('common.loading')}</Typography>}
      </Box>
    );
  }

  const invoicePreview = `${prefs.documents.invoice_prefix || 'FAC'}-${new Date().getFullYear()}-00001`;
  const fxBase = prefs.regional.fx_base || FX_BASE_DEFAULT;
  const fxRates = { ...DEFAULT_FX_RATES, ...(prefs.regional.fx_rates || {}) };

  return (
    <Box>
      <PageHeader
        title={t('prefs.title')}
        subtitle={t('prefs.subtitle')}
        action={canEdit && section !== 'about' && isDirty ? (
          <Button variant="contained" startIcon={<SaveIcon />} onClick={save} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        ) : undefined}
      />

      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('prefs.readonly')}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <List dense disablePadding>
              {visibleSections.map((id) => (
                <ListItemButton
                  key={id}
                  selected={section === id}
                  onClick={() => setSection(id)}
                >
                  <ListItemText
                    primary={t(`prefs.sections.${id}`)}
                    primaryTypographyProps={{ fontWeight: section === id ? 700 : 500 }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 9 }}>
          {section === 'locale' && (
            <SectionCard title={t('prefs.regional')} hint={t('prefs.regionalHint')}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField select label={t('prefs.language')} value={prefs.regional.language} disabled={!canEdit}
                    onChange={(e) => {
                      const language = e.target.value as AppLanguage;
                      setRegional({
                        language,
                        number_format: languageToLocale(language),
                      });
                      // Appliquer immédiatement (FR / EN / AR + RTL)
                      applyLocaleRuntime({
                        language,
                        locale: languageToLocale(language),
                        currency: company.currency,
                        fxBase: prefs.regional.fx_base || FX_BASE_DEFAULT,
                        fxRates: { ...DEFAULT_FX_RATES, ...(prefs.regional.fx_rates || {}) },
                        dateFormat: prefs.regional.date_format,
                      });
                    }} fullWidth>
                    <MenuItem value="fr">Français</MenuItem>
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="ar">العربية</MenuItem>
                  </TextField>
                  <TextField select label={t('prefs.currency')} value={company.currency} disabled={!canEdit}
                    onChange={(e) => {
                      const currency = e.target.value;
                      setCompanyField('currency', currency);
                      pushLocaleLive({ currency });
                    }} fullWidth>
                    {CURRENCY_OPTIONS.map((c) => (
                      <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                    {t('prefs.fxTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('prefs.fxHint', { base: fxBase })}
                  </Typography>
                  <TextField
                    select
                    label={t('prefs.fxBase')}
                    value={fxBase}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const fx_base = e.target.value;
                      setRegional({ fx_base });
                      pushLocaleLive({ fx_base });
                    }}
                    sx={{ mb: 2, maxWidth: 280 }}
                    fullWidth
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                    ))}
                  </TextField>
                  <Grid container spacing={1.5}>
                    {CURRENCY_OPTIONS.filter((c) => c.code !== fxBase).map((c) => (
                      <Grid key={c.code} size={{ xs: 12, sm: 6 }}>
                        <TextField
                          type="number"
                          label={`${t('prefs.rateFor', { code: c.code })} ${fxBase}`}
                          value={fxRates[c.code] ?? ''}
                          disabled={!canEdit}
                          fullWidth
                          inputProps={{ min: 0, step: 'any' }}
                          onChange={(e) => setFxRate(c.code, Number(e.target.value) || 0)}
                          helperText={localizeDigits(`1 ${c.code} = ${fxRates[c.code] || 0} ${fxBase}`)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                  <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
                    {t('prefs.preview', { base: fxBase })}{' '}
                    <Typography component="span" fontWeight={700} color="text.primary">
                      {(() => {
                        const rate = Number(fxRates[company.currency] || 1) || 1;
                        const baseRate = Number(fxRates[fxBase] || 1) || 1;
                        const converted = (10000 * baseRate) / rate;
                        return formatCurrency(converted, { currency: company.currency, convert: false });
                      })()}
                    </Typography>
                    {' '}({company.currency})
                  </Typography>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField select label={t('prefs.dateFormat')} value={prefs.regional.date_format} disabled={!canEdit}
                    onChange={(e) => {
                      const date_format = e.target.value;
                      setPref('regional', 'date_format', date_format);
                      pushLocaleLive({ date_format });
                    }} fullWidth>
                    <MenuItem value="DD/MM/YYYY">{tr('JJ/MM/AAAA')}</MenuItem>
                    <MenuItem value="MM/DD/YYYY">{tr('MM/JJ/AAAA')}</MenuItem>
                    <MenuItem value="YYYY-MM-DD">{tr('AAAA-MM-JJ')}</MenuItem>
                  </TextField>
                  <TextField select label={t('prefs.timeFormat')} value={prefs.regional.time_format} disabled={!canEdit}
                    onChange={(e) => setPref('regional', 'time_format', e.target.value)} fullWidth>
                    <MenuItem value="24h">24h</MenuItem>
                    <MenuItem value="12h">12h</MenuItem>
                  </TextField>
                  <TextField select label={t('prefs.timezone')} value={prefs.regional.timezone} disabled={!canEdit}
                    onChange={(e) => setPref('regional', 'timezone', e.target.value)} fullWidth>
                    <MenuItem value="Africa/Abidjan">Africa/Abidjan (GMT)</MenuItem>
                    <MenuItem value="Africa/Dakar">Africa/Dakar (GMT)</MenuItem>
                    <MenuItem value="Africa/Bamako">Africa/Bamako (GMT)</MenuItem>
                    <MenuItem value="Europe/Paris">Europe/Paris</MenuItem>
                  </TextField>
                </Stack>
              </Stack>
            </SectionCard>
          )}

          {section === 'general' && (
            <>
              <SectionCard title={t('prefs.generalInfo')} hint={t('prefs.generalHint')}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <Box
                      component="img"
                      src={logoUrl(company.logo)}
                      alt=""
                      sx={{
                        width: 72, height: 72, borderRadius: 2, objectFit: 'cover',
                        bgcolor: 'grey.100', border: '1px solid', borderColor: 'divider',
                      }}
                    />
                    <Button variant="outlined" component="label" disabled={!canEdit}>
                      {t('prefs.changeLogo')}
                      <input hidden type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0] || null)} />
                    </Button>
                  </Stack>
                  <TextField label={t('prefs.companyName')} value={company.name} disabled={!canEdit}
                    onChange={(e) => setCompanyField('name', e.target.value)} fullWidth />
                  <TextField label={t('prefs.slogan')} value={company.slogan || ''} disabled={!canEdit}
                    onChange={(e) => setCompany({ ...company, slogan: e.target.value })} fullWidth />
                  <TextField label={t('prefs.address')} value={company.address || ''} disabled={!canEdit} multiline rows={2}
                    onChange={(e) => setCompanyField('address', e.target.value)} fullWidth />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField label={t('prefs.phone')} value={company.phone || ''} disabled={!canEdit}
                      onChange={(e) => setCompanyField('phone', e.target.value)} fullWidth />
                    <TextField label={t('prefs.email')} value={company.email || ''} disabled={!canEdit}
                      onChange={(e) => setCompanyField('email', e.target.value)} fullWidth />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField label={t('prefs.website')} value={company.website || ''} disabled={!canEdit}
                      onChange={(e) => setCompany({ ...company, website: e.target.value })} fullWidth />
                    <TextField label={t('prefs.taxId')} value={company.tax_id || ''} disabled={!canEdit}
                      onChange={(e) => setCompany({ ...company, tax_id: e.target.value })} fullWidth />
                  </Stack>
                </Stack>
              </SectionCard>
            </>
          )}

          {section === 'commercial' && (
            <>
              <SectionCard title="Vente">
                <Stack>
                  <Toggle label="Autoriser les ventes sans stock" checked={prefs.commercial.allow_sales_without_stock}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'allow_sales_without_stock', v)} />
                  <Toggle label="Afficher les prix d’achat" checked={prefs.commercial.show_purchase_price}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'show_purchase_price', v)} />
                  <Toggle label="Afficher la marge bénéficiaire" checked={prefs.commercial.show_margin}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'show_margin', v)} />
                  <Toggle label="Demander confirmation avant validation d’une vente" checked={prefs.commercial.confirm_before_sale}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'confirm_before_sale', v)} />
                  <Toggle label="Générer automatiquement une facture après vente" checked={prefs.commercial.auto_invoice_after_sale}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'auto_invoice_after_sale', v)} />
                  <Toggle label="Imprimer automatiquement le ticket" checked={prefs.commercial.auto_print_receipt}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'auto_print_receipt', v)} />
                </Stack>
              </SectionCard>
              <SectionCard title="Stock">
                <Stack spacing={1.5}>
                  <Toggle label="Activer les alertes de stock faible" checked={prefs.commercial.low_stock_alerts}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'low_stock_alerts', v)} />
                  <TextField
                    label={tr('Seuil global d’alerte (optionnel)')}
                    type="number"
                    value={prefs.commercial.global_alert_threshold ?? ''}
                    disabled={!canEdit}
                    helperText={tr('Laisser vide pour utiliser le stock minimum de chaque produit')}
                    onChange={(e) => setPref(
                      'commercial',
                      'global_alert_threshold',
                      e.target.value === '' ? null : Number(e.target.value),
                    )}
                    sx={{ maxWidth: 320 }}
                  />
                  <Toggle label="Autoriser le stock négatif" checked={prefs.commercial.allow_negative_stock}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'allow_negative_stock', v)} />
                  <TextField select label={tr('Méthode de calcul du coût')} value={prefs.commercial.cost_method}
                    disabled={!canEdit} onChange={(e) => setPref('commercial', 'cost_method', e.target.value)}
                    sx={{ maxWidth: 360 }}>
                    <MenuItem value="fifo">FIFO</MenuItem>
                    <MenuItem value="last_purchase">{tr('Dernier prix d’achat')}</MenuItem>
                    <MenuItem value="average">{tr('Prix moyen')}</MenuItem>
                  </TextField>
                </Stack>
              </SectionCard>
              <SectionCard title="Produits">
                <Stack>
                  <Toggle label="Code produit automatique" checked={prefs.commercial.auto_product_code}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'auto_product_code', v)} />
                  <Toggle label="Génération automatique des références" checked={prefs.commercial.auto_product_reference}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'auto_product_reference', v)} />
                  <Toggle label="Afficher les variantes" checked={prefs.commercial.show_variants}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'show_variants', v)} />
                  <Toggle label="Gestion des dates d’expiration" checked={prefs.commercial.track_expiry_dates}
                    disabled={!canEdit} onChange={(v) => setPref('commercial', 'track_expiry_dates', v)} />
                </Stack>
              </SectionCard>
            </>
          )}

          {section === 'display' && (
            <SectionCard title="Interface & tableaux">
              <Stack spacing={2}>
                <TextField select label={tr('Thème')} value={prefs.display.theme} disabled={!canEdit}
                  onChange={(e) => setPref('display', 'theme', e.target.value)} sx={{ maxWidth: 280 }}>
                  <MenuItem value="light">{tr('Clair')}</MenuItem>
                  <MenuItem value="dark">{tr('Sombre')}</MenuItem>
                  <MenuItem value="auto">{tr('Automatique')}</MenuItem>
                </TextField>
                <TextField label={tr('Couleur principale')} type="color" value={prefs.display.primary_color || '#0D9488'}
                  disabled={!canEdit} onChange={(e) => setPref('display', 'primary_color', e.target.value)}
                  sx={{ maxWidth: 160 }} InputLabelProps={{ shrink: true }} />
                <Toggle label="Logo affiché dans le menu" checked={prefs.display.show_logo_in_menu}
                  disabled={!canEdit} onChange={(v) => setPref('display', 'show_logo_in_menu', v)} />
                <TextField select label={tr('Style du tableau de bord')} value={prefs.display.dashboard_style}
                  disabled={!canEdit} onChange={(e) => setPref('display', 'dashboard_style', e.target.value)}
                  sx={{ maxWidth: 320 }}>
                  <MenuItem value="standard">{tr('Standard')}</MenuItem>
                  <MenuItem value="compact">{tr('Compact')}</MenuItem>
                  <MenuItem value="detailed">{tr('Détaillé')}</MenuItem>
                </TextField>
                <TextField select label={tr('Éléments par page')} value={prefs.display.page_size}
                  disabled={!canEdit} onChange={(e) => setPref('display', 'page_size', Number(e.target.value))}
                  sx={{ maxWidth: 200 }}>
                  {[10, 25, 50, 100].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                </TextField>
              </Stack>
            </SectionCard>
          )}

          {section === 'notifications' && (
            <>
              <SectionCard title="Notifications système" hint="Activer ou désactiver les alertes importantes.">
                <Stack>
                  {NOTIF_EVENTS.map((ev) => (
                    <FormControlLabel
                      key={ev.key}
                      control={(
                        <Checkbox
                          checked={Boolean(prefs.notifications.events[ev.key])}
                          disabled={!canEdit}
                          onChange={(e) => setNested('notifications', 'events', ev.key, e.target.checked)}
                        />
                      )}
                      label={tr(ev.label)}
                    />
                  ))}
                </Stack>
              </SectionCard>
              <SectionCard title="Moyen de réception">
                <Stack>
                  {NOTIF_CHANNELS.map((ch) => (
                    <Toggle
                      key={ch.key}
                      label={ch.label}
                      checked={Boolean(prefs.notifications.channels[ch.key])}
                      disabled={!canEdit}
                      onChange={(v) => setNested('notifications', 'channels', ch.key, v)}
                    />
                  ))}
                </Stack>
              </SectionCard>
            </>
          )}

          {section === 'documents' && (
            <>
              <SectionCard title="Factures" hint={`Exemple de numérotation : ${invoicePreview}`}>
                <Stack spacing={2}>
                  <Toggle label="Numérotation automatique" checked={prefs.documents.invoice_auto_number}
                    disabled={!canEdit} onChange={(v) => setPref('documents', 'invoice_auto_number', v)} />
                  <TextField label={tr('Préfixe facture')} value={prefs.documents.invoice_prefix} disabled={!canEdit}
                    onChange={(e) => setPref('documents', 'invoice_prefix', e.target.value)} sx={{ maxWidth: 200 }} />
                </Stack>
              </SectionCard>
              <SectionCard title="Tickets caisse">
                <Stack spacing={1.5}>
                  <Toggle label="Afficher logo" checked={prefs.documents.receipt_show_logo}
                    disabled={!canEdit} onChange={(v) => setPref('documents', 'receipt_show_logo', v)} />
                  <Toggle label="Afficher adresse" checked={prefs.documents.receipt_show_address}
                    disabled={!canEdit} onChange={(v) => setPref('documents', 'receipt_show_address', v)} />
                  <Toggle label="Afficher téléphone" checked={prefs.documents.receipt_show_phone}
                    disabled={!canEdit} onChange={(v) => setPref('documents', 'receipt_show_phone', v)} />
                  <Toggle label="Afficher QR Code" checked={prefs.documents.receipt_show_qr}
                    disabled={!canEdit} onChange={(v) => setPref('documents', 'receipt_show_qr', v)} />
                  <TextField
                    label={tr('Message de bas de ticket')}
                    value={prefs.documents.receipt_footer}
                    disabled={!canEdit}
                    multiline
                    rows={3}
                    onChange={(e) => setPref('documents', 'receipt_footer', e.target.value)}
                    fullWidth
                  />
                </Stack>
              </SectionCard>
            </>
          )}

          {section === 'security' && (
            <SectionCard title="Sécurité des comptes">
              <Stack spacing={2}>
                <TextField
                  label={tr('Déconnexion automatique (minutes d’inactivité)')}
                  type="number"
                  value={prefs.security.auto_logout_minutes}
                  disabled={!canEdit}
                  onChange={(e) => setPref('security', 'auto_logout_minutes', Number(e.target.value))}
                  sx={{ maxWidth: 320 }}
                />
                <TextField
                  label={tr('Durée de session (heures)')}
                  type="number"
                  value={prefs.security.session_duration_hours}
                  disabled={!canEdit}
                  onChange={(e) => setPref('security', 'session_duration_hours', Number(e.target.value))}
                  sx={{ maxWidth: 320 }}
                />
                <Toggle label="Demander confirmation avant suppression" checked={prefs.security.confirm_before_delete}
                  disabled={!canEdit} onChange={(v) => setPref('security', 'confirm_before_delete', v)} />
                <Toggle label="Masquer les informations sensibles" checked={prefs.security.hide_sensitive_info}
                  disabled={!canEdit} onChange={(v) => setPref('security', 'hide_sensitive_info', v)} />
                <Toggle label="Autoriser la connexion sur plusieurs appareils" checked={prefs.security.multi_device_login}
                  disabled={!canEdit} onChange={(v) => setPref('security', 'multi_device_login', v)} />
                <Toggle label="Activer la double authentification" checked={prefs.security.two_factor_auth}
                  disabled={!canEdit} onChange={(v) => setPref('security', 'two_factor_auth', v)} />
              </Stack>
            </SectionCard>
          )}

          {section === 'backup' && (
            <SectionCard title="Sauvegarde automatique" hint="Exemple : tous les jours à 02h00">
              <Stack spacing={2}>
                <Toggle label="Sauvegarde automatique activée" checked={prefs.backup.enabled}
                  disabled={!canEdit} onChange={(v) => setPref('backup', 'enabled', v)} />
                <TextField select label={tr('Fréquence')} value={prefs.backup.frequency} disabled={!canEdit}
                  onChange={(e) => setPref('backup', 'frequency', e.target.value)} sx={{ maxWidth: 280 }}>
                  <MenuItem value="daily">{tr('Chaque jour')}</MenuItem>
                  <MenuItem value="weekly">{tr('Chaque semaine')}</MenuItem>
                  <MenuItem value="monthly">{tr('Chaque mois')}</MenuItem>
                </TextField>
                <TextField label={tr('Heure de sauvegarde')} type="time" value={prefs.backup.hour} disabled={!canEdit}
                  onChange={(e) => setPref('backup', 'hour', e.target.value)} sx={{ maxWidth: 200 }}
                  InputLabelProps={{ shrink: true }} />
                <Divider />
                <Typography variant="body2" color="text.secondary">
                  {tr('Dernière sauvegarde :')} {prefs.backup.last_backup_at ? formatDate(prefs.backup.last_backup_at) : '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tr('Taille :')} {prefs.backup.last_backup_size || '—'}
                </Typography>
              </Stack>
            </SectionCard>
          )}

          {section === 'automation' && (
            <>
              <SectionCard title="Stock faible" hint="Si stock < minimum → notification / alerte / demande auto">
                <Stack>
                  <Toggle label="Envoyer une notification" checked={prefs.automation.low_stock_notify}
                    disabled={!canEdit} onChange={(v) => setPref('automation', 'low_stock_notify', v)} />
                  <Toggle label="Créer une alerte" checked={prefs.automation.low_stock_create_alert}
                    disabled={!canEdit} onChange={(v) => setPref('automation', 'low_stock_create_alert', v)} />
                  <Toggle label="Créer une demande de réapprovisionnement" checked={prefs.automation.low_stock_auto_request}
                    disabled={!canEdit} onChange={(v) => setPref('automation', 'low_stock_auto_request', v)} />
                </Stack>
              </SectionCard>
              <SectionCard title="Vente terminée">
                <Stack>
                  <Toggle label="Générer une facture" checked={prefs.automation.sale_generate_invoice}
                    disabled={!canEdit} onChange={(v) => setPref('automation', 'sale_generate_invoice', v)} />
                  <Toggle label="Envoyer au client" checked={prefs.automation.sale_send_to_customer}
                    disabled={!canEdit} onChange={(v) => setPref('automation', 'sale_send_to_customer', v)} />
                </Stack>
              </SectionCard>
              <SectionCard title="Nouvelle commande boutique">
                <Stack>
                  <Toggle label="Notification responsable" checked={prefs.automation.online_order_notify_manager}
                    disabled={!canEdit} onChange={(v) => setPref('automation', 'online_order_notify_manager', v)} />
                  <Toggle label="Mise à jour du stock" checked={prefs.automation.online_order_update_stock}
                    disabled={!canEdit} onChange={(v) => setPref('automation', 'online_order_update_stock', v)} />
                </Stack>
              </SectionCard>
            </>
          )}

          {section === 'advanced' && isAdmin && (
            <SectionCard title="Avancé (administrateur)" hint="Actions sensibles réservées au propriétaire.">
              <Stack spacing={2}>
                <Toggle label="Mode maintenance" checked={prefs.advanced.maintenance_mode}
                  disabled={!canEdit} onChange={(v) => setPref('advanced', 'maintenance_mode', v)} />
                <Alert severity="warning">
                  {tr('Export / import / archivage / réinitialisation seront branchés progressivement. Pour l’instant, utilisez les modules Produits (import) et Abonnement.')}
                </Alert>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button variant="outlined" disabled>{tr('Export complet')}</Button>
                  <Button variant="outlined" disabled>{tr('Import de données')}</Button>
                  <Button variant="outlined" disabled>{tr('Nettoyage historiques')}</Button>
                  <Button variant="outlined" color="warning" disabled>{tr('Réinitialiser les paramètres')}</Button>
                </Stack>
              </Stack>
            </SectionCard>
          )}

          {section === 'about' && about && (
            <SectionCard title="À propos d’Stokeya">
              <Stack spacing={1.25}>
                <Typography variant="body2"><strong>{tr('Produit')}</strong> — {about.product}</Typography>
                <Typography variant="body2"><strong>{tr('Version')}</strong> — {about.version}</Typography>
                <Typography variant="body2">
                  <strong>{tr('Dernière mise à jour')}</strong> — {formatDate(about.updated_at)}
                </Typography>
                <Typography variant="body2"><strong>{tr('Licence')}</strong> — {about.license}</Typography>
                <Typography variant="body2">
                  <strong>{tr('Support')}</strong> — {about.support_email}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  {tr('Conditions d’utilisation et politique de confidentialité seront publiées avec le site public Stokeya.')}
                </Typography>
              </Stack>
            </SectionCard>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
