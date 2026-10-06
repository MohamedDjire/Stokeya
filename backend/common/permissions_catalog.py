"""Catalogue de permissions Stokeya — modules + rôles métier."""

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

# Autorisations fines (fiche utilisateur)
GRANULAR_FLAGS = [
    ('can_sell', 'Effectuer des ventes'),
    ('can_view_own_sales', 'Consulter ses ventes'),
    ('can_print_receipt', 'Imprimer un reçu'),
    ('can_open_register', 'Ouvrir sa caisse'),
    ('can_close_register', 'Fermer sa caisse'),
    ('can_edit_price', 'Modifier un prix'),
    ('can_discount', 'Accorder une remise'),
    ('can_cancel_sale', 'Annuler une vente'),
    ('can_modify_stock', 'Modifier le stock'),
    ('can_view_profit', 'Voir les bénéfices'),
    ('can_view_purchases', 'Voir les achats'),
    ('can_view_expenses', 'Voir les dépenses'),
    ('can_transfer', 'Transférer des produits'),
    ('can_request_stock', 'Demander un réapprovisionnement'),
    ('can_create_user', 'Créer un utilisateur'),
    ('can_delete_product', 'Supprimer un produit'),
    ('can_edit_settings', 'Modifier les paramètres'),
]

ROLE_DEFAULT_FLAGS = {
    'company_admin': {key: True for key, _ in GRANULAR_FLAGS},
    'manager': {
        'can_sell': True, 'can_view_own_sales': True, 'can_print_receipt': True,
        'can_open_register': True, 'can_close_register': True,
        'can_edit_price': True, 'can_discount': True, 'can_cancel_sale': True,
        'can_modify_stock': True, 'can_view_profit': True,
        'can_view_purchases': True, 'can_view_expenses': True,
        'can_transfer': True, 'can_request_stock': True,
        'can_create_user': False, 'can_delete_product': True, 'can_edit_settings': False,
    },
    'warehouse_manager': {
        'can_sell': False, 'can_view_own_sales': False, 'can_print_receipt': False,
        'can_open_register': False, 'can_close_register': False,
        'can_edit_price': False, 'can_discount': False, 'can_cancel_sale': False,
        'can_modify_stock': True, 'can_view_profit': False,
        'can_view_purchases': True, 'can_view_expenses': False,
        'can_transfer': True, 'can_request_stock': False,
        'can_create_user': False, 'can_delete_product': False, 'can_edit_settings': False,
    },
    'stock_keeper': {
        'can_sell': False, 'can_view_own_sales': False, 'can_print_receipt': False,
        'can_open_register': False, 'can_close_register': False,
        'can_edit_price': False, 'can_discount': False, 'can_cancel_sale': False,
        'can_modify_stock': False, 'can_view_profit': False,
        'can_view_purchases': False, 'can_view_expenses': False,
        'can_transfer': True, 'can_request_stock': False,
        'can_create_user': False, 'can_delete_product': False, 'can_edit_settings': False,
    },
    'pos_manager': {
        'can_sell': True, 'can_view_own_sales': True, 'can_print_receipt': True,
        'can_open_register': True, 'can_close_register': True,
        'can_edit_price': True, 'can_discount': True, 'can_cancel_sale': True,
        'can_modify_stock': False, 'can_view_profit': True,
        'can_view_purchases': False, 'can_view_expenses': True,
        'can_transfer': False, 'can_request_stock': True,
        'can_create_user': False, 'can_delete_product': False, 'can_edit_settings': False,
    },
    'cashier': {
        'can_sell': True, 'can_view_own_sales': True, 'can_print_receipt': True,
        'can_open_register': True, 'can_close_register': True,
        'can_edit_price': False, 'can_discount': False, 'can_cancel_sale': False,
        'can_modify_stock': False, 'can_view_profit': False,
        'can_view_purchases': False, 'can_view_expenses': False,
        'can_transfer': False, 'can_request_stock': True,
        'can_create_user': False, 'can_delete_product': False, 'can_edit_settings': False,
    },
    'accountant': {
        'can_sell': False, 'can_view_own_sales': False, 'can_print_receipt': False,
        'can_open_register': False, 'can_close_register': False,
        'can_edit_price': False, 'can_discount': False, 'can_cancel_sale': False,
        'can_modify_stock': False, 'can_view_profit': True,
        'can_view_purchases': True, 'can_view_expenses': True,
        'can_transfer': False, 'can_request_stock': False,
        'can_create_user': False, 'can_delete_product': False, 'can_edit_settings': False,
    },
}

