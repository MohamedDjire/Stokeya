"""SasPay : checkout hébergé et confirmation d'abonnement.

La clé secrète ne sort jamais de Django. Un paiement n'active un pack
qu'après vérification du montant et du statut auprès de l'API SasPay.
"""
import hashlib
import hmac
import json
import logging
import time
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import quote

import requests
from django.conf import settings
from django.utils import timezone

from sales.models import PaymentStatus

from .models import (
    CheckoutStatus,
    PaymentProvider,
    SubscriptionWaveCheckout,
    WaveCheckout,
    WaveWebhookEvent,
)
from .saspay_methods import build_groups
from .wave_service import PaymentError, mark_checkout_completed

logger = logging.getLogger(__name__)

REF_MARKER = 'STOKEYA:'
SUCCESS_STATUSES = {'SUCCESS', 'PAID', 'COMPLETED'}
FAIL_STATUSES = {'FAILED', 'CANCELLED', 'CANCELED', 'EXPIRED'}
WEBHOOK_TOLERANCE_SECONDS = 300


class SasPaySignatureError(PaymentError):
    pass


def _money(value) -> Decimal:
    try:
        return Decimal(str(value if value is not None else '0')).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return Decimal('0.00')


def _api_base() -> str:
    return (settings.SASPAY_API_URL or 'https://api.saspay.me/api/v1').rstrip('/')


def _headers() -> dict:
    key = (settings.SASPAY_SECRET_KEY or '').strip()
    if not key:
        raise PaymentError('SASPAY_SECRET_KEY non configurée.')
    return {
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }


def _unwrap(payload):
    if isinstance(payload, dict) and 'success' in payload and 'data' in payload:
        data = payload.get('data')
        return data if isinstance(data, dict) else {}
    return payload if isinstance(payload, dict) else {}


def _request(method: str, path: str, body=None) -> dict:
    url = f'{_api_base()}{path}'
    try:
        response = requests.request(
            method,
            url,
            headers=_headers(),
            json=body,
            timeout=20,
        )
    except requests.RequestException as exc:
        logger.warning('SasPay injoignable: %s', exc.__class__.__name__)
        raise PaymentError('SasPay est momentanément injoignable.') from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if response.status_code >= 400:
        message = _error_message(payload, response.status_code)
        logger.info('SasPay %s %s -> %s', method, path, response.status_code)
        raise PaymentError(message)
    return _unwrap(payload)


def _error_message(payload, status_code: int) -> str:
    if isinstance(payload, dict):
        error = payload.get('error')
        if isinstance(error, dict) and error.get('message'):
            return str(error['message'])
        if payload.get('message'):
            return str(payload['message'])
    return f'SasPay a refusé la requête ({status_code}).'


def _country_code(company) -> str:
    raw = (getattr(company, 'country', '') or '').strip().upper()
    if len(raw) == 2 and raw.isalpha():
        return raw
    return (settings.SASPAY_DEFAULT_COUNTRY or 'SN').strip().upper()[:2] or 'SN'


def _customer(user, company):
    email = (getattr(user, 'email', '') or getattr(company, 'email', '') or '').strip()
    if not email:
        raise PaymentError('Un e-mail est requis pour payer avec SasPay.')
    name = ''
    if user is not None and hasattr(user, 'get_full_name'):
        name = (user.get_full_name() or '').strip()
    if not name:
        name = (getattr(company, 'name', '') or 'Client STOKEYA').strip()
    return email, name


def _as_list(payload) -> list:
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in ('results', 'data', 'countries', 'networks'):
        value = payload.get(key)
        if isinstance(value, list):
            return value
    return []


def _public_get(path: str) -> dict | list:
    url = f'{_api_base()}{path}'
    headers = {'Accept': 'application/json'}
    key = (getattr(settings, 'SASPAY_SECRET_KEY', '') or '').strip()
    if key:
        headers['Authorization'] = f'Bearer {key}'
    try:
        response = requests.get(url, headers=headers, timeout=15)
    except requests.RequestException:
        return {}
    if response.status_code >= 400:
        return {}
    try:
        return response.json()
    except ValueError:
        return {}


def _country_ids() -> dict:
    raw = _public_get('/countries/')
    rows = raw if isinstance(raw, list) else _as_list(_unwrap(raw) if isinstance(raw, dict) else raw)
    if not rows and isinstance(raw, dict):
        rows = _as_list(raw)
    mapping = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        code = str(row.get('code') or row.get('iso') or '').upper()
        if code and row.get('id'):
            mapping[str(row['id'])] = code
    return mapping


