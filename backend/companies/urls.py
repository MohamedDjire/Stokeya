from django.urls import path

from .views import (
    ChangePlanView,
    CompanyDetailView,
    CompanyLogoUploadView,
    CompanyPreferencesView,
    PlanListView,
    SubscriptionDetailView,
    SubscriptionSettingsView,
)

urlpatterns = [
    path('me/', CompanyDetailView.as_view(), name='company-me'),
    path('me/logo/', CompanyLogoUploadView.as_view(), name='company-logo'),
    path('preferences/', CompanyPreferencesView.as_view(), name='company-preferences'),
    path('subscription/', SubscriptionDetailView.as_view(), name='company-subscription'),
    path('subscription/change/', ChangePlanView.as_view(), name='company-subscription-change'),
    path('subscription/settings/', SubscriptionSettingsView.as_view(), name='company-subscription-settings'),
    path('plans/', PlanListView.as_view(), name='company-plans'),
]
