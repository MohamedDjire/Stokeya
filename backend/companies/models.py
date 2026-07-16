from django.db import models
from common.models import TimeStampedModel

UNLIMITED = 0  # convention: 0 = illimité pour les champs de limite


class SubscriptionPlan(TimeStampedModel):
    code = models.CharField(max_length=30, blank=True, db_index=True)
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    price_annual = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_users = models.PositiveIntegerField(default=5)
    max_branches = models.PositiveIntegerField(default=1)
    max_products = models.PositiveIntegerField(default=500)
    features = models.JSONField(default=list, blank=True)
    is_public = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['price']

    def __str__(self):
        return self.name

    def has_feature(self, feature_code):
        return 'all' in self.features or feature_code in self.features

    @staticmethod
    def is_unlimited(value):
        return value == UNLIMITED


class Company(TimeStampedModel):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    logo = models.ImageField(upload_to='companies/logos/', blank=True, null=True)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    country = models.CharField(max_length=100, default='SN')
    currency = models.CharField(max_length=3, default='XOF')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'companies'
        ordering = ['name']

    def __str__(self):
        return self.name


class SubscriptionStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    TRIAL = 'trial', 'Essai'
    SUSPENDED = 'suspended', 'Suspendue'
    CANCELLED = 'cancelled', 'Annulée'


class BillingCycle(models.TextChoices):
    MONTHLY = 'monthly', 'Mensuel'
    ANNUAL = 'annual', 'Annuel'


class Subscription(TimeStampedModel):
    company = models.OneToOneField(
        Company, on_delete=models.CASCADE, related_name='subscription'
    )
    plan = models.ForeignKey(
        SubscriptionPlan, on_delete=models.PROTECT, related_name='subscriptions'
    )
    status = models.CharField(
        max_length=20, choices=SubscriptionStatus.choices, default=SubscriptionStatus.TRIAL
    )
    billing_cycle = models.CharField(
        max_length=10, choices=BillingCycle.choices, default=BillingCycle.MONTHLY
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f'{self.company.name} — {self.plan.name}'

    def is_valid(self):
        from django.utils import timezone
        if self.status in (SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED):
            return False
        if self.end_date and self.end_date < timezone.now().date():
            return False
        return True

    def has_feature(self, feature_code):
        return self.is_valid() and self.plan.has_feature(feature_code)
