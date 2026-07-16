from rest_framework import serializers

from .models import Unit


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ['id', 'name', 'abbreviation', 'created_at']
        read_only_fields = ['id', 'created_at']
