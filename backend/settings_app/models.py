from django.db import models
from common.models import TimeStampedModel


class CompanySettings(TimeStampedModel):
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='settings'
    )
    key = models.CharField(max_length=100)
    value = models.JSONField(default=dict)

    class Meta:
        verbose_name_plural = 'company settings'
        unique_together = ['company', 'key']

    def __str__(self):
        return f'{self.company.name} — {self.key}'
