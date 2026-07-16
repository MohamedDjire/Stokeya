from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from accounts.utils import get_user_permissions, seed_company_permissions
from branches.models import Branch
from companies.models import Company, Subscription
from units.models import Unit
from warehouses.models import Warehouse

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'phone', 'first_name', 'last_name',
            'full_name', 'company', 'is_company_admin', 'is_active', 'permissions',
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_permissions(self, obj):
        return get_user_permissions(obj)


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
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)

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

        company = Company.objects.create(
            name=company_name,
            slug=self._unique_slug(company_name),
            email=email,
            phone=validated_data.get('phone', ''),
        )

        user = User.objects.create_user(
            username=email,
            email=email,
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone=validated_data.get('phone', ''),
            company=company,
            is_company_admin=True,
        )

        branch = Branch.objects.create(
            company=company,
            name='Siège',
            is_active=True,
        )
        Warehouse.objects.create(
            branch=branch,
            name='Entrepôt principal',
            is_default=True,
        )
        from branches.models import CashRegister
        CashRegister.objects.create(
            company=company,
            branch=branch,
            name='Caisse principale',
            is_active=True,
        )
        Unit.objects.create(
            company=company,
            name='Pièce',
            abbreviation='pce',
        )

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
            end_date=timezone.now().date() + timedelta(days=14),
        )

        roles = seed_company_permissions(company)
        from accounts.models import UserRole
        UserRole.objects.create(user=user, role=roles['company_admin'], branch=None)

        return user
