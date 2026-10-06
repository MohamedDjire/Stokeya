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

export type UserLike = {
  is_company_admin?: boolean;
  permissions?: string[];
  flags?: Record<string, boolean>;
  scope?: { flags?: Record<string, boolean>; is_cashier?: boolean };
  role_code?: string | null;
};

export function hasPermission(
  permissions: string[] | undefined,
  code: string | string[],
): boolean {
  if (!permissions?.length) return false;
  if (permissions.includes('ALL')) return true;
  if (Array.isArray(code)) return code.some((c) => permissions.includes(c));
  return permissions.includes(code);
}

export function hasModuleAccess(
  permissions: string[] | undefined,
  moduleName: string,
): boolean {
  const code = MODULE_PERMISSION_MAP[moduleName];
  if (!code) return true;
  return hasPermission(permissions, code);
}

export function hasFlag(user: UserLike | null | undefined, flag: string): boolean {
  if (!user) return false;
  if (user.is_company_admin) return true;
  const flags = user.flags || user.scope?.flags || {};
  return Boolean(flags[flag]);
}

/** Navigation : modules + flags métier (caissier = ventes seulement). */
export function canAccessNavItem(
  user: UserLike | null | undefined,
  opts: {
    module?: string;
    adminOnly?: boolean;
    flag?: string;
    /** Masquer pour les caissiers même s'ils ont GS (ex. stock magasin en lecture) */
    hideForCashier?: boolean;
  },
): boolean {
  if (!user) return false;
  if (opts.adminOnly && !user.is_company_admin && !hasFlag(user, 'can_create_user')) {
    return false;
  }
  if (opts.hideForCashier && (user.role_code === 'cashier' || user.scope?.is_cashier)) {
    return false;
  }
  if (opts.flag && !hasFlag(user, opts.flag)) return false;
  if (opts.module && !hasModuleAccess(user.permissions, opts.module)) return false;
  return true;
}
