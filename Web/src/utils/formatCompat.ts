export {
  formatCurrency,
  formatDate,
  convertAmount,
  formatNumber,
  localizeDigits,
} from '../locale/runtime';

import { formatNumber } from '../locale/runtime';

export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `${formatNumber(n / 1_000_000, { maximumFractionDigits: 1 })}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `${formatNumber(Math.round(n / 1000), { maximumFractionDigits: 0 })}k`;
  }
  return formatNumber(Math.round(n), { maximumFractionDigits: 0 });
}
