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
}


def available_providers():
    """Liste les providers configurés (ou tous en DEBUG)."""
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
    if getattr(settings, 'MTN_MOMO_API_KEY', '') or settings.DEBUG:
        providers.append({
            'code': PaymentProvider.MTN_MONEY,
            'label': 'MTN Money',
            'configured': bool(getattr(settings, 'MTN_MOMO_API_KEY', '')),
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
        'payerMessage': 'Paiement Inventra',
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
    # une page Inventra d'attente + instructions USSD.
    wait_url = f'{_success_url().rsplit("/payment/", 1)[0]}/payment/success?pending=1&provider=mtn_money&ref={client_reference}'
    return {
        'id': reference_id,
        'payment_url': wait_url,
        'status_code': response.status_code,
    }


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

    payment = sale.payments.filter(method='mobile_money').first()
    if payment:
        payment.reference = checkout.session_id
        payment.status = 'pending'
        payment.save(update_fields=['reference', 'status', 'updated_at'])

    sale.payment_status = PaymentStatus.UNPAID
    sale.save(update_fields=['payment_status', 'updated_at'])
    return checkout


def create_subscription_checkout(company, plan, billing_cycle='monthly', provider=PaymentProvider.WAVE, phone=None):
    amount = Decimal(plan.price_annual if billing_cycle == 'annual' else plan.price)
    if amount <= 0:
        raise PaymentError('Montant invalide.')

    client_reference = f'SUB-{company.id}-{plan.code}-{billing_cycle}-{timezone.now().strftime("%Y%m%d%H%M%S")}'
    session_id, launch_url, raw = _create_provider_session(
        provider, amount, client_reference, phone=phone,
    )

    return SubscriptionWaveCheckout.objects.create(
        company=company,
        plan=plan,
        billing_cycle=billing_cycle,
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
    from datetime import timedelta
    from companies.models import BillingCycle, Subscription, SubscriptionStatus

    subscription = Subscription.objects.select_related('plan').get(company=checkout.company)
    subscription.plan = checkout.plan
    subscription.billing_cycle = (
        BillingCycle.ANNUAL if checkout.billing_cycle == 'annual' else BillingCycle.MONTHLY
    )
    subscription.status = SubscriptionStatus.ACTIVE
    subscription.start_date = timezone.now().date()
    duration = 365 if checkout.billing_cycle == 'annual' else 30
    subscription.end_date = timezone.now().date() + timedelta(days=duration)
    subscription.save()


def _complete_sale_checkout(checkout: WaveCheckout):
    checkout.status = CheckoutStatus.COMPLETED
    checkout.save(update_fields=['status', 'updated_at'])
    sale = checkout.sale
    sale.payment_status = PaymentStatus.PAID
    sale.save(update_fields=['payment_status', 'updated_at'])
    for payment in sale.payments.filter(method='mobile_money'):
        payment.status = 'completed'
        payment.save(update_fields=['status', 'updated_at'])


@transaction.atomic
def mark_checkout_completed(client_reference: str, provider=None):
    """Marque un checkout comme payé (webhook ou simulation DEBUG)."""
    if client_reference.startswith('SUB-'):
        qs = SubscriptionWaveCheckout.objects.filter(client_reference=client_reference)
        if provider:
            qs = qs.filter(provider=provider)
        sub_checkout = qs.order_by('-created_at').first()
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
    checkout = qs.order_by('-created_at').first()
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