ROLE_DISPLAY_NAMES = {
    'company_admin': 'Administrateur entreprise',
    'manager': 'Gérant',
    'warehouse_manager': 'Responsable entrepôt',
    'stock_keeper': 'Magasinier',
    'pos_manager': 'Responsable point de vente',
    'cashier': 'Caissier',
    'accountant': 'Comptable',
}

ROLE_DESCRIPTIONS = {
    'company_admin': 'Contrôle toute l’entreprise : stocks, ventes, utilisateurs, chiffres.',
    'manager': 'Pilote les opérations au niveau entreprise (proche de l’administrateur).',
    'warehouse_manager': 'Reçoit les marchandises, prépare les transferts, inventaires — son entrepôt uniquement.',
    'stock_keeper': 'Prépare et expédie les transferts. Ne vend pas et ne gère pas les boutiques.',
    'pos_manager': 'Pilote un point de vente : ventes, demandes de réappro, réception des transferts.',
    'cashier': 'Vend uniquement sur sa caisse. Ne gère jamais le stock.',
    'accountant': 'Consulte achats, dépenses et bénéfices. Pas de stock ni de caisse.',
}

# Champs de rattachement attendus selon le rôle
ROLE_SCOPE_RULES = {
    'manager': {'branch': 'optional', 'warehouse': 'hidden', 'cash_register': 'hidden'},
    'warehouse_manager': {'branch': 'hidden', 'warehouse': 'required', 'cash_register': 'hidden'},
    'stock_keeper': {'branch': 'hidden', 'warehouse': 'required', 'cash_register': 'hidden'},
    'pos_manager': {'branch': 'required', 'warehouse': 'hidden', 'cash_register': 'optional'},
    'cashier': {'branch': 'required', 'warehouse': 'hidden', 'cash_register': 'required'},
    'accountant': {'branch': 'optional', 'warehouse': 'hidden', 'cash_register': 'hidden'},
}

# Groupes d’autorisations (fiche utilisateur)
PERMISSION_FLAG_GROUPS = [
    {
        'key': 'caisse',
        'label': 'Caisse & ventes',
        'flags': [
            'can_sell', 'can_view_own_sales', 'can_print_receipt',
            'can_open_register', 'can_close_register',
            'can_edit_price', 'can_discount', 'can_cancel_sale',
        ],
    },
    {
        'key': 'stock',
        'label': 'Stock & transferts',
        'flags': [
            'can_modify_stock', 'can_request_stock', 'can_transfer', 'can_delete_product',
        ],
    },
    {
        'key': 'finance',
        'label': 'Finance & reporting',
        'flags': [
            'can_view_profit', 'can_view_purchases', 'can_view_expenses',
        ],
    },
    {
        'key': 'admin',
        'label': 'Administration',
        'flags': [
            'can_create_user', 'can_edit_settings',
        ],
    },
]

# Ordre d’affichage des rôles (hiérarchie métier)
ROLE_ORDER = [
    'manager',
    'warehouse_manager',
    'stock_keeper',
    'pos_manager',
    'cashier',
    'accountant',
]

DEFAULT_ROLE_PERMISSIONS = {
    'company_admin': list(PERMISSION_CODES),
    'manager': ['GP', 'GS', 'GV', 'GCL', 'GF', 'GCM', 'GT', 'GCS'],
    'warehouse_manager': ['GP', 'GS', 'GT', 'GF', 'GCM'],
    'stock_keeper': ['GS', 'GT'],
    'pos_manager': ['GV', 'GCL', 'GCS', 'GS'],  # GS = voir stock magasin, pas modifier
    'cashier': ['GV', 'GCL', 'GCS'],
    'accountant': ['GC', 'GF', 'GCM'],
}
