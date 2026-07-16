from django.db import models
from common.models import TimeStampedModel


class PaymentProvider(models.TextChoices):
    WAVE = 'wave', 'Wave'
    ORANGE_MONEY = 'orange_money', 'Orange Money'
    MTN_MONEY = 'mtn_money', 'MTN Money'


class CheckoutStatus(models.TextChoices):
    PENDING = 'pending', 'En attente'
    COMPLETED = 'completed', 'Payé'
    FAILED = 'failed', 'Échoué'
    EXPIRED = 'expired', 'Expiré'


# Alias rétrocompatibilité
WaveCheckoutStatus = CheckoutStatus


class WaveCheckout(TimeStampedModel):
    sale = models.ForeignKey(
        'sales.Sale', on_delete=models.CASCADE, related_name='wave_checkouts'
    )
    provider = models.CharField(
        max_length=20,
        choices=PaymentProvider.choices,
        default=PaymentProvider.WAVE,
        db_index=True,
    )
    session_id = models.CharField(max_length=100, unique=True, blank=True)
    client_reference = models.CharField(max_length=100, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='XOF')
    wave_launch_url = models.URLField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=CheckoutStatus.choices,
        default=CheckoutStatus.PENDING,
    )
    raw_response = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def launch_url(self):
        return self.wave_launch_url

    def __str__(self):
        return f'{self.provider} {self.client_reference} — {self.status}'


class WaveWebhookEvent(TimeStampedModel):
    event_id = models.CharField(max_length=200, unique=True)
    event_type = models.CharField(max_length=100)
    payload = models.JSONField(default=dict)
    processed = models.BooleanField(default=False)
    provider = models.CharField(
        max_length=20,
        choices=PaymentProvider.choices,
        default=PaymentProvider.WAVE,
    )

    def __str__(self):
        return self.event_id


class SubscriptionWaveCheckout(TimeStampedModel):
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='subscription_wave_checkouts'
    )
    plan = models.ForeignKey(
        'companies.SubscriptionPlan', on_delete=models.PROTECT, related_name='wave_checkouts'
    )
    billing_cycle = models.CharField(max_length=10, default='monthly')
    provider = models.CharField(
        max_length=20,
        choices=PaymentProvider.choices,
        default=PaymentProvider.WAVE,
        db_index=True,
    )
    session_id = models.CharField(max_length=100, unique=True, blank=True)
    client_reference = models.CharField(max_length=100, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='XOF')
    wave_launch_url = models.URLField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=CheckoutStatus.choices,
        default=CheckoutStatus.PENDING,
    )
    raw_response = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def launch_url(self):
        return self.wave_launch_url

    def __str__(self):
        return f'Abonnement {self.provider} {self.client_reference} — {self.status}'
