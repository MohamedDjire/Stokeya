from django.db import models
from common.models import CompanyScopedModel, TimeStampedModel


class SaleStatus(models.TextChoices):
    DRAFT = 'draft', 'Brouillon'
    COMPLETED = 'completed', 'Terminée'
    CANCELLED = 'cancelled', 'Annulée'
    RETURNED = 'returned', 'Retournée'


class PaymentStatus(models.TextChoices):
    UNPAID = 'unpaid', 'Non payée'
    PARTIAL = 'partial', 'Partiellement payée'
    PAID = 'paid', 'Payée'


class Sale(CompanyScopedModel):
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.PROTECT, related_name='sales'
    )
    cash_register = models.ForeignKey(
        'branches.CashRegister',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales',
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales',
    )
    seller = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='sales',
    )
    reference = models.CharField(max_length=50)
    status = models.CharField(
        max_length=20, choices=SaleStatus.choices, default=SaleStatus.COMPLETED
    )
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PAID
    )
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    is_offline = models.BooleanField(default=False)
    synced_at = models.DateTimeField(null=True, blank=True)
    client_reference = models.CharField(
        max_length=64, blank=True, null=True,
        help_text='Référence locale (idempotence sync offline).',
    )

    class Meta:
        ordering = ['-created_at']
        unique_together = ['company', 'reference']
        indexes = [
            models.Index(fields=['company', 'created_at']),
            models.Index(fields=['company', 'client_reference']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'client_reference'],
                name='uniq_sale_client_reference',
                condition=models.Q(client_reference__isnull=False) & ~models.Q(client_reference=''),
            ),
        ]

    def __str__(self):
        return self.reference


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        'products.Product', on_delete=models.PROTECT, related_name='sale_items'
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f'{self.product.name} x {self.quantity}'


class PaymentMethod(models.TextChoices):
    CASH = 'cash', 'Espèces'
    MOBILE_MONEY = 'mobile_money', 'Mobile Money'
    CARD = 'card', 'Carte bancaire'
    CREDIT = 'credit', 'Crédit'
    OTHER = 'other', 'Autre'


class Payment(TimeStampedModel):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='payments')
    method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, default='completed')

    def __str__(self):
        return f'{self.method} — {self.amount}'


class ReturnStatus(models.TextChoices):
    PENDING = 'pending', 'En attente'
    APPROVED = 'approved', 'Approuvé'
    REJECTED = 'rejected', 'Rejeté'


class SaleReturn(CompanyScopedModel):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='returns')
    reason = models.TextField()
    status = models.CharField(
        max_length=20, choices=ReturnStatus.choices, default=ReturnStatus.PENDING
    )
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    processed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='processed_returns',
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Retour {self.sale.reference}'


class SaleReturnItem(models.Model):
    sale_return = models.ForeignKey(
        SaleReturn, on_delete=models.CASCADE, related_name='items'
    )
    sale_item = models.ForeignKey(
        SaleItem, on_delete=models.CASCADE, related_name='return_items'
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3)

    def __str__(self):
        return f'{self.sale_item.product.name} x {self.quantity}'
