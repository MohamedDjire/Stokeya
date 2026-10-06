from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from accounts.utils import (
    get_effective_flags,
    get_user_permissions,
    get_user_role_code,
    get_user_scope,
    seed_company_permissions,
)
from branches.models import Branch
from companies.models import Company, Subscription
from warehouses.models import Warehouse

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    role_code = serializers.SerializerMethodField()
    flags = serializers.SerializerMethodField()
    scope = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    company_logo = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    assigned_branch_name = serializers.CharField(
        source='assigned_branch.name', read_only=True, default=None,
    )
    assigned_cash_register_name = serializers.CharField(
        source='assigned_cash_register.name', read_only=True, default=None,
    )

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'phone', 'first_name', 'last_name',
            'full_name', 'avatar', 'company', 'company_name', 'company_logo',
            'is_company_admin', 'is_active', 'permissions',
            'role_code', 'flags', 'scope',
            'assigned_branch', 'assigned_branch_name',
            'assigned_warehouse', 'assigned_cash_register', 'assigned_cash_register_name',
        ]
        read_only_fields = fields

    def _abs(self, file_field):
        if not file_field:
            return None
        request = self.context.get('request')
        url = file_field.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_avatar(self, obj):
        return self._abs(obj.avatar)

    def get_company_logo(self, obj):
        if not obj.company_id or not obj.company.logo:
            return None
        return self._abs(obj.company.logo)

    def get_company_name(self, obj):
        return obj.company.name if obj.company_id else None

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_permissions(self, obj):
        return get_user_permissions(obj)

    def get_role_code(self, obj):
        return get_user_role_code(obj)

    def get_flags(self, obj):
        return get_effective_flags(obj)

    def get_scope(self, obj):
        return get_user_scope(obj)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'phone']


class RegisterSerializer(serializers.Serializer):
    company_name = serializers.CharField(max_length=200)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True, default='')
    city = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    whatsapp = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    shop_slug = serializers.SlugField(max_length=80, required=False, allow_blank=True, default='')
    wave_number = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    orange_money_number = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    payment_timing = serializers.ChoiceField(
        choices=[
            ('on_delivery', 'À la livraison'),
            ('before_delivery', 'Avant livraison'),
            ('both', 'Les deux'),
        ],
        required=False,
        default='on_delivery',
    )

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Cet email est déjà utilisé.')
        return value.lower()

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Les mots de passe ne correspondent pas.'})
        return data

    def _unique_slug(self, name):
        base = slugify(name) or 'entreprise'
        slug = base
        counter = 1
        while Company.objects.filter(slug=slug).exists():
            slug = f'{base}-{counter}'
            counter += 1
        return slug

    @transaction.atomic
    def create(self, validated_data):
        email = validated_data['email']
        company_name = validated_data['company_name']
        phone = validated_data.get('phone', '')
        address = validated_data.get('address', '')
        city = validated_data.get('city', '')
        whatsapp = validated_data.get('whatsapp', '') or phone
        full_address = address
        if city and city not in address:
            full_address = f'{address}, {city}'.strip(', ')

        company = Company.objects.create(
            name=company_name,
            slug=self._unique_slug(company_name),
            email=email,
            phone=phone,
            address=full_address,
        )

        user = User.objects.create_user(
            username=email,
            email=email,
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone=phone,
            company=company,
            is_company_admin=True,
        )

        branch = Branch.objects.create(
            company=company,
            name='Siège',
            is_active=True,
            is_main=True,
            acts_as_warehouse=True,
            allow_supplier_receipts=True,
            currency='XOF',
            phone=phone,
            address=full_address,
        )
        Warehouse.objects.create(
            branch=branch,
            name='Stock boutique',
            is_default=True,
            is_active=True,
            is_pos_stock=True,
        )
        from branches.models import CashRegister
        CashRegister.objects.create(
            company=company,
            branch=branch,
            name='Caisse principale',
            is_active=True,
        )
        from shops.models import ensure_online_shop_for_company
        ensure_online_shop_for_company(company, branch, extras={
            'slug': validated_data.get('shop_slug') or '',
            'name': company_name,
            'whatsapp': whatsapp,
            'phone': phone,
            'address': full_address,
            'wave_number': validated_data.get('wave_number', ''),
            'orange_money_number': validated_data.get('orange_money_number', ''),
            'payment_timing': validated_data.get('payment_timing') or 'on_delivery',
            'accept_cod': True,
            'accept_wave': True,
            'accept_orange_money': True,
        })
        from common.catalog_seed import seed_company_catalog
        seed_company_catalog(company)

        from datetime import timedelta
        from django.utils import timezone
        from companies.plans import seed_plans

        plans = seed_plans()
        trial_plan = plans['trial']
        Subscription.objects.create(
            company=company,
            plan=trial_plan,
            status='trial',
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=7),
        )

        roles = seed_company_permissions(company)
        from accounts.models import UserRole
        UserRole.objects.create(user=user, role=roles['company_admin'], branch=None)

        return user
