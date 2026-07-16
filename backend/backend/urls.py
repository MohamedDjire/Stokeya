from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('authentication.urls')),
    path('api/v1/company/', include('companies.urls')),
    path('api/v1/', include('branches.urls')),
    path('api/v1/', include('warehouses.urls')),
    path('api/v1/', include('units.urls')),
    path('api/v1/', include('categories.urls')),
    path('api/v1/', include('brands.urls')),
    path('api/v1/', include('products.urls')),
    path('api/v1/dashboard/', include('dashboard.urls')),
    path('api/v1/', include('inventory.urls')),
    path('api/v1/', include('sales.urls')),
    path('api/v1/payments/', include('payments.urls')),
    path('api/v1/', include('customers.urls')),
    path('api/v1/', include('suppliers.urls')),
    path('api/v1/', include('purchases.urls')),
    path('api/v1/', include('expenses.urls')),
    path('api/v1/reports/', include('reports.urls')),
    path('api/v1/', include('accounts.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
