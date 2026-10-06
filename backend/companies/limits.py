"""Helpers pour les limites de plan et l'accès aux fonctionnalités."""

from rest_framework.exceptions import PermissionDenied

from .models import SubscriptionPlan


class LimitReached(PermissionDenied):
    """Levée quand une limite de plan est atteinte (HTTP 403)."""


def get_subscription(company):
    return getattr(company, 'subscription', None)


def get_plan(company):
    sub = get_subscription(company)
    return sub.plan if sub else None


def company_has_feature(company, feature_code):
    sub = get_subscription(company)
    if not sub:
        return False
    return sub.has_feature(feature_code)


def _count_or_limit_error(*, current, limit, label):
    """limit == 0 => illimité."""
    if limit and current >= limit:
        raise LimitReached(
            f"Limite de votre abonnement atteinte : {label} "
            f"({current}/{limit}). Passez à un pack supérieur pour continuer."
        )


def check_can_add_product(company):
    from products.models import Product

    plan = get_plan(company)
    if not plan:
        return
    _count_or_limit_error(
        current=Product.objects.filter(company=company).count(),
        limit=plan.max_products,
        label='produits',
    )


def check_can_add_products(company, count):
    """Vérifie qu'on peut ajouter `count` produits (utilisé par l'import)."""
    from products.models import Product

    plan = get_plan(company)
    if not plan or not plan.max_products:
        return
    current = Product.objects.filter(company=company).count()
    if current + count > plan.max_products:
        available = max(plan.max_products - current, 0)
        raise LimitReached(
            f"Votre pack autorise {plan.max_products} produits "
            f"(déjà {current}). Vous ne pouvez importer que {available} produit(s) "
            f"supplémentaire(s). Passez à un pack supérieur."
        )


def remaining_products(company):
    from products.models import Product

    plan = get_plan(company)
    if not plan or not plan.max_products:
        return None  # illimité
    return max(plan.max_products - Product.objects.filter(company=company).count(), 0)


def check_can_add_branch(company):
    """Plafond de points de vente (hors boutique principale)."""
    from branches.models import Branch
    from .plans import FEATURE_MULTI_BRANCH

    plan = get_plan(company)
    if not plan:
        return
    if not company_has_feature(company, FEATURE_MULTI_BRANCH):
        raise LimitReached(
            'Les points de vente supplémentaires nécessitent le pack Business (5 000 F) '
            'ou supérieur. Sur le Pack Starter, votre boutique principale sert déjà '
            'de point de vente et d\'entrepôt.'
        )
    current = Branch.objects.filter(company=company, is_main=False).count()
    _count_or_limit_error(
        current=current,
        limit=plan.max_branches,
        label='points de vente',
    )


def check_can_add_warehouse(company, is_pos_stock=False):
    """Plafond d'entrepôts de stockage (hors stock POS des boutiques)."""
    if is_pos_stock:
        return
    from warehouses.models import Warehouse
    from .plans import FEATURE_MULTI_WAREHOUSE

    plan = get_plan(company)
    if not plan:
        return
    if not company_has_feature(company, FEATURE_MULTI_WAREHOUSE):
        raise LimitReached(
            'Les entrepôts de stockage nécessitent le pack Business (5 000 F) ou supérieur. '
            'Sur le Pack Starter, le stock est géré dans votre boutique principale.'
        )
    storage_count = Warehouse.objects.filter(
        branch__company=company, is_pos_stock=False,
    ).count()
    _count_or_limit_error(
        current=storage_count,
        limit=plan.max_warehouses,
        label='entrepôts',
    )


def check_can_use_online_shop(company):
    from .plans import FEATURE_ONLINE_SHOP

    if not company_has_feature(company, FEATURE_ONLINE_SHOP):
        raise LimitReached(
            'La boutique en ligne est disponible à partir du pack Business (5 000 F / mois). '
            'Passez à un pack supérieur pour l\'activer.'
        )


def check_can_add_user(company):
    from accounts.models import User

    plan = get_plan(company)
    if not plan:
        return
    _count_or_limit_error(
        current=User.objects.filter(company=company).count(),
        limit=plan.max_users,
        label='utilisateurs',
    )


def require_feature(company, feature_code):
    if not company_has_feature(company, feature_code):
        raise LimitReached(
            'Cette fonctionnalité nécessite un pack supérieur '
            '(Business 5 000 F ou Enterprise).'
        )


def usage_summary(company):
    from accounts.models import User
    from branches.models import Branch
    from products.models import Product
    from warehouses.models import Warehouse

    plan = get_plan(company)

    def fmt(current, limit):
        return {
            'used': current,
            'limit': limit,
            'unlimited': SubscriptionPlan.is_unlimited(limit) if plan else True,
        }

    return {
        'users': fmt(User.objects.filter(company=company).count(), plan.max_users if plan else 0),
        'branches': fmt(
            Branch.objects.filter(company=company, is_main=False).count(),
            plan.max_branches if plan else 0,
        ),
        'warehouses': fmt(
            Warehouse.objects.filter(branch__company=company, is_pos_stock=False).count(),
            getattr(plan, 'max_warehouses', 0) if plan else 0,
        ),
        'products': fmt(Product.objects.filter(company=company).count(), plan.max_products if plan else 0),
    }
