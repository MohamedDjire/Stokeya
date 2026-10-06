from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    MerchantQuestionViewSet,
    MerchantReviewViewSet,
    OnlineShopSettingsView,
    ShopDetailView,
    ShopFavoriteView,
    ShopHomeView,
    ShopOrderCreateView,
    ShopOrderTrackView,
    ShopOrderViewSet,
    ShopProductListView,
    ShopProductLookupView,
    ShopQuestionView,
    ShopReviewCreateView,
)

public_urlpatterns = [
    path('track/', ShopOrderTrackView.as_view(), name='shop-order-track'),
    path('<str:identifier>/', ShopDetailView.as_view(), name='shop-detail'),
    path('<str:identifier>/home/', ShopHomeView.as_view(), name='shop-home'),
    path('<str:identifier>/products/', ShopProductListView.as_view(), name='shop-products'),
    path('<str:identifier>/lookup/', ShopProductLookupView.as_view(), name='shop-lookup'),
    path('<str:identifier>/orders/', ShopOrderCreateView.as_view(), name='shop-order-create'),
    path('<str:identifier>/reviews/', ShopReviewCreateView.as_view(), name='shop-reviews'),
    path('<str:identifier>/questions/', ShopQuestionView.as_view(), name='shop-questions'),
    path('<str:identifier>/favorites/', ShopFavoriteView.as_view(), name='shop-favorites'),
]

_order_router = DefaultRouter()
_order_router.register('', ShopOrderViewSet, basename='shop-order')
order_urlpatterns = _order_router.urls

_merchant_router = DefaultRouter()
_merchant_router.register('product-questions', MerchantQuestionViewSet, basename='product-question')
_merchant_router.register('product-reviews', MerchantReviewViewSet, basename='product-review')

merchant_urlpatterns = [
    path('online-shop/', OnlineShopSettingsView.as_view(), name='online-shop-settings'),
] + _merchant_router.urls

urlpatterns = public_urlpatterns