def _live_mobile(country_code: str):
    """Réseaux mobile money actifs du pays, lus chez SasPay. None si l'API ne répond pas."""
    if not (getattr(settings, 'SASPAY_SECRET_KEY', '') or '').strip():
        return None
    id_to_iso = _country_ids()
    found = []
    seen = set()
    for page in range(1, 8):
        raw = _public_get(f'/networks/?page={page}&page_size=100')
        rows = raw if isinstance(raw, list) else _as_list(_unwrap(raw) if isinstance(raw, dict) else raw)
        if not rows and isinstance(raw, dict):
            rows = _as_list(raw)
        if not rows:
            break
        for row in rows:
            if not isinstance(row, dict) or row.get('is_active') is False:
                continue
            code = str(row.get('code') or '')
            if not code or code in seen or code in ('card', 'crypto'):
                continue
            country = row.get('country')
            iso = ''
            if isinstance(country, dict):
                iso = str(country.get('code') or country.get('iso') or '').upper()
            elif isinstance(country, str) and len(country) == 2:
                iso = country.upper()
            else:
                iso = id_to_iso.get(str(country), '')
            if iso != country_code:
                continue
            seen.add(code)
            found.append((code, str(row.get('name') or code)))
        if isinstance(raw, dict) and not raw.get('next'):
            break
    return found or None


def list_payment_methods(company) -> dict:
    country = _country_code(company)
    try:
        live = _live_mobile(country)
    except Exception:
        logger.exception('Catalogue SasPay indisponible')
        live = None
    return build_groups(country, live)


def _return_url(client_reference: str) -> str:
    base = (settings.SASPAY_RETURN_URL or settings.WAVE_SUCCESS_URL or '').strip()
    if not base:
        base = 'https://stokeya.com/payment/success'
    sep = '&' if '?' in base else '?'
    return f'{base}{sep}ref={quote(client_reference, safe="")}'


def create_subscription_session(*, company, plan, user, billing_cycle='monthly', months=1):
    from companies.subscription_service import price_for_months

    months = int(months or 1)
    if months not in (1, 3, 6, 12):
        months = 12 if billing_cycle == 'annual' else 1

    amount = price_for_months(plan, months)
    if amount <= 0:
        raise PaymentError('Ce pack ne nécessite pas de paiement.')

    cycle = 'annual' if months >= 12 else 'monthly'
    client_reference = (
        f'SUB-{company.id}-{plan.code}-{months}m-'
        f'{timezone.now().strftime("%Y%m%d%H%M%S")}'
    )
    email, name = _customer(user, company)
    description = f'Abonnement STOKEYA {plan.name} {REF_MARKER}{client_reference}'
    remote = _open_session(
        amount=amount,
        description=description,
        country=_country_code(company),
        email=email,
        name=name,
        client_reference=client_reference,
        metadata={
            'client_reference': client_reference,
            'company_id': company.id,
            'plan_code': plan.code,
            'months': months,
            'kind': 'subscription',
        },
    )
    return SubscriptionWaveCheckout.objects.create(
        company=company,
        plan=plan,
        billing_cycle=cycle,
        months=months,
        provider=PaymentProvider.SASPAY,
        session_id=remote['id'][:100],
        client_reference=client_reference[:100],
        amount=amount,
        currency='XOF',
        wave_launch_url=remote['checkout_url'],
        raw_response={
            'id': remote['id'],
            'status': remote.get('status') or 'PENDING',
            'slug': remote.get('slug') or '',
        },
    )


def _open_session(*, amount, description, country, email, name, client_reference, metadata) -> dict:
    remote = _request('POST', '/checkout-sessions/', {
        'amount': f'{Decimal(amount):.2f}',
        'currency': 'XOF',
        'description': description[:240],
        'country': country,
        'customer_email': email,
        'customer_name': name[:120],
        'return_url': _return_url(client_reference),
        'metadata': metadata,
    })
    checkout_url = remote.get('checkout_url') or ''
    session_id = str(remote.get('id') or '')
    if not checkout_url or not session_id:
        raise PaymentError('SasPay n’a pas renvoyé de page de paiement.')
    remote['id'] = session_id
    remote['checkout_url'] = checkout_url
    return remote


