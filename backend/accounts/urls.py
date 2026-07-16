from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CompanyUserViewSet, RoleListView

router = DefaultRouter()
router.register('users', CompanyUserViewSet, basename='company-user')

urlpatterns = [
    path('roles/', RoleListView.as_view(), name='roles-list'),
    *router.urls,
]
