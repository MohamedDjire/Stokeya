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
    expiry_date = models.DateField(null=True, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)

    class Meta:
        verbose_name_plural = 'product batches'
        unique_together = ['product', 'batch_number']

    def __str__(self):
        return f'{self.product.name} — {self.batch_number}'
