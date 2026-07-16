from django.contrib import admin
from .models import Product, Barcode, ProductBatch


class BarcodeInline(admin.TabularInline):
    model = Barcode
    extra = 1


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'sku', 'sale_price', 'company', 'is_active']
    list_filter = ['company', 'category', 'brand', 'is_active']
    search_fields = ['name', 'sku']
    inlines = [BarcodeInline]


@admin.register(ProductBatch)
class ProductBatchAdmin(admin.ModelAdmin):
    list_display = ['product', 'batch_number', 'expiry_date', 'quantity']
