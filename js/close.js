// ---------- Cierre ----------

const __CLOSE_PAY_BASE_IDS = {
  EFECTIVO: { real: "realCash", diff: "diffCash", ticketPay: "cCash", ticketReal: "cRealCash", ticketDiff: "cDiffCash", label: "EFECTIVO" },
  TARJETA: { real: "realCard", diff: "diffCard", ticketPay: "cCard", ticketReal: "cRealCard", ticketDiff: "cDiffCard", label: "TARJETA" },
  TRANSFERENCIA: { real: "realTrans", diff: "diffTrans", ticketPay: "cTrans", ticketReal: "cRealTrans", ticketDiff: "cDiffTrans", label: "TRANSFERENCIA" }
};

function closeMethodLabel(name){
  return String(name || "").trim().toUpperCase();
}

function closeMethodSlug(name){
  return closeMethodLabel(name)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "METODO";
}

function getCloseMethodList(c){
  const preferred = (typeof getPayMethods === "function") ? getPayMethods() : ["EFECTIVO","TARJETA","TRANSFERENCIA"];
  const seen = new Set();
  const out = [];
  const add = (x)=>{
    const key = closeMethodLabel(x);
    if(!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };
  preferred.forEach(add);
  Object.keys(c?.pay || {}).forEach(add);
  Object.keys(c?.real || {}).forEach(add);
  Object.keys(c?.diff || {}).forEach(add);
  return out.length ? out : ["EFECTIVO","TARJETA","TRANSFERENCIA"];
}

function getAllSalePayMethods(list){
  const methods = (typeof getPayMethods === "function") ? getPayMethods().slice() : ["EFECTIVO","TARJETA","TRANSFERENCIA"];
  const seen = new Set(methods.map(closeMethodLabel));
  for(const s of (list || [])){
    const pm = closeMethodLabel(s?.payMethod || "");
    if(pm && pm !== "MIXTO" && !seen.has(pm)){
      seen.add(pm);
      methods.push(pm);
    }
    if(s?.paySplit && typeof s.paySplit === "object"){
      for(const key of Object.keys(s.paySplit)){
        const mk = closeMethodLabel(key);
        if(mk && !seen.has(mk)){
          seen.add(mk);
          methods.push(mk);
        }
      }
    }
  }
  return methods.length ? methods : ["EFECTIVO","TARJETA","TRANSFERENCIA"];
}

function getCloseRealValue(method){
  const key = closeMethodLabel(method);
  const base = __CLOSE_PAY_BASE_IDS[key];
  if(base && $(base.real)) return Number($(base.real).value || 0);
  const dyn = document.querySelector(`[data-realpay="${escapeHtml(key)}"]`);
  return Number(dyn?.value || 0);
}

function setCloseRealValue(method, value){
  const key = closeMethodLabel(method);
  const base = __CLOSE_PAY_BASE_IDS[key];
  const v = Number(value || 0);
  if(base && $(base.real)){
    $(base.real).value = v;
    return;
  }
  const dyn = document.querySelector(`[data-realpay="${escapeHtml(key)}"]`);
  if(dyn) dyn.value = v;
}

function setCloseDiffValue(method, value){
  const key = closeMethodLabel(method);
  const base = __CLOSE_PAY_BASE_IDS[key];
  const n = Number(value || 0);
  const txt = money(n);
  const tag = n > 0 ? "SOBRA" : (n < 0 ? "FALTA" : "CUADRADO");

  if(base && $(base.diff)){
    $(base.diff).textContent = txt;
  }else{
    const dyn = document.querySelector(`[data-diffpay="${escapeHtml(key)}"]`);
    if(dyn) dyn.textContent = txt;
  }

  const cardVal = document.querySelector(`[data-diffcard-value="${escapeHtml(key)}"]`);
  const cardTag = document.querySelector(`[data-diffcard-tag="${escapeHtml(key)}"]`);
  if(cardVal) cardVal.textContent = txt;
  if(cardTag) cardTag.textContent = tag;
}


function getCloseStatusInfo(diff){
  const n = Number(diff || 0);
  if(n > 0) return { amount:n, tag:"SOBRA", text:`SOBRANTE ${money(n)}` };
  if(n < 0) return { amount:n, tag:"FALTA", text:`FALTANTE ${money(Math.abs(n))}` };
  return { amount:0, tag:"CUADRADO", text:"CUADRADO" };
}

function getCloseSummaryRows(c){
  const methods = getCloseMethodList(c);
  return methods.map(method=>{
    const key = closeMethodLabel(method);
    const info = getCloseStatusInfo(c?.diff?.[key] || 0);
    return { method:key, info };
  });
}

function getCurrentCloseRealMap(){
  const out = {};
  try{
    for(const [method, ids] of Object.entries(__CLOSE_PAY_BASE_IDS)){
      const el = $(ids.real);
      if(el) out[method] = Number(el.value || 0);
    }
    document.querySelectorAll('[data-realpay]').forEach(el=>{
      const key = closeMethodLabel(el.getAttribute('data-realpay'));
      if(key) out[key] = Number(el.value || 0);
    });
  }catch(_){ }
  return out;
}

function styleCloseInput(el){
  if(!el) return;
  el.style.width = '100%';
  el.style.maxWidth = '100%';
  el.style.minWidth = '0';
  el.style.boxSizing = 'border-box';
  el.style.height = '48px';
  el.style.borderRadius = '16px';
  el.style.fontSize = '24px';
  el.style.fontWeight = '800';
  el.style.padding = '8px 14px';
}

function updateCloseDiffsFromCurrentInputs(){
  const close = state?.lastClose;
  if(!close || !close.pay) return;

  const methods = getCloseMethodList(close);
  const real = {};
  const diff = {};
  let diffTotal = 0;

  for(const method of methods){
    const key = closeMethodLabel(method);
    real[key] = Number(getCloseRealValue(key) || 0);
    diff[key] = Number((real[key] - Number(close.pay?.[key] || 0)).toFixed(2));
    diffTotal += diff[key];
    setCloseDiffValue(key, diff[key]);
  }

  diffTotal = Number(diffTotal.toFixed(2));
  close.real = real;
  close.diff = diff;
  close.diffTotal = diffTotal;

  if($("diffTotal")) $("diffTotal").textContent = money(diffTotal);
  renderCloseTicket(close);
}

function beautifyCloseBaseLayout(){
  try{
    const baseInputs = ["realCash","realCard","realTrans"].map(id => $(id)).filter(Boolean);
    const seen = new Set();
    for(const el of baseInputs){
      const card = el.closest('div');
      if(card && !seen.has(card)){
        seen.add(card);
        card.style.padding = '14px 16px';
        card.style.borderRadius = '18px';
        card.style.border = '1px solid rgba(120,130,255,.14)';
        card.style.background = 'linear-gradient(180deg, rgba(255,255,255,.86), rgba(255,255,255,.68))';
        card.style.boxShadow = '0 10px 24px rgba(95,76,160,.06)';
      }
      styleCloseInput(el);
    }

    const diffIds = ['diffCash','diffCard','diffTrans','diffTotal'];
    for(const id of diffIds){
      const val = $(id);
      const card = val?.closest('div');
      if(card){
        card.style.padding = '16px';
        card.style.borderRadius = '22px';
        card.style.border = '1px solid rgba(120,130,255,.12)';
        card.style.background = 'linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.72))';
        card.style.boxShadow = '0 10px 24px rgba(95,76,160,.08)';
      }
    }
  }catch(_){ }
}

function ensureDynamicClosePayRows(methods){
  const wanted = methods.filter(m => !__CLOSE_PAY_BASE_IDS[closeMethodLabel(m)]);
  const baseInput = $("realTrans") || $("realCard") || $("realCash");
  if(!baseInput || !baseInput.parentElement || !baseInput.parentElement.parentElement) return;

  const currentValues = getCurrentCloseRealMap();
  let host = document.getElementById("closeDynamicPayRows");
  if(!host){
    host = document.createElement("div");
    host.id = "closeDynamicPayRows";
    host.style.display = "grid";
    host.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
    host.style.gap = "14px";
    host.style.marginTop = "10px";
    host.style.width = "100%";
    host.style.alignItems = "stretch";
    const anchorRow = baseInput.parentElement.parentElement;
    anchorRow.parentElement.insertBefore(host, anchorRow.nextSibling);
  }

  host.innerHTML = "";
  for(const method of wanted){
    const key = closeMethodLabel(method);
    const value = Number(currentValues[key] || 0);
    const row = document.createElement("div");
    row.className = "close-dyn-pay-row";
    row.style.minWidth = "0";
    row.style.width = "100%";
    row.style.padding = "14px 16px";
    row.style.borderRadius = "22px";
    row.style.border = "1px solid var(--border)";
    row.style.background = "rgba(255,255,255,.90)";
    row.style.boxShadow = "var(--shadow2)";
    row.style.overflow = "hidden";
    row.innerHTML = `
      <div style="font-size:12px;color:var(--muted);font-weight:1000;letter-spacing:.2px">${escapeHtml(key)} <span style="text-transform:none">(real)</span></div>
      <input type="number" step="0.01" min="0" value="${value}" data-realpay="${escapeHtml(key)}" data-realpay-input="1" class="input" />
    `;
    host.appendChild(row);
    styleCloseInput(row.querySelector('input'));
    const input = row.querySelector('input');
    if(input) input.style.marginTop = '8px';
  }

  const compact = window.innerWidth <= 980;
  host.style.gridTemplateColumns = compact ? '1fr' : 'repeat(2, minmax(0, 1fr))';

  ensureDynamicCloseDiffCards(wanted);
  beautifyCloseBaseLayout();
}

function ensureDynamicCloseDiffCards(methods){
  const wanted = methods.filter(m => !__CLOSE_PAY_BASE_IDS[closeMethodLabel(m)]);
  const diffTotalEl = $("diffTotal");
  const anchorCard = diffTotalEl?.closest("div");
  const anchorRow = anchorCard?.parentElement;
  if(!anchorRow) return;

  let host = document.getElementById("closeDynamicDiffCards");
  if(!host){
    host = document.createElement("div");
    host.id = "closeDynamicDiffCards";
    host.style.display = "grid";
    host.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
    host.style.gap = "14px";
    host.style.marginTop = "14px";
    host.style.width = "100%";
    anchorRow.parentElement.insertBefore(host, anchorRow.nextSibling);
  }

  host.innerHTML = "";
  for(const method of wanted){
    const key = closeMethodLabel(method);
    const card = document.createElement("div");
    card.className = "close-dyn-diff-card";
    card.style.minWidth = "0";
    card.style.width = "100%";
    card.style.padding = "16px";
    card.style.borderRadius = "22px";
    card.style.border = "1px solid var(--border)";
    card.style.background = "rgba(255,255,255,.92)";
    card.style.boxShadow = "var(--shadow2)";
    card.style.overflow = "hidden";
    card.innerHTML = `
      <div style="font-size:12px;color:var(--muted);font-weight:1000;letter-spacing:.2px">Dif. ${escapeHtml(key)}</div>
      <div style="margin-top:12px;padding:12px 14px;border-radius:16px;border:1px solid var(--border);background:#fff;min-height:56px;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box;">
        <div style="font-size:18px;font-weight:900;line-height:1.1;word-break:break-word;" data-diffcard-value="${escapeHtml(key)}">${money(0)}</div>
        <div style="margin-top:8px;font-size:12px;font-weight:800;color:#6b7280" data-diffcard-tag="${escapeHtml(key)}">CUADRADO</div>
      </div>
    `;
    host.appendChild(card);
  }

  const compact = window.innerWidth <= 980;
  host.style.gridTemplateColumns = compact ? '1fr' : 'repeat(2, minmax(0, 1fr))';
}

function ensureDynamicCloseTicketRows(methods){
  const wanted = methods.filter(m => !__CLOSE_PAY_BASE_IDS[closeMethodLabel(m)]);
  let payHost = document.getElementById("cPayDynamic");
  if(!payHost){
    const anchor = $("cTrans")?.parentElement || $("cCard")?.parentElement || $("cCash")?.parentElement;
    if(anchor && anchor.parentElement){
      payHost = document.createElement("div");
      payHost.id = "cPayDynamic";
      anchor.parentElement.insertBefore(payHost, anchor.nextSibling);
    }
  }
  let diffHost = document.getElementById("cDiffDynamic");
  if(!diffHost){
    const anchor = $("cDiffTrans")?.parentElement || $("cDiffCard")?.parentElement || $("cDiffCash")?.parentElement;
    if(anchor && anchor.parentElement){
      diffHost = document.createElement("div");
      diffHost.id = "cDiffDynamic";
      anchor.parentElement.insertBefore(diffHost, anchor.nextSibling);
    }
  }
  if(payHost) payHost.innerHTML = "";
  if(diffHost) diffHost.innerHTML = "";

  for(const method of wanted){
    const key = closeMethodLabel(method);
    const slug = closeMethodSlug(key);
    if(payHost){
      const line = document.createElement("div");
      line.className = "line";
      line.innerHTML = `<span>${escapeHtml(key)}</span><span id="cPay_${escapeHtml(slug)}">${money(0)}</span>`;
      payHost.appendChild(line);
    }
    if(diffHost){
      const line = document.createElement("div");
      line.className = "line";
      line.innerHTML = `<span>${escapeHtml(key)}</span><span id="cDiff_${escapeHtml(slug)}">CUADRADO</span>`;
      diffHost.appendChild(line);
    }
  }
}

function clearAllCloseRealInputs(methods){
  for(const method of methods){
    setCloseRealValue(method, 0);
    setCloseDiffValue(method, 0);
  }
  if($("diffTotal")) $("diffTotal").textContent = money(0);
}

function closeToText(c){
  if(!c) return "No hay cierre todavía.";
  const methods = getCloseMethodList(c);
  const lines = [];
  lines.push(`🧾 *${c.shop}*`);
  lines.push(`CIERRE DE VENTAS — ${c.dateKey} (${c.fromHHMM} - ${c.toHHMM})`);
  lines.push(`Generado: ${new Date(c.ts).toLocaleString()}`);
  lines.push(`--------------------------------`);
  lines.push(`Ventas: ${c.salesCount}`);
  lines.push(`Mostrador: ${c.mostradorCount} | Envíos: ${c.envioCount}`);
  lines.push(`--------------------------------`);
  for(const method of methods){
    lines.push(`${method}: ${money(c.pay?.[method] || 0)}`);
  }
  lines.push(`--------------------------------`);
  lines.push(`SUBTOTAL: ${money(c.subtotal)}`);
  lines.push(`DESCUENTOS: ${money(c.discounts)}`);
  lines.push(`TOTAL: *${money(c.total)}*`);
  lines.push(`--------------------------------`);
  lines.push(`CUADRE:`);
  for(const row of getCloseSummaryRows(c)){
    lines.push(`${row.method}: ${row.info.text}`);
  }
  const totalInfo = getCloseStatusInfo(c.diffTotal || 0);
  lines.push(`TOTAL: ${totalInfo.text}`);
  lines.push(`--------------------------------`);
  lines.push(`Productos vendidos:`);
  for(const p of (c.products||[])){
    lines.push(`- ${p.qty} x ${p.name} ${money(p.total || 0)}`);
  }
  lines.push(`--------------------------------`);
  lines.push(`Cierre generado ✅`);
  return lines.join("\n");
}

function closeToPrintableHTML(c){
  const methods = getCloseMethodList(c);
  const rows = (c.products||[]).map(p=>`
    <tr>
      <td style="text-align:center">${p.qty}</td>
      <td>${escapeHtml(p.name)}</td>
      <td style="text-align:right">${money(p.total || 0)}</td>
    </tr>
  `).join("");

  const payLines = methods.map(method=>`
      <div class="line"><span>${escapeHtml(method)}</span><span>${money(c.pay?.[method] || 0)}</span></div>
  `).join("");

  const diffLines = getCloseSummaryRows(c).map(row=>`
      <div class="line"><span>${escapeHtml(row.method)}</span><span>${escapeHtml(row.info.text)}</span></div>
  `).join("");

  return `
  <!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Cierre ${escapeHtml(c.dateKey)}</title>
    <style>
      body{ 
        font-family: Arial, sans-serif; 
        margin: 20px; 
        color:#111; 
        background:#fff7fb; 
      }

      .box{
        position:relative;
        width:100mm;
        min-height:100mm;
        overflow:hidden;
        margin:0 auto;
        border:2px solid #fbcfe8;
        border-radius:16px;
        padding:10px;
        background:#fff;
        box-sizing:border-box;
      }

      .cornerLogo{ 
        position:absolute; 
        top:12px; 
        right:12px; 
        width:60px; 
        height:60px; 
        object-fit:contain; 
        border-radius:14px; 
        border:1px solid #eee; 
        padding:4px; 
        background:#fff; 
      }

      .bar{ 
        height:8px; 
        border-radius:999px; 
        background: linear-gradient(90deg, #ff4fb7, #a855f7); 
        margin-bottom:12px; 
      }

      h1{ 
        margin:0; 
        font-size:18px; 
        color:#7b2fb4; 
        padding-right:70px; 
      }

      .meta{ 
        margin-top:4px; 
        color:#444; 
        font-size:12px; 
        font-weight:700; 
      }

      .line{ 
        display:flex; 
        justify-content:space-between; 
        gap:12px; 
        font-weight:800; 
        margin:6px 0; 
      }

      table{ 
        width:100%; 
        border-collapse:collapse; 
        margin-top:14px; 
      }

      th,td{ 
        border-bottom:1px solid #eee; 
        padding:8px; 
        font-size:13px; 
      }

      th{ 
        background:#ffe4f1; 
        text-align:left; 
      }

      @media print{
        body{ margin:0; }
        .box{ border:none; border-radius:0; }
      }
    </style>
  </head>
  <body onload="setTimeout(function(){window.print();},250)">
    <div class="box">
      <img class="cornerLogo" src="LOGO1.png" onerror="this.style.display='none'" alt="Logo" />
      <div class="bar"></div>
      <h1>${escapeHtml(c.shop)} — Cierre ${escapeHtml(c.dateKey)} (${escapeHtml(c.fromHHMM)}-${escapeHtml(c.toHHMM)})</h1>
      <div class="meta">Generado: ${escapeHtml(new Date(c.ts).toLocaleString())}</div>

      <div class="line"><span>Ventas</span><span>${c.salesCount}</span></div>
      <div class="line"><span>Mostrador</span><span>${c.mostradorCount}</span></div>
      <div class="line"><span>Envíos</span><span>${c.envioCount}</span></div>
      <hr>

      ${payLines}
      <hr>

      <div class="line"><span>SUBTOTAL</span><span>${money(c.subtotal)}</span></div>
      <div class="line"><span>DESCUENTOS</span><span>${money(c.discounts)}</span></div>
      <div class="line"><span>TOTAL</span><span>${money(c.total)}</span></div>

      <div style="font-size:12px; font-weight:900; margin:8px 0 6px; color:#666">CUADRE</div>
      ${diffLines}
      <div class="line"><span>TOTAL</span><span>${escapeHtml(getCloseStatusInfo(c.diffTotal||0).text)}</span></div>

      <h3 style="margin-top:14px">Productos vendidos</h3>
      <table>
        <thead><tr><th style="width:80px;text-align:center">Cant</th><th>Producto</th><th style="width:110px;text-align:right">Total</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3">Sin ventas</td></tr>`}</tbody>
      </table>

      <div style="margin-top:12px; color:#444; font-size:12px; font-weight:700;">Cierre generado ✅</div>
    </div>
  </body>
  </html>
  `;
}

function renderCloseTicket(close){
  if(!close) return;

  const methods = getCloseMethodList(close);
  ensureDynamicCloseTicketRows(methods);

  $("cShop").textContent = close.shop;
  $("cMeta").textContent = `Cierre • ${close.fromHHMM}-${close.toHHMM}`;
  $("cDate").textContent = close.dateKey;
  $("cTime").textContent = new Date(close.ts).toLocaleString();

  $("cSales").textContent = String(close.salesCount);
  $("cMost").textContent = String(close.mostradorCount);
  $("cEnv").textContent = String(close.envioCount);

  const fmtDiffTag = (v)=> getCloseStatusInfo(v).text;

  for(const method of methods){
    const key = closeMethodLabel(method);
    const base = __CLOSE_PAY_BASE_IDS[key];
    const slug = closeMethodSlug(key);
    const payEl = base ? $(base.ticketPay) : document.getElementById(`cPay_${slug}`);
    const realEl = base ? $(base.ticketReal) : document.getElementById(`cReal_${slug}`);
    const diffEl = base ? $(base.ticketDiff) : document.getElementById(`cDiff_${slug}`);
    if(payEl) payEl.textContent = money(close.pay?.[key] || 0);
    if(realEl && realEl.parentElement) realEl.parentElement.style.display = "none";
    if(diffEl){
      diffEl.textContent = fmtDiffTag(close.diff?.[key] || 0);
      if(diffEl.parentElement){
        const labelEl = diffEl.parentElement.querySelector("span:first-child");
        if(labelEl) labelEl.textContent = key;
        diffEl.parentElement.style.display = "flex";
      }
    }
  }

  ["cRealCash","cRealCard","cRealTrans"].forEach(id=>{
    const el = $(id);
    if(el && el.parentElement) el.parentElement.style.display = "none";
  });

  $("cSub").textContent = money(close.subtotal);
  $("cDisc").textContent = money(close.discounts);
  $("cTotal").textContent = money(close.total);
  if($("cDiffTotal")){
    $("cDiffTotal").textContent = fmtDiffTag(close.diffTotal||0);
    if($("cDiffTotal").parentElement){
      const labelEl = $("cDiffTotal").parentElement.querySelector("span:first-child");
      if(labelEl) labelEl.textContent = "TOTAL";
    }
  }

  const cp = $("cProducts");
  cp.innerHTML = "";
  renderCloseVoidsTicket(close.voids || []);
  if((close.products||[]).length===0){
    const div = document.createElement("div");
    div.className="muted";
    div.textContent = "Sin ventas en este rango.";
    cp.appendChild(div);
  }else{
    for(const p of (close.products||[]).slice(0,50)){
      const div = document.createElement("div");
      div.className="line";
      div.innerHTML = `<span>${p.qty} x ${escapeHtml(p.name)}</span><span>${money(p.total || 0)}</span>`;
      cp.appendChild(div);
    }
  }
}

function buildVoidSummaryHtml(voids){
  const list = Array.isArray(voids) ? voids : [];
  if(!list.length){
    return `
      <div class="muted" style="margin-top:8px">Sin anulaciones en este cierre.</div>
    `;
  }

  const rows = list.map(v=>{
    const when = new Date(v.ts || Date.now()).toLocaleString();
    const cashier = escapeHtml(v.cashierName || "Sin nombre");
    const role = escapeHtml(v.authRole || "CAJERO");
    const reason = escapeHtml(v.reason || "Sin motivo");
    const items = escapeHtml(v.itemSummary || (typeof formatVoidItemsText === "function" ? formatVoidItemsText(v.items||[]) : "")) || "—";
    const receipt = escapeHtml(v.receiptNo || "");
    return `
      <div style="padding:10px 0; border-bottom:1px dashed rgba(0,0,0,.12)">
        <div style="font-weight:900">${cashier} <span style="font-weight:700; color:#666">(${role})</span></div>
        <div style="font-size:12px; color:#666">${when}${receipt ? ` • #${receipt}` : ""}</div>
        <div style="margin-top:4px"><b>Motivo:</b> ${reason}</div>
        <div style="margin-top:4px"><b>Productos:</b> ${items}</div>
        <div style="margin-top:4px"><b>Total anulado:</b> ${money(v.total||0)}</div>
      </div>
    `;
  }).join("");

  return rows;
}

function renderCloseVoidsPanel(voids){
  const box = $("closeVoidsBox");
  if(!box) return;
  box.innerHTML = buildVoidSummaryHtml(voids);
}

function renderCloseVoidsTicket(voids){
  const wrap = $("cVoidsWrap");
  const box = $("cVoids");
  if(!wrap || !box) return;
  const list = Array.isArray(voids) ? voids : [];
  wrap.style.display = list.length ? "block" : "none";
  box.innerHTML = "";
  if(!list.length) return;

  for(const v of list){
    const div = document.createElement("div");
    div.style.padding = "8px 0";
    div.style.borderBottom = "1px dashed rgba(0,0,0,.12)";
    div.innerHTML = `
      <div style="font-weight:900">${escapeHtml(v.cashierName || "Sin nombre")}</div>
      <div class="muted">${escapeHtml(new Date(v.ts || Date.now()).toLocaleString())}</div>
      <div><b>Motivo:</b> ${escapeHtml(v.reason || "Sin motivo")}</div>
      <div><b>Productos:</b> ${escapeHtml(v.itemSummary || (typeof formatVoidItemsText === "function" ? formatVoidItemsText(v.items||[]) : "")) || "—"}</div>
      <div><b>Total:</b> ${money(v.total||0)}</div>
    `;
    box.appendChild(div);
  }
}

async function renderClosePanel(){
  if($("closeDate") && !$("closeDate").value) $("closeDate").value = todayKey();
  await renderSavedCloses();
  await buildClose();
  beautifyCloseBaseLayout();
}

async function buildClose(){
  const dateKey = $("closeDate").value || todayKey();
  const rawFrom = $("closeFrom").value;
  const rawTo   = $("closeTo").value;
  let fromHHMM = rawFrom;
  let toHHMM   = rawTo;

  let autoStartTs = null;
  let autoEndTs = null;

  if(dateKey===todayKey()){
    const shiftStart = await getShiftStartTs();
    const lastClose  = await getLastCloseTs(dateKey);
    const startTs    = Math.max(Number(shiftStart||0), Number(lastClose||0)) || null;

    if(startTs){
      autoStartTs = startTs;
      autoEndTs   = Date.now();

      if((!fromHHMM || !toHHMM)){
        const a = new Date(startTs);
        const b = new Date(autoEndTs);
        if(!fromHHMM) fromHHMM = a.toTimeString().slice(0,5);
        if(!toHHMM)   toHHMM   = b.toTimeString().slice(0,5);
        if(!rawFrom) $("closeFrom").value = fromHHMM;
        if(!rawTo)   $("closeTo").value   = toHHMM;
      }
    }
  }

  fromHHMM = fromHHMM || "00:00";
  toHHMM   = toHHMM   || "23:59";

  const all = await idbAll("sales");
  let list = all.filter(s=> isWithinDateRange(s.ts, dateKey, fromHHMM, toHHMM)).sort((a,b)=>a.ts-b.ts);

  if(autoStartTs && autoEndTs){
    list = list.filter(s=> (Number(s.ts||0) >= autoStartTs) && (Number(s.ts||0) <= autoEndTs));
  }

  const allVoids = await idbAll("voids");
  let voids = allVoids.filter(v=> todayKey(v.ts) === dateKey).sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
  if(autoStartTs && autoEndTs){
    voids = voids.filter(v=> (typeof isTsBetween === "function") ? isTsBetween(v.ts, autoStartTs, autoEndTs) : (Number(v.ts||0) >= autoStartTs && Number(v.ts||0) <= autoEndTs));
  }else{
    const rangeStart = new Date(`${dateKey}T${fromHHMM}:00`).getTime();
    const rangeEnd = new Date(`${dateKey}T${toHHMM}:59`).getTime();
    voids = voids.filter(v=> Number(v.ts||0) >= rangeStart && Number(v.ts||0) <= rangeEnd);
  }

  renderCloseVoidsPanel(voids);

  const methods = getAllSalePayMethods(list);
  ensureDynamicClosePayRows(methods);
  beautifyCloseBaseLayout();
  const pay = Object.fromEntries(methods.map(m => [m, 0]));
  let subtotal = 0;
  let discounts = 0;
  let total = 0;
  let envioCount = 0;
  let mostradorCount = 0;

  const prodMap = new Map();

  for(const s of list){
    subtotal += Number(s.subtotal ?? s.total ?? 0);
    discounts += Number(s.discountAmount ?? 0);
    total += Number(s.total ?? 0);

    if(s.saleType==="ENVIO") envioCount++; else mostradorCount++;

    if(s.payMethod==="MIXTO" && s.paySplit){
      for(const key of Object.keys(s.paySplit || {})){
        const method = closeMethodLabel(key);
        if(!(method in pay)) pay[method] = 0;
        pay[method] += Number(s.paySplit[key] || 0);
      }
    }else{
      const pm = closeMethodLabel(s.payMethod || "");
      if(pm){
        if(!(pm in pay)) pay[pm] = 0;
        pay[pm] += Number(s.total||0);
      }
    }

    for(const it of (s.items||[])){
      const key = it.code || it.name || Math.random().toString(36).slice(2,8);
      const gross = Number(it.qty||0) * Number(it.price||0);
      const disc  = Math.min(gross, Math.max(0, Number(it.discValue||0)));
      const net   = Math.max(0, gross - disc);

      const cur = prodMap.get(key) || {code:it.code||"", name:it.name||"", qty:0, total:0};
      cur.qty += Number(it.qty||0);
      cur.total += net;
      cur.name = it.name || cur.name;
      cur.code = it.code || cur.code;
      prodMap.set(key, cur);
    }
  }

  const products = [...prodMap.values()].sort((a,b)=>b.qty-a.qty);

  const hb = $("closeHistBody");
  hb.innerHTML = "";
  for(const s of list){
    const tr = document.createElement("tr");
    const d = new Date(s.ts);
    const when = d.toLocaleTimeString();
    const client = s.client ? `${s.client.names} ${s.client.last}` : "MOSTRADOR";
    tr.innerHTML = `
      <td><small>${escapeHtml(when)}</small><br><small>#${escapeHtml(s.receiptNo||"")}</small></td>
      <td>${escapeHtml(client)}</td>
      <td>${escapeHtml(s.saleType||"")}</td>
      <td>${escapeHtml(s.payMethod||"")}</td>
      <td>${money(s.total||0)}</td>
    `;
    hb.appendChild(tr);
  }

  const real = {};
  const diff = {};
  let diffTotal = 0;
  for(const method of Object.keys(pay)){
    const key = closeMethodLabel(method);
    real[key] = Number(getCloseRealValue(key) || 0);
    diff[key] = Number((real[key] - Number(pay[key] || 0)).toFixed(2));
    diffTotal += diff[key];
    setCloseDiffValue(key, diff[key]);
  }
  diffTotal = Number(diffTotal.toFixed(2));
  if($("diffTotal")) $("diffTotal").textContent = money(diffTotal);

  const close = {
    id: "C-TMP",
    ts: Date.now(),
    dateKey,
    fromHHMM,
    toHHMM,
    shop: state.settings.shopName || "Tienda de Ropa",
    salesCount: list.length,
    envioCount,
    mostradorCount,
    pay,
    subtotal: Number(subtotal.toFixed(2)),
    discounts: Number(discounts.toFixed(2)),
    total: Number(total.toFixed(2)),
    products,
    real,
    diff,
    diffTotal,
    voids
  };

  state.lastClose = close;
  renderCloseTicket(close);
  return close;
}

function showCloseSuccessModal(c){
  const methods = getCloseMethodList(c);
  const msg = [
    `Ventas registradas: ${Number(c?.salesCount||0)}`,
    `Total vendido: ${money(c?.total||0)}`,
    ...methods.map(m => `${m}: ${money(c?.pay?.[m]||0)}`)
  ].join("\n");

  const ov = document.getElementById("okModalOverlay");
  const t = document.getElementById("okModalTitle");
  const m = document.getElementById("okModalMsg");
  const b = document.getElementById("okModalBtn");
  if(!ov || !t || !m || !b){
    showOkModal("Cierre generado con éxito", msg, {enter:true});
    return;
  }
  t.textContent = "Cierre generado con éxito";
  m.textContent = msg;
  m.style.whiteSpace = "pre-line";
  __okModalEnter = true;
  __okModalReload = false;
  ov.setAttribute("aria-hidden", "false");
  ov.classList.add("show");
  setTimeout(()=>{ try{ b.focus(); }catch(e){} }, 30);
}

async function saveClose(opts={}){
  const options = {
    autoBuild: true,
    autoPNG: true,
    resetAfter: true,
    ...opts
  };

  if(options.autoBuild) await buildClose();
  if(!state.lastClose){
    showOkModal("Error","No se pudo generar el cierre.",{enter:true});
    return;
  }

  const c = {...state.lastClose};
  c.id = "C-" + c.ts + "-" + Math.random().toString(16).slice(2,8);
  await idbPut("closes", c);
  await setLastCloseTs(c.dateKey, c.ts);

  state.lastClose = c;
  renderCloseTicket(c);
  beautifyCloseBaseLayout();

  await clearPaidShipments();
  await renderSavedCloses();
  await autoBackupToFolder("cierre");

  if(options.autoPNG){
    try{ await downloadClosePNG(); }catch(e){ console.warn("No se pudo descargar el PNG del cierre:", e); }
  }

  await setShiftStartTs(Date.now());
  await refreshKPIs();

  showCloseSuccessModal(c);

  if(options.resetAfter){
    clearAllCloseRealInputs(getCloseMethodList(state.lastClose));
    $("closeFrom").value = "";
    $("closeTo").value = "";
    $("closeDate").value = todayKey();
    await buildClose();
  }

  return c;
}

async function generateAndSaveClose(){
  return saveClose({autoBuild:true, autoPNG:true, resetAfter:true});
}

function initCloseArchiveFolder(){
  const tbody = $("closeSavedBody");
  if(!tbody || document.getElementById("closeArchiveToggle")) return;

  const table = tbody.closest("table");
  const refreshBtn = $("btnCloseListRefresh");
  if(!table) return;

  const wrap = document.createElement("div");
  wrap.id = "closeArchiveFolder";
  wrap.style.marginTop = "12px";
  wrap.style.border = "1px solid rgba(255,255,255,.08)";
  wrap.style.borderRadius = "14px";
  wrap.style.background = "rgba(255,255,255,.03)";
  wrap.style.padding = "10px";

  const toggle = document.createElement("button");
  toggle.id = "closeArchiveToggle";
  toggle.type = "button";
  toggle.className = "btn";
  toggle.textContent = "📁 Ver cierres guardados";
  toggle.style.width = "100%";

  const content = document.createElement("div");
  content.id = "closeArchiveContent";
  content.style.display = "none";
  content.style.marginTop = "10px";

  table.parentNode.insertBefore(wrap, table);
  wrap.appendChild(toggle);
  wrap.appendChild(content);
  if(refreshBtn) content.appendChild(refreshBtn);
  content.appendChild(table);

  toggle.addEventListener("click", async ()=>{
    const isOpen = content.style.display !== "none";
    if(isOpen){
      content.style.display = "none";
      toggle.textContent = "📁 Ver cierres guardados";
      return;
    }
    if(typeof requireCode === "function" && !requireCode("ver cierres guardados")) return;
    await renderSavedCloses();
    content.style.display = "block";
    toggle.textContent = "📂 Ocultar cierres guardados";
  });
}

async function renderSavedCloses(){
  initCloseArchiveFolder();
  const dateKey = $("closeDate").value || todayKey();
  const all = await idbAll("closes");
  const list = all.filter(x=>x.dateKey===dateKey).sort((a,b)=>b.ts-a.ts);

  const tb = $("closeSavedBody");
  tb.innerHTML = "";
  for(const c of list){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><small>${escapeHtml(c.dateKey)}</small><br><small>${escapeHtml(new Date(c.ts).toLocaleString())}</small></td>
      <td><b>${escapeHtml(c.fromHHMM||"")}</b> - <b>${escapeHtml(c.toHHMM||"")}</b></td>
      <td>${escapeHtml(String(c.salesCount||0))}</td>
      <td>${money(c.total||0)}</td>
      <td>
        <button class="btn small" data-viewclose="${escapeHtml(c.id)}">Ver</button>
        <button class="btn danger small" data-delclose="${escapeHtml(c.id)}">Borrar</button>
      </td>
    `;
    tb.appendChild(tr);
  }
}