def create_sale_session(*, sale, user):
    amount = Decimal(sale.total)
    if amount <= 0:
        raise PaymentError('Montant invalide.')

    client_reference = f'SALE-{sale.id}-{timezone.now().strftime("%Y%m%d%H%M%S")}'
    email, name = _customer(user, sale.company)
    customer = getattr(sale, 'customer', None)
    if customer is not None and getattr(customer, 'email', ''):
        email = customer.email
    if customer is not None and getattr(customer, 'name', ''):
        name = customer.name
    description = f'Vente STOKEYA {sale.reference} {REF_MARKER}{client_reference}'
    remote = _open_session(
        amount=amount,
        description=description,
        country=_country_code(sale.company),
        email=email,
        name=name,
        client_reference=client_reference,
        metadata={
            'client_reference': client_reference,
            'company_id': sale.company_id,
            'sale_id': sale.id,
            'sale_reference': sale.reference,
            'kind': 'sale',
        },
    )
    checkout = WaveCheckout.objects.create(
        sale=sale,
        provider=PaymentProvider.SASPAY,
        session_id=remote['id'][:100],
        client_reference=client_reference[:100],
        amount=amount,
        currency='XOF',
        wave_launch_url=remote['checkout_url'],
        raw_response={
            'id': remote['id'],
            'status': remote.get('status') or 'PENDING',
            'slug': remote.get('slug') or '',
        },
    )
    payment = sale.payments.filter(method__in=['mobile_money', 'card']).first()
    if payment:
        payment.reference = checkout.session_id
        payment.status = 'pending'
        payment.save(update_fields=['reference', 'status', 'updated_at'])
    sale.payment_status = PaymentStatus.UNPAID
    sale.save(update_fields=['payment_status', 'updated_at'])
    return checkout


def fetch_checkout_status(session_id: str) -> dict:
    return _request('GET', f'/checkout-sessions/{session_id}/status/')


def verify_payment(payment_id: str) -> dict:
    return _request('GET', f'/payments/{payment_id}/verify/')


def _reference_from(*sources) -> str:
    for source in sources:
        if not isinstance(source, dict):
            continue
        metadata = source.get('metadata') or {}
        if isinstance(metadata, dict) and metadata.get('client_reference'):
            return str(metadata['client_reference'])
        description = str(source.get('description') or '')
        if REF_MARKER in description:
            return description.split(REF_MARKER, 1)[1].strip().split()[0]
    return ''


def _assert_amount(checkout: SubscriptionWaveCheckout, *sources) -> None:
    expected = _money(checkout.amount)
    seen = None
    currency = 'XOF'
    for source in sources:
        if not isinstance(source, dict):
            continue
        if source.get('currency'):
            currency = str(source['currency']).upper()
        for key in ('requested_amount', 'amount'):
            if source.get(key) not in (None, ''):
                seen = _money(source.get(key))
                break
        if seen is not None:
            break
    if seen is None:
        raise PaymentError('Le montant confirmé ne correspond pas au paiement.')
    if currency in ('', 'XOF', 'FCFA'):
        if seen != expected:
            logger.warning(
                'Montant SasPay refusé pour %s (attendu %s, reçu %s %s)',
                checkout.client_reference, expected, seen, currency,
            )
            raise PaymentError('Le montant confirmé ne correspond pas au paiement.')
        return
    # Carte et crypto : SasPay convertit le montant XOF de la session en USD.
    if currency != 'USD':
        logger.warning(
            'Devise SasPay inattendue pour %s : %s',
            checkout.client_reference, currency,
        )
        raise PaymentError('Le montant confirmé ne correspond pas au paiement.')


def _lookup_reference(reference: str):
    if not reference:
        return None
    if reference.startswith('SUB-'):
        return SubscriptionWaveCheckout.objects.filter(
            client_reference=reference,
            provider=PaymentProvider.SASPAY,
        ).order_by('-created_at').first()
    return (
        WaveCheckout.objects.filter(
            client_reference=reference,
            provider=PaymentProvider.SASPAY,
        ).order_by('-created_at').first()
        or SubscriptionWaveCheckout.objects.filter(
            client_reference=reference,
            provider=PaymentProvider.SASPAY,
        ).order_by('-created_at').first()
    )


def _find_checkout(transaction_id: str, *sources):
    found = _lookup_reference(_reference_from(*sources))
    if found:
        return found

    if not transaction_id:
        return None

    found = (
        SubscriptionWaveCheckout.objects.filter(
            provider=PaymentProvider.SASPAY,
            raw_response__transaction_id=str(transaction_id),
        ).order_by('-created_at').first()
        or WaveCheckout.objects.filter(
            provider=PaymentProvider.SASPAY,
            raw_response__transaction_id=str(transaction_id),
        ).order_by('-created_at').first()
    )
    if found:
        return found

    since = timezone.now() - timedelta(days=2)
    pending = list(
        SubscriptionWaveCheckout.objects.filter(
            provider=PaymentProvider.SASPAY,
            created_at__gte=since,
        ).exclude(status=CheckoutStatus.COMPLETED).order_by('-created_at')[:15]
    ) + list(
        WaveCheckout.objects.filter(
            provider=PaymentProvider.SASPAY,
            created_at__gte=since,
        ).exclude(status=CheckoutStatus.COMPLETED).order_by('-created_at')[:15]
    )
    for checkout in pending:
        if not checkout.session_id:
            continue
        try:
            remote = fetch_checkout_status(checkout.session_id)
        except PaymentError:
            continue
        if str(remote.get('transaction_id') or '') == str(transaction_id):
            return checkout
    return None


