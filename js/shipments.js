// ---------- Sales / Shipments / Checkout ----------
async function nextReceiptNo(){
  const meta = await idbGet("meta","receiptNo");
  const n = meta?.value ? Number(meta.value) : 1;
  await idbPut("meta",{key:"receiptNo", value:n+1});
  return n;
}

function requireClientIfShipping(){
  const type = $("saleType").value;
  if(type==="ENVIO"){
    const c = state.selectedClient;
    if(!c || !c.phone || !c.names || !c.last || !c.addr){
      return {ok:false, msg:"En ENVÍO es obligatorio seleccionar/crear un cliente con teléfono, nombre y dirección."};
    }
  }
  return {ok:true};
}

async function validateStockForCart(){
  for(const it of state.cart){
    const p = await getProductByCode(it.code);
    if(!p) return {ok:false, msg:"Producto no existe: " + it.code};
    if(Number(p.stock||0) < it.qty) return {ok:false, msg:`Stock insuficiente para "${p.name}". Stock:${p.stock} Cant:${it.qty}`};
  }
  return {ok:true};
}

async function deductStockForCart(refType="VENTA", refId="", note=""){
  for(const it of state.cart){
    const p = await getProductByCode(it.code);
    p.stock = Number(p.stock||0) - it.qty;
    p.updatedAt = Date.now();
    await idbPut("products", p);
    // Kardex: salida por venta/envío
    await logMovement({
      type: "SALIDA",
      code: it.code,
      name: p.name || it.name || "",
      qty: -Number(it.qty||0),
      stockAfter: p.stock,
      refType: refType,
      refId: refId,
      note: note || (refType==="ENVIO" ? "Envío" : "Venta")
    });
  }
}

async function restoreStockForItems(items, refType="", refId="", note=""){
  for(const it of (items||[])){
    const p = await getProductByCode(it.code);
    if(!p) continue;
    p.stock = Number(p.stock||0) + Number(it.qty||0);
    p.updatedAt = Date.now();
    await idbPut("products", p);
    // Kardex: entrada por devolución/anulación
    await logMovement({
      type: "ENTRADA",
      code: it.code,
      name: p.name || it.name || "",
      qty: Number(it.qty||0),
      stockAfter: p.stock,
      refType: refType,
      refId: refId,
      note: note || "Restock"
    });
  }
}


function playSaleTone(){
  try{
    const a = document.getElementById('saleTone');
    if(!a) return;
    a.currentTime = 0;
    const p = a.play();
    if(p && typeof p.catch === 'function') p.catch(()=>{});
  }catch(e){}
}

const SHIPMENT_FEE = 35;