async function viewSavedClose(id){
  const c = await idbGet("closes", id);
  if(!c) return;
  state.lastClose = c;
  $("closeDate").value = c.dateKey;
  $("closeFrom").value = c.fromHHMM;
  $("closeTo").value = c.toHHMM;

  const methods = getCloseMethodList(c);
  ensureDynamicClosePayRows(methods);
  beautifyCloseBaseLayout();
  for(const method of methods){
    setCloseRealValue(method, c.real?.[method] ?? 0);
    setCloseDiffValue(method, c.diff?.[method] ?? 0);
  }
  if($("diffTotal")) $("diffTotal").textContent = money(c.diffTotal||0);

  renderCloseTicket(c);
}

async function deleteSavedClose(id){
  if(!requireCode("borrar cierre")) return;
  await idbDel("closes", id);
  await renderSavedCloses();
  showOkModal("Registro eliminado","El cierre fue borrado.",{enter:true});
}

async function copyClose(){
  const text = closeToText(state.lastClose);
  try{
    await navigator.clipboard.writeText(text);
    showOkModal("Copiado","Cierre copiado al portapapeles.",{enter:true});
  }catch{
    showOkModal("Error","No se pudo copiar automáticamente.",{enter:true});
  }
}

function openCloseWhatsApp(){
  const text = closeToText(state.lastClose);
  window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
}

