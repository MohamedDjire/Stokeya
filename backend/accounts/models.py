from django.contrib.auth.models import AbstractUser
from django.db import models
from common.models import TimeStampedModel


class User(AbstractUser):
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='users/avatars/', blank=True, null=True)
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='users',
        null=True,
        blank=True,
    )
    is_company_admin = models.BooleanField(default=False)
    # Périmètre opérationnel
    assigned_branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_users',
        help_text='Point de vente rattaché (caissier / responsable PDV)',
    )
    assigned_warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_users',
        help_text='Entrepôt rattaché (responsable / magasinier)',
    )
    assigned_cash_register = models.ForeignKey(
        'branches.CashRegister',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_users',
        help_text='Caisse rattachée (caissier)',
    )
    # Surcharges d'autorisations (True/False) par rapport au rôle
    permission_flags = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['first_name', 'last_name']

    def __str__(self):
        return self.get_full_name() or self.email or self.username


class Role(TimeStampedModel):
    SYSTEM_ROLES = [
        ('super_admin', 'Super Administrateur'),
        ('company_admin', 'Administrateur entreprise'),
        ('manager', 'Gérant'),
        ('warehouse_manager', 'Responsable entrepôt'),
        ('stock_keeper', 'Magasinier'),
        ('pos_manager', 'Responsable point de vente'),
        ('cashier', 'Caissier'),
        ('accountant', 'Comptable'),
    ]

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50)
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='roles',
        null=True,
        blank=True,
        help_text='Null = rôle système global',
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ['code', 'company']
        ordering = ['name']

    def __str__(self):
        return self.name


class Permission(TimeStampedModel):
    codename = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    module = models.CharField(max_length=50)

    class Meta:
        ordering = ['module', 'name']

    def __str__(self):
        return f'{self.module}.{self.codename}'


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name='role_permissions'
    )

    class Meta:
        unique_together = ['role', 'permission']


class UserRole(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='user_roles')
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='user_roles',
        help_text='Limiter le rôle à une boutique spécifique',
    )

    class Meta:
        unique_together = ['user', 'role', 'branch']

    def __str__(self):
        return f'{self.user} — {self.role}'
