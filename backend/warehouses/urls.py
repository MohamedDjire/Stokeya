from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import WarehouseLocationViewSet, WarehouseViewSet

router = DefaultRouter()
router.register('warehouses', WarehouseViewSet, basename='warehouse')
router.register('locations', WarehouseLocationViewSet, basename='location')

urlpatterns = router.urls
