from django.db import models
from common.models import CompanyScopedModel


class Branch(CompanyScopedModel):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=40, blank=True, db_index=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    manager_name = models.CharField(max_length=120, blank=True)
    opening_hours = models.CharField(max_length=200, blank=True)
    currency = models.CharField(max_length=10, blank=True, default='XOF')
    is_active = models.BooleanField(default=True)
    # Boutique principale (siège) — une seule par entreprise, non supprimable
    is_main = models.BooleanField(default=False)
    # Legacy: boutique = entrepôt (conservé pour migration)
    acts_as_warehouse = models.BooleanField(default=True)
    # Entrepôt / siège d'où partent les approvisionnements par défaut
    default_supply_warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supplied_branches',
    )
    # Si False (défaut pour un PDV), les achats fournisseurs ne peuvent pas arriver ici
    allow_supplier_receipts = models.BooleanField(default=False)
    shop_slug = models.SlugField(max_length=80, blank=True, null=True)
    shop_code = models.CharField(max_length=16, blank=True, null=True)
    shop_enabled = models.BooleanField(default=False)
    shop_banner = models.ImageField(upload_to='shops/', blank=True, null=True)
    shop_description = models.TextField(blank=True)
    shop_whatsapp = models.CharField(max_length=30, blank=True)
    shop_hours = models.CharField(max_length=200, blank=True)
    shop_show_prices = models.BooleanField(default=True)
    shop_show_stock = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'branches'
        ordering = ['-is_main', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['company'],
                name='uniq_company_main_branch',
                condition=models.Q(is_main=True),
            ),
            models.UniqueConstraint(
                fields=['company', 'shop_slug'],
                name='uniq_branch_shop_slug',
                condition=models.Q(shop_slug__isnull=False) & ~models.Q(shop_slug=''),
            ),
            models.UniqueConstraint(
                fields=['shop_code'],
                name='uniq_branch_shop_code',
                condition=models.Q(shop_code__isnull=False) & ~models.Q(shop_code=''),
            ),
        ]

    def __str__(self):
        return f'{self.name} ({self.company.name})'

    @property
    def is_pos(self):
        return not self.is_main


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
