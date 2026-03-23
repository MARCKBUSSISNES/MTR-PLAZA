// ---------- Reports ----------
function saleDetailMoney(v){ return money(Number(v||0)); }

function saleDetailDate(v){
  if(!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function saleDetailClientName(rec){
  if(!rec?.client) return 'MOSTRADOR';
  return `${rec.client.names||''} ${rec.client.last||''}`.trim() || 'MOSTRADOR';
}

function saleDetailPayment(rec){
  if(rec?.payMethod === 'MIXTO' && rec?.paySplit){
    return `MIXTO · Efectivo ${saleDetailMoney(rec.paySplit.EFECTIVO||0)} + Tarjeta ${saleDetailMoney(rec.paySplit.TARJETA||0)}`;
  }
  return rec?.payMethod || '—';
}

function saleDetailItemsHtml(items){
  const rows = (items||[]).map(it=>{
    const qty = Number(it.qty||0);
    const price = Number(it.price||0);
    const total = Number((qty*price).toFixed(2));
    return `
      <tr>
        <td>${qty}</td>
        <td>${escapeHtml(it.code||'')}</td>
        <td>${escapeHtml(it.name||'')}</td>
        <td>${saleDetailMoney(price)}</td>
        <td>${saleDetailMoney(total)}</td>
      </tr>
    `;
  }).join('');
  if(rows) return rows;
  return '<tr><td colspan="5">Sin productos registrados.</td></tr>';
}

async function openSaleDetailModal(record, kind='sale'){
  if(!record) return;

  const overlay = $('saleDetailOverlay');
  const title = $('saleDetailTitle');
  const sub = $('saleDetailSub');
  const content = $('saleDetailContent');
  if(!overlay || !title || !sub || !content) return;

  let linkedShipment = null;
  if(kind === 'sale' && record.shipmentId){
    try{ linkedShipment = await idbGet('shipments', record.shipmentId); }catch(e){}
  }

  const isShipment = (record.saleType === 'ENVIO') || kind === 'shipment';
  const productTotal = Number((record.productTotal ?? Math.max(Number((record.total||0) - Number(record.shippingFee||0)), 0)).toFixed(2));
  const shippingFee = Number(record.shippingFee || 0);
  const createdAt = kind === 'shipment' ? record.ts : (linkedShipment?.ts || record.ts);
  const paidAt = kind === 'shipment' ? (record.paidAt || null) : (record.paidAt || linkedShipment?.paidAt || null);
  const status = kind === 'shipment' ? (record.status || 'PENDIENTE') : 'PAGADO';
  const client = record.client || null;
  const clientName = saleDetailClientName(record);
  const sourceLabel = kind === 'shipment' ? 'Envíos' : 'Reportes';

  title.textContent = kind === 'shipment' ? `Detalle de envío #${record.receiptNo||''}` : `Detalle de venta #${record.receiptNo||''}`;
  sub.textContent = `${sourceLabel} · ${record.saleType || 'MOSTRADOR'} · ${saleDetailPayment(record)}`;

  content.innerHTML = `
    <div class="sale-detail-badges">
      <span class="sale-detail-badge ${status === 'PAGADO' ? 'paid' : 'pending'}">${status === 'PAGADO' ? '✅ PAGADO' : '⏳ PENDIENTE'}</span>
      <span class="sale-detail-badge ${isShipment ? 'ship' : 'shop'}">${escapeHtml(record.saleType || 'MOSTRADOR')}</span>
      <span class="sale-detail-badge shop">${escapeHtml(record.receiptNo || '—')}</span>
    </div>

    <div class="sale-detail-grid">
      <div class="sale-detail-box">
        <h4>Cliente</h4>
        <div class="sale-detail-list">
          <div class="sale-detail-row"><span>Nombre</span><strong>${escapeHtml(clientName)}</strong></div>
          <div class="sale-detail-row"><span>Teléfono</span><strong>${escapeHtml(client?.phone || '—')}</strong></div>
          <div class="sale-detail-row"><span>NIT</span><strong>${escapeHtml(client?.nit || '—')}</strong></div>
          <div class="sale-detail-row"><span>Dirección</span><strong>${escapeHtml(client?.addr || '—')}</strong></div>
          <div class="sale-detail-row"><span>Indicaciones</span><strong>${escapeHtml(client?.indic || '—')}</strong></div>
        </div>
      </div>

      <div class="sale-detail-box">
        <h4>Pago y tiempos</h4>
        <div class="sale-detail-list">
          <div class="sale-detail-row"><span>Forma de pago</span><strong>${escapeHtml(saleDetailPayment(record))}</strong></div>
          <div class="sale-detail-row"><span>Creado</span><strong>${escapeHtml(saleDetailDate(createdAt))}</strong></div>
          <div class="sale-detail-row"><span>Pagado</span><strong>${escapeHtml(saleDetailDate(paidAt))}</strong></div>
          <div class="sale-detail-row"><span>ID interno</span><strong>${escapeHtml(record.id || '—')}</strong></div>
          ${kind === 'shipment' && record.saleId ? `<div class="sale-detail-row"><span>Venta generada</span><strong>${escapeHtml(record.saleId)}</strong></div>` : ''}
          ${kind === 'sale' && record.shipmentId ? `<div class="sale-detail-row"><span>ID envío</span><strong>${escapeHtml(record.shipmentId)}</strong></div>` : ''}
        </div>
      </div>

      <div class="sale-detail-box">
        <h4>Totales</h4>
        <div class="sale-detail-list">
          <div class="sale-detail-row"><span>Subtotal</span><strong>${saleDetailMoney(record.subtotal ?? productTotal)}</strong></div>
          <div class="sale-detail-row"><span>Descuento</span><strong>${saleDetailMoney(record.discountAmount || 0)}</strong></div>
          <div class="sale-detail-row"><span>Total productos</span><strong>${saleDetailMoney(productTotal)}</strong></div>
          <div class="sale-detail-row"><span>Cobro envío</span><strong>${shippingFee > 0 ? saleDetailMoney(shippingFee) : 'No'}</strong></div>
          <div class="sale-detail-row"><span>Total final</span><strong>${saleDetailMoney(record.total || 0)}</strong></div>
        </div>
        <div class="sale-detail-note">El cobro de envío sí se refleja en ventas y cierres aunque no aparezca desglosado en el ticket de envío.</div>
      </div>
    </div>

    <div class="sale-detail-box">
      <h4>Productos comprados</h4>
      <div style="overflow:auto;">
        <table class="sale-detail-items">
          <thead>
            <tr>
              <th>Cant.</th>
              <th>Código</th>
              <th>Producto</th>
              <th>Precio</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${saleDetailItemsHtml(record.items)}</tbody>
        </table>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
}

function closeSaleDetailModal(){
  const overlay = $('saleDetailOverlay');
  if(!overlay) return;
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');
}

async function renderReport(mode){
  const all = await idbAll("sales");
  const now = Date.now();
  let list = [];

  if(mode==="daily"){
    const k = todayKey(now);
    list = all.filter(s=>s.dateKey===k);
  }else if(mode==="weekly"){
    const k = weekKey(now);
    list = all.filter(s=>s.weekKey===k);
  }else{
    const k = monthKey(now);
    list = all.filter(s=>s.monthKey===k);
  }

  const total = list.reduce((a,s)=>a+Number(s.total||0),0);
  $("repCount").textContent = list.length;
  $("repTotal").textContent = money(total);

  const tb = $("salesBody");
  tb.innerHTML = "";
  for(const s of list.sort((a,b)=>b.ts-a.ts)){
    const d = new Date(s.ts);
    const when = d.toLocaleString();
    const c = s.client ? `${s.client.names} ${s.client.last}` : "MOSTRADOR";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><small>${escapeHtml(when)}</small><br><small>#${escapeHtml(s.receiptNo||"")}</small></td>
      <td>${escapeHtml(c)}<br><small>${escapeHtml(s.saleType||"")}</small></td>
      <td>${escapeHtml(s.payMethod||"")}</td>
      <td>${money(s.total)}</td>
      <td>
        <button class="btn small" data-viewsale="${escapeHtml(s.id)}">Ver</button>
        <button class="btn danger small" data-delsale="${escapeHtml(s.id)}">Anular</button>
      </td>
    `;
    tb.appendChild(tr);
  }
}


async function voidSaleRecord(sale){
  if(!sale || !sale.id) return false;

  const auth = (typeof authorizeSaleVoid === "function") ? authorizeSaleVoid() : null;
  if(!auth) return false;

  const reasonRaw = prompt("Motivo de anulación:");
  if(reasonRaw===null) return false;
  const reason = String(reasonRaw||"").trim();
  if(!reason){
    alert("Debe ingresar el motivo de la anulación.");
    return false;
  }

  const items = Array.isArray(sale.items) ? sale.items.map(it=> ({...it})) : [];

  await idbPut("voids", {
    id: `VOID_${sale.id}_${Date.now()}`,
    saleId: sale.id,
    ts: Date.now(),
    saleTs: Number(sale.ts || 0),
    receiptNo: sale.receiptNo || "",
    cashierName: auth.cashierName,
    authRole: auth.role || "CAJERO",
    reason,
    saleType: sale.saleType || "MOSTRADOR",
    payMethod: sale.payMethod || "",
    clientName: sale.client ? `${sale.client.names||""} ${sale.client.last||""}`.trim() : "MOSTRADOR",
    total: Number(sale.total || 0),
    subtotal: Number(sale.subtotal || 0),
    discountAmount: Number(sale.discountAmount || 0),
    items,
    itemSummary: (typeof formatVoidItemsText === "function") ? formatVoidItemsText(items) : "",
    dateKey: todayKey(),
    createdAtText: new Date().toLocaleString()
  });

  if(items.length && typeof restoreStockForItems === "function"){
    await restoreStockForItems(items, "ANULACION", sale.id, `Anulación de venta #${sale.receiptNo || sale.id}`);
  }

  await idbDel("sales", sale.id);
  return true;
}
