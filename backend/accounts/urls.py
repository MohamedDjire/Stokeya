from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CompanyUserViewSet, PermissionFlagsCatalogView, RoleListView

router = DefaultRouter()
router.register('users', CompanyUserViewSet, basename='company-user')

urlpatterns = [
    path('roles/', RoleListView.as_view(), name='roles-list'),
    path('permission-flags/', PermissionFlagsCatalogView.as_view(), name='permission-flags'),
    *router.urls,
]
