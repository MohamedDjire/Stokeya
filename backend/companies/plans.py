"""Catalogue des fonctionnalités et définition des packs Stokeya.

Les fonctionnalités « cœur » (produits, catégories, stock, ventes simples,
clients, fournisseurs, tableau de bord, ticket, sauvegarde) sont disponibles
sur TOUS les packs et ne sont donc pas listées ici.

Business = fonctionnalités premium intégrées.
Enterprise = Business + avantages exclusifs (échelle illimitée, accompagnement).
"""

# --- Codes de fonctionnalités premium (intégrées) ---
FEATURE_BARCODE_SCANNER = 'barcode_scanner'
FEATURE_MULTI_BRANCH = 'multi_branch'
FEATURE_MULTI_WAREHOUSE = 'multi_warehouse'
FEATURE_ONLINE_SHOP = 'online_shop'
FEATURE_ROLES_PERMISSIONS = 'roles_permissions'
FEATURE_ADVANCED_PURCHASES = 'advanced_purchases'
FEATURE_ADVANCED_REPORTS = 'advanced_reports'
FEATURE_EXPORT = 'export_excel_pdf'
FEATURE_POS_ADVANCED = 'pos_advanced'
FEATURE_CUSTOMER_CREDIT = 'customer_credit'

# --- Exclusifs Pack Enterprise (10 000 F) ---
FEATURE_UNLIMITED_SCALE = 'unlimited_scale'
FEATURE_PRIORITY_SUPPORT = 'priority_support'
FEATURE_DEDICATED_ONBOARDING = 'dedicated_onboarding'
FEATURE_API_ACCESS = 'api_access'
FEATURE_CUSTOM_APP = 'custom_app'

# Réservés pour plus tard :
# supplier_payments, promotions, notifications_whatsapp,
# hr_advanced, accounting, ai_forecasting

FEATURE_LABELS = {
    FEATURE_BARCODE_SCANNER: 'Scanner code-barres',
    FEATURE_MULTI_BRANCH: 'Multi-boutiques / points de vente',
    FEATURE_MULTI_WAREHOUSE: 'Gestion multi-entrepôts',
    FEATURE_ONLINE_SHOP: 'Boutique en ligne',
    FEATURE_ROLES_PERMISSIONS: 'Rôles et permissions',
    FEATURE_ADVANCED_PURCHASES: 'Gestion des achats avancée',
    FEATURE_ADVANCED_REPORTS: 'Rapports avancés',
    FEATURE_EXPORT: 'Export Excel / PDF',
    FEATURE_POS_ADVANCED: 'Point de vente complet',
    FEATURE_CUSTOMER_CREDIT: 'Dettes clients',
    # Enterprise only (visibles via features=['all'])
    FEATURE_UNLIMITED_SCALE: 'Utilisateurs, boutiques, entrepôts et produits illimités',
    FEATURE_PRIORITY_SUPPORT: 'Assistance prioritaire',
    FEATURE_DEDICATED_ONBOARDING: 'Accompagnement et formation dédiés',
    FEATURE_API_ACCESS: 'Accès API & intégrations',
    FEATURE_CUSTOM_APP: 'Personnalisation avancée (marque / besoins)',
}

_BUSINESS_FEATURES = [
    FEATURE_BARCODE_SCANNER,
    FEATURE_MULTI_BRANCH,
    FEATURE_MULTI_WAREHOUSE,
    FEATURE_ONLINE_SHOP,
    FEATURE_ROLES_PERMISSIONS,
    FEATURE_ADVANCED_PURCHASES,
    FEATURE_ADVANCED_REPORTS,
    FEATURE_EXPORT,
    FEATURE_POS_ADVANCED,
    FEATURE_CUSTOMER_CREDIT,
]

_ENTERPRISE_EXTRA = [
    FEATURE_UNLIMITED_SCALE,
    FEATURE_PRIORITY_SUPPORT,
    FEATURE_DEDICATED_ONBOARDING,
    FEATURE_API_ACCESS,
    FEATURE_CUSTOM_APP,
]

ENTERPRISE_FEATURES = [*_BUSINESS_FEATURES, *_ENTERPRISE_EXTRA]

# --- Définition des packs ---
# max_* = 0 signifie illimité.
# max_branches = plafond de points de vente (hors siège).
# max_warehouses = plafond d'entrepôts de stockage (is_pos_stock=False).
PLAN_DEFINITIONS = [
    {
        'code': 'trial',
        'name': 'Essai gratuit',
        'price': 0,
        'price_annual': 0,
        'max_users': 1,
        'max_branches': 1,
        'max_warehouses': 1,
        'max_products': 50,
        'features': list(_BUSINESS_FEATURES),
        'is_public': False,
    },
    {
        'code': 'starter',
        'name': 'Pack Starter',
        'price': 3000,
        'price_annual': 30000,
        'max_users': 1,
        # 1 boutique principale + 1 entrepôt (stock de la boutique) — pas illimité.
        'max_branches': 1,
        'max_warehouses': 1,
        'max_products': 1000,
        # Boutique principale = POS + stock uniquement (pas multi-POS / boutique en ligne).
        'features': [],
        'is_public': True,
    },
    {
        'code': 'business',
        'name': 'Pack Business',
        'price': 5000,
        'price_annual': 50000,
        'max_users': 5,
        'max_branches': 5,
        'max_warehouses': 3,
        'max_products': 10000,
        'features': list(_BUSINESS_FEATURES),
        'is_public': True,
    },
    {
        'code': 'enterprise',
        'name': 'Pack Enterprise',
        'price': 10000,
        'price_annual': 100000,
        'max_users': 0,
        'max_branches': 0,
        'max_warehouses': 0,
        'max_products': 0,
        # Liste explicite : tout Business + exclusifs Enterprise.
        'features': list(ENTERPRISE_FEATURES),
        'is_public': True,
    },
]


def seed_plans():
    """Crée ou met à jour les packs. Idempotent."""
    from .models import SubscriptionPlan

    plans = {}
    for definition in PLAN_DEFINITIONS:
        plan, _ = SubscriptionPlan.objects.update_or_create(
            code=definition['code'],
            defaults={
                'name': definition['name'],
                'price': definition['price'],
                'price_annual': definition['price_annual'],
                'max_users': definition['max_users'],
                'max_branches': definition['max_branches'],
                'max_warehouses': definition['max_warehouses'],
                'max_products': definition['max_products'],
                'features': definition['features'],
                'is_public': definition['is_public'],
                'is_active': True,
            },
        )
        plans[definition['code']] = plan
    return plans
