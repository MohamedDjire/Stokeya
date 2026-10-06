from django.contrib.auth import get_user_model
from rest_framework import serializers

from branches.models import Branch, CashRegister
from warehouses.models import Warehouse
from .models import Role, UserRole
from .utils import get_effective_flags, get_user_permissions, get_user_role_code, get_user_scope

User = get_user_model()


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'code', 'description', 'is_active']


class CompanyUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    role_code = serializers.SerializerMethodField()
    flags = serializers.SerializerMethodField()
    assigned_branch_name = serializers.CharField(
        source='assigned_branch.name', read_only=True, default=None,
    )
    assigned_warehouse_name = serializers.CharField(
        source='assigned_warehouse.name', read_only=True, default=None,
    )
    assigned_cash_register_name = serializers.CharField(
        source='assigned_cash_register.name', read_only=True, default=None,
    )

    class Meta:
        model = User
        fields = [
            'id', 'email', 'phone', 'first_name', 'last_name', 'full_name',
            'is_company_admin', 'is_active', 'roles', 'role_code', 'permissions',
            'flags', 'permission_flags',
            'assigned_branch', 'assigned_branch_name',
            'assigned_warehouse', 'assigned_warehouse_name',
            'assigned_cash_register', 'assigned_cash_register_name',
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_roles(self, obj):
        return [
            {'id': ur.role_id, 'name': ur.role.name, 'code': ur.role.code}
            for ur in obj.user_roles.select_related('role').all()
        ]

    def get_role_code(self, obj):
        return get_user_role_code(obj)

    def get_permissions(self, obj):
        return get_user_permissions(obj)

    def get_flags(self, obj):
        return get_effective_flags(obj)


class CreateUserSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    role_code = serializers.CharField(required=False, allow_blank=True)
    assigned_branch = serializers.IntegerField(required=False, allow_null=True)
    assigned_warehouse = serializers.IntegerField(required=False, allow_null=True)
    assigned_cash_register = serializers.IntegerField(required=False, allow_null=True)
    permission_flags = serializers.DictField(required=False)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Cet email est déjà utilisé.')
        return value.lower()


class UpdateUserSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    role_code = serializers.CharField(required=False, allow_blank=True)
    assigned_branch = serializers.IntegerField(required=False, allow_null=True)
    assigned_warehouse = serializers.IntegerField(required=False, allow_null=True)
    assigned_cash_register = serializers.IntegerField(required=False, allow_null=True)
    permission_flags = serializers.DictField(required=False)


def resolve_assignments(company, data):
    """Valide et retourne branch/warehouse/register instances."""
    result = {}
    branch_id = data.get('assigned_branch', serializers.empty)
    if branch_id is not serializers.empty:
        if branch_id is None:
            result['assigned_branch'] = None
        else:
            try:
                result['assigned_branch'] = Branch.objects.get(id=branch_id, company=company)
            except Branch.DoesNotExist:
                raise serializers.ValidationError({'assigned_branch': 'Boutique invalide.'})

    wh_id = data.get('assigned_warehouse', serializers.empty)
    if wh_id is not serializers.empty:
        if wh_id is None:
            result['assigned_warehouse'] = None
        else:
            try:
                result['assigned_warehouse'] = Warehouse.objects.get(
                    id=wh_id, branch__company=company,
                )
            except Warehouse.DoesNotExist:
                raise serializers.ValidationError({'assigned_warehouse': 'Entrepôt invalide.'})

    reg_id = data.get('assigned_cash_register', serializers.empty)
    if reg_id is not serializers.empty:
        if reg_id is None:
            result['assigned_cash_register'] = None
        else:
            try:
                result['assigned_cash_register'] = CashRegister.objects.get(
                    id=reg_id, company=company,
                )
            except CashRegister.DoesNotExist:
                raise serializers.ValidationError({'assigned_cash_register': 'Caisse invalide.'})
    return result
