"""Factures / reçus HTML pour les paiements d'abonnement."""

from html import escape

from . import wave_service


def _money(amount, currency='XOF'):
    try:
        n = int(float(amount))
    except (TypeError, ValueError):
        n = amount
    return f'{n} {currency}'


def build_subscription_invoice_html(checkout) -> str:
    company = checkout.company
    plan = checkout.plan
    provider = wave_service.PROVIDER_LABELS.get(checkout.provider, checkout.provider)
    months = getattr(checkout, 'months', 1) or 1
    ref = escape(checkout.client_reference)
    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/><title>Facture {ref}</title>
<style>
  body {{ font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 720px; margin: 40px auto; padding: 0 24px; }}
  h1 {{ font-size: 22px; margin-bottom: 4px; }}
  .muted {{ color: #666; font-size: 13px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 24px; }}
  th, td {{ text-align: left; padding: 10px 8px; border-bottom: 1px solid #e5e5e5; font-size: 14px; }}
  th {{ color: #555; font-weight: 600; }}
  .total {{ font-size: 18px; font-weight: 700; }}
  .stamp {{ margin-top: 32px; padding: 12px 16px; background: #f4f7f5; border-radius: 8px; }}
</style></head><body>
  <h1>Facture Stokeya</h1>
  <p class="muted">Référence {ref}</p>
  <p><strong>{escape(company.name)}</strong><br/>
  {escape(company.email or '')}<br/>
  {escape(company.phone or '')}</p>
  <table>
    <tr><th>Désignation</th><th>Période</th><th>Montant</th></tr>
    <tr>
      <td>Abonnement {escape(plan.name)}</td>
      <td>{months} mois</td>
      <td>{_money(checkout.amount, checkout.currency)}</td>
    </tr>
    <tr><td colspan="2" class="total">Total TTC</td><td class="total">{_money(checkout.amount, checkout.currency)}</td></tr>
  </table>
  <div class="stamp">
    Statut : <strong>Payé</strong><br/>
    Moyen : {escape(provider)}<br/>
    Date : {checkout.created_at.strftime('%d/%m/%Y %H:%M') if checkout.created_at else '—'}
  </div>
  <p class="muted" style="margin-top:40px">Stokeya — Gestion commerciale</p>
</body></html>"""


def build_subscription_receipt_html(checkout) -> str:
    company = checkout.company
    plan = checkout.plan
    provider = wave_service.PROVIDER_LABELS.get(checkout.provider, checkout.provider)
    ref = escape(checkout.client_reference)
    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/><title>Reçu {ref}</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 420px; margin: 32px auto; padding: 24px; border: 1px solid #eee; border-radius: 12px; }}
  h1 {{ font-size: 18px; margin: 0 0 8px; }}
  .ok {{ color: #1b7a3d; font-weight: 700; }}
  p {{ margin: 6px 0; font-size: 14px; }}
</style></head><body>
  <h1>Reçu de paiement</h1>
  <p class="ok">PAYÉ</p>
  <p><strong>{escape(company.name)}</strong></p>
  <p>Pack : {escape(plan.name)}</p>
  <p>Montant : <strong>{_money(checkout.amount, checkout.currency)}</strong></p>
  <p>Moyen : {escape(provider)}</p>
  <p>Réf. : {ref}</p>
  <p>Date : {checkout.created_at.strftime('%d/%m/%Y %H:%M') if checkout.created_at else '—'}</p>
</body></html>"""
