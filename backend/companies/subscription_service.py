"""Helpers abonnement : reconduction cumulative, alertes d'échéance, tarifs."""

from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from django.utils import timezone

from .models import BillingCycle, SubscriptionStatus

# Seuils de rappel (jours restants)
EXPIRY_THRESHOLDS = (15, 7, 3)
EXPIRY_WARNING_DAYS = 15  # bandeau / expiring_soon

# Grâce post-expiration (affichage access_level ; enforcement = phase 2)
GRACE_READONLY_DAYS = 7   # J0–J6 : full→readonly conceptuel
GRACE_SALES_BLOCK_DAYS = 7  # dès J7 : sales_blocked
GRACE_SUSPEND_DAYS = 15     # dès J15 : suspended


def period_days(billing_cycle: str) -> int:
    if billing_cycle in (BillingCycle.ANNUAL, 'annual'):
        return 365
    return 30


def months_to_days(months: int) -> int:
    months = int(months or 1)
    if months >= 12:
        return 365
    return months * 30


def price_for_months(plan, months: int) -> Decimal:
    """Montant TTC pack pour une durée (remises engagement)."""
    months = int(months or 1)
    monthly = Decimal(str(plan.price or 0))
    annual = Decimal(str(plan.price_annual or 0))

    if months >= 12:
        if annual > 0:
            return annual.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        return (monthly * 10).quantize(Decimal('1'), rounding=ROUND_HALF_UP)  # ~−2 mois

    if months == 1:
        amount = monthly
    elif months == 3:
        amount = monthly * 3 * Decimal('0.95')  # −5 %
    elif months == 6:
        amount = monthly * 6 * Decimal('0.90')  # −10 %
    else:
        amount = monthly * months

    return amount.quantize(Decimal('1'), rounding=ROUND_HALF_UP)


def discount_label(months: int) -> str:
    months = int(months or 1)
    if months >= 12:
        return 'Économisez 2 mois'
    if months == 3:
        return '−5 %'
    if months == 6:
        return '−10 %'
    return ''


def days_remaining(subscription) -> Optional[int]:
    if not subscription.end_date:
        return None
    today = timezone.now().date()
    return (subscription.end_date - today).days


def grace_day(subscription) -> int:
    """Jours depuis expiration (0 si encore actif ou pas de date)."""
    remaining = days_remaining(subscription)
    if remaining is None or remaining >= 0:
        return 0
    return abs(remaining)


def access_level(subscription) -> str:
    """full | readonly | sales_blocked | suspended (calculé)."""
    if subscription.status == SubscriptionStatus.SUSPENDED:
        return 'suspended'
    if subscription.status == SubscriptionStatus.CANCELLED:
        return 'suspended'

    remaining = days_remaining(subscription)
    if remaining is None:
        return 'full'
    if remaining >= 0:
        return 'full'

    days_expired = abs(remaining)
    if days_expired >= GRACE_SUSPEND_DAYS:
        return 'suspended'
    if days_expired >= GRACE_SALES_BLOCK_DAYS:
        return 'sales_blocked'
    return 'readonly'


def is_expiring_soon(subscription, within_days=EXPIRY_WARNING_DAYS) -> bool:
    remaining = days_remaining(subscription)
    if remaining is None:
        return False
    return 0 <= remaining <= within_days


def display_status(subscription) -> str:
    """Statut métier pour l'UI."""
    if subscription.status == SubscriptionStatus.SUSPENDED:
        return 'suspended'
    if subscription.status == SubscriptionStatus.CANCELLED:
        return 'cancelled'
    if subscription.status == SubscriptionStatus.TRIAL and subscription.is_valid():
        return 'trial'

    remaining = days_remaining(subscription)
    if remaining is not None and remaining < 0:
        level = access_level(subscription)
        if level == 'suspended':
            return 'suspended'
        return 'expired'
    if is_expiring_soon(subscription, within_days=7):
        return 'expiring_soon'
    if subscription.is_valid():
        return 'active'
    return 'expired'


