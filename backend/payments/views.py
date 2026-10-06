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
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionWaveCheckout
        fields = [
            'id', 'provider', 'provider_label', 'session_id', 'client_reference',
            'amount', 'currency', 'wave_launch_url', 'launch_url', 'status', 'status_label',
            'plan_code', 'plan_name', 'billing_cycle', 'months', 'created_at',
        ]

    def get_provider_label(self, obj):
        return wave_service.PROVIDER_LABELS.get(obj.provider, obj.provider)

    def get_status_label(self, obj):
        return obj.get_status_display()


def _parse_provider(value):
    provider = (value or PaymentProvider.WAVE).strip().lower()
    # Wave + Orange Money uniquement pour l'instant
    allowed = {PaymentProvider.WAVE, PaymentProvider.ORANGE_MONEY}
    if provider not in allowed:
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
        months = request.data.get('months')
        provider = _parse_provider(request.data.get('provider'))
        phone = request.data.get('phone') or ''

        try:
            months_int = int(months) if months is not None else (12 if billing_cycle == 'annual' else 1)
        except (TypeError, ValueError):
            months_int = 1
        if months_int not in (1, 3, 6, 12):
            return Response({'detail': 'Durée invalide (1, 3, 6 ou 12 mois).'}, status=400)
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
                months=months_int,
            )
        except wave_service.PaymentError as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response({
            'checkout': SubscriptionWaveCheckoutSerializer(checkout).data,
        }, status=status.HTTP_201_CREATED)


class SubscriptionPaymentHistoryView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        qs = (
            SubscriptionWaveCheckout.objects.filter(company=request.user.company)
            .select_related('plan')
            .order_by('-created_at')[:100]
        )
        return Response(SubscriptionWaveCheckoutSerializer(qs, many=True).data)


class SubscriptionPaymentDocumentView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request, pk=None):
        from .subscription_invoices import (
            build_subscription_invoice_html,
            build_subscription_receipt_html,
        )

        doc = request.query_params.get('type', 'invoice')
        try:
            checkout = SubscriptionWaveCheckout.objects.select_related(
                'plan', 'company',
            ).get(pk=pk, company=request.user.company)
        except SubscriptionWaveCheckout.DoesNotExist:
            return Response({'detail': 'Paiement introuvable.'}, status=404)

        if checkout.status != 'completed':
            return Response({'detail': 'Document disponible uniquement pour un paiement validé.'}, status=400)

        if doc == 'receipt':
            html = build_subscription_receipt_html(checkout)
        else:
            html = build_subscription_invoice_html(checkout)

        return Response({
            'reference': checkout.client_reference,
            'html': html,
            'type': 'receipt' if doc == 'receipt' else 'invoice',
        })


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


class PayPalConfigView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        from django.conf import settings
        client_id = getattr(settings, 'PAYPAL_CLIENT_ID', '') or ''
        secret = getattr(settings, 'PAYPAL_CLIENT_SECRET', '') or ''
        return Response({
            'configured': bool(client_id and secret),
            'client_id': client_id,
            'mode': getattr(settings, 'PAYPAL_MODE', 'sandbox'),
            'currency': getattr(settings, 'PAYPAL_CURRENCY', 'EUR'),
        })


class PayPalCaptureView(APIView):
    """Capture une commande PayPal après retour utilisateur (?token=ORDER_ID)."""
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def post(self, request):
        order_id = request.data.get('order_id') or request.data.get('token')
        if not order_id:
            return Response({'detail': 'order_id requis.'}, status=400)
        try:
            result = wave_service.capture_paypal_order(order_id)
        except wave_service.PaymentError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response({'status': result.get('status', 'COMPLETED'), 'order_id': order_id})


class PayPalWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.data if isinstance(request.data, dict) else {}
        event_id = payload.get('id') or str(hash(str(payload)))
        event_type = payload.get('event_type', '')
        wave_service.process_webhook_event(
            str(event_id), str(event_type), payload, provider=PaymentProvider.PAYPAL,
        )
        return Response({'received': True})


def _saspay_status_payload(checkout):
    base = {
        'provider': checkout.provider,
        'provider_label': wave_service.PROVIDER_LABELS.get(checkout.provider, checkout.provider),
        'status': checkout.status,
        'checkout_id': checkout.id,
        'client_reference': checkout.client_reference,
        'amount': str(checkout.amount),
        'currency': checkout.currency,
        'launch_url': checkout.wave_launch_url,
    }
    if getattr(checkout, 'plan_id', None):
        return {
            **base,
            'type': 'subscription',
            'plan_code': checkout.plan.code,
            'plan_name': checkout.plan.name,
            'billing_cycle': checkout.billing_cycle,
            'months': checkout.months,
        }
    sale = checkout.sale
    return {
        **base,
        'type': 'sale',
        'sale_id': sale.id,
        'reference': sale.reference,
        'payment_status': sale.payment_status,
    }


