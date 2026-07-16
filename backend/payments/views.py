from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsCompanyAdmin, IsCompanyMember
from companies.models import SubscriptionPlan
from sales.models import Sale
from sales.serializers import SaleSerializer
from . import wave_service
from .models import PaymentProvider, SubscriptionWaveCheckout, WaveCheckout


class WaveCheckoutSerializer(serializers.ModelSerializer):
    launch_url = serializers.CharField(source='wave_launch_url', read_only=True)
    provider_label = serializers.SerializerMethodField()

    class Meta:
        model = WaveCheckout
        fields = [
            'id', 'provider', 'provider_label', 'session_id', 'client_reference',
            'amount', 'currency', 'wave_launch_url', 'launch_url', 'status', 'created_at',
        ]

    def get_provider_label(self, obj):
        return wave_service.PROVIDER_LABELS.get(obj.provider, obj.provider)


class SubscriptionWaveCheckoutSerializer(serializers.ModelSerializer):
    plan_code = serializers.CharField(source='plan.code', read_only=True)
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    launch_url = serializers.CharField(source='wave_launch_url', read_only=True)
    provider_label = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionWaveCheckout
        fields = [
            'id', 'provider', 'provider_label', 'session_id', 'client_reference',
            'amount', 'currency', 'wave_launch_url', 'launch_url', 'status',
            'plan_code', 'plan_name', 'billing_cycle', 'created_at',
        ]

    def get_provider_label(self, obj):
        return wave_service.PROVIDER_LABELS.get(obj.provider, obj.provider)


def _parse_provider(value):
    provider = (value or PaymentProvider.WAVE).strip().lower()
    valid = {c.value for c in PaymentProvider}
    if provider not in valid:
        return None
    return provider


class PaymentProvidersView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        return Response({'providers': wave_service.available_providers()})


class WaveCheckoutCreateView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def post(self, request):
        sale_id = request.data.get('sale_id')
        provider = _parse_provider(request.data.get('provider'))
        phone = request.data.get('phone') or ''
        if not provider:
            return Response({'detail': 'Fournisseur de paiement invalide.'}, status=400)

        try:
            sale = Sale.objects.get(id=sale_id, company=request.user.company)
        except Sale.DoesNotExist:
            return Response({'detail': 'Vente introuvable.'}, status=404)

        try:
            checkout = wave_service.create_checkout_session(sale, provider=provider, phone=phone)
        except wave_service.PaymentError as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response({
            'checkout': WaveCheckoutSerializer(checkout).data,
            'sale': SaleSerializer(sale).data,
        }, status=status.HTTP_201_CREATED)


class SubscriptionWaveCheckoutView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyAdmin]

    def post(self, request):
        plan_code = request.data.get('plan_code')
        billing_cycle = request.data.get('billing_cycle', 'monthly')
        provider = _parse_provider(request.data.get('provider'))
        phone = request.data.get('phone') or ''

        if billing_cycle not in ('monthly', 'annual'):
            return Response({'detail': 'Cycle de facturation invalide.'}, status=400)
        if not provider:
            return Response({'detail': 'Fournisseur de paiement invalide.'}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(code=plan_code, is_active=True, is_public=True)
        except SubscriptionPlan.DoesNotExist:
            return Response({'detail': 'Pack introuvable.'}, status=404)

        try:
            checkout = wave_service.create_subscription_checkout(
                company=request.user.company,
                plan=plan,
                billing_cycle=billing_cycle,
                provider=provider,
                phone=phone,
            )
        except wave_service.PaymentError as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response({
            'checkout': SubscriptionWaveCheckoutSerializer(checkout).data,
        }, status=status.HTTP_201_CREATED)


class WavePaymentStatusView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        sale_id = request.query_params.get('sale_id')
        subscription_checkout_id = request.query_params.get('subscription_checkout_id')
        data = wave_service.get_payment_status(
            sale_id=sale_id,
            subscription_checkout_id=subscription_checkout_id,
            company=request.user.company,
        )
        if not data:
            return Response({'detail': 'Paiement introuvable.'}, status=404)
        return Response(data)


class WaveWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        body = request.body
        signature = request.headers.get('Wave-Signature', '')
        if not wave_service.verify_webhook_signature(body, signature):
            return Response({'detail': 'Signature invalide.'}, status=403)

        try:
            payload = request.data if isinstance(request.data, dict) else {}
        except Exception:
            payload = {}

        event_id = payload.get('id') or payload.get('event_id') or str(hash(body))
        event_type = payload.get('type') or payload.get('event_type', '')
        wave_service.process_webhook_event(
            event_id, event_type, payload, provider=PaymentProvider.WAVE,
        )
        return Response({'received': True})


class OrangeMoneyWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.data if isinstance(request.data, dict) else {}
        event_id = (
            payload.get('notif_token')
            or payload.get('pay_token')
            or payload.get('order_id')
            or str(hash(str(payload)))
        )
        event_type = payload.get('status') or 'orange_money.notification'
        wave_service.process_webhook_event(
            str(event_id), str(event_type), payload, provider=PaymentProvider.ORANGE_MONEY,
        )
        return Response({'received': True})


class MtnMoneyWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.data if isinstance(request.data, dict) else {}
        event_id = (
            payload.get('financialTransactionId')
            or payload.get('externalId')
            or str(hash(str(payload)))
        )
        event_type = payload.get('status') or 'mtn_money.notification'
        wave_service.process_webhook_event(
            str(event_id), str(event_type), payload, provider=PaymentProvider.MTN_MONEY,
        )
        return Response({'received': True})


class MockCompletePaymentView(APIView):
    """Uniquement en DEBUG : simule un paiement réussi (tests locaux)."""
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def post(self, request):
        from django.conf import settings
        if not settings.DEBUG:
            return Response({'detail': 'Indisponible en production.'}, status=403)

        client_reference = request.data.get('client_reference')
        provider = _parse_provider(request.data.get('provider')) or PaymentProvider.WAVE
        if not client_reference:
            return Response({'detail': 'client_reference requis.'}, status=400)

        ok = wave_service.mark_checkout_completed(client_reference, provider=provider)
        if not ok:
            return Response({'detail': 'Checkout introuvable.'}, status=404)
        return Response({'status': 'completed'})
