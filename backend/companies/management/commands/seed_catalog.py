from django.core.management.base import BaseCommand

from common.catalog_seed import seed_company_catalog
from companies.models import Company


class Command(BaseCommand):
    help = 'Ajoute les unités et catégories catalogue par défaut à toutes les entreprises (ou une seule).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--company-id',
            type=int,
            help='Limiter à une entreprise (id).',
        )

    def handle(self, *args, **options):
        qs = Company.objects.all().order_by('id')
        company_id = options.get('company_id')
        if company_id:
            qs = qs.filter(id=company_id)
        if not qs.exists():
            self.stdout.write(self.style.WARNING('Aucune entreprise trouvée.'))
            return

        total_u = total_c = 0
        for company in qs:
            result = seed_company_catalog(company)
            total_u += result['units']
            total_c += result['categories']
            self.stdout.write(
                f"  {company.name}: +{result['units']} unité(s), +{result['categories']} catégorie(s)"
            )

        self.stdout.write(self.style.SUCCESS(
            f'Terminé — {qs.count()} entreprise(s), {total_u} unité(s) et {total_c} catégorie(s) créées.'
        ))
