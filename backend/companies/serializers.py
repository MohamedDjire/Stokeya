from rest_framework import serializers

from .models import Company, Subscription, SubscriptionPlan
from .plans import FEATURE_LABELS


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            'id', 'name', 'slug', 'logo', 'email', 'phone', 'address',
            'country', 'currency', 'tax_rate', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'slug', 'created_at']


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    features_detail = serializers.SerializerMethodField()
    unlimited_users = serializers.SerializerMethodField()
    unlimited_branches = serializers.SerializerMethodField()
    unlimited_products = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'code', 'name', 'price', 'price_annual',
            'max_users', 'max_branches', 'max_products',
            'unlimited_users', 'unlimited_branches', 'unlimited_products',
            'features', 'features_detail', 'is_public',
        ]

    def get_features_detail(self, obj):
        if 'all' in obj.features:
            return [{'code': code, 'label': label} for code, label in FEATURE_LABELS.items()]
        return [
            {'code': code, 'label': FEATURE_LABELS.get(code, code)}
            for code in obj.features
        ]

    def get_unlimited_users(self, obj):
        return SubscriptionPlan.is_unlimited(obj.max_users)

    def get_unlimited_branches(self, obj):
        return SubscriptionPlan.is_unlimited(obj.max_branches)

    def get_unlimited_products(self, obj):
        return SubscriptionPlan.is_unlimited(obj.max_products)


class SubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_code = serializers.CharField(source='plan.code', read_only=True)
    plan = SubscriptionPlanSerializer(read_only=True)
    is_valid = serializers.SerializerMethodField()
    usage = serializers.SerializerMethodField()
    features = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = [
            'id', 'plan', 'plan_name', 'plan_code', 'status', 'billing_cycle',
            'start_date', 'end_date', 'is_valid', 'usage', 'features',
        ]

    def get_is_valid(self, obj):
        return obj.is_valid()

    def get_usage(self, obj):
        from .limits import usage_summary
        return usage_summary(obj.company)

    def get_features(self, obj):
        return obj.plan.features


class ChangePlanSerializer(serializers.Serializer):
    plan_code = serializers.CharField()
    billing_cycle = serializers.ChoiceField(choices=['monthly', 'annual'], default='monthly')
