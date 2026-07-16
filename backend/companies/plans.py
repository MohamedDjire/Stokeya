"""Catalogue des fonctionnalités et définition des packs Inventra.

Les fonctionnalités « cœur » (produits, catégories, stock, ventes simples,
clients, fournisseurs, tableau de bord, ticket, sauvegarde) sont disponibles
sur TOUS les packs et ne sont donc pas listées ici.

Ce fichier ne liste que les fonctionnalités « premium » qui s'activent /
désactivent selon le pack. Le code `all` sur un pack débloque tout.
"""

# --- Codes de fonctionnalités premium ---
FEATURE_BARCODE_SCANNER = 'barcode_scanner'
FEATURE_MULTI_BRANCH = 'multi_branch'
FEATURE_ROLES_PERMISSIONS = 'roles_permissions'
FEATURE_ADVANCED_PURCHASES = 'advanced_purchases'
FEATURE_CUSTOMER_CREDIT = 'customer_credit'
FEATURE_SUPPLIER_PAYMENTS = 'supplier_payments'
FEATURE_ADVANCED_REPORTS = 'advanced_reports'
FEATURE_EXPORT = 'export_excel_pdf'
FEATURE_PROMOTIONS = 'promotions'
FEATURE_NOTIFICATIONS_WHATSAPP = 'notifications_whatsapp'
FEATURE_POS_ADVANCED = 'pos_advanced'
FEATURE_MULTI_WAREHOUSE = 'multi_warehouse'
FEATURE_HR_ADVANCED = 'hr_advanced'
FEATURE_ACCOUNTING = 'accounting'
FEATURE_AI_FORECASTING = 'ai_forecasting'
FEATURE_API_ACCESS = 'api_access'
FEATURE_CUSTOM_APP = 'custom_app'
FEATURE_PRIORITY_SUPPORT = 'priority_support'

FEATURE_LABELS = {
    FEATURE_BARCODE_SCANNER: 'Scanner code-barres',
    FEATURE_MULTI_BRANCH: 'Multi-boutiques',
    FEATURE_ROLES_PERMISSIONS: 'Rôles et permissions',
    FEATURE_ADVANCED_PURCHASES: 'Gestion des achats avancée',
    FEATURE_CUSTOMER_CREDIT: 'Gestion des dettes clients',
    FEATURE_SUPPLIER_PAYMENTS: 'Paiements fournisseurs',
    FEATURE_ADVANCED_REPORTS: 'Rapports avancés',
    FEATURE_EXPORT: 'Export Excel / PDF',
    FEATURE_PROMOTIONS: 'Promotions et réductions',
    FEATURE_NOTIFICATIONS_WHATSAPP: 'Notifications WhatsApp / email',
    FEATURE_POS_ADVANCED: 'Point de vente complet',
    FEATURE_MULTI_WAREHOUSE: 'Gestion multi-entrepôts',
    FEATURE_HR_ADVANCED: 'Gestion avancée des employés',
    FEATURE_ACCOUNTING: 'Comptabilité avancée',
    FEATURE_AI_FORECASTING: 'Intelligence artificielle (prévisions)',
    FEATURE_API_ACCESS: 'Accès API développeur',
    FEATURE_CUSTOM_APP: 'Application personnalisée',
    FEATURE_PRIORITY_SUPPORT: 'Assistance prioritaire',
}

_BUSINESS_FEATURES = [
    FEATURE_BARCODE_SCANNER,
    FEATURE_MULTI_BRANCH,
    FEATURE_ROLES_PERMISSIONS,
    FEATURE_ADVANCED_PURCHASES,
    FEATURE_CUSTOMER_CREDIT,
    FEATURE_SUPPLIER_PAYMENTS,
    FEATURE_ADVANCED_REPORTS,
    FEATURE_EXPORT,
    FEATURE_PROMOTIONS,
    FEATURE_NOTIFICATIONS_WHATSAPP,
    FEATURE_POS_ADVANCED,
]

# --- Définition des packs ---
# max_* = 0 signifie illimité.
PLAN_DEFINITIONS = [
    {
        'code': 'trial',
        'name': 'Essai gratuit',
        'price': 0,
        'price_annual': 0,
        'max_users': 1,
        'max_branches': 1,
        'max_products': 50,
        'features': _BUSINESS_FEATURES,  # essai = accès Business pour tester
        'is_public': False,
    },
    {
        'code': 'starter',
        'name': 'Pack Starter',
        'price': 3000,
        'price_annual': 30000,
        'max_users': 1,
        'max_branches': 1,
        'max_products': 1000,
        'features': [],
        'is_public': True,
    },
    {
        'code': 'business',
        'name': 'Pack Business',
        'price': 5000,
        'price_annual': 50000,
        'max_users': 5,
        'max_branches': 3,
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
        'max_products': 0,
        'features': ['all'],
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
                'max_products': definition['max_products'],
                'features': definition['features'],
                'is_public': definition['is_public'],
                'is_active': True,
            },
        )
        plans[definition['code']] = plan
    return plans
