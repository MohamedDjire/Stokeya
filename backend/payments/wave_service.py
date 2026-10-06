"""Services de paiement Mobile Money : Wave, Orange Money, MTN Money."""
import hashlib
import hmac
import logging
import uuid
from decimal import Decimal

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from sales.models import PaymentStatus

from .models import (
    CheckoutStatus,
    PaymentProvider,
    SubscriptionWaveCheckout,
    WaveCheckout,
    WaveWebhookEvent,
)

logger = logging.getLogger(__name__)


class PaymentError(Exception):
    pass


# Alias rétrocompatibilité
WaveError = PaymentError


PROVIDER_LABELS = {
    PaymentProvider.WAVE: 'Wave',
    PaymentProvider.ORANGE_MONEY: 'Orange Money',
    PaymentProvider.MTN_MONEY: 'MTN Money',
    PaymentProvider.PAYPAL: 'PayPal',
    PaymentProvider.SASPAY: 'SasPay',
}


def available_providers():
    """Liste les providers actifs (Wave + Orange Money uniquement pour l'instant)."""
    providers = []
    if settings.WAVE_API_KEY or settings.DEBUG:
        providers.append({
            'code': PaymentProvider.WAVE,
            'label': 'Wave',
            'configured': bool(settings.WAVE_API_KEY),
        })
    if getattr(settings, 'ORANGE_MONEY_CLIENT_ID', '') or settings.DEBUG:
        providers.append({
            'code': PaymentProvider.ORANGE_MONEY,
            'label': 'Orange Money',
            'configured': bool(getattr(settings, 'ORANGE_MONEY_CLIENT_ID', '')),
        })
    return providers


def _success_url():
    return settings.WAVE_SUCCESS_URL


def _error_url():
    return settings.WAVE_ERROR_URL


def _mock_launch_url(provider, client_reference):
    """URL de simulation locale quand les clés API ne sont pas configurées (DEBUG)."""
    base = getattr(settings, 'PAYMENT_MOCK_BASE_URL', 'http://localhost:5173')
    return f'{base}/payment/success?mock=1&provider={provider}&ref={client_reference}'


# ─── Wave ───────────────────────────────────────────────────────────────────

def _wave_headers():
    return {
        'Authorization': f'Bearer {settings.WAVE_API_KEY}',
        'Content-Type': 'application/json',
    }


def _create_wave_session(amount, client_reference):
    if not settings.WAVE_API_KEY:
        if settings.DEBUG:
            return {
                'id': f'mock-wave-{uuid.uuid4().hex[:12]}',
                'wave_launch_url': _mock_launch_url(PaymentProvider.WAVE, client_reference),
                'mock': True,
            }
        raise PaymentError('WAVE_API_KEY non configurée.')

    payload = {
        'amount': str(int(amount)),
        'currency': 'XOF',
        'client_reference': client_reference,
        'success_url': _success_url(),
        'error_url': _error_url(),
    }
    response = requests.post(
        f'{settings.WAVE_API_BASE_URL}/v1/checkout/sessions',
        headers=_wave_headers(),
        json=payload,
        timeout=30,
    )
    if response.status_code >= 400:
        logger.error('Wave API error: %s', response.text)
        raise PaymentError('Impossible de créer la session Wave.')
    return response.json()


# ─── Orange Money ────────────────────────────────────────────────────────────

def _orange_access_token():
    client_id = getattr(settings, 'ORANGE_MONEY_CLIENT_ID', '')
    client_secret = getattr(settings, 'ORANGE_MONEY_CLIENT_SECRET', '')
    if not client_id or not client_secret:
        return None

    token_url = getattr(
        settings,
        'ORANGE_MONEY_TOKEN_URL',
        'https://api.orange.com/oauth/v3/token',
    )
    response = requests.post(
        token_url,
        data={'grant_type': 'client_credentials'},
        auth=(client_id, client_secret),
        headers={'Accept': 'application/json'},
        timeout=30,
    )
    if response.status_code >= 400:
        logger.error('Orange Money token error: %s', response.text)
        raise PaymentError('Authentification Orange Money impossible.')
    return response.json().get('access_token')