class SasPayMethodsView(APIView):
    """Moyens SasPay du pays, ordonnés : mobile money, carte, autres."""
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        from . import saspay_service
        return Response(saspay_service.list_payment_methods(request.user.company))


class SasPaySubscriptionCheckoutView(APIView):
    """Crée une session SasPay. Le montant vient du pack ou de la vente, jamais du frontend."""
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def post(self, request):
        from . import saspay_service

        sale_id = request.data.get('sale_id')
        if sale_id:
            try:
                sale = Sale.objects.get(id=sale_id, company=request.user.company)
            except Sale.DoesNotExist:
                return Response({'detail': 'Vente introuvable.'}, status=404)
            try:
                checkout = saspay_service.create_sale_session(sale=sale, user=request.user)
            except saspay_service.PaymentError as exc:
                return Response({'detail': str(exc)}, status=400)
            return Response({
                'checkout': WaveCheckoutSerializer(checkout).data,
                'sale': SaleSerializer(sale).data,
            }, status=status.HTTP_201_CREATED)

        if not request.user.is_company_admin:
            return Response({'detail': 'Seul un administrateur peut payer l’abonnement.'}, status=403)

        plan_code = request.data.get('plan_code')
        billing_cycle = request.data.get('billing_cycle', 'monthly')
        months = request.data.get('months')
        try:
            months_int = int(months) if months is not None else (12 if billing_cycle == 'annual' else 1)
        except (TypeError, ValueError):
            months_int = 1
        if months_int not in (1, 3, 6, 12):
            return Response({'detail': 'Durée invalide (1, 3, 6 ou 12 mois).'}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(code=plan_code, is_active=True, is_public=True)
        except SubscriptionPlan.DoesNotExist:
            return Response({'detail': 'Pack introuvable.'}, status=404)

        try:
            checkout = saspay_service.create_subscription_session(
                company=request.user.company,
                plan=plan,
                user=request.user,
                billing_cycle=billing_cycle,
                months=months_int,
            )
        except saspay_service.PaymentError as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response({
            'checkout': SubscriptionWaveCheckoutSerializer(checkout).data,
        }, status=status.HTTP_201_CREATED)


class SasPayStatusView(APIView):
    """Relit le statut réel chez SasPay. Le frontend ne peut pas activer l'abonnement."""
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        from . import saspay_service

        checkout_id = request.query_params.get('subscription_checkout_id') or request.query_params.get('checkout_id')
        client_reference = (request.query_params.get('client_reference') or request.query_params.get('ref') or '').strip()
        sale_qs = WaveCheckout.objects.filter(
            sale__company=request.user.company,
            provider=PaymentProvider.SASPAY,
        ).select_related('sale')
        sub_qs = SubscriptionWaveCheckout.objects.filter(
            company=request.user.company,
            provider=PaymentProvider.SASPAY,
        ).select_related('plan')
        checkout = None
        if client_reference.startswith('SALE-') or request.query_params.get('sale_id'):
            if client_reference:
                checkout = sale_qs.filter(client_reference=client_reference).first()
            elif checkout_id:
                checkout = sale_qs.filter(pk=checkout_id).first()
        elif client_reference.startswith('SUB-') or request.query_params.get('subscription_checkout_id'):
            if client_reference:
                checkout = sub_qs.filter(client_reference=client_reference).first()
            elif checkout_id:
                checkout = sub_qs.filter(pk=checkout_id).first()
        elif client_reference:
            checkout = (
                sub_qs.filter(client_reference=client_reference).first()
                or sale_qs.filter(client_reference=client_reference).first()
            )
        elif checkout_id:
            checkout = sub_qs.filter(pk=checkout_id).first() or sale_qs.filter(pk=checkout_id).first()
        if not checkout:
            return Response({'detail': 'Paiement introuvable.'}, status=404)

        if checkout.status == 'pending':
            try:
                checkout = saspay_service.sync_checkout(checkout)
            except saspay_service.PaymentError as exc:
                return Response({
                    **_saspay_status_payload(checkout),
                    'detail': str(exc),
                })
        return Response(_saspay_status_payload(checkout))


class SasPayWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from . import saspay_service

        signature = request.headers.get('X-Webhook-Signature', '')
        timestamp = request.headers.get('X-Webhook-Timestamp', '')
        try:
            saspay_service.handle_webhook(request.body, signature, timestamp)
        except saspay_service.SasPaySignatureError:
            return Response({'detail': 'Signature invalide.'}, status=403)
        except saspay_service.PaymentError:
            return Response({'detail': 'Confirmation impossible pour le moment.'}, status=503)
        return Response({'received': True})
