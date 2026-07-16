from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role, Permission, RolePermission, UserRole


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'company', 'is_company_admin', 'is_active']
    list_filter = ['is_active', 'is_company_admin', 'company']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Inventra', {'fields': ('phone', 'company', 'is_company_admin')}),
    )


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'company', 'is_active']
    list_filter = ['company', 'is_active']


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['codename', 'name', 'module']
    list_filter = ['module']


admin.site.register(RolePermission)
admin.site.register(UserRole)
