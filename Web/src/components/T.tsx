import type { ReactNode } from 'react';
import { useLocale } from '../locale/useLocale';
import { tr } from '../locale/tr';

/** Affiche un texte FR traduit selon la langue active. */
export default function T({ children }: { children: ReactNode }) {
  const { version } = useLocale();
  void version;
  if (typeof children === 'string' || typeof children === 'number') {
    return <>{tr(String(children))}</>;
  }
  return <>{children}</>;
}

export function useTr() {
  const { version } = useLocale();
  void version;
  return tr;
}