def _create_orange_session(amount, client_reference):
    client_id = getattr(settings, 'ORANGE_MONEY_CLIENT_ID', '')
    if not client_id:
        if settings.DEBUG:
            return {
                'id': f'mock-om-{uuid.uuid4().hex[:12]}',
                'payment_url': _mock_launch_url(PaymentProvider.ORANGE_MONEY, client_reference),
                'mock': True,
            }
        raise PaymentError('ORANGE_MONEY_CLIENT_ID non configurée.')

    token = _orange_access_token()
    merchant_key = getattr(settings, 'ORANGE_MONEY_MERCHANT_KEY', '')
    api_base = getattr(
        settings,
        'ORANGE_MONEY_API_BASE_URL',
        'https://api.orange.com/orange-money-webpay/dev/v1',
    )
    payload = {
        'merchant_key': merchant_key,
        'currency': 'XOF',
        'order_id': client_reference,
        'amount': int(amount),
        'return_url': _success_url(),
        'cancel_url': _error_url(),
        'notif_url': getattr(settings, 'ORANGE_MONEY_NOTIF_URL', ''),
        'lang': 'fr',
        'reference': client_reference,
    }
    response = requests.post(
        f'{api_base}/webpayment',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        json=payload,
        timeout=30,
    )
    if response.status_code >= 400:
        logger.error('Orange Money API error: %s', response.text)
        raise PaymentError('Impossible de créer la session Orange Money.')
    data = response.json()
    return {
        'id': data.get('pay_token') or data.get('notif_token') or data.get('order_id', ''),
        'payment_url': data.get('payment_url') or data.get('paymentUrl', ''),
        **data,
    }


# ─── MTN Money ───────────────────────────────────────────────────────────────