def _remember_transaction(checkout: SubscriptionWaveCheckout, transaction_id: str):
    if not transaction_id:
        return
    raw = dict(checkout.raw_response or {})
    if raw.get('transaction_id') == str(transaction_id):
        return
    raw['transaction_id'] = str(transaction_id)
    checkout.raw_response = raw
    checkout.save(update_fields=['raw_response', 'updated_at'])


def _mark_failed(checkout: SubscriptionWaveCheckout, status: str):
    if checkout.status == CheckoutStatus.COMPLETED:
        return
    checkout.status = (
        CheckoutStatus.EXPIRED if status == 'EXPIRED' else CheckoutStatus.FAILED
    )
    checkout.save(update_fields=['status', 'updated_at'])


def sync_checkout(checkout: SubscriptionWaveCheckout) -> SubscriptionWaveCheckout:
    """Interroge SasPay et n'active l'abonnement que si le paiement est prouvé."""
    if checkout.provider != PaymentProvider.SASPAY or checkout.status == CheckoutStatus.COMPLETED:
        return checkout
    if not checkout.session_id:
        return checkout

    remote = fetch_checkout_status(checkout.session_id)
    session_status = str(remote.get('status') or '').upper()
    tx_status = str(remote.get('transaction_status') or '').upper()
    transaction_id = str(remote.get('transaction_id') or '')
    _remember_transaction(checkout, transaction_id)

    if tx_status in SUCCESS_STATUSES or session_status == 'PAID':
        if not transaction_id:
            return checkout
        verified = verify_payment(transaction_id)
        verified_status = str(verified.get('status') or '').upper()
        if verified_status not in SUCCESS_STATUSES:
            return checkout
        _assert_amount(checkout, verified, remote)
        mark_checkout_completed(checkout.client_reference, provider=PaymentProvider.SASPAY)
        checkout.refresh_from_db()
        sale = getattr(checkout, 'sale', None)
        if sale is not None:
            sale.refresh_from_db()
        return checkout

    if tx_status in FAIL_STATUSES or session_status in FAIL_STATUSES:
        _mark_failed(checkout, tx_status or session_status)
        checkout.refresh_from_db()
    return checkout


def verify_webhook_signature(raw_body: bytes, signature: str, timestamp: str) -> bool:
    secret = (settings.SASPAY_WEBHOOK_SECRET or '').strip()
    if not secret or not signature or not timestamp:
        return False
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False
    if abs(int(time.time()) - ts) > WEBHOOK_TOLERANCE_SECONDS:
        return False
    signed = f'{timestamp}.'.encode() + raw_body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.strip().lower())


def handle_webhook(raw_body: bytes, signature: str, timestamp: str) -> None:
    if not verify_webhook_signature(raw_body, signature, timestamp):
        raise SasPaySignatureError('Signature webhook SasPay invalide.')

    try:
        payload = json.loads(raw_body.decode('utf-8') or '{}')
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PaymentError('Corps de webhook illisible.') from exc
    if not isinstance(payload, dict):
        raise PaymentError('Corps de webhook illisible.')

    event = str(payload.get('event') or '')
    data = payload.get('data') if isinstance(payload.get('data'), dict) else {}
    transaction_id = str(data.get('id') or '')
    event_id = f'saspay:{event}:{transaction_id or data.get("reference") or timestamp}'[:200]
    if WaveWebhookEvent.objects.filter(event_id=event_id, processed=True).exists():
        return

    if event == 'transaction.success':
        verified = verify_payment(transaction_id) if transaction_id else {}
        if str(verified.get('status') or data.get('status') or '').upper() not in SUCCESS_STATUSES:
            raise PaymentError('Paiement SasPay non confirmé.')
        checkout = _find_checkout(transaction_id, verified, data)
        if checkout is None:
            logger.warning('Webhook SasPay sans abonnement correspondant: %s', event_id)
        else:
            _remember_transaction(checkout, transaction_id or str(verified.get('id') or ''))
            try:
                _assert_amount(checkout, verified, data)
            except PaymentError:
                logger.warning('Webhook SasPay ignoré, montant incorrect: %s', event_id)
            else:
                mark_checkout_completed(checkout.client_reference, provider=PaymentProvider.SASPAY)
    elif event in ('transaction.failed', 'transaction.cancelled'):
        checkout = _find_checkout(transaction_id, data)
        if checkout is not None:
            status = str(data.get('status') or '').upper()
            _mark_failed(checkout, status or 'FAILED')

    WaveWebhookEvent.objects.update_or_create(
        event_id=event_id,
        defaults={
            'event_type': event[:100],
            'payload': payload,
            'processed': True,
            'provider': PaymentProvider.SASPAY,
        },
    )
