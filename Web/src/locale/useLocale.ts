import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { t as translate, subscribeLocale } from './i18n';
import {
  applyLocaleRuntime,
  formatCurrency,
  formatDate,
  formatNumber,
  convertAmount,
  localizeDigits,
  getLocaleRuntime,
  getLocaleVersion,
} from './runtime';
import { tr as translatePhraseRaw } from './tr';
import type { AppLanguage } from './currencies';

export function useLocale() {
  const version = useSyncExternalStore(subscribeLocale, getLocaleVersion, () => 0);
  const snap = getLocaleRuntime();

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, vars),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const translatePhrase = useCallback(
    (text: string) => translatePhraseRaw(text),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  return useMemo(
    () => ({
      ...snap,
      version,
      t,
      tr: translatePhrase,
      formatCurrency,
      formatDate,
      formatNumber,
      localizeDigits,
      convertAmount,
      setLanguage: (language: AppLanguage) => applyLocaleRuntime({ language }),
      setCurrency: (currency: string) => applyLocaleRuntime({ currency }),
      apply: applyLocaleRuntime,
    }),
    [version, snap.language, snap.currency, snap.fxBase, snap.dateFormat, snap.rtl, snap.locale, t, translatePhrase],
  );
}

export {
  formatCurrency,
  formatDate,
  formatNumber,
  convertAmount,
  applyLocaleRuntime,
  localizeDigits,
  translatePhraseRaw as tr,
};
