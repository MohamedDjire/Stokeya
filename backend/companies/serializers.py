from rest_framework import serializers

from .models import Company, PreferredPaymentMethod, Subscription, SubscriptionPlan
from .plans import ENTERPRISE_FEATURES, FEATURE_LABELS


# Fonctionnalités « cœur » affichées pour tous les packs
CORE_FEATURE_LABELS = [
    'Gestion de stock',
    'Point de vente (POS)',
    'CRM clients',
    'Achats & fournisseurs',
    'Dépenses',
    'Statistiques',
    'Sauvegarde cloud',
]


class CompanySerializer(serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'id', 'name', 'slug', 'logo', 'slogan', 'email', 'phone', 'address',
            'website', 'tax_id', 'country', 'currency', 'tax_rate',
            'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'logo']

    def get_logo(self, obj):
        if not obj.logo:
            return None
        request = self.context.get('request')
        url = obj.logo.url
        if request:
            return request.build_absolute_uri(url)
        return url


class CompanyPreferencesSerializer(serializers.Serializer):
    """Payload partiel des préférences (fusionné avec les défauts)."""
    regional = serializers.DictField(required=False)
    commercial = serializers.DictField(required=False)
    display = serializers.DictField(required=False)
    notifications = serializers.DictField(required=False)
    documents = serializers.DictField(required=False)
    security = serializers.DictField(required=False)
    backup = serializers.DictField(required=False)
    automation = serializers.DictField(required=False)
    advanced = serializers.DictField(required=False)


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    features_detail = serializers.SerializerMethodField()
    unlimited_users = serializers.SerializerMethodField()
    unlimited_branches = serializers.SerializerMethodField()
    unlimited_warehouses = serializers.SerializerMethodField()
    unlimited_products = serializers.SerializerMethodField()
    renewal_options = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'code', 'name', 'price', 'price_annual',
            'max_users', 'max_branches', 'max_warehouses', 'max_products',
            'unlimited_users', 'unlimited_branches', 'unlimited_warehouses',
            'unlimited_products',
            'features', 'features_detail', 'renewal_options', 'is_public',
        ]

    def get_features_detail(self, obj):
        if 'all' in (obj.features or []):
            codes = list(ENTERPRISE_FEATURES)
        else:
            codes = [c for c in (obj.features or []) if c in FEATURE_LABELS]
        return [
            {'code': code, 'label': FEATURE_LABELS.get(code, code)}
            for code in codes
        ]

    def get_unlimited_users(self, obj):
        return SubscriptionPlan.is_unlimited(obj.max_users)

    def get_unlimited_branches(self, obj):
        return SubscriptionPlan.is_unlimited(obj.max_branches)

    def get_unlimited_warehouses(self, obj):
        return SubscriptionPlan.is_unlimited(obj.max_warehouses)

    def get_unlimited_products(self, obj):
        return SubscriptionPlan.is_unlimited(obj.max_products)

    def get_renewal_options(self, obj):
        from .subscription_service import renewal_options
        return renewal_options(obj)


class SubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_code = serializers.CharField(source='plan.code', read_only=True)
    plan = SubscriptionPlanSerializer(read_only=True)
    is_valid = serializers.SerializerMethodField()
    usage = serializers.SerializerMethodField()
    features = serializers.SerializerMethodField()
    features_included = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    expiring_soon = serializers.SerializerMethodField()
    grace_day = serializers.SerializerMethodField()
    access_level = serializers.SerializerMethodField()
    display_status = serializers.SerializerMethodField()
    monthly_amount = serializers.SerializerMethodField()
    preferred_payment_method_label = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = [
            'id', 'plan', 'plan_name', 'plan_code', 'status', 'display_status',
            'billing_cycle', 'start_date', 'end_date', 'is_valid',
            'days_remaining', 'expiring_soon', 'grace_day', 'access_level',
            'auto_renew', 'preferred_payment_method', 'preferred_payment_method_label',
            'monthly_amount', 'usage', 'features', 'features_included',
        ]

    def get_is_valid(self, obj):
        return obj.is_valid()

    def get_days_remaining(self, obj):
        from .subscription_service import days_remaining
        return days_remaining(obj)

    def get_expiring_soon(self, obj):
        from .subscription_service import is_expiring_soon
        remaining = self.get_days_remaining(obj)
        if remaining is not None and remaining < 0:
            return True
        return is_expiring_soon(obj)

    def get_grace_day(self, obj):
        from .subscription_service import grace_day
        return grace_day(obj)

    def get_access_level(self, obj):
        from .subscription_service import access_level
        return access_level(obj)

    def get_display_status(self, obj):
        from .subscription_service import display_status
        return display_status(obj)

    def get_monthly_amount(self, obj):
        return str(obj.plan.price)

    def get_preferred_payment_method_label(self, obj):
        return obj.get_preferred_payment_method_display() if obj.preferred_payment_method else 'Non défini'

    def get_usage(self, obj):
        from .limits import usage_summary
        return usage_summary(obj.company)

    def get_features(self, obj):
        return obj.plan.features

    def get_features_included(self, obj):
        """Cœur + features premium du pack."""
        items = [{'code': f'core_{i}', 'label': label, 'core': True} for i, label in enumerate(CORE_FEATURE_LABELS)]
        plan_data = SubscriptionPlanSerializer(obj.plan).data
        for f in plan_data.get('features_detail') or []:
            items.append({**f, 'core': False})
        return items


class SubscriptionSettingsSerializer(serializers.Serializer):
    auto_renew = serializers.BooleanField(required=False)
    preferred_payment_method = serializers.ChoiceField(
        choices=[c[0] for c in PreferredPaymentMethod.choices],
        required=False,
        allow_blank=True,
    )


class ChangePlanSerializer(serializers.Serializer):
    plan_code = serializers.CharField()
    billing_cycle = serializers.ChoiceField(choices=['monthly', 'annual'], default='monthly')
    months = serializers.IntegerField(required=False, default=1, min_value=1, max_value=12)
