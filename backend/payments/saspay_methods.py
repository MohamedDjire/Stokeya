"""Moyens SasPay, dans l'ordre d'encaissement STOKEYA : mobile money, carte, autres."""

# Réseaux actifs du catalogue SasPay, déjà ordonnés (Wave, Orange, MTN, puis le reste).
MOBILE_MONEY = {
    'BF': [('moov_bf', 'Moov'), ('orange_bf', 'Orange Money')],
    'BJ': [('mtn_bj', 'MTN MoMo'), ('moov_bj', 'Moov Money'), ('celtiis_bj', 'Celtiis Cash')],
    'CD': [('orange_cd', 'Orange Money'), ('airtel_cd', 'Airtel'), ('vodacom_cd', 'Vodacom')],
    'CI': [('wave_ci', 'Wave'), ('orange_ci', 'Orange Money'), ('mtn_ci', 'MTN MoMo'), ('moov_ci', 'Moov Money')],
    'CM': [('orange_cm', 'Orange Money'), ('mtn_cm', 'MTN MoMo')],
    'GH': [('mtn_gh', 'MTN MoMo'), ('vodafone_gh', 'Vodafone'), ('tigo_gh', 'Airtel / Tigo')],
    'GN': [('mtn_gn', 'MTN MoMo')],
    'KE': [('mpesa_ke', 'M-Pesa')],
    'ML': [('orange_ml', 'Orange Money'), ('moov_ml', 'Moov Money'), ('mobi_cash_ml', 'Mobi Cash')],
    'MW': [('airtel_mw', 'Airtel Money'), ('tnm_mw', 'TNM Mpamba')],
    'NE': [('airtel_ne', 'Airtel')],
    'NG': [('mtn_ng', 'MTN'), ('airtel_ng', 'Airtel Money')],
    'RW': [('mtn_rw', 'MTN MoMo'), ('airtel_rw', 'Airtel')],
    'SN': [
        ('wave_sn', 'Wave'),
        ('orange_sn', 'Orange Money'),
        ('freemoney_sn', 'Free Money'),
        ('wizall_sn', 'Wizall'),
    ],
    'TG': [('moov_tg', 'Moov Money'), ('togocel', 'Togocel Money')],
    'TZ': [
        ('mpesa_tz', 'M-Pesa'),
        ('tigo_tz', 'Tigo'),
        ('airtel_tz', 'Airtel'),
        ('halopesa_tz', 'Halopesa'),
    ],
    'UG': [('mtn_ug', 'MTN MoMo'), ('airtel_ug', 'Airtel')],
    'ZM': [('mtn_zm', 'MTN MoMo'), ('airtel_zm', 'Airtel'), ('zamtel_zm', 'Zamtel')],
}

_RANK = (
    'wave', 'orange', 'mtn', 'moov', 'freemoney', 'free', 'wizall',
    'celtiis', 'togocel', 'airtel', 'mpesa', 'vodafone', 'tigo',
    'halopesa', 'mobi', 'zamtel', 'tnm', 'vodacom',
)


def _rank(code: str) -> tuple:
    head = (code or '').split('_', 1)[0]
    try:
        return (_RANK.index(head), code)
    except ValueError:
        return (len(_RANK), code)


def _methods(pairs):
    ordered = sorted(pairs, key=lambda item: _rank(item[0]))
    return [{'code': code, 'label': label} for code, label in ordered]


def build_groups(country_code: str, live_mobile=None) -> dict:
    """live_mobile : liste (code, nom) renvoyée par SasPay, ou None pour le catalogue local."""
    country = (country_code or 'SN').upper()
    if live_mobile:
        pairs = [(code, name) for code, name in live_mobile if code and code not in ('card', 'crypto')]
    else:
        pairs = list(MOBILE_MONEY.get(country) or MOBILE_MONEY['SN'])
        country = country if country in MOBILE_MONEY else 'SN'

    return {
        'country': country,
        'groups': [
            {
                'code': 'mobile_money',
                'label': 'Mobile Money',
                'methods': _methods(pairs),
            },
            {
                'code': 'card',
                'label': 'Carte bancaire',
                'methods': [{'code': 'card', 'label': 'Visa / Mastercard'}],
            },
            {
                'code': 'other',
                'label': 'Autres moyens',
                'methods': [{'code': 'crypto', 'label': 'Crypto / stablecoins'}],
            },
        ],
    }