def apply_plan_period(subscription, plan, billing_cycle: str = 'monthly', months: int = None):
    """Applique un pack et prolonge la période (additionne au reste éventuel).

    months: 1, 3, 6 ou 12. Si None, dérivé du billing_cycle (1 ou 12).
    """
    today = timezone.now().date()
    if months is None:
        months = 12 if billing_cycle in (BillingCycle.ANNUAL, 'annual') else 1
    months = int(months)
    if months not in (1, 3, 6, 12):
        months = 1

    duration = months_to_days(months)

    if subscription.end_date and subscription.end_date > today:
        base = subscription.end_date
    else:
        base = today
        subscription.start_date = today

    subscription.plan = plan
    subscription.billing_cycle = (
        BillingCycle.ANNUAL if months >= 12 else BillingCycle.MONTHLY
    )
    subscription.status = SubscriptionStatus.ACTIVE
    subscription.end_date = base + timedelta(days=duration)
    subscription.save()
    return subscription


def _expiry_message(subscription, remaining: int):
    plan_name = subscription.plan.name
    end = subscription.end_date
    if remaining < 0:
        return (
            'Abonnement expiré',
            f'Votre pack {plan_name} a expiré le {end}. '
            'Renouvelez maintenant pour continuer sans perdre vos données.',
            'expired',
        )
    if remaining <= 3:
        return (
            'Attention — expiration imminente',
            f'Votre abonnement {plan_name} expire dans {remaining} jour(s) (le {end}).',
            'day_3',
        )
    if remaining <= 7:
        return (
            'Plus que 7 jours',
            f'Plus que {remaining} jour(s) avant expiration de {plan_name} (le {end}).',
            'day_7',
        )
    # 8–15
    return (
        'Abonnement bientôt terminé',
        f'Votre abonnement expire dans {remaining} jour(s) (le {end}).',
        'day_15',
    )


def ensure_expiry_notifications(subscription):
    """Notifs 15 / 7 / 3 jours et expiré (1× / jour / seuil)."""
    remaining = days_remaining(subscription)
    if remaining is None:
        return
    if remaining > EXPIRY_WARNING_DAYS:
        return

    from accounts.models import User
    from notifications.models import Notification, NotificationType
    from notifications.services import create_notification

    today = timezone.now().date()
    title, message, threshold_key = _expiry_message(subscription, remaining)

    recipients = User.objects.filter(company=subscription.company, is_active=True)
    for user in recipients:
        already = Notification.objects.filter(
            user=user,
            notification_type=NotificationType.SYSTEM,
            data__kind='subscription_expiry',
            data__threshold=threshold_key,
            created_at__date=today,
        ).exists()
        if already:
            continue
        create_notification(
            user=user,
            notification_type=NotificationType.SYSTEM,
            title=title,
            message=message,
            data={
                'kind': 'subscription_expiry',
                'threshold': threshold_key,
                'link': '/subscription',
                'days_remaining': remaining,
                'end_date': str(subscription.end_date),
            },
        )


def ensure_stock_alert_notifications(company, summary):
    """Notif résumé stock (1× / jour) s'il y a des alertes."""
    count = summary.get('count') or 0
    if count <= 0:
        return

    from notifications.models import Notification, NotificationType
    from notifications.services import company_notification_recipients, create_notification

    today = timezone.now().date()
    low = summary.get('low_stock') or 0
    out = summary.get('out_of_stock') or 0
    title = 'Alertes stock'
    message = (
        f'{count} produit(s) à surveiller : {out} rupture(s), {low} stock(s) faible(s).'
    )

    for user in company_notification_recipients(company, permission='GS'):
        already = Notification.objects.filter(
            user=user,
            notification_type=NotificationType.LOW_STOCK,
            data__kind='stock_alerts_summary',
            created_at__date=today,
        ).exists()
        if already:
            continue
        create_notification(
            user=user,
            notification_type=NotificationType.LOW_STOCK,
            title=title,
            message=message,
            data={
                'kind': 'stock_alerts_summary',
                'link': '/stock',
                'count': count,
                'low_stock': low,
                'out_of_stock': out,
            },
        )


def renewal_options(plan):
    """Options 1/3/6/12 mois pour l'UI."""
    options = []
    for months in (1, 3, 6, 12):
        options.append({
            'months': months,
            'label': f'{months} mois' if months > 1 else '1 mois',
            'amount': str(price_for_months(plan, months)),
            'discount_label': discount_label(months),
        })
    return options
