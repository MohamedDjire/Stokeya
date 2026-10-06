"""Création et diffusion des notifications in-app."""

from accounts.models import User
from accounts.utils import user_has_permission

from .models import Notification, NotificationType

# Permission ventes (Commandes boutique / POS).
SALES_PERMISSION = 'GV'


def company_notification_recipients(company, *, permission=SALES_PERMISSION):
    """Utilisateurs actifs de l'entreprise qui doivent être alertés."""
    users = User.objects.filter(company=company, is_active=True)
    return [u for u in users if user_has_permission(u, permission)]


def create_notification(
    *,
    user,
    notification_type,
    title,
    message,
    data=None,
):
    return Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        data=data or {},
    )


def notify_users(users, *, notification_type, title, message, data=None):
    created = []
    payload = data or {}
    for user in users:
        created.append(
            create_notification(
                user=user,
                notification_type=notification_type,
                title=title,
                message=message,
                data=payload,
            )
        )
    return created


def notify_company(
    company,
    *,
    notification_type,
    title,
    message,
    data=None,
    permission=SALES_PERMISSION,
):
    recipients = company_notification_recipients(company, permission=permission)
    return notify_users(
        recipients,
        notification_type=notification_type,
        title=title,
        message=message,
        data=data,
    )


def notify_new_shop_order(order):
    """Alerte l'équipe quand une commande boutique arrive."""
    customer = f'{order.first_name} {order.last_name}'.strip() or order.phone or 'Client'
    title = 'Nouvelle commande boutique'
    message = (
        f'{order.reference} — {customer} · {order.total} F '
        f'({order.items.count()} article(s))'
    )
    return notify_company(
        order.company,
        notification_type=NotificationType.SHOP_ORDER,
        title=title,
        message=message,
        data={
            'order_id': order.id,
            'reference': order.reference,
            'link': '/orders',
            'total': str(order.total),
            'status': order.status,
        },
    )
