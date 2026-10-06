from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsCompanyAdmin, IsCompanyMember
from .models import Subscription, SubscriptionPlan
from .preferences import DEFAULT_PREFERENCES, deep_merge, get_company_preferences
from .serializers import (
    ChangePlanSerializer,
    CompanyPreferencesSerializer,
    CompanySerializer,
    SubscriptionPlanSerializer,
    SubscriptionSerializer,
    SubscriptionSettingsSerializer,
)
from .subscription_service import apply_plan_period, ensure_expiry_notifications


class CompanyDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = CompanySerializer

    def get_object(self):
        return self.request.user.company

    def partial_update(self, request, *args, **kwargs):
        if not (request.user.is_company_admin or request.user.is_superuser):
            from accounts.utils import user_has_flag
            if not user_has_flag(request.user, 'can_edit_settings'):
                return Response(
                    {'detail': 'Vous n\'êtes pas autorisé à modifier l\'entreprise.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        return super().partial_update(request, *args, **kwargs)


class CompanyPreferencesView(APIView):
    """GET/PATCH préférences de fonctionnement globales."""

    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        company = request.user.company
        return Response({
            'company': CompanySerializer(company, context={'request': request}).data,
            'preferences': get_company_preferences(company),
            'defaults': DEFAULT_PREFERENCES,
            'about': {
                'product': 'Stokeya',
                'version': '1.0.0',
                'updated_at': company.updated_at,
                'license': 'SaaS — abonnement actif',
                'support_email': 'support@stokeya.com',
                'terms_url': '/legal/terms',
                'privacy_url': '/legal/privacy',
            },
        })

    def patch(self, request):
        if not (request.user.is_company_admin or request.user.is_superuser):
            from accounts.utils import user_has_flag
            if not user_has_flag(request.user, 'can_edit_settings'):
                return Response(
                    {'detail': 'Vous n\'êtes pas autorisé à modifier les préférences.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        company = request.user.company
        company_data = request.data.get('company')
        prefs_data = request.data.get('preferences')

        if company_data and isinstance(company_data, dict):
            ser = CompanySerializer(company, data=company_data, partial=True, context={'request': request})
            ser.is_valid(raise_exception=True)
            # Ne pas toucher au logo via ce JSON (upload séparé)
            ser.validated_data.pop('logo', None)
            ser.save()

        if prefs_data is not None:
            ser_p = CompanyPreferencesSerializer(data=prefs_data, partial=True)
            ser_p.is_valid(raise_exception=True)
            # Interdire maintenance_mode / advanced aux non-admins
            validated = dict(ser_p.validated_data)
            if 'advanced' in validated and not request.user.is_company_admin:
                validated.pop('advanced', None)
            current = company.preferences if isinstance(company.preferences, dict) else {}
            company.preferences = deep_merge(current, validated)
            company.save(update_fields=['preferences', 'updated_at'])

        return Response({
            'company': CompanySerializer(company, context={'request': request}).data,
            'preferences': get_company_preferences(company),
            'about': {
                'product': 'Stokeya',
                'version': '1.0.0',
                'updated_at': company.updated_at,
                'license': 'SaaS — abonnement actif',
                'support_email': 'support@stokeya.com',
                'terms_url': '/legal/terms',
                'privacy_url': '/legal/privacy',
            },
        })


class CompanyLogoUploadView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyAdmin]

    def post(self, request):
        company = request.user.company
        logo = request.FILES.get('logo')
        if not logo:
            return Response({'detail': 'Fichier logo requis.'}, status=400)
        company.logo = logo
        company.save(update_fields=['logo', 'updated_at'])

        # Propager vers la boutique en ligne pour l’affichage public
        try:
            from django.core.files.base import ContentFile
            from shops.models import OnlineShop
            shop = OnlineShop.objects.filter(company=company).first()
            if shop and company.logo:
                company.logo.open('rb')
                content = company.logo.read()
                filename = company.logo.name.split('/')[-1]
                shop.logo.save(filename, ContentFile(content), save=True)
        except Exception:
            pass

        return Response(CompanySerializer(company, context={'request': request}).data)


class SubscriptionDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = SubscriptionSerializer

    def get_object(self):
        subscription = Subscription.objects.select_related('plan', 'company').get(
            company=self.request.user.company
        )
        ensure_expiry_notifications(subscription)
        return subscription


class SubscriptionSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyAdmin]

    def patch(self, request):
        serializer = SubscriptionSettingsSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        subscription = Subscription.objects.select_related('plan').get(
            company=request.user.company,
        )
        data = serializer.validated_data
        if 'auto_renew' in data:
            subscription.auto_renew = data['auto_renew']
        if 'preferred_payment_method' in data:
            subscription.preferred_payment_method = data['preferred_payment_method'] or ''
        subscription.save()
        return Response(SubscriptionSerializer(subscription).data)


class PlanListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = SubscriptionPlanSerializer

    def get_queryset(self):
        return SubscriptionPlan.objects.filter(is_active=True, is_public=True)


class ChangePlanView(APIView):
    """Changement de pack gratuit uniquement (prix 0). Les packs payants passent par le checkout."""

    permission_classes = [IsAuthenticated, IsCompanyAdmin]

    def post(self, request):
        serializer = ChangePlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data['plan_code']
        cycle = serializer.validated_data['billing_cycle']
        months = int(serializer.validated_data.get('months') or (12 if cycle == 'annual' else 1))

        try:
            plan = SubscriptionPlan.objects.get(code=code, is_active=True, is_public=True)
        except SubscriptionPlan.DoesNotExist:
            return Response({'detail': 'Pack introuvable.'}, status=400)

        if float(plan.price or 0) > 0:
            return Response(
                {'detail': 'Ce pack nécessite un paiement. Utilisez le renouvellement.'},
                status=400,
            )

        subscription = Subscription.objects.select_related('plan').get(
            company=request.user.company
        )
        apply_plan_period(subscription, plan, cycle, months=months)

        return Response(
            SubscriptionSerializer(subscription).data,
            status=status.HTTP_200_OK,
        )
