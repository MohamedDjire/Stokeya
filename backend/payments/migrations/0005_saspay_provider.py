from django.db import migrations, models


PROVIDER_CHOICES = [
    ('wave', 'Wave'),
    ('orange_money', 'Orange Money'),
    ('mtn_money', 'MTN Money'),
    ('paypal', 'PayPal'),
    ('saspay', 'SasPay'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0004_subscription_hub'),
    ]

    operations = [
        migrations.AlterField(
            model_name='subscriptionwavecheckout',
            name='provider',
            field=models.CharField(
                choices=PROVIDER_CHOICES, db_index=True, default='wave', max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='wavecheckout',
            name='provider',
            field=models.CharField(
                choices=PROVIDER_CHOICES, db_index=True, default='wave', max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='wavewebhookevent',
            name='provider',
            field=models.CharField(choices=PROVIDER_CHOICES, default='wave', max_length=20),
        ),
    ]
