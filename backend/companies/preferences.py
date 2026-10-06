"""Préférences globales Stokeya (entreprise)."""

DEFAULT_PREFERENCES = {
    'regional': {
        'language': 'fr',  # fr | en | ar
        'timezone': 'Africa/Abidjan',
        'date_format': 'DD/MM/YYYY',
        'time_format': '24h',
        'number_format': 'fr-FR',
        'amount_format': 'spaced',  # 10 000 FCFA
        # Montants stockés en fx_base ; fx_rates = unités de base pour 1 unité de devise
        'fx_base': 'XOF',
        'fx_rates': {
            'XOF': 1,
            'EUR': 655.957,
            'USD': 600,
            'GNF': 0.07,
        },
    },
    'commercial': {
        'allow_sales_without_stock': False,
        'show_purchase_price': False,
        'show_margin': False,
        'confirm_before_sale': True,
        'auto_invoice_after_sale': False,
        'auto_print_receipt': True,
        'low_stock_alerts': True,
        'global_alert_threshold': None,  # null = utiliser min_stock produit
        'allow_negative_stock': False,
        'cost_method': 'average',  # fifo | last_purchase | average
        'auto_product_code': True,
        'auto_product_reference': True,
        'show_variants': False,
        'track_expiry_dates': True,
    },
    'display': {
        'theme': 'light',  # light | dark | auto
        'primary_color': '#0D9488',
        'show_logo_in_menu': True,
        'dashboard_style': 'standard',
        'page_size': 25,
    },
    'notifications': {
        'channels': {
            'in_app': True,
            'email': False,
            'whatsapp': False,
            'sms': False,
        },
        'events': {
            'low_stock': True,
            'out_of_stock': True,
            'new_sale': False,
            'new_expense': True,
            'new_customer': False,
            'new_supplier': False,
            'new_transfer': True,
            'new_online_order': True,
            'payment_received': True,
            'subscription_expiry': True,
        },
    },
    'documents': {
        'invoice_auto_number': True,
        'invoice_prefix': 'FAC',
        'receipt_show_logo': True,
        'receipt_show_address': True,
        'receipt_show_phone': True,
        'receipt_show_qr': False,
        'receipt_footer': 'Merci pour votre achat.\nÀ bientôt !',
    },
    'security': {
        'auto_logout_minutes': 60,
        'session_duration_hours': 12,
        'confirm_before_delete': True,
        'hide_sensitive_info': False,
        'multi_device_login': True,
        'two_factor_auth': False,
    },
    'backup': {
        'enabled': True,
        'frequency': 'daily',  # daily | weekly | monthly
        'hour': '02:00',
        'last_backup_at': None,
        'last_backup_size': None,
    },
    'automation': {
        'low_stock_notify': True,
        'low_stock_create_alert': True,
        'low_stock_auto_request': True,
        'sale_generate_invoice': False,
        'sale_send_to_customer': False,
        'online_order_notify_manager': True,
        'online_order_update_stock': True,
    },
    'advanced': {
        'maintenance_mode': False,
    },
}


def deep_merge(base: dict, override: dict | None) -> dict:
    """Fusion récursive : override gagne, sans perdre les clés absentes."""
    if not override:
        return {**base}
    result = {}
    for key, value in base.items():
        if key in override:
            if isinstance(value, dict) and isinstance(override[key], dict):
                result[key] = deep_merge(value, override[key])
            else:
                result[key] = override[key]
        else:
            result[key] = value
    for key, value in override.items():
        if key not in result:
            result[key] = value
    return result


def get_company_preferences(company) -> dict:
    stored = getattr(company, 'preferences', None) or {}
    return deep_merge(DEFAULT_PREFERENCES, stored if isinstance(stored, dict) else {})
