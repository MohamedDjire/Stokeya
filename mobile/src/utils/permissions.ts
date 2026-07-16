export const PERMISSION_CODES = {
  GP: 'GP',
  GS: 'GS',
  GV: 'GV',
  GU: 'GU',
  GC: 'GC',
  GT: 'GT',
  GCM: 'GCM',
  GF: 'GF',
  GCL: 'GCL',
  GCS: 'GCS',
  ALL: 'ALL',
} as const;

export const PERMISSION_LABELS: Record<string, string> = {
  GP: 'Gestion produit',
  GS: 'Gestion stock',
  GV: 'Gestion vente',
  GU: 'Gestion utilisateur',
  GC: 'Gestion comptabilité',
  GT: 'Gestion entrepôt',
  GCM: 'Gestion commandes',
  GF: 'Gestion fournisseur',
  GCL: 'Gestion clients',
  GCS: 'Gestion caisse',
  ALL: 'Tous les droits',
};

export const MODULE_PERMISSION_MAP: Record<string, string> = {
  products: 'GP',
  stock: 'GS',
  sales: 'GV',
  users: 'GU',
  accounting: 'GC',
  warehouses: 'GT',
  purchases: 'GCM',
  suppliers: 'GF',
  customers: 'GCL',
  cash: 'GCS',
};

export function hasPermission(
  permissions: string[] | undefined,
  code: string | string[],
): boolean {
  if (!permissions?.length) return false;
  if (permissions.includes('ALL')) return true;
  if (Array.isArray(code)) {
    return code.some((c) => permissions.includes(c));
  }
  return permissions.includes(code);
}

export function hasModuleAccess(
  permissions: string[] | undefined,
  moduleName: string,
): boolean {
  const code = MODULE_PERMISSION_MAP[moduleName];
  if (!code) return false;
  return hasPermission(permissions, code);
}
