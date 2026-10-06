import { ar, en, fr, type MessageTree } from './messages';
import { getLocaleRuntime, subscribeLocale, formatNumber, localizeDigits } from './runtime';
import type { AppLanguage } from './currencies';

const catalogs: Record<AppLanguage, MessageTree> = { fr, en, ar };

function lookup(tree: MessageTree, path: string): string | undefined {
  const parts = path.split('.');
  let cur: string | MessageTree | undefined = tree;
  for (const p of parts) {
    if (!cur || typeof cur === 'string') return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const lang = getLocaleRuntime().language;
  let text = lookup(catalogs[lang], key) || lookup(catalogs.fr, key) || key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      const rendered = typeof v === 'number' ? formatNumber(v) : String(v);
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), rendered);
    });
  }
  return lang === 'ar' ? localizeDigits(text) : text;
}

/** Hook-like helper: re-render when locale changes (use with useSyncExternalStore). */
export { subscribeLocale, getLocaleRuntime };
