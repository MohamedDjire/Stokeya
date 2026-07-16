from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import StockRequestViewSet, StockViewSet, WarehouseListView

router = DefaultRouter()
router.register('stock', StockViewSet, basename='stock')
router.register('stock-requests', StockRequestViewSet, basename='stock-request')

urlpatterns = [
    path('warehouses-list/', WarehouseListView.as_view(), name='warehouses-list'),
    *router.urls,
]
