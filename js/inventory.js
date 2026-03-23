// ---------- Inventory ----------
async function renderInventory(){
  const q = normKey($("invSearch").value);
  const all = await idbAll("products");
  const list = q ? all.filter(p => normKey(p.code).includes(q) || (p.nameKey||"").includes(q)) : all;

  const tb = $("invBody");
  tb.innerHTML = "";
  for(const p of list.sort((a,b)=> (a.nameKey||"").localeCompare(b.nameKey||""))){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.code)}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${money(p.price)}</td>
      <td>${money(p.cost||0)}</td>
      <td>${Number(p.stock||0)}</td>
    `;
    tb.appendChild(tr);
  }
}


// ---------- Kardex UI ----------

function exportInventoryExcel(){
  // Exporta a Excel (HTML .xls) con tabla formateada (no CSV)
  idbAll("products").then((products)=>{
    const rows = (products || []).slice().sort((a,b)=> (a.nameKey||"").localeCompare(b.nameKey||""));
    const now = new Date();
    const title = `Inventario (Stock actual) - ${now.toLocaleString()}`;

    const header = `
      <html><head><meta charset="utf-8">
      <style>
        body{font-family:Arial, sans-serif;}
        h2{margin:0 0 10px 0;}
        table{border-collapse:collapse; width:100%;}
        th,td{border:1px solid #333; padding:8px; font-size:12px;}
        th{background:#e6f4ea; font-weight:700;}
        .num{text-align:right;}
        .muted{color:#555; font-size:11px; margin:6px 0 12px;}
      </style></head><body>
      <h2>${escapeHtml(title)}</h2>
      <div class="muted">Exportado desde MTR ONLINE AP</div>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th class="num">Precio (Q)</th>
            <th class="num">Costo (Q)</th>
            <th class="num">Stock</th>
          </tr>
        </thead>
        <tbody>
    `;

    const body = rows.map(p=>{
      const code = escapeHtml(p.code||"");
      const name = escapeHtml(p.name||"");
      const price = Number(p.price||0).toFixed(2);
      const cost = Number(p.cost||0).toFixed(2);
      const stock = Number(p.stock||0);
      return `<tr>
        <td>${code}</td>
        <td>${name}</td>
        <td class="num">${price}</td>
        <td class="num">${cost}</td>
        <td class="num">${stock}</td>
      </tr>`;
    }).join("");

    const footer = `
        </tbody>
      </table>
      
<!-- Modal: Crear producto (desde Generador) -->
<div class="ok-modal" id="genProdOverlayMB" aria-hidden="true" style="display:none">
  <div class="ok-modal-card" role="dialog" aria-modal="true" aria-labelledby="genProdTitleMB" style="max-width:520px">
    <div class="ok-modal-head">
      <div class="ok-modal-title" id="genProdTitleMB">➕ Crear producto</div>
      <button class="btn mb-modal-x" type="button" onclick="closeGenProdModalMB()">✕</button>
    </div>
    <div class="ok-modal-body">
      <div class="form stack">
        <div class="field">
          <label>Código / SKU</label>
          <input id="mbNewPCode" placeholder="Ej: 7501234567890"/>
        </div>
        <div class="field">
          <label>Nombre</label>
          <input id="mbNewPName" placeholder="Ej: Camisa Oxford"/>
        </div>
        <div class="row" style="gap:10px">
          <div class="field grow">
            <label>Precio (Q)</label>
            <input id="mbNewPPrice" inputmode="decimal" placeholder="129.00"/>
          </div>
          <div class="field grow">
            <label>Costo (Q)</label>
            <input id="mbNewPCost" inputmode="decimal" placeholder="80.00"/>
          </div>
        </div>
        <div class="field">
          <label>Stock</label>
          <input id="mbNewPStock" inputmode="numeric" placeholder="0"/>
        </div>
      </div>
    </div>
    <div class="ok-modal-foot">
      <button class="btn primary" type="button" onclick="saveGenProductMB()">Guardar en inventario</button>
      <button class="btn" type="button" onclick="closeGenProdModalMB()">Cancelar</button>
    </div>
  </div>
</div>

</body></html>
    `;

    const html = header + body + footer;

    const blob = new Blob([html], {type:"application/vnd.ms-excel;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const y = now.getFullYear();
    const m = String(now.getMonth()+1).padStart(2,"0");
    const d = String(now.getDate()).padStart(2,"0");
    a.download = `inventario_${y}-${m}-${d}.xls`;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }).catch((e)=>{
    console.warn(e);
    alert("No se pudo exportar el inventario.");
  });
}

async function renderKardex(){
  const q = ($("kSearch")?.value || "").trim().toLowerCase();
  const t = ($("kType")?.value || "").trim();

  let rows = await (typeof idbAll === "function" ? idbAll("movements") : idbGetAll("movements"));
  rows.sort((a,b)=>(b.ts||0)-(a.ts||0));

  if(t) rows = rows.filter(r=>String(r.type||"")===t);
  if(q){
    rows = rows.filter(r=>{
      const code = String(r.code||"").toLowerCase();
      const name = String(r.name||"").toLowerCase();
      const note = String(r.note||"").toLowerCase();
      return code.includes(q) || name.includes(q) || note.includes(q);
    });
  }

  const body = $("kBody");
  if(!body) return;
  body.innerHTML = rows.map(r=>{
    const dt = new Date(r.ts||0);
    const f = dt.toLocaleString("es-GT");
    const qty = Number(r.qty||0);
    const qtyTxt = (qty>0? `+${qty}` : String(qty));
    const stockTxt = (r.stockAfter===null || r.stockAfter===undefined) ? "" : String(r.stockAfter);
    const ref = [r.refType, r.refId].filter(Boolean).join(": ");
    return `
      <tr>
        <td>${escapeHtml(f)}</td>
        <td><b>${escapeHtml(String(r.type||""))}</b></td>
        <td>${escapeHtml(String(r.code||""))}</td>
        <td>${escapeHtml(String(r.name||""))}</td>
        <td style="text-align:right">${escapeHtml(qtyTxt)}</td>
        <td style="text-align:right">${escapeHtml(stockTxt)}</td>
        <td>${escapeHtml(ref)}</td>
        <td>${escapeHtml(String(r.note||""))}</td>
      </tr>
    `;
  }).join("");
}

async function clearKardex(){
  if(!confirm("¿Seguro? Esto borrará TODOS los movimientos del kardex.")) return;
  if(typeof idbClearStore === "function") await idbClearStore("movements");
  else if(typeof clearStore === "function") await clearStore("movements");
  else if(typeof idbClear === "function") await idbClear("movements");
  await renderKardex();
}
async function exportKardexExcel(){

  const rows = await idbGetAll("movements");
  rows.sort((a,b)=>(a.ts||0)-(b.ts||0));

  const empresa = state.settings?.shopName || "REPORTE KARDEX";
  const fechaReporte = new Date().toLocaleString();

  let entradas = 0;
  let salidas = 0;

  const data = rows.map(r=>{

    const fecha = new Date(r.ts||0).toLocaleString();
    const qty = Number(r.qty||0);

    if(qty>0) entradas += qty;
    if(qty<0) salidas += Math.abs(qty);

    return [
      fecha,
      r.type || "",
      r.code || "",
      r.name || "",
      qty,
      r.stockAfter ?? "",
      [r.refType,r.refId].filter(Boolean).join(": "),
      r.note || ""
    ];
  });

  const sheetData = [
    [empresa],
    ["KARDEX DE INVENTARIO"],
    ["Generado: " + fechaReporte],
    [],
    ["Fecha","Tipo","Código","Producto","Cantidad","Stock luego","Referencia","Nota"],
    ...data,
    [],
    ["","","","TOTAL ENTRADAS",entradas],
    ["","","","TOTAL SALIDAS",salidas]
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws["!cols"] = [
    {wch:22},
    {wch:12},
    {wch:15},
    {wch:35},
    {wch:12},
    {wch:12},
    {wch:20},
    {wch:30}
  ];

  ws["!freeze"] = { xSplit:0, ySplit:5 };

  ws["!autofilter"] = { ref:"A5:H5" };

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb,ws,"Kardex");

  const fecha = new Date().toISOString().slice(0,10);

  XLSX.writeFile(wb,`KARDEX_${fecha}.xlsx`);
}