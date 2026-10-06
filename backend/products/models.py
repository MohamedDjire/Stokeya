from decimal import Decimal

from django.db import models
from common.models import CompanyScopedModel


class Product(CompanyScopedModel):
    name = models.CharField(max_length=300)
    sku = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        'categories.Category',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
    )
    brand = models.ForeignKey(
        'brands.Brand',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
    )
    unit = models.ForeignKey(
        'units.Unit',
        on_delete=models.PROTECT,
        related_name='products',
    )
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sale_price = models.DecimalField(max_digits=12, decimal_places=2)
    wholesale_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    wholesale_min_qty = models.DecimalField(
        max_digits=10, decimal_places=3, default=10,
        help_text='Quantité à partir de laquelle le prix de gros s’applique.',
    )

    class WholesaleDiscountType(models.TextChoices):
        PRICE = 'price', 'Prix unitaire gros'
        PERCENT = 'percent', 'Réduction en %'
        AMOUNT = 'amount', 'Réduction en francs'

    wholesale_discount_type = models.CharField(
        max_length=16, choices=WholesaleDiscountType.choices,
        default=WholesaleDiscountType.PRICE,
    )
    wholesale_discount_value = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text='Pourcentage ou montant de réduction (selon le type).',
    )
    packaging = models.CharField(
        max_length=50, blank=True, default='unité',
        help_text='Conditionnement : unité, carton, sac, caisse…',
    )
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    min_stock = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    max_stock = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    track_batches = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['company', 'sku']),
            models.Index(fields=['company', 'name']),
        ]

    def resolved_wholesale_unit_price(self):
        from decimal import Decimal
        sale = self.sale_price or Decimal('0')
        dtype = self.wholesale_discount_type or self.WholesaleDiscountType.PRICE
        value = self.wholesale_discount_value
        if dtype == self.WholesaleDiscountType.PERCENT and value and value > 0:
            price = sale * (Decimal('100') - value) / Decimal('100')
        elif dtype == self.WholesaleDiscountType.AMOUNT and value and value > 0:
            price = sale - value
        else:
            price = self.wholesale_price
        if price is None or price <= 0:
            return None
        return price.quantize(Decimal('0.01'))

    def unit_price_for_qty(self, quantity):
        from decimal import Decimal
        qty = Decimal(str(quantity))
        wholesale = self.resolved_wholesale_unit_price()
        min_qty = self.wholesale_min_qty if self.wholesale_min_qty is not None else Decimal('10')
        if wholesale and qty >= min_qty:
            return wholesale
        return self.sale_price

    def __str__(self):
        return self.name


class Barcode(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='barcodes')
    code = models.CharField(max_length=100, db_index=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        unique_together = ['product', 'code']

    def __str__(self):
        return self.code


class ProductBatch(CompanyScopedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='batches')
    batch_number = models.CharField(max_length=100)
    manufactured_at = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='batches',
    )
    location = models.ForeignKey(
        'warehouses.WarehouseLocation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='batches',
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='batches',
    )

    class Meta:
        verbose_name_plural = 'product batches'
        unique_together = ['product', 'batch_number']

    def __str__(self):
        return f'{self.product.name} — {self.batch_number}'


class ProductImportBatch(CompanyScopedModel):
    """Historique d'un import produits (wizard + annulation 30 min)."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Brouillon'
        ANALYZED = 'analyzed', 'Analysé'
        VALIDATED = 'validated', 'Validé'
        COMPLETED = 'completed', 'Terminé'
        CANCELLED = 'cancelled', 'Annulé'

    class DuplicatePolicy(models.TextChoices):
        IGNORE = 'ignore', 'Ignorer'
        UPDATE = 'update', 'Mettre à jour'
        ASK = 'ask', 'Demander'

    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='product_imports',
    )
    filename = models.CharField(max_length=255)
    file = models.FileField(upload_to='product_imports/', blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT,
    )
    headers = models.JSONField(default=list, blank=True)
    column_mapping = models.JSONField(default=dict, blank=True)
    duplicate_policy = models.CharField(
        max_length=20, choices=DuplicatePolicy.choices, default=DuplicatePolicy.IGNORE,
    )
    auto_create_related = models.BooleanField(default=True)
    total_rows = models.PositiveIntegerField(default=0)
    created_count = models.PositiveIntegerField(default=0)
    updated_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    errors = models.JSONField(default=list, blank=True)
    created_product_ids = models.JSONField(default=list, blank=True)
    updated_product_ids = models.JSONField(default=list, blank=True)
    can_undo_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Import {self.filename} ({self.status})'
