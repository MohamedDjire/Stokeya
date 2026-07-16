"""Catalogue de permissions inspiré de new_stock."""

PERMISSION_CODES = (
    'GP', 'GS', 'GV', 'GU', 'GC', 'GT', 'GCM', 'GF', 'GCL', 'GCS', 'ALL',
)

PERMISSION_LABELS = {
    'GP': 'Gestion produit',
    'GS': 'Gestion stock',
    'GV': 'Gestion vente',
    'GU': 'Gestion utilisateur',
    'GC': 'Gestion comptabilite',
    'GT': 'Gestion entrepot',
    'GCM': 'Gestion commandes',
    'GF': 'Gestion fournisseur',
    'GCL': 'Gestion clients',
    'GCS': 'Gestion caisse',
    'ALL': 'Tous les droits',
}

MODULE_PERMISSION_MAP = {
    'products': 'GP',
    'stock': 'GS',
    'sales': 'GV',
    'users': 'GU',
    'accounting': 'GC',
    'warehouses': 'GT',
    'purchases': 'GCM',
    'suppliers': 'GF',
    'customers': 'GCL',
    'cash': 'GCS',
}

DEFAULT_ROLE_PERMISSIONS = {
    'company_admin': list(PERMISSION_CODES),
    'manager': ['GP', 'GS', 'GV', 'GCL', 'GF', 'GCM', 'GT', 'GCS'],
    'cashier': ['GV', 'GCL', 'GCS'],
    'stock_keeper': ['GP', 'GS', 'GT'],
    'accountant': ['GC', 'GF', 'GCM'],
}
