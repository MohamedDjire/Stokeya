from django.db import models
from common.models import TimeStampedModel


class Warehouse(TimeStampedModel):
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.CASCADE, related_name='warehouses'
    )
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=40, blank=True, db_index=True)
    manager_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    # Entrepôt servant aussi de stock POS pour la boutique liée
    is_pos_stock = models.BooleanField(default=True)

    class Meta:
        ordering = ['branch', 'name']

    def __str__(self):
        return f'{self.name} ({self.branch.name})'


class WarehouseLocation(TimeStampedModel):
    """Emplacement dans un entrepôt (rayon, allée, casier…)."""
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.CASCADE, related_name='locations'
    )
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['warehouse', 'code']
        unique_together = ['warehouse', 'code']

    def __str__(self):
        return f'{self.code} @ {self.warehouse.name}'
