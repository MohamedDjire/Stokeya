from django.db import models
from common.models import CompanyScopedModel


class Unit(CompanyScopedModel):
    name = models.CharField(max_length=50)
    abbreviation = models.CharField(max_length=10)

    class Meta:
        verbose_name = 'unité'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.abbreviation})'
