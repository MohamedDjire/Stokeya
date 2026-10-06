/** Codes de fonctionnalités premium (alignés sur backend/companies/plans.py). */
export const FEATURE_MULTI_BRANCH = 'multi_branch';
export const FEATURE_MULTI_WAREHOUSE = 'multi_warehouse';
export const FEATURE_ONLINE_SHOP = 'online_shop';
export const FEATURE_CUSTOMER_CREDIT = 'customer_credit';

export function hasPlanFeature(
  features: string[] | null | undefined,
  featureCode: string,
): boolean {
  if (!features?.length) return false;
  return features.includes('all') || features.includes(featureCode);
}
