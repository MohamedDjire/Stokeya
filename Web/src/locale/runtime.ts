import {
  DEFAULT_FX_RATES,
  FX_BASE_DEFAULT,
  currencySymbol,
  languageToLocale,
  toLocalizedDigits,
  type AppLanguage,
} from './currencies';

export interface LocaleRuntime {
  language: AppLanguage;
  locale: string;
  currency: string;
  fxBase: string;
  fxRates: Record<string, number>;
  dateFormat: string;
  rtl: boolean;
  /** Incrémenté à chaque changement — déclenche les re-renders React */
  version: number;
}

const DEFAULT: LocaleRuntime = {
  language: 'fr',
  locale: 'fr-FR',
  currency: 'XOF',
  fxBase: FX_BASE_DEFAULT,
  fxRates: { ...DEFAULT_FX_RATES },
  dateFormat: 'DD/MM/YYYY',
  rtl: false,
  version: 0,
};

let runtime: LocaleRuntime = { ...DEFAULT, fxRates: { ...DEFAULT_FX_RATES } };

/** Langue choisie en direct (pas encore enregistrée) — ne pas l’écraser par l’API. */
let languagePinned = false;

const listeners = new Set<() => void>();

export function getLocaleRuntime(): LocaleRuntime {
  return runtime;
}

/** Snapshot stable pour useSyncExternalStore (primitive). */
export function getLocaleVersion(): number {
  return runtime.version;
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify() {
  listeners.forEach((l) => l());
}

export function clearLanguagePin() {
  languagePinned = false;
}

export function isLanguagePinned() {
  return languagePinned;
}

export function applyLocaleRuntime(partial: Partial<LocaleRuntime> & { fxRates?: Record<string, number> }) {
  const language = (partial.language || runtime.language) as AppLanguage;
  const currency = partial.currency ?? runtime.currency;
  const fxBase = partial.fxBase ?? runtime.fxBase;
  const dateFormat = partial.dateFormat ?? runtime.dateFormat;
  const fxRates = { ...DEFAULT_FX_RATES, ...(partial.fxRates || runtime.fxRates) };
  // Toujours dériver la locale de la langue (arabe = chiffres arabes)
  const locale = languageToLocale(language);
  const rtl = language === 'ar';

  if (partial.language != null && partial.language !== runtime.language) {
    languagePinned = true;
  }

  const unchanged =
    language === runtime.language
    && currency === runtime.currency
    && fxBase === runtime.fxBase
    && dateFormat === runtime.dateFormat
    && locale === runtime.locale
    && rtl === runtime.rtl
    && JSON.stringify(fxRates) === JSON.stringify(runtime.fxRates);

  if (unchanged) return;

  runtime = {
    language,
    locale,
    currency,
    fxBase,
    fxRates,
    dateFormat,
    rtl,
    version: runtime.version + 1,
  };

  try {
    document.documentElement.lang = language === 'ar' ? 'ar' : language;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    localStorage.setItem('stokeya_language', language);
    localStorage.setItem('stokeya_currency', currency);
    localStorage.setItem('stokeya_fx_rates', JSON.stringify(fxRates));
    localStorage.setItem('stokeya_fx_base', fxBase);
    localStorage.setItem('stokeya_date_format', dateFormat);
  } catch {
    /* ignore */
  }
  notify();
}

function stored(key: string) {
  return localStorage.getItem(`stokeya_${key}`) || localStorage.getItem(`inventra_${key}`);
}

export function hydrateLocaleFromStorage() {
  try {
    const language = (stored('language') as AppLanguage) || 'fr';
    const currency = stored('currency') || 'XOF';
    const fxBase = stored('fx_base') || FX_BASE_DEFAULT;
    const dateFormat = stored('date_format') || 'DD/MM/YYYY';
    const rawRates = stored('fx_rates');
    const fxRates = rawRates ? { ...DEFAULT_FX_RATES, ...JSON.parse(rawRates) } : { ...DEFAULT_FX_RATES };
    applyLocaleRuntime({ language, currency, fxBase, fxRates, dateFormat, locale: languageToLocale(language) });
    clearLanguagePin();
  } catch {
    applyLocaleRuntime({ language: 'fr' });
    clearLanguagePin();
  }
}

/** Convertit un montant stocké (fxBase) vers la devise d’affichage. */
export function convertAmount(value: string | number | null | undefined, toCurrency?: string): number {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  const { fxBase, fxRates, currency } = runtime;
  const target = toCurrency || currency;
  const baseRate = Number(fxRates[fxBase] ?? 1) || 1;
  const targetRate = Number(fxRates[target] ?? 1) || 1;
  const inBase = amount * baseRate;
  return inBase / targetRate;
}

function numberFormatOpts(extra?: Intl.NumberFormatOptions): Intl.NumberFormatOptions {
  const opts: Intl.NumberFormatOptions = { ...extra };
  if (runtime.language === 'ar') {
    opts.numberingSystem = 'arab';
  }
  return opts;
}

/** Tout nombre affiché à l’écran (qté, stats, pourcentages…). */
export function formatNumber(
  value: string | number | null | undefined,
  opts?: Intl.NumberFormatOptions,
): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) {
    return runtime.language === 'ar' ? toLocalizedDigits('0', 'ar') : '0';
  }
  let formatted: string;
  try {
    formatted = n.toLocaleString(runtime.locale, numberFormatOpts(opts));
  } catch {
    formatted = n.toLocaleString('en-US', opts);
  }
  // Toujours post-traiter : certains navigateurs ignorent numberingSystem=arab
  return runtime.language === 'ar' ? toLocalizedDigits(formatted, 'ar') : formatted;
}

export function formatCurrency(
  value: string | number | null | undefined,
  opts?: { currency?: string; convert?: boolean },
): string {
  const { currency } = runtime;
  const code = opts?.currency || currency;
  const convert = opts?.convert !== false;
  const n = convert ? convertAmount(value, code) : Number(value || 0);
  const decimals = code === 'XOF' || code === 'GNF' ? 0 : 2;
  const formatted = formatNumber(n, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${formatted} ${currencySymbol(code)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const { locale, dateFormat, language } = runtime;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const arabOpts = language === 'ar' ? { numberingSystem: 'arab' as const } : {};
  let formatted: string;
  try {
    if (dateFormat === 'YYYY-MM-DD') {
      formatted = d.toLocaleDateString(language === 'ar' ? locale : 'en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit', ...arabOpts,
      });
    } else if (dateFormat === 'MM/DD/YYYY') {
      formatted = d.toLocaleDateString(language === 'ar' ? locale : 'en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit', ...arabOpts,
      });
    } else {
      formatted = d.toLocaleDateString(locale, {
        day: '2-digit', month: '2-digit', year: 'numeric', ...arabOpts,
      });
    }
  } catch {
    formatted = d.toLocaleDateString('fr-FR');
  }
  return language === 'ar' ? toLocalizedDigits(formatted, 'ar') : formatted;
}

/** Convertit les chiffres d’une chaîne selon la langue active. */
export function localizeDigits(text: string): string {
  if (runtime.language !== 'ar') return text;
  return toLocalizedDigits(text, 'ar');
}
