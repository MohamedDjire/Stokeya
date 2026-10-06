from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CustomerTagViewSet, CustomerViewSet, LoyaltySettingsView

router = DefaultRouter()
router.register('customers', CustomerViewSet, basename='customer')
router.register('customer-tags', CustomerTagViewSet, basename='customer-tag')

urlpatterns = router.urls + [
    path('crm/loyalty-settings/', LoyaltySettingsView.as_view(), name='loyalty-settings'),
]