async function checkout(){
  if(state._checkoutBusy) return;
  state._checkoutBusy = true;
  try{
  if(state.cart.length===0) return alert("No hay productos en la venta.");
  const clientRule = requireClientIfShipping();
  if(!clientRule.ok) return alert(clientRule.msg);

  const saleType = $("saleType").value;
  let payMethod = $("payMethod").value;
  let paySplit = null;
  if(payMethod==="MIXTO"){
    const subtotalTmp = cartSubtotal();
    const discountAmountTmp = cartDiscountAmount(subtotalTmp);
    const productTotalTmp = Math.max(subtotalTmp - discountAmountTmp, 0);
    const totalTmp = saleType === "ENVIO"
      ? Number((productTotalTmp + SHIPMENT_FEE).toFixed(2))
      : Number(productTotalTmp.toFixed(2));

    const cash = Number($("mixCash")?.value || 0);
    const card = Number($("mixCard")?.value || 0);
    if(!isFinite(cash) || cash<0) return alert("Efectivo inválido.");
    if(!isFinite(card) || card<0) return alert("Tarjeta inválida.");

    const sum = Number((cash + card).toFixed(2));
    const tot = Number(totalTmp.toFixed(2));
    if(Math.abs(sum - tot) > 0.01){
      return alert("Pago mixto: la suma de Efectivo + Tarjeta debe ser igual al total.");
    }
    paySplit = { EFECTIVO: Number(cash.toFixed(2)), TARJETA: Number(card.toFixed(2)) };
  }

  // WhatsApp auto (si hay teléfono). Abrimos una pestaña en blanco YA (para evitar bloqueos por popups en async).
  const _waPhonePre = normalizePhoneForWA(state.selectedClient?.phone || $("cPhone")?.value || "");
  let _waWin = null;
  if(_waPhonePre){
    try{ _waWin = window.open("about:blank", "_blank"); }catch(e){ _waWin = null; }
  }

  const subtotal = cartSubtotal();
  const discountAmount = cartDiscountAmount(subtotal);
  const productTotal = Math.max(subtotal - discountAmount, 0);
  const shippingFee = (saleType === "ENVIO") ? SHIPMENT_FEE : 0;
  const total = Number((productTotal + shippingFee).toFixed(2));

  const ts = Date.now();
  const id = "S-" + ts + "-" + Math.random().toString(16).slice(2,8);
  const receiptNo = await nextReceiptNo();

  // Validar stock siempre (MOSTRADOR y ENVÍO)
  const st = await validateStockForCart();
  if(!st.ok) return alert(st.msg);

  // Opción A: ENVIÓ descuenta stock al crear el envío pendiente (lo que tú elegiste).
  await deductStockForCart(saleType, receiptNo, "Venta");

  const client = (saleType==="ENVIO") ? state.selectedClient : (state.selectedClient || null);

  if(saleType === "ENVIO"){
    // Crear ENVÍO pendiente (no entra a ventas/reporte/cierre hasta que se marque PAGADO)
    const shipment = {
      id: "E-" + ts + "-" + Math.random().toString(16).slice(2,8),
      ts,
      dateKey: todayKey(ts),
      weekKey: weekKey(ts),
      monthKey: monthKey(ts),
      saleType, payMethod,
    paySplit,
      status: "PENDIENTE",
      client: client ? { phone:client.phone, names:client.names, last:client.last, nit:(client.nit||""), addr:client.addr, indic:client.indic } : null,
      items: state.cart.map(x=>({...x})),
      subtotal: Number(subtotal.toFixed(2)),
      discountType: state.discount.type,
      discountValue: Number(state.discount.value||0),
      discountAmount: Number(discountAmount.toFixed(2)),
      productTotal: Number(productTotal.toFixed(2)),
      shippingFee: Number(shippingFee.toFixed(2)),
      total: Number(total.toFixed(2)),
      receiptNo: pad(receiptNo, 6),
      shop: state.settings.shopName || "Tienda de Ropa",
      stockDeducted: true,
      paidAt: null,
      saleId: null
    };

    await idbPut("shipments", shipment);
    state.lastReceipt = shipment;

    // ✅ ENVÍO: dispara acciones automáticas dentro del click (evita bloqueos del navegador)
    try{
      // Pre-abrir WhatsApp en blanco (mantiene gesto del usuario)
      const __ph = getClientPhoneFromReceipt(shipment);
      if(__ph){
        _waWin = _waWin || window.open("about:blank","_blank");
      }
      // Lanzar descarga sin await para no perder gesto del usuario
      if(state.settings.autoPNG){
        try{
          // 🔥 asegurar que el ticket esté actualizado antes de capturar PNG
          if(typeof updateReceiptPreview === "function"){
            try{ updateReceiptPreview(); }catch(e){}
          }
          // pequeño delay para que el DOM pinte (evita PNG vacío / bloqueado)
          setTimeout(()=>{
            try{ downloadReceiptPNG(); }catch(e){}
          }, 80);
        }catch(e){}
      }else if(state.settings.autoPDF){
        try{ generatePDF(); }catch(e){}
      }
      // Enviar a WhatsApp (si hay teléfono)
      if(__ph){
        const __url = "https://wa.me/" + __ph + "?text=" + encodeURIComponent(saleToReceiptText(shipment));
        if(_waWin) _waWin.location.href = __url;
        else { const w = window.open(__url, "_blank"); if(!w) window.location.href = __url; }
      }
    }catch(e){}


 await autoBackupToFolder("envio_pendiente");

    // reset carrito + descuento
    state.discount = {type:"NONE", value:0};
    syncDiscUI();
    cartClear();

    // limpiar UI + KPIs
    await refreshKPIs();
    refreshProductPicker();
    if(state.view==="inventory") renderInventory();
    updateReceiptPreview();
    if(state.view==="shipments") renderShipments();

    showOkModal("Registro exitoso","", {enter:true});
    return;
  }

  // MOSTRADOR: sí es venta directa
  const sale = {
    id, ts,
    dateKey: todayKey(ts),
    weekKey: weekKey(ts),
    monthKey: monthKey(ts),
    saleType, payMethod,
    client: client ? { phone:client.phone, names:client.names, last:client.last, nit:(client.nit||""), addr:client.addr } : null,
    items: state.cart.map(x=>({...x})),
    subtotal: Number(subtotal.toFixed(2)),
    discountType: state.discount.type,
    discountValue: Number(state.discount.value||0),
    discountAmount: Number(discountAmount.toFixed(2)),
    productTotal: Number(productTotal.toFixed(2)),
    shippingFee: Number(shippingFee.toFixed(2)),
    total: Number(total.toFixed(2)),
    receiptNo: pad(receiptNo, 6),
    shop: state.settings.shopName || "Tienda de Ropa",
    source: "DIRECT"
  };

  await idbPut("sales", sale);
  state.lastReceipt = sale;
  await autoBackupToFolder("venta");

  // reset carrito + descuento
  state.discount = {type:"NONE", value:0};
  syncDiscUI();

  cartClear();
  await refreshKPIs();
  refreshProductPicker();
  if(state.view==="inventory") renderInventory();
  updateReceiptPreview();

  // Auto descargas (solo 1 descarga automática para evitar bloqueo del navegador)
  // Para MOSTRADOR (no ENVÍO):
  // - Si autoPNG => descarga PNG
  // - Si no, pero autoPDF => descarga PDF
  if(sale.saleType !== "ENVIO"){
    if(state.settings.autoPNG){
      try{ await downloadReceiptPNG(); }catch(e){}
    }else if(state.settings.autoPDF){
      try{ generatePDF(); }catch(e){}
    }
  }


  // WhatsApp auto: si hay teléfono, abre chat con el recibo
  try{
    const __url = (function(){
      const txt = saleToReceiptText(sale);
      const ph = getClientPhoneFromReceipt(sale);
      return ph ? ("https://wa.me/" + ph + "?text=" + encodeURIComponent(txt)) : "";
    })();
    if(__url){
      if(_waWin) _waWin.location.href = __url;
      else { const w = window.open(__url, "_blank"); if(!w) window.location.href = __url; }
    }else if(_waWin){
      try{ _waWin.close(); }catch(e){}
    }
  }catch(e){}
playSaleTone();
  try{ sessionStorage.setItem("mt_post_reload_ok", JSON.stringify({title:"Registro exitoso", msg:"Venta registrada."})); }catch(e){}
  showCheckoutLoading("Espera un momento…");
  setTimeout(()=>location.reload(), 3000);
  } finally { state._checkoutBusy = false; }
}