def _create_mtn_session(amount, client_reference, phone=None):
    api_key = getattr(settings, 'MTN_MOMO_API_KEY', '')
    if not api_key:
        if settings.DEBUG:
            return {
                'id': f'mock-mtn-{uuid.uuid4().hex[:12]}',
                'payment_url': _mock_launch_url(PaymentProvider.MTN_MONEY, client_reference),
                'mock': True,
            }
        raise PaymentError('MTN_MOMO_API_KEY non configurée.')

    api_base = getattr(
        settings,
        'MTN_MOMO_API_BASE_URL',
        'https://sandbox.momodeveloper.mtn.com',
    )
    subscription_key = getattr(settings, 'MTN_MOMO_SUBSCRIPTION_KEY', '')
    target_env = getattr(settings, 'MTN_MOMO_TARGET_ENVIRONMENT', 'sandbox')
    reference_id = str(uuid.uuid4())

    # RequestToPay — en sandbox le payeur doit être un numéro de test MTN
    payload = {
        'amount': str(int(amount)),
        'currency': 'XOF',
        'externalId': client_reference,
        'payer': {
            'partyIdType': 'MSISDN',
            'partyId': phone or getattr(settings, 'MTN_MOMO_DEFAULT_PAYER', '22997000000'),
        },
        'payerMessage': 'Paiement Stokeya',
        'payeeNote': client_reference,
    }
    response = requests.post(
        f'{api_base}/collection/v1_0/requesttopay',
        headers={
            'Authorization': f'Bearer {api_key}',
            'X-Reference-Id': reference_id,
            'X-Target-Environment': target_env,
            'Ocp-Apim-Subscription-Key': subscription_key,
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=30,
    )
    if response.status_code not in (200, 201, 202):
        logger.error('MTN MoMo API error: %s', response.text)
        raise PaymentError('Impossible de créer la session MTN Money.')

    # MTN RequestToPay n'a pas toujours d'URL de redirection ; on renvoie
    # une page Stokeya d'attente + instructions USSD.
    wait_url = f'{_success_url().rsplit("/payment/", 1)[0]}/payment/success?pending=1&provider=mtn_money&ref={client_reference}'
    return {
        'id': reference_id,
        'payment_url': wait_url,
        'status_code': response.status_code,
    }


# ─── PayPal ──────────────────────────────────────────────────────────────────

def _paypal_api_base():
    mode = getattr(settings, 'PAYPAL_MODE', 'sandbox')
    if mode == 'live':
        return 'https://api-m.paypal.com'
    return 'https://api-m.sandbox.paypal.com'


def _paypal_access_token():
    import base64

    client_id = getattr(settings, 'PAYPAL_CLIENT_ID', '')
    client_secret = getattr(settings, 'PAYPAL_CLIENT_SECRET', '')
    if not client_id or not client_secret:
        return None

    auth = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
    response = requests.post(
        f'{_paypal_api_base()}/v1/oauth2/token',
        headers={
            'Authorization': f'Basic {auth}',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        data={'grant_type': 'client_credentials'},
        timeout=30,
    )
    if response.status_code >= 400:
        logger.error('PayPal token error: %s', response.text)
        raise PaymentError('Authentification PayPal impossible.')
    return response.json().get('access_token')


def _paypal_amount_from_xof(amount_xof):
    """Convertit un montant XOF en devise PayPal (EUR/USD)."""
    currency = getattr(settings, 'PAYPAL_CURRENCY', 'EUR')
    rate = Decimal(str(getattr(settings, 'PAYPAL_XOF_RATE', 655.957)))
    if rate <= 0:
        rate = Decimal('655.957')
    converted = (Decimal(amount_xof) / rate).quantize(Decimal('0.01'))
    if converted <= 0:
        converted = Decimal('0.01')
    return f'{converted:.2f}', currency


def _create_paypal_session(amount, client_reference):
    client_id = getattr(settings, 'PAYPAL_CLIENT_ID', '')
    client_secret = getattr(settings, 'PAYPAL_CLIENT_SECRET', '')
    if not client_id or not client_secret:
        raise PaymentError(
            'PayPal n’est pas configuré. Renseignez PAYPAL_CLIENT_ID et PAYPAL_CLIENT_SECRET.'
        )

    token = _paypal_access_token()
    if not token:
        raise PaymentError('PayPal : identifiants invalides.')

    value, currency = _paypal_amount_from_xof(amount)
    return_url = getattr(settings, 'PAYPAL_RETURN_URL', _success_url())
    if 'provider=' not in return_url:
        sep = '&' if '?' in return_url else '?'
        return_url = f'{return_url}{sep}provider=paypal'
    cancel_url = getattr(settings, 'PAYPAL_CANCEL_URL', _error_url())

    payload = {
        'intent': 'CAPTURE',
        'purchase_units': [{
            'reference_id': client_reference[:127],
            'amount': {
                'currency_code': currency,
                'value': value,
            },
            'description': f'Stokeya — {client_reference}'[:127],
        }],
        'application_context': {
            'return_url': return_url,
            'cancel_url': cancel_url,
            'brand_name': 'Stokeya',
            'user_action': 'PAY_NOW',
            'shipping_preference': 'NO_SHIPPING',
        },
    }
    response = requests.post(
        f'{_paypal_api_base()}/v2/checkout/orders',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=30,
    )
    if response.status_code >= 400:
        logger.error('PayPal order error: %s', response.text)
        raise PaymentError('Impossible de créer la commande PayPal.')

    data = response.json()
    order_id = data.get('id', '')
    approve_url = ''
    for link in data.get('links', []):
        if link.get('rel') == 'approve':
            approve_url = link.get('href', '')
            break
    return {
        'id': order_id,
        'payment_url': approve_url,
        'paypal_amount': value,
        'paypal_currency': currency,
        **data,
    }


def capture_paypal_order(order_id: str):
    """Capture une commande PayPal après approbation (retour utilisateur ou webhook)."""
    if not order_id:
        raise PaymentError('Identifiant PayPal manquant.')

    if order_id.startswith('mock-paypal-') and settings.DEBUG:
        checkout = (
            WaveCheckout.objects.filter(session_id=order_id, provider=PaymentProvider.PAYPAL).first()
            or SubscriptionWaveCheckout.objects.filter(
                session_id=order_id, provider=PaymentProvider.PAYPAL,
            ).first()
        )
        if checkout:
            mark_checkout_completed(checkout.client_reference, provider=PaymentProvider.PAYPAL)
        return {'status': 'COMPLETED', 'mock': True}

    token = _paypal_access_token()
    if not token:
        raise PaymentError('PayPal : identifiants invalides.')

    response = requests.post(
        f'{_paypal_api_base()}/v2/checkout/orders/{order_id}/capture',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
        json={},
        timeout=30,
    )
    data = {}
    try:
        data = response.json()
    except Exception:
        data = {}

    if response.status_code >= 400:
        issues = {d.get('issue') for d in (data.get('details') or []) if isinstance(d, dict)}
        if 'ORDER_ALREADY_CAPTURED' in issues or response.status_code == 422:
            status_resp = requests.get(
                f'{_paypal_api_base()}/v2/checkout/orders/{order_id}',
                headers={'Authorization': f'Bearer {token}'},
                timeout=30,
            )
            data = status_resp.json() if status_resp.status_code < 400 else data
        else:
            logger.error('PayPal capture error: %s', response.text)
            raise PaymentError('Capture PayPal impossible.')
    status = data.get('status', '')
    if status != 'COMPLETED':
        for unit in data.get('purchase_units') or []:
            captures = ((unit.get('payments') or {}).get('captures')) or []
            if any(c.get('status') == 'COMPLETED' for c in captures):
                status = 'COMPLETED'
                break

    client_reference = None
    for unit in data.get('purchase_units') or []:
        client_reference = unit.get('reference_id')
        if client_reference:
            break

    if status == 'COMPLETED':
        if client_reference:
            mark_checkout_completed(client_reference, provider=PaymentProvider.PAYPAL)
        else:
            checkout = (
                WaveCheckout.objects.filter(session_id=order_id, provider=PaymentProvider.PAYPAL).first()
                or SubscriptionWaveCheckout.objects.filter(
                    session_id=order_id, provider=PaymentProvider.PAYPAL,
                ).first()
            )
            if checkout:
                mark_checkout_completed(checkout.client_reference, provider=PaymentProvider.PAYPAL)

    return data


def _create_provider_session(provider, amount, client_reference, phone=None):
    if provider == PaymentProvider.WAVE:
        data = _create_wave_session(amount, client_reference)
        return data.get('id', ''), data.get('wave_launch_url', ''), data
    if provider == PaymentProvider.ORANGE_MONEY:
        data = _create_orange_session(amount, client_reference)
        return data.get('id', ''), data.get('payment_url', ''), data
    if provider == PaymentProvider.MTN_MONEY:
        data = _create_mtn_session(amount, client_reference, phone=phone)
        return data.get('id', ''), data.get('payment_url', ''), data
    if provider == PaymentProvider.PAYPAL:
        data = _create_paypal_session(amount, client_reference)
        return data.get('id', ''), data.get('payment_url', ''), data
    raise PaymentError(f'Fournisseur de paiement inconnu : {provider}')


def create_checkout_session(sale, provider=PaymentProvider.WAVE, phone=None):
    amount = Decimal(sale.total)
    if amount <= 0:
        raise PaymentError('Montant invalide.')

    client_reference = sale.reference
    session_id, launch_url, raw = _create_provider_session(
        provider, amount, client_reference, phone=phone,
    )

    checkout = WaveCheckout.objects.create(
        sale=sale,
        provider=provider,
        session_id=session_id or f'{provider}-{uuid.uuid4().hex[:16]}',
        client_reference=client_reference,
        amount=sale.total,
        wave_launch_url=launch_url,
        raw_response=raw,
    )

    payment = sale.payments.filter(method__in=['mobile_money', 'card']).first()
    if payment:
        payment.reference = checkout.session_id
        payment.status = 'pending'
        payment.save(update_fields=['reference', 'status', 'updated_at'])

    sale.payment_status = PaymentStatus.UNPAID
    sale.save(update_fields=['payment_status', 'updated_at'])
    return checkout


def create_subscription_checkout(
    company, plan, billing_cycle='monthly', provider=PaymentProvider.WAVE,
    phone=None, months=1,
):
    from companies.subscription_service import price_for_months

    months = int(months or 1)
    if months not in (1, 3, 6, 12):
        months = 12 if billing_cycle == 'annual' else 1

    amount = price_for_months(plan, months)
    if amount <= 0:
        raise PaymentError('Montant invalide.')

    cycle = 'annual' if months >= 12 else 'monthly'
    client_reference = (
        f'SUB-{company.id}-{plan.code}-{months}m-'
        f'{timezone.now().strftime("%Y%m%d%H%M%S")}'
    )
    session_id, launch_url, raw = _create_provider_session(
        provider, amount, client_reference, phone=phone,
    )

    return SubscriptionWaveCheckout.objects.create(
        company=company,
        plan=plan,
        billing_cycle=cycle,
        months=months,
        provider=provider,
        session_id=session_id or f'{provider}-{uuid.uuid4().hex[:16]}',
        client_reference=client_reference,
        amount=amount,
        wave_launch_url=launch_url,
        raw_response=raw,
    )


def get_payment_status(*, sale_id=None, subscription_checkout_id=None, company=None):
    if sale_id and company:
        checkout = WaveCheckout.objects.filter(
            sale_id=sale_id, sale__company=company,
        ).order_by('-created_at').first()
        if not checkout:
            return None
        sale = checkout.sale
        return {
            'type': 'sale',
            'provider': checkout.provider,
            'provider_label': PROVIDER_LABELS.get(checkout.provider, checkout.provider),
            'status': checkout.status,
            'sale_id': sale.id,
            'reference': sale.reference,
            'amount': str(sale.total),
            'payment_status': sale.payment_status,
            'wave_launch_url': checkout.wave_launch_url,
            'launch_url': checkout.wave_launch_url,
        }

    if subscription_checkout_id and company:
        checkout = SubscriptionWaveCheckout.objects.filter(
            id=subscription_checkout_id, company=company,
        ).first()
        if not checkout:
            return None
        return {
            'type': 'subscription',
            'provider': checkout.provider,
            'provider_label': PROVIDER_LABELS.get(checkout.provider, checkout.provider),
            'status': checkout.status,
            'checkout_id': checkout.id,
            'plan_code': checkout.plan.code,
            'plan_name': checkout.plan.name,
            'billing_cycle': checkout.billing_cycle,
            'amount': str(checkout.amount),
            'wave_launch_url': checkout.wave_launch_url,
            'launch_url': checkout.wave_launch_url,
        }
    return None


def verify_webhook_signature(body: bytes, signature_header: str) -> bool:
    secret = settings.WAVE_WEBHOOK_SECRET
    if not secret or not signature_header:
        return settings.DEBUG

    try:
        parts = dict(p.split('=', 1) for p in signature_header.split(','))
        timestamp = parts.get('t', '')
        signature = parts.get('v1', '')
        signed_payload = f'{timestamp}.{body.decode("utf-8")}'
        expected = hmac.new(
            secret.encode('utf-8'),
            signed_payload.encode('utf-8'),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception:
        logger.exception('Wave signature verification failed')
        return False


def _activate_subscription(checkout: SubscriptionWaveCheckout):
    from companies.models import Subscription
    from companies.subscription_service import apply_plan_period

    subscription = Subscription.objects.select_related('plan').get(company=checkout.company)
    months = getattr(checkout, 'months', None) or (12 if checkout.billing_cycle == 'annual' else 1)
    apply_plan_period(subscription, checkout.plan, checkout.billing_cycle, months=months)


def _complete_sale_checkout(checkout: WaveCheckout):
    checkout.status = CheckoutStatus.COMPLETED
    checkout.save(update_fields=['status', 'updated_at'])
    sale = checkout.sale
    sale.payment_status = PaymentStatus.PAID
    sale.save(update_fields=['payment_status', 'updated_at'])
    for payment in sale.payments.filter(method__in=['mobile_money', 'card']):
        payment.status = 'completed'
        payment.save(update_fields=['status', 'updated_at'])


@transaction.atomic
def mark_checkout_completed(client_reference: str, provider=None):
    """Marque un checkout comme payé (webhook ou simulation DEBUG)."""
    if client_reference.startswith('SUB-'):
        qs = SubscriptionWaveCheckout.objects.filter(client_reference=client_reference)
        if provider:
            qs = qs.filter(provider=provider)
        sub_checkout = qs.select_for_update().order_by('-created_at').first()
        if not sub_checkout:
            return False
        if sub_checkout.status != CheckoutStatus.COMPLETED:
            sub_checkout.status = CheckoutStatus.COMPLETED
            sub_checkout.save(update_fields=['status', 'updated_at'])
            _activate_subscription(sub_checkout)
        return True

    qs = WaveCheckout.objects.select_related('sale').filter(client_reference=client_reference)
    if provider:
        qs = qs.filter(provider=provider)
    checkout = qs.select_for_update().order_by('-created_at').first()
    if not checkout:
        return False
    if checkout.status != CheckoutStatus.COMPLETED:
        _complete_sale_checkout(checkout)
    return True


@transaction.atomic
def process_webhook_event(event_id: str, event_type: str, payload: dict, provider=PaymentProvider.WAVE):
    if WaveWebhookEvent.objects.filter(event_id=event_id).exists():
        return

    WaveWebhookEvent.objects.create(
        event_id=event_id,
        event_type=event_type,
        payload=payload,
        processed=True,
        provider=provider,
    )

    # Wave
    if provider == PaymentProvider.WAVE:
        if 'checkout.session.completed' not in event_type:
            return
        client_reference = (
            payload.get('data', {}).get('client_reference')
            or payload.get('client_reference')
        )
        if client_reference:
            mark_checkout_completed(client_reference, provider=PaymentProvider.WAVE)
        return

    # Orange Money — statut SUCCESS / SUCCESSFUL
    if provider == PaymentProvider.ORANGE_MONEY:
        status = (payload.get('status') or payload.get('status_code') or '').upper()
        if status not in ('SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID'):
            return
        client_reference = payload.get('order_id') or payload.get('reference') or payload.get('client_reference')
        if client_reference:
            mark_checkout_completed(client_reference, provider=PaymentProvider.ORANGE_MONEY)
        return

    # MTN Money — SUCCESSFUL
    if provider == PaymentProvider.MTN_MONEY:
        status = (payload.get('status') or '').upper()
        if status not in ('SUCCESSFUL', 'SUCCESS', 'COMPLETED'):
            return
        client_reference = payload.get('externalId') or payload.get('client_reference')
        if client_reference:
            mark_checkout_completed(client_reference, provider=PaymentProvider.MTN_MONEY)
        return

    # PayPal — PAYMENT.CAPTURE.COMPLETED ou CHECKOUT.ORDER.APPROVED
    if provider == PaymentProvider.PAYPAL:
        event_type = event_type or payload.get('event_type', '')
        resource = payload.get('resource') or {}
        if event_type == 'PAYMENT.CAPTURE.COMPLETED':
            client_reference = resource.get('custom_id') or resource.get('invoice_id')
            order_id = resource.get('supplementary_data', {}).get('related_ids', {}).get('order_id')
            if not client_reference and order_id:
                checkout = (
                    WaveCheckout.objects.filter(session_id=order_id).first()
                    or SubscriptionWaveCheckout.objects.filter(session_id=order_id).first()
                )
                if checkout:
                    client_reference = checkout.client_reference
            if client_reference:
                mark_checkout_completed(client_reference, provider=PaymentProvider.PAYPAL)
            elif order_id:
                try:
                    capture_paypal_order(order_id)
                except PaymentError:
                    logger.exception('PayPal webhook capture failed for %s', order_id)
        elif event_type == 'CHECKOUT.ORDER.APPROVED':
            order_id = resource.get('id')
            if order_id:
                try:
                    capture_paypal_order(order_id)
                except PaymentError:
                    logger.exception('PayPal auto-capture failed for %s', order_id)
