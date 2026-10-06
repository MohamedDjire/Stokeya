from django.conf import settings
from django.db import models

from common.models import CompanyScopedModel, TimeStampedModel


class LoyaltyLevel(models.TextChoices):
    BRONZE = 'bronze', 'Bronze'
    SILVER = 'silver', 'Argent'
    GOLD = 'gold', 'Or'
    PLATINUM = 'platinum', 'Platine'


class CustomerGender(models.TextChoices):
    MALE = 'male', 'Homme'
    FEMALE = 'female', 'Femme'
    OTHER = 'other', 'Autre'
    UNSPECIFIED = '', 'Non précisé'


class Customer(CompanyScopedModel):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, blank=True, db_index=True)
    whatsapp = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    photo = models.ImageField(upload_to='customers/', blank=True, null=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    commune = models.CharField(max_length=100, blank=True)
    quartier = models.CharField(max_length=100, blank=True)
    landmark = models.CharField(max_length=200, blank=True)
    gender = models.CharField(max_length=20, blank=True, default='')
    profession = models.CharField(max_length=120, blank=True)
    company_name = models.CharField(max_length=200, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    loyalty_points = models.PositiveIntegerField(default=0)
    loyalty_level = models.CharField(
        max_length=20, choices=LoyaltyLevel.choices, default=LoyaltyLevel.BRONZE,
    )
    score = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    last_order_at = models.DateTimeField(null=True, blank=True)
    orders_count = models.PositiveIntegerField(default=0)
    total_spent = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'phone'],
                name='uniq_customer_company_phone',
                condition=models.Q(phone__isnull=False) & ~models.Q(phone=''),
            ),
        ]

    def __str__(self):
        return self.name


class CustomerAddress(TimeStampedModel):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=50, default='Domicile')
    address = models.TextField()
    city = models.CharField(max_length=100, blank=True)
    commune = models.CharField(max_length=100, blank=True)
    quartier = models.CharField(max_length=100, blank=True)
    landmark = models.CharField(max_length=200, blank=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ['-is_default', 'label']

    def __str__(self):
        return f'{self.label} — {self.customer.name}'


class CustomerTag(CompanyScopedModel):
    name = models.CharField(max_length=80)
    color = models.CharField(max_length=20, default='#0D9488')
    is_system = models.BooleanField(default=False)
    code = models.SlugField(max_length=40, blank=True)

    class Meta:
        ordering = ['name']
        unique_together = ['company', 'name']

    def __str__(self):
        return self.name


class CustomerTagAssignment(TimeStampedModel):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='tag_assignments')
    tag = models.ForeignKey(CustomerTag, on_delete=models.CASCADE, related_name='assignments')

    class Meta:
        unique_together = ['customer', 'tag']


class CustomerNote(TimeStampedModel):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='notes')
    content = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_notes',
    )
    is_private = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']


class LoyaltySettings(CompanyScopedModel):
    """One settings row per company (enforced in service layer)."""
    points_per_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=1000,
        help_text='Montant FCFA pour 1 point',
    )
    bronze_max = models.PositiveIntegerField(default=100)
    silver_max = models.PositiveIntegerField(default=500)
    gold_max = models.PositiveIntegerField(default=1500)
    active_days = models.PositiveIntegerField(default=60)
    inactive_days = models.PositiveIntegerField(default=90)

    class Meta:
        verbose_name_plural = 'loyalty settings'


class LoyaltyTransaction(TimeStampedModel):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='loyalty_transactions')
    points = models.IntegerField()
    balance_after = models.PositiveIntegerField(default=0)
    reason = models.CharField(max_length=200, blank=True)
    reference = models.CharField(max_length=80, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='loyalty_transactions',
    )

    class Meta:
        ordering = ['-created_at']


class CustomerPayment(CompanyScopedModel):
    """Encaissement sur dette client (hors paiement immédiat POS)."""
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name='credit_payments',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, default='cash')
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_payments',
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.customer_id} — {self.amount}'


class AbandonedCart(CompanyScopedModel):
    customer = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='abandoned_carts',
    )
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.SET_NULL, null=True, blank=True, related_name='abandoned_carts',
    )
    session_key = models.CharField(max_length=64, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    customer_name = models.CharField(max_length=200, blank=True)
    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    recovered = models.BooleanField(default=False)
    recovered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']


class AbandonedCartItem(TimeStampedModel):
    cart = models.ForeignKey(AbandonedCart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        'products.Product', on_delete=models.SET_NULL, null=True, blank=True,
    )
    product_name = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    @property
    def line_total(self):
        return self.quantity * self.unit_price
