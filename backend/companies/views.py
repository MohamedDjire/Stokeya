from datetime import timedelta

from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsCompanyAdmin, IsCompanyMember
from .models import BillingCycle, Subscription, SubscriptionPlan, SubscriptionStatus
from .serializers import (
    ChangePlanSerializer,
    CompanySerializer,
    SubscriptionPlanSerializer,
    SubscriptionSerializer,
)


class CompanyDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = CompanySerializer

    def get_object(self):
        return self.request.user.company


class SubscriptionDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = SubscriptionSerializer

    def get_object(self):
        return Subscription.objects.select_related('plan', 'company').get(
            company=self.request.user.company
        )


class PlanListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = SubscriptionPlanSerializer

    def get_queryset(self):
        return SubscriptionPlan.objects.filter(is_active=True, is_public=True)


class ChangePlanView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyAdmin]

    def post(self, request):
        serializer = ChangePlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data['plan_code']
        cycle = serializer.validated_data['billing_cycle']

        try:
            plan = SubscriptionPlan.objects.get(code=code, is_active=True, is_public=True)
        except SubscriptionPlan.DoesNotExist:
            return Response({'detail': 'Pack introuvable.'}, status=400)

        subscription = Subscription.objects.select_related('plan').get(
            company=request.user.company
        )
        subscription.plan = plan
        subscription.billing_cycle = (
            BillingCycle.ANNUAL if cycle == 'annual' else BillingCycle.MONTHLY
        )
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.start_date = timezone.now().date()
        duration = 365 if cycle == 'annual' else 30
        subscription.end_date = timezone.now().date() + timedelta(days=duration)
        subscription.save()

        return Response(
            SubscriptionSerializer(subscription).data,
            status=status.HTTP_200_OK,
        )