// ---------- Shipments ----------
function shipmentClientName(s){
  return s.client ? `${s.client.names} ${s.client.last}` : "—";
}
function shipmentSearchKey(s){
  return normKey(`${s.receiptNo||""} ${s.client?.phone||""} ${shipmentClientName(s)} ${s.client?.addr||""}`);
}
async function renderShipments(){
  const q = normKey($("shipSearch").value);
  const f = $("shipFilter").value || "ALL";
  const all = await idbAll("shipments");

  let list = all;
  if(f !== "ALL") list = list.filter(s => (s.status||"PENDIENTE") === f);
  if(q) list = list.filter(s => shipmentSearchKey(s).includes(q));

  list.sort((a,b)=>b.ts-a.ts);

  const tb = $("shipBody");
  tb.innerHTML = "";

  for(const s of list){
    const d = new Date(s.ts).toLocaleString();
    const tr = document.createElement("tr");
    const status = s.status || "PENDIENTE";
    const statusHtml = status==="PAGADO"
      ? `<span style="font-weight:1000;color:#0e5b2a">✅ PAGADO</span>`
      : `<span style="font-weight:1000;color:#7a4b00">⏳ PENDIENTE</span>`;

    tr.innerHTML = `
      <td><small>${escapeHtml(d)}</small></td>
      <td><b>#${escapeHtml(s.receiptNo||"")}</b></td>
      <td>${escapeHtml(shipmentClientName(s))}<br><small>${escapeHtml(s.client?.phone||"")}</small></td>
      <td>${escapeHtml(s.payMethod||"")}</td>
      <td>${money(s.total||0)}</td>
      <td>${statusHtml}</td>
      <td>
        <button class="btn small" data-viewship="${escapeHtml(s.id)}">Ver</button>
        <button class="btn ok small" data-payship="${escapeHtml(s.id)}">Marcar PAGADO</button>
        <button class="btn danger small" data-delship="${escapeHtml(s.id)}">Borrar</button>
      </td>
    `;
    tb.appendChild(tr);
  }
}

