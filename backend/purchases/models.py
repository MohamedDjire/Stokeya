from django.db import models
from common.models import CompanyScopedModel, TimeStampedModel


class OrderStatus(models.TextChoices):
    DRAFT = 'draft', 'Brouillon'
    ORDERED = 'ordered', 'Commandée'
    PARTIAL = 'partial', 'Partiellement reçue'
    RECEIVED = 'received', 'Reçue'
    CANCELLED = 'cancelled', 'Annulée'


class PurchaseOrder(CompanyScopedModel):
    supplier = models.ForeignKey(
        'suppliers.Supplier', on_delete=models.PROTECT, related_name='purchase_orders'
    )
    reference = models.CharField(max_length=50)
    status = models.CharField(
        max_length=20, choices=OrderStatus.choices, default=OrderStatus.DRAFT
    )
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    expected_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='purchase_orders',
    )

    class Meta:
        ordering = ['-created_at']
        unique_together = ['company', 'reference']

    def __str__(self):
        return self.reference


class PurchaseOrderItem(models.Model):
    order = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name='items'
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.PROTECT, related_name='purchase_items'
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_received = models.DecimalField(max_digits=10, decimal_places=3, default=0)

    def __str__(self):
        return f'{self.product.name} x {self.quantity}'


class GoodsReceipt(TimeStampedModel):
    order = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name='receipts'
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse', on_delete=models.PROTECT, related_name='goods_receipts'
    )
    reference = models.CharField(max_length=50)
    received_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='goods_receipts',
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.reference


class GoodsReceiptItem(models.Model):
    receipt = models.ForeignKey(
        GoodsReceipt, on_delete=models.CASCADE, related_name='items'
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.PROTECT, related_name='receipt_items'
    )
    quantity_received = models.DecimalField(max_digits=10, decimal_places=3)

    def __str__(self):
        return f'{self.product.name} x {self.quantity_received}'