function generateClosePDF(){
  if(!state.lastClose){
    showOkModal("Aviso","Primero genera el cierre.",{enter:true});
    return;
  }
  const html = closeToPrintableHTML(state.lastClose);
  const w = window.open("", "_blank");
  if(!w){
    showOkModal("Popup bloqueado","Permite ventanas emergentes para generar el PDF.",{enter:true});
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

async function downloadClosePNG(){
  if(!state.lastClose){
    showOkModal("Aviso","Primero genera el cierre.",{enter:true});
    return;
  }
  const node = $("closeBox");
  if(!node) return;

  if(window.html2canvas){
    try{
      await capturePNG(node, `cierre_${state.lastClose.dateKey}_${state.lastClose.fromHHMM.replace(":","")}-${state.lastClose.toHHMM.replace(":","")}.png`, 2);
      return;
    }catch(e){}
  }
  showOkModal("Error","No se pudo generar el PNG. Intenta con PDF.",{enter:true});
}

async function exportJSON(){
  const clients   = await idbAll("clients");
  const products  = await idbAll("products");
  const sales     = await idbAll("sales");
  const shipments = await idbAll("shipments");
  const closes    = await idbAll("closes");
  const meta      = await idbAll("meta");
  const movements = await idbAll("movements");
  const voids     = await idbAll("voids");

  const data = {
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    clients, products, sales, shipments, closes, meta, movements, voids
  };

  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "MTR_BACKUP.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

async function importJSON(file){
  const text = await file.text();
  const data = JSON.parse(text);
  if(!data || typeof data!=="object") throw new Error("JSON inválido.");

  await idbClearAll();
  if(data.clients) for(const c of data.clients) await idbPut("clients", c);
  if(data.products)for(const p of data.products) await idbPut("products", p);
  if(data.sales)   for(const s of data.sales) await idbPut("sales", s);
  if(data.shipments) for(const s of data.shipments) await idbPut("shipments", s);
  if(data.closes) for(const c of data.closes) await idbPut("closes", c);
  if(data.voids) for(const v of data.voids) await idbPut("voids", v);
  if(data.meta)    for(const m of data.meta) await idbPut("meta", m);
  if(data.movements) for(const m of data.movements) await idbPut("movements", m);
  if(data.settings) state.settings = data.settings;

  await loadSettings();
  await refreshKPIs();
  refreshProductPicker();
  renderProducts();
  renderInventory();
  renderClients();
  renderReport("daily");
  renderShipments();
  updateReceiptPreview();
  buildClose();
  syncDiscUI();
  renderSavedCloses();
  showOkModal("Backup restaurado","Los datos fueron importados correctamente.",{enter:true});
}

async function pickBackupFolder(){
  if(!window.showDirectoryPicker){
    showOkModal("No compatible","Tu navegador no soporta carpeta automática. Usa Chrome o Edge.",{enter:true});
    return;
  }
  if(!window.state) window.state = {};
  state._uiLocks = state._uiLocks || {};
  if(state._uiLocks.pickBackupFolder) return;
  state._uiLocks.pickBackupFolder = true;

  try{
    const handle = await window.showDirectoryPicker();
    if(!handle) return;
    state.backup = state.backup || {};
    state.backup.dirHandle = handle;
    showOkModal("Carpeta configurada","La carpeta de backups quedó configurada correctamente.",{enter:true});
  }catch(err){
    if(err && (err.name === "AbortError" || err.message?.includes("aborted"))){
    } else if(err && err.name === "NotAllowedError"){
      console.warn("No permitido abrir selector de carpeta:", err);
    } else {
      console.error(err);
      showOkModal("Error","No se pudo seleccionar la carpeta. Intenta de nuevo.",{enter:true});
    }
  }finally{
    state._uiLocks.pickBackupFolder = false;
  }
}

async function autoBackupToFolder(tag="auto"){
  try{
    if(!state.backup?.enabled) return;

    if(!state.backup?.dirHandle){
      await exportJSON();
      return;
    }

    const clients   = await idbAll("clients");
    const products  = await idbAll("products");
    const sales     = await idbAll("sales");
    const shipments = await idbAll("shipments");
    const closes    = await idbAll("closes");
    const meta      = await idbAll("meta");
    const movements = await idbAll("movements");

    const data = {
      exportedAt: new Date().toISOString(),
      tag,
      settings: state.settings,
      clients, products, sales, shipments, closes, meta, movements
    };

    const ts = new Date();
    const name =
      `backup_${tag}_` +
      ts.getFullYear() +
      String(ts.getMonth()+1).padStart(2,"0") +
      String(ts.getDate()).padStart(2,"0") + "_" +
      String(ts.getHours()).padStart(2,"0") +
      String(ts.getMinutes()).padStart(2,"0") +
      String(ts.getSeconds()).padStart(2,"0") +
      ".json";

    const fileHandle = await state.backup.dirHandle.getFileHandle(name, { create:true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([JSON.stringify(data,null,2)], {type:"application/json"}));
    await writable.close();
  }catch(e){
    console.warn("AutoBackup falló:", e);
    try{ await exportJSON(); }catch(_){ }
  }
}

async function refreshKPIs(){
  const clients = await idbAll("clients");
  const products= await idbAll("products");
  const sales   = await idbAll("sales");
  const shipments = await idbAll("shipments");

  const now = Date.now();
  let shiftStart = await getShiftStartTs();

  if(!shiftStart){
    const d = new Date();
    d.setHours(0,0,0,0);
    shiftStart = d.getTime();
    await setShiftStartTs(shiftStart);
  }

  const turnoSales = sales.filter(s => Number(s.ts||0) >= shiftStart && Number(s.ts||0) <= now);
  const total = turnoSales.reduce((a,s)=>a+Number(s.total||0),0);

  const pending = shipments.filter(s=> (s.status||"PENDIENTE")==="PENDIENTE").length;

  const kClients = $("kClients"); if(kClients) kClients.textContent = clients.length;

  const soldQty = turnoSales.reduce((acc,s)=> acc + (Array.isArray(s.items) ? s.items.reduce((a,it)=>a+Number(it.qty||0),0) : 0), 0);

  const kProducts= $("kProducts"); if(kProducts) kProducts.textContent = String(soldQty);
  const kSalesToday = $("kSalesToday"); if(kSalesToday) kSalesToday.textContent = turnoSales.length;
  const kTotalToday = $("kTotalToday"); if(kTotalToday) kTotalToday.textContent = money(total);
  const kShipPending= $("kShipPending"); if(kShipPending) kShipPending.textContent = pending;

  const pill = document.querySelector(".sidecard .pill");
  if(pill) pill.textContent = "💗 TUS VENTAS TURNO ACTUAL";
}

function sanitizeSettings(){
  if(state.settings.envPngWidth===undefined) state.settings.envPngWidth = 360;
  if(state.settings.envPngScale===undefined) state.settings.envPngScale = 2;
  if(state.settings.envPdfWidthMM===undefined) state.settings.envPdfWidthMM = 80;
  if(state.settings.envPdfMarginMM===undefined) state.settings.envPdfMarginMM = 6;
  if(state.settings.payMethods===undefined) state.settings.payMethods = ["EFECTIVO","TARJETA","TRANSFERENCIA"];
}

function getPayMethods(){
  const raw = state.settings?.payMethods;
  let list = [];
  if(Array.isArray(raw)) list = raw.slice();
  else if(typeof raw === "string") list = raw.split(/[\n,]+/g);
  else list = ["EFECTIVO","TARJETA","TRANSFERENCIA"];

  list = list.map(s=>String(s||"").trim()).filter(Boolean);
  const seen = new Set();
  const out = [];
  for(const x of list){
    const key = x.toUpperCase();
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.length ? out : ["EFECTIVO","TARJETA","TRANSFERENCIA"];
}

function renderPayMethodSelect(){
  const sel = $("payMethod");
  if(!sel) return;
  const current = String(sel.value || "").toUpperCase();
  const methods = getPayMethods();
  sel.innerHTML = "";
  for(const m of methods){
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  }
  sel.value = methods.includes(current) ? current : methods[0];
}

async function loadSettings(){
  const meta = await idbGet("meta","settings");
  if(meta?.value) state.settings = meta.value;

  if(state.settings.autoPDF===undefined) state.settings.autoPDF = true;
  if(state.settings.autoPNG===undefined) state.settings.autoPNG = true;

  sanitizeSettings();

  $("sShopName").value = state.settings.shopName || "Tienda de Ropa";
  $("sAutoPDF").value = state.settings.autoPDF ? "1" : "0";
  $("sAutoPNG").value = state.settings.autoPNG ? "1" : "0";

  if($("sPayMethods")) $("sPayMethods").value = (Array.isArray(state.settings.payMethods)? state.settings.payMethods.join("\n") : (state.settings.payMethods||""));

  $("sEnvPngWidth").value = state.settings.envPngWidth;
  $("sEnvPngScale").value = state.settings.envPngScale;
  $("sEnvPdfWidth").value = state.settings.envPdfWidthMM;
  $("sEnvPdfMargin").value = state.settings.envPdfMarginMM;

  renderPayMethodSelect();

  $("rShop").textContent = state.settings.shopName || "Tienda de Ropa";
  $("cShop").textContent = state.settings.shopName || "Tienda de Ropa";
}

async function saveSettings(){
  const prev = {...state.settings};

  const shopName = $("sShopName").value.trim() || "Tienda de Ropa";
  const autoPDF = $("sAutoPDF").value==="1";
  const autoPNG = $("sAutoPNG").value==="1";

  const payMethodsRaw = ($("sPayMethods")?.value || "").trim();

  const envPngWidth = Number($("sEnvPngWidth").value||360);
  const envPngScale = Number($("sEnvPngScale").value||2);
  const envPdfWidthMM = Number($("sEnvPdfWidth").value||80);
  const envPdfMarginMM = Number($("sEnvPdfMargin").value||6);

  const advancedChanged =
    Number(prev.envPngWidth||360) !== envPngWidth ||
    Number(prev.envPngScale||2) !== envPngScale ||
    Number(prev.envPdfWidthMM||80) !== envPdfWidthMM ||
    Number(prev.envPdfMarginMM||6) !== envPdfMarginMM;

  if(advancedChanged){
    if(!requireCode("cambiar tamaños de impresión (ENVÍO)")) return;
  }

  state.settings.shopName = shopName;
  state.settings.autoPDF = autoPDF;
  state.settings.autoPNG = autoPNG;

  state.settings.payMethods = payMethodsRaw
    ? payMethodsRaw.split(/[\n,]+/g).map(s=>String(s||"").trim()).filter(Boolean).map(s=>s.toUpperCase())
    : (state.settings.payMethods || ["EFECTIVO","TARJETA","TRANSFERENCIA"]);

  state.settings.envPngWidth = Math.max(260, Math.min(520, envPngWidth));
  state.settings.envPngScale = Math.max(1, Math.min(4, envPngScale));
  state.settings.envPdfWidthMM = Math.max(50, Math.min(120, envPdfWidthMM));
  state.settings.envPdfMarginMM = Math.max(0, Math.min(20, envPdfMarginMM));

  await idbPut("meta",{key:"settings", value: state.settings});
  renderPayMethodSelect();
  showOkModal("Registro exitoso","Ajustes guardados.", {enter:true});
  updateReceiptPreview();
  buildClose();
}

function getClientDraftFromForm(){
  const phone = $("cPhone")?.value?.trim() || "";
  const names = $("cNames")?.value?.trim() || "";
  const last  = $("cLast")?.value?.trim() || "";
  const addr  = $("cAddr")?.value?.trim() || "";
  const indic = $("cIndic")?.value?.trim() || "";

  if(!(phone || names || last || addr || indic)) return null;
  return { phone, names, last, addr, indic };
}

function syncClientDraftLive(){
  const draft = getClientDraftFromForm();
  state.selectedClient = draft;
  updateReceiptPreview();
}
