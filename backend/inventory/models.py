from django.db import models
from common.models import TimeStampedModel


class MovementType(models.TextChoices):
    IN = 'in', 'Entrée'
    OUT = 'out', 'Sortie'
    TRANSFER = 'transfer', 'Transfert'
    ADJUSTMENT = 'adjustment', 'Ajustement'
    SALE = 'sale', 'Vente'
    PURCHASE = 'purchase', 'Achat'
    RETURN = 'return', 'Retour'


class StockLevel(TimeStampedModel):
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='stock_levels'
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse', on_delete=models.CASCADE, related_name='stock_levels'
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)

    class Meta:
        unique_together = ['product', 'warehouse']
        indexes = [
            models.Index(fields=['product', 'warehouse']),
        ]

    def __str__(self):
        return f'{self.product.name} @ {self.warehouse.name}: {self.quantity}'


class StockMovement(TimeStampedModel):
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='movements'
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse', on_delete=models.CASCADE, related_name='movements'
    )
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='stock_movements',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['warehouse', 'created_at']),
        ]

    def __str__(self):
        return f'{self.movement_type} {self.quantity} {self.product.name}'


class TransferStatus(models.TextChoices):
    PENDING = 'pending', 'En attente'
    IN_TRANSIT = 'in_transit', 'En transit'
    COMPLETED = 'completed', 'Terminé'
    CANCELLED = 'cancelled', 'Annulé'


class StockTransfer(TimeStampedModel):
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='stock_transfers'
    )
    from_warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name='transfers_out',
    )
    to_warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name='transfers_in',
    )
    status = models.CharField(
        max_length=20, choices=TransferStatus.choices, default=TransferStatus.PENDING
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='stock_transfers',
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Transfert {self.from_warehouse} → {self.to_warehouse}'


class StockTransferItem(models.Model):
    transfer = models.ForeignKey(
        StockTransfer, on_delete=models.CASCADE, related_name='items'
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='transfer_items'
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3)

    def __str__(self):
        return f'{self.product.name} x {self.quantity}'


class StockAdjustment(TimeStampedModel):
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='stock_adjustments'
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse', on_delete=models.CASCADE, related_name='adjustments'
    )
    reason = models.CharField(max_length=200)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='stock_adjustments',
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Ajustement {self.warehouse.name} — {self.reason}'


class StockAdjustmentItem(models.Model):
    adjustment = models.ForeignKey(
        StockAdjustment, on_delete=models.CASCADE, related_name='items'
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='adjustment_items'
    )
    expected_quantity = models.DecimalField(max_digits=10, decimal_places=3)
    actual_quantity = models.DecimalField(max_digits=10, decimal_places=3)

    @property
    def difference(self):
        return self.actual_quantity - self.expected_quantity

    def __str__(self):
        return f'{self.product.name}: {self.expected_quantity} → {self.actual_quantity}'


class RequestStatus(models.TextChoices):
    DRAFT = 'draft', 'Brouillon'
    PENDING = 'pending', 'En attente'
    APPROVED = 'approved', 'Approuvée'
    REJECTED = 'rejected', 'Rejetée'
    FULFILLED = 'fulfilled', 'Servie'
    CANCELLED = 'cancelled', 'Annulée'


class StockRequest(TimeStampedModel):
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='stock_requests'
    )
    reference = models.CharField(max_length=50)
    from_warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name='requests_out',
        null=True,
        blank=True,
    )
    to_warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name='requests_in',
    )
    status = models.CharField(
        max_length=20, choices=RequestStatus.choices, default=RequestStatus.PENDING,
    )
    notes = models.TextField(blank=True)
    requested_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='stock_requests',
    )
    processed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_stock_requests',
    )

    class Meta:
        ordering = ['-created_at']
        unique_together = ['company', 'reference']

    def __str__(self):
        return self.reference


class StockRequestItem(models.Model):
    request = models.ForeignKey(StockRequest, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        'products.Product', on_delete=models.PROTECT, related_name='stock_request_items'
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    quantity_fulfilled = models.DecimalField(max_digits=10, decimal_places=3, default=0)

    def __str__(self):
        return f'{self.product.name} x {self.quantity}'
