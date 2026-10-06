from django.db import models
from common.models import TimeStampedModel, CompanyScopedModel


class NotificationType(models.TextChoices):
    LOW_STOCK = 'low_stock', 'Stock faible'
    PAYMENT_DUE = 'payment_due', 'Paiement en retard'
    SALE = 'sale', 'Vente'
    SHOP_ORDER = 'shop_order', 'Commande boutique'
    SYSTEM = 'system', 'Système'
    PROMOTION = 'promotion', 'Promotion'


class Notification(TimeStampedModel):
    user = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='notifications'
    )
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices)
    title = models.CharField(max_length=200)
    message = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', '-created_at']),
        ]

    def __str__(self):
        return self.title


class NotificationRule(CompanyScopedModel):
    event_type = models.CharField(max_length=50)
    threshold = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['event_type']

    def __str__(self):
        return f'{self.event_type} ({self.company.name})'
