from django.urls import path

from .views import (
    ChangePlanView,
    CompanyDetailView,
    PlanListView,
    SubscriptionDetailView,
)

urlpatterns = [
    path('me/', CompanyDetailView.as_view(), name='company-me'),
    path('subscription/', SubscriptionDetailView.as_view(), name='company-subscription'),
    path('subscription/change/', ChangePlanView.as_view(), name='company-subscription-change'),
    path('plans/', PlanListView.as_view(), name='company-plans'),
]
