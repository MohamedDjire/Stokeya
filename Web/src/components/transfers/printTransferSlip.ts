import type { StockTransfer } from '../../api/stock';
import { formatCurrency, formatDate, formatNumber } from '../../utils/format';

export function printTransferSlip(transfer: StockTransfer, companyName?: string) {
  const ref = transfer.reference || `TRF-${String(transfer.id).padStart(6, '0')}`;
  const items = transfer.items || [];
  const totalQty = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const w = window.open('', '_blank');
  if (!w) return;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Bon de transfert ${ref}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;padding:28px;color:#111;max-width:800px;margin:0 auto}
      h1{font-size:22px;margin:0 0 4px;letter-spacing:.04em}
      .sub{color:#555;margin-bottom:20px;font-size:13px}
      .box{border:1px solid #ccc;padding:12px 14px;margin:12px 0;display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}
      th{background:#f5f5f5}
      .tot{margin-top:16px;font-size:14px}
      .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px}
      .sign div{border-top:1px solid #333;padding-top:8px;font-size:13px;min-height:60px}
      @media print{body{padding:12px}}
    </style></head><body>
    <h1>BON DE TRANSFERT</h1>
    <div class="sub">${companyName || 'Stokeya'} — ${formatDate(transfer.created_at)}</div>
    <div><strong>N° ${ref}</strong> — Statut : ${transfer.status_display || transfer.status}</div>
    <div class="box">
      <div><strong>Source</strong><br/>${transfer.from_warehouse}</div>
      <div><strong>Destination</strong><br/>${transfer.to_warehouse}</div>
      <div><strong>Créé par</strong><br/>${transfer.created_by || '—'}</div>
      <div><strong>Transporteur</strong><br/>${transfer.carrier || '—'}</div>
    </div>
    ${transfer.notes ? `<p><strong>Commentaire :</strong> ${transfer.notes}</p>` : ''}
    <table>
      <thead><tr><th>#</th><th>Produit</th><th>SKU</th><th>Qté</th></tr></thead>
      <tbody>
        ${items.map((i, idx) => `<tr>
          <td>${idx + 1}</td>
          <td>${i.product_name}</td>
          <td>${i.product_sku || ''}</td>
          <td>${formatNumber(i.quantity)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="tot">
      <div><strong>${formatNumber(items.length)}</strong> produit(s) — <strong>${formatNumber(totalQty)}</strong> unité(s)</div>
    </div>
    <div class="sign">
      <div>Préparateur<br/><br/>________________</div>
      <div>Réceptionnaire<br/><br/>________________</div>
    </div>
    <script>window.print()</script>
  </body></html>`);
  w.document.close();
}

export function transferSummaryValue(
  items: Array<{ product_id: number; quantity: string | number }>,
  priceByProduct: Record<number, string | number>,
) {
  return items.reduce((sum, i) => {
    const qty = Number(i.quantity || 0);
    const price = Number(priceByProduct[i.product_id] || 0);
    return sum + qty * price;
  }, 0);
}

export function formatTransferValue(value: number) {
  return formatCurrency(value);
}
