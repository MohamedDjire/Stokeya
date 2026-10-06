/** Devise de référence des montants stockés en base (historique Stokeya = XOF). */
export const FX_BASE_DEFAULT = 'XOF';

export const CURRENCY_OPTIONS = [
  { code: 'XOF', label: 'FCFA (XOF)', symbol: 'FCFA' },
  { code: 'EUR', label: 'Euro (EUR)', symbol: '€' },
  { code: 'USD', label: 'Dollar (USD)', symbol: '$' },
  { code: 'GNF', label: 'Franc guinéen (GNF)', symbol: 'GNF' },
] as const;

/** Combien d’unités de la devise de base (XOF) pour 1 unité de cette devise. */
export const DEFAULT_FX_RATES: Record<string, number> = {
  XOF: 1,
  EUR: 655.957,
  USD: 600,
  GNF: 0.07,
};

export type AppLanguage = 'fr' | 'en' | 'ar';

export function languageToLocale(lang: string): string {
  if (lang === 'en') return 'en-US';
  // nu-arab = chiffres arabes orientaux ٠١٢٣…
  if (lang === 'ar') return 'ar-SA-u-nu-arab';
  return 'fr-FR';
}

export function currencySymbol(code: string): string {
  return CURRENCY_OPTIONS.find((c) => c.code === code)?.symbol || code;
}

/** Chiffres occidentaux → arabes orientaux */
const ARAB_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toLocalizedDigits(text: string, lang?: string): string {
  const useArab = (lang || '') === 'ar' || (lang || '').startsWith('ar');
  if (!useArab) return text;
  return text
    .replace(/\d/g, (d) => ARAB_DIGITS[Number(d)])
    .replace(/\./g, '٫') // séparateur décimal arabe
    .replace(/,/g, '٬'); // séparateur de milliers arabe
}
