from django.urls import path

from .views import (
    MockCompletePaymentView,
    MtnMoneyWebhookView,
    OrangeMoneyWebhookView,
    PaymentProvidersView,
    SubscriptionWaveCheckoutView,
    WaveCheckoutCreateView,
    WavePaymentStatusView,
    WaveWebhookView,
)

urlpatterns = [
    path('providers/', PaymentProvidersView.as_view(), name='payment-providers'),
    path('wave/checkout/', WaveCheckoutCreateView.as_view(), name='wave-checkout'),
    path('wave/subscription/', SubscriptionWaveCheckoutView.as_view(), name='wave-subscription'),
    path('wave/status/', WavePaymentStatusView.as_view(), name='wave-status'),
    path('wave/webhook/', WaveWebhookView.as_view(), name='wave-webhook'),
    path('orange/webhook/', OrangeMoneyWebhookView.as_view(), name='orange-webhook'),
    path('mtn/webhook/', MtnMoneyWebhookView.as_view(), name='mtn-webhook'),
    path('mock/complete/', MockCompletePaymentView.as_view(), name='mock-complete'),
]
