from django.urls import path

from .analytics import AnalyticsFiltersView, AnalyticsView
from .export import AnalyticsExportView
from .views import FinanceReportView, SalesReportView

urlpatterns = [
    path('sales/', SalesReportView.as_view(), name='report-sales'),
    path('finance/', FinanceReportView.as_view(), name='report-finance'),
    path('analytics/', AnalyticsView.as_view(), name='report-analytics'),
    path('analytics/export/', AnalyticsExportView.as_view(), name='report-analytics-export'),
    path('analytics/filters/', AnalyticsFiltersView.as_view(), name='report-analytics-filters'),
]
