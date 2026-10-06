from django.db import models
from common.models import TimeStampedModel


class MovementType(models.TextChoices):
    IN = 'in', 'Entrée'
    OUT = 'out', 'Sortie'
    TRANSFER = 'transfer', 'Transfert'
    ADJUSTMENT = 'adjustment', 'Ajustement'
    SALE = 'sale', 'Vente'
    PURCHASE = 'purchase', 'Achat'
    RETURN_CUSTOMER = 'return_customer', 'Retour client'
    RETURN_SUPPLIER = 'return_supplier', 'Retour fournisseur'
    LOSS = 'loss', 'Perte'
    BREAKAGE = 'breakage', 'Casse'
    THEFT = 'theft', 'Vol'
    DONATION = 'donation', 'Don'
    INTERNAL = 'internal', 'Consommation interne'
    INVENTORY = 'inventory', 'Inventaire'
    # Legacy alias kept for old rows
    RETURN = 'return', 'Retour'


class StockLevel(TimeStampedModel):
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='stock_levels'
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse', on_delete=models.CASCADE, related_name='stock_levels'
    )
    location = models.ForeignKey(
        'warehouses.WarehouseLocation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_levels',
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    reserved_quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)

    class Meta:
        unique_together = ['product', 'warehouse']
        indexes = [
            models.Index(fields=['product', 'warehouse']),
        ]

    @property
    def available(self):
        return self.quantity - self.reserved_quantity

    def __str__(self):
        return f'{self.product.name} @ {self.warehouse.name}: {self.quantity}'


class StockMovement(TimeStampedModel):
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='movements'
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse', on_delete=models.CASCADE, related_name='movements'
    )
    movement_type = models.CharField(max_length=30, choices=MovementType.choices)
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    old_quantity = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    new_quantity = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    invoice_ref = models.CharField(max_length=100, blank=True)
    reason = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_movements',
    )
    batch = models.ForeignKey(
        'products.ProductBatch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movements',
    )
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
            models.Index(fields=['product', 'created_at']),
            models.Index(fields=['movement_type', 'created_at']),
        ]

    def __str__(self):
        return f'{self.movement_type} {self.quantity} {self.product.name}'


class TransferStatus(models.TextChoices):
    PENDING = 'pending', 'Créé'
    PREPARING = 'preparing', 'En préparation'
    SHIPPED = 'shipped', 'Expédié'
    IN_TRANSIT = 'in_transit', 'En transit'
    RECEIVED = 'received', 'Reçu'
    COMPLETED = 'completed', 'Terminé'
    CANCELLED = 'cancelled', 'Annulé'


class TransferVarianceReason(models.TextChoices):
    BROKEN = 'broken', 'Cassé'
    LOST = 'lost', 'Perdu'
    STOLEN = 'stolen', 'Volé'
    OTHER = 'other', 'Autre'


class StockTransfer(TimeStampedModel):
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='stock_transfers'
    )
    reference = models.CharField(max_length=40, blank=True, db_index=True)
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
    carrier = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='stock_transfers',
    )
    received_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_stock_transfers',
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.reference or f'Transfert {self.from_warehouse} → {self.to_warehouse}'


class StockTransferItem(models.Model):
    transfer = models.ForeignKey(
        StockTransfer, on_delete=models.CASCADE, related_name='items'
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='transfer_items'
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    quantity_received = models.DecimalField(
        max_digits=10, decimal_places=3, null=True, blank=True,
    )
    variance_reason = models.CharField(
        max_length=20, choices=TransferVarianceReason.choices, blank=True, default='',
    )
    variance_notes = models.CharField(max_length=200, blank=True)

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


class InventorySessionStatus(models.TextChoices):
    DRAFT = 'draft', 'Brouillon'
    IN_PROGRESS = 'in_progress', 'En cours'
    COMPLETED = 'completed', 'Validé'
    CANCELLED = 'cancelled', 'Annulé'


class InventorySession(TimeStampedModel):
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='inventory_sessions'
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse', on_delete=models.CASCADE, related_name='inventory_sessions'
    )
    reference = models.CharField(max_length=50)
    status = models.CharField(
        max_length=20,
        choices=InventorySessionStatus.choices,
        default=InventorySessionStatus.DRAFT,
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='inventory_sessions',
    )
    validated_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='validated_inventories',
    )
    validated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ['company', 'reference']

    def __str__(self):
        return self.reference


class InventorySessionItem(models.Model):
    session = models.ForeignKey(
        InventorySession, on_delete=models.CASCADE, related_name='items'
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.PROTECT, related_name='inventory_items'
    )
    system_quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    counted_quantity = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    notes = models.CharField(max_length=200, blank=True)

    @property
    def difference(self):
        if self.counted_quantity is None:
            return None
        return self.counted_quantity - self.system_quantity

    def __str__(self):
        return f'{self.product.name} @ {self.session.reference}'


class RequestStatus(models.TextChoices):
    DRAFT = 'draft', 'Brouillon'
    PENDING = 'pending', 'En attente PDV'
    POS_VALIDATED = 'pos_validated', 'Envoyée au siège'
    APPROVED = 'approved', 'Approuvée siège'
    REJECTED = 'rejected', 'Rejetée'
    FULFILLED = 'fulfilled', 'Transfert créé'
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
    # alert = demande caissier/auto sans qté choisie ; supply = demande classique
    source = models.CharField(
        max_length=20,
        choices=[
            ('manual', 'Manuelle'),
            ('cashier_alert', 'Alerte caissier'),
            ('auto', 'Automatique'),
            ('pos_manager', 'Responsable PDV'),
        ],
        default='manual',
        blank=True,
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
    transfer = models.ForeignKey(
        'inventory.StockTransfer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_requests',
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
