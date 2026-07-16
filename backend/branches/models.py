from django.db import models
from common.models import CompanyScopedModel


class Branch(CompanyScopedModel):
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'branches'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.company.name})'


class CashRegister(CompanyScopedModel):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='cash_registers')
    name = models.CharField(max_length=100)
    is_open = models.BooleanField(default=False)
    opened_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='opened_registers',
    )
    opened_at = models.DateTimeField(null=True, blank=True)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    closing_balance = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    session_sales_total = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['branch', 'name']

    def __str__(self):
        return f'{self.name} — {self.branch.name}'
