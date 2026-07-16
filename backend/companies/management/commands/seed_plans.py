from django.core.management.base import BaseCommand

from companies.plans import seed_plans


class Command(BaseCommand):
    help = 'Crée ou met à jour les packs d\'abonnement Inventra (Starter/Business/Enterprise).'

    def handle(self, *args, **options):
        plans = seed_plans()
        for code, plan in plans.items():
            self.stdout.write(
                self.style.SUCCESS(f'{code}: {plan.name} — {plan.price} FCFA')
            )
        self.stdout.write(self.style.SUCCESS('Packs synchronisés.'))
