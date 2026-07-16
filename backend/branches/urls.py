from rest_framework.routers import DefaultRouter

from .views import BranchViewSet, CashRegisterViewSet

router = DefaultRouter()
router.register('branches', BranchViewSet, basename='branch')
router.register('cash-registers', CashRegisterViewSet, basename='cash-register')

urlpatterns = router.urls
