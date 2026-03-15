// ---------- Cierre ----------
function closeToText(c){
  if(!c) return "No hay cierre todavía.";
  const lines = [];
  lines.push(`🧾 *${c.shop}*`);
  lines.push(`CIERRE DE VENTAS — ${c.dateKey} (${c.fromHHMM} - ${c.toHHMM})`);
  lines.push(`Generado: ${new Date(c.ts).toLocaleString()}`);
  lines.push(`--------------------------------`);
  lines.push(`Ventas: ${c.salesCount}`);
  lines.push(`Mostrador: ${c.mostradorCount} | Envíos: ${c.envioCount}`);
  lines.push(`--------------------------------`);
  lines.push(`EFECTIVO: ${money(c.pay.EFECTIVO)}`);
  lines.push(`TARJETA: ${money(c.pay.TARJETA)}`);
  lines.push(`TRANSFERENCIA: ${money(c.pay.TRANSFERENCIA)}`);
  lines.push(`--------------------------------`);
  lines.push(`SUBTOTAL: ${money(c.subtotal)}`);
  lines.push(`DESCUENTOS: ${money(c.discounts)}`);
  lines.push(`TOTAL: *${money(c.total)}*`);
  lines.push(`--------------------------------`);
  lines.push(`CUADRE (Real - Sistema):`);
  lines.push(`EFECTIVO: ${money(c.diff?.EFECTIVO||0)}`);
  lines.push(`TARJETA: ${money(c.diff?.TARJETA||0)}`);
  lines.push(`TRANSFER.: ${money(c.diff?.TRANSFERENCIA||0)}`);
  lines.push(`TOTAL: ${money(c.diffTotal||0)}`);
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
  const rows = (c.products||[]).map(p=>`
    <tr>
      <td style="text-align:center">${p.qty}</td>
      <td>${escapeHtml(p.name)}</td>
      <td style="text-align:right">${money(p.total || 0)}</td>
    </tr>
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

      <div class="line"><span>EFECTIVO</span><span>${money(c.pay.EFECTIVO)}</span></div>
      <div class="line"><span>TARJETA</span><span>${money(c.pay.TARJETA)}</span></div>
      <div class="line"><span>TRANSFERENCIA</span><span>${money(c.pay.TRANSFERENCIA)}</span></div>
      <hr>

      <div class="line"><span>SUBTOTAL</span><span>${money(c.subtotal)}</span></div>
      <div class="line"><span>DESCUENTOS</span><span>${money(c.discounts)}</span></div>
      <div class="line"><span>TOTAL</span><span>${money(c.total)}</span></div>

      <div style="font-size:12px; font-weight:900; margin:8px 0 6px; color:#666">CUADRE (Real - Sistema)</div>
      <div class="line"><span>Real EFECTIVO</span><span>${money((c.real?.EFECTIVO||0))}</span></div>
      <div class="line"><span>Dif. EFECTIVO</span><span>${(function(v){const n=Number(v||0);const tag=n>0?"SOBRA":(n<0?"FALTA":"CUADRADO");return money(n)+" ("+tag+")";})(c.diff?.EFECTIVO||0)}</span></div>
      <div class="line"><span>Real TARJETA</span><span>${money((c.real?.TARJETA||0))}</span></div>
      <div class="line"><span>Dif. TARJETA</span><span>${(function(v){const n=Number(v||0);const tag=n>0?"SOBRA":(n<0?"FALTA":"CUADRADO");return money(n)+" ("+tag+")";})(c.diff?.TARJETA||0)}</span></div>
      <div class="line"><span>Real TRANSF.</span><span>${money((c.real?.TRANSFERENCIA||0))}</span></div>
      <div class="line"><span>Dif. TRANSF.</span><span>${(function(v){const n=Number(v||0);const tag=n>0?"SOBRA":(n<0?"FALTA":"CUADRADO");return money(n)+" ("+tag+")";})(c.diff?.TRANSFERENCIA||0)}</span></div>
      <div class="line"><span>Dif. TOTAL</span><span>${(function(v){const n=Number(v||0);const tag=n>0?"SOBRA":(n<0?"FALTA":"CUADRADO");return money(n)+" ("+tag+")";})(c.diffTotal||0)}</span></div>

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

  $("cShop").textContent = close.shop;
  $("cMeta").textContent = `Cierre • ${close.fromHHMM}-${close.toHHMM}`;
  $("cDate").textContent = close.dateKey;
  $("cTime").textContent = new Date(close.ts).toLocaleString();

  $("cSales").textContent = String(close.salesCount);
  $("cMost").textContent = String(close.mostradorCount);
  $("cEnv").textContent = String(close.envioCount);

  $("cCash").textContent = money(close.pay.EFECTIVO||0);
  $("cCard").textContent = money(close.pay.TARJETA||0);
  $("cTrans").textContent = money(close.pay.TRANSFERENCIA||0);

  $("cSub").textContent = money(close.subtotal);
  $("cDisc").textContent = money(close.discounts);
  $("cTotal").textContent = money(close.total);

  const fmtDiffTag = (v)=>{
    const n = Number(v||0);
    const tag = n>0 ? "SOBRA" : (n<0 ? "FALTA" : "CUADRADO");
    return `${money(n)} (${tag})`;
  };
  if($("cRealCash")) $("cRealCash").textContent = money(close.real?.EFECTIVO||0);
  if($("cRealCard")) $("cRealCard").textContent = money(close.real?.TARJETA||0);
  if($("cRealTrans")) $("cRealTrans").textContent = money(close.real?.TRANSFERENCIA||0);
  if($("cDiffCash")) $("cDiffCash").textContent = fmtDiffTag(close.diff?.EFECTIVO||0);
  if($("cDiffCard")) $("cDiffCard").textContent = fmtDiffTag(close.diff?.TARJETA||0);
  if($("cDiffTrans")) $("cDiffTrans").textContent = fmtDiffTag(close.diff?.TRANSFERENCIA||0);
  if($("cDiffTotal")) $("cDiffTotal").textContent = fmtDiffTag(close.diffTotal||0);

  const cp = $("cProducts");
  cp.innerHTML = "";
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



async function renderClosePanel(){
  if($("closeDate") && !$("closeDate").value) $("closeDate").value = todayKey();
  await renderSavedCloses();
  await buildClose();
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

  const pay = {EFECTIVO:0, TARJETA:0, TRANSFERENCIA:0};
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
      pay.EFECTIVO = (pay.EFECTIVO||0) + Number(s.paySplit.EFECTIVO||0);
      pay.TARJETA  = (pay.TARJETA||0)  + Number(s.paySplit.TARJETA||0);
      pay.TRANSFERENCIA = (pay.TRANSFERENCIA||0) + Number(s.paySplit.TRANSFERENCIA||0);
    }else{
      pay[s.payMethod] = (pay[s.payMethod]||0) + Number(s.total||0);
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

  const realCash = Number($("realCash").value||0);
  const realCard = Number($("realCard").value||0);
  const realTrans= Number($("realTrans").value||0);

  const diff = {
    EFECTIVO: Number((realCash - (pay.EFECTIVO||0)).toFixed(2)),
    TARJETA: Number((realCard - (pay.TARJETA||0)).toFixed(2)),
    TRANSFERENCIA: Number((realTrans - (pay.TRANSFERENCIA||0)).toFixed(2))
  };
  const diffTotal = Number((diff.EFECTIVO + diff.TARJETA + diff.TRANSFERENCIA).toFixed(2));

  $("diffCash").textContent = money(diff.EFECTIVO);
  $("diffCard").textContent = money(diff.TARJETA);
  $("diffTrans").textContent = money(diff.TRANSFERENCIA);
  $("diffTotal").textContent = money(diffTotal);

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
    real: {EFECTIVO: realCash, TARJETA: realCard, TRANSFERENCIA: realTrans},
    diff,
    diffTotal
  };

  state.lastClose = close;
  renderCloseTicket(close);
  return close;
}

function showCloseSuccessModal(c){
  const msg = [
    `Ventas registradas: ${Number(c?.salesCount||0)}`,
    `Total vendido: ${money(c?.total||0)}`,
    `Efectivo: ${money(c?.pay?.EFECTIVO||0)}`,
    `Tarjeta: ${money(c?.pay?.TARJETA||0)}`,
    `Transferencia: ${money(c?.pay?.TRANSFERENCIA||0)}`
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
    $("realCash").value = 0;
    $("realCard").value = 0;
    $("realTrans").value = 0;
    $("diffCash").textContent = money(0);
    $("diffCard").textContent = money(0);
    $("diffTrans").textContent = money(0);
    $("diffTotal").textContent = money(0);
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

  $("realCash").value = c.real?.EFECTIVO ?? 0;
  $("realCard").value = c.real?.TARJETA ?? 0;
  $("realTrans").value = c.real?.TRANSFERENCIA ?? 0;

  $("diffCash").textContent = money(c.diff?.EFECTIVO||0);
  $("diffCard").textContent = money(c.diff?.TARJETA||0);
  $("diffTrans").textContent = money(c.diff?.TRANSFERENCIA||0);
  $("diffTotal").textContent = money(c.diffTotal||0);

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

  const data = {
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    clients, products, sales, shipments, closes, meta, movements
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
