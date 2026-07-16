from django.contrib import admin
from .models import WaveCheckout, WaveWebhookEvent


@admin.register(WaveCheckout)
class WaveCheckoutAdmin(admin.ModelAdmin):
    list_display = ['client_reference', 'amount', 'status', 'session_id', 'created_at']
    list_filter = ['status']


@admin.register(WaveWebhookEvent)
class WaveWebhookEventAdmin(admin.ModelAdmin):
    list_display = ['event_id', 'event_type', 'processed', 'created_at']