async function markShipmentPaid(id){
  const s = await idbGet("shipments", id);
  if(!s) return alert("Envío no encontrado.");
  if((s.status||"PENDIENTE")==="PAGADO"){
    alert("Ya está PAGADO.");
    return;
  }

  // Crear venta desde el envío (NO tocar stock, ya se descontó en creación)
  const ts = Date.now();
  const saleId = "S-" + ts + "-" + Math.random().toString(16).slice(2,8);

  const sale = {
    id: saleId,
    ts: ts,
    dateKey: todayKey(ts),
    weekKey: weekKey(ts),
    monthKey: monthKey(ts),
    saleType: "ENVIO",
    payMethod: s.payMethod,
    client: s.client || null,
    items: (s.items||[]).map(x=>({...x})),
    subtotal: Number((s.subtotal ?? s.productTotal ?? s.total ?? 0).toFixed(2)),
    discountType: s.discountType || "NONE",
    discountValue: Number(s.discountValue||0),
    discountAmount: Number((s.discountAmount ?? 0).toFixed(2)),
    productTotal: Number((s.productTotal ?? Math.max(Number((s.total ?? 0) - (s.shippingFee ?? 0)), 0)).toFixed(2)),
    shippingFee: Number((s.shippingFee ?? 0).toFixed(2)),
    total: Number((s.total ?? 0).toFixed(2)),
    receiptNo: s.receiptNo,
    shop: s.shop || state.settings.shopName || "Tienda de Ropa",
    source: "SHIPMENT",
    shipmentId: s.id,
    paidAt: ts
  };

  await idbPut("sales", sale);
await autoBackupToFolder("envio_pagado");

  // Actualizar envío a PAGADO (mantener, para historial)
  s.status = "PAGADO";
  s.paidAt = ts;
  s.saleId = saleId;
  await idbPut("shipments", s);

  state.lastReceipt = sale;
  await refreshKPIs();
  if(state.view==="shipments") renderShipments();
  if(state.view==="reports") renderReport("daily");
  updateReceiptPreview();
  buildClose();

  alert("Envío marcado como PAGADO. Ya cuenta como venta en Reportes y Cierres.");
}

// (removido) botón pendiente eliminado


async function deleteShipment(id){
  if(!requireCode("borrar envío")) return;
  const s = await idbGet("shipments", id);
  if(!s) return;
  if(!confirm("¿Borrar envío #"+(s.receiptNo||"") + "?")) return;

  // Si era pendiente (o incluso pagado), restauramos stock SOLO si fue descontado y todavía está en shipments.
  // Nota: Si ya se vendió (saleId), normalmente NO se debería restaurar porque la venta existe. Lo protegemos:
  if(s.stockDeducted && !s.saleId){
    await restoreStockForItems(s.items||[]);
  }

  await idbDel("shipments", id);
  await refreshKPIs();
  renderShipments();
  renderInventory();
  refreshProductPicker();
  alert("Envío borrado.");
}
