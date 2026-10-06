import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { fetchPreferences, type CompanyPreferences, type PreferencesPayload } from '../api/preferences';
import { applyLocaleRuntime, clearLanguagePin, getLocaleRuntime, isLanguagePinned } from '../locale/runtime';
import { DEFAULT_FX_RATES, FX_BASE_DEFAULT, languageToLocale, type AppLanguage } from '../locale/currencies';
import { logoutThunk } from './authSlice';

export interface PrefsState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  companyCurrency: string;
  preferences: CompanyPreferences | null;
  error: string | null;
}

const initialState: PrefsState = {
  status: 'idle',
  companyCurrency: 'XOF',
  preferences: null,
  error: null,
};

/** Applique les prefs serveur. `force` = après Enregistrer (écrase le choix live). */
export function syncRuntimeFromPayload(
  data: PreferencesPayload,
  opts?: { force?: boolean },
) {
  const regional = data.preferences.regional as CompanyPreferences['regional'] & {
    fx_base?: string;
    fx_rates?: Record<string, number>;
  };
  const serverLang = (regional.language || 'fr') as AppLanguage;
  const language = (!opts?.force && isLanguagePinned())
    ? getLocaleRuntime().language
    : serverLang;

  if (opts?.force) clearLanguagePin();

  applyLocaleRuntime({
    language,
    locale: languageToLocale(language),
    currency: data.company.currency || 'XOF',
    fxBase: regional.fx_base || FX_BASE_DEFAULT,
    fxRates: { ...DEFAULT_FX_RATES, ...(regional.fx_rates || {}) },
    dateFormat: regional.date_format || 'DD/MM/YYYY',
  });

  if (opts?.force) clearLanguagePin();
}

export const loadPreferences = createAsyncThunk('prefs/load', async () => {
  const data = await fetchPreferences();
  return data;
});

const prefsSlice = createSlice({
  name: 'prefs',
  initialState,
  reducers: {
    applyPreferencesPayload(state, action: PayloadAction<PreferencesPayload>) {
      state.preferences = action.payload.preferences;
      state.companyCurrency = action.payload.company.currency || 'XOF';
      state.status = 'ready';
    },
    clearPrefs(state) {
      state.preferences = null;
      state.companyCurrency = 'XOF';
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPreferences.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadPreferences.fulfilled, (state, action) => {
        state.preferences = action.payload.preferences;
        state.companyCurrency = action.payload.company.currency || 'XOF';
        state.status = 'ready';
      })
      .addCase(loadPreferences.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message || 'error';
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.preferences = null;
        state.companyCurrency = 'XOF';
        state.status = 'idle';
        clearLanguagePin();
      });
  },
});

export const { applyPreferencesPayload, clearPrefs } = prefsSlice.actions;
export default prefsSlice.reducer;
