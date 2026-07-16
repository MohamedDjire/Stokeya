from django.contrib import admin
from .models import Sale, SaleItem, Payment, SaleReturn


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['reference', 'company', 'branch', 'total', 'status', 'created_at']
    list_filter = ['status', 'payment_status', 'company']
    inlines = [SaleItemInline, PaymentInline]


@admin.register(SaleReturn)
class SaleReturnAdmin(admin.ModelAdmin):
    list_display = ['sale', 'status', 'refund_amount', 'created_at']
