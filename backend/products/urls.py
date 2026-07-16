from rest_framework.routers import DefaultRouter

from .views import ProductBatchViewSet, ProductViewSet

router = DefaultRouter()
router.register('products', ProductViewSet, basename='product')
router.register('batches', ProductBatchViewSet, basename='batch')

urlpatterns = router.urls
