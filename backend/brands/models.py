from django.db import models
from common.models import CompanyScopedModel


class Brand(CompanyScopedModel):
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
