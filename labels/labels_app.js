(function(){
  const LOGIN_CODE = '363534';
  const LOGIN_KEY = 'mb_labels_logged_in_v1';
  const state = { products: [], queue: [] };
  const $ = (id) => document.getElementById(id);

  function toast(msg){
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function money(n){ return 'Q' + Number(n || 0).toFixed(2); }
  function norm(s){ return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function validateCode(code){ return /^\d{1,}$/.test(String(code || '').trim()); }

  function drawBarcode(svgEl, code){
    if(!svgEl) return;
    svgEl.innerHTML = '';
    if(!code) return;
    try{
      JsBarcode(svgEl, String(code), {
        format:'CODE128', displayValue:false, margin:0, height:58, width:2.6,
        background:'#ffffff', lineColor:'#000000'
      });
    }catch(_e){}
  }

  function updatePreview(prod){
    $('pvName').textContent = prod?.name || '—';
    $('pvPrice').textContent = money(prod?.price || 0);
    drawBarcode($('pvBarcode'), prod?.code || '00000');
  }

  function findProduct(code){
    return state.products.find(p => String(p.code) === String(code)) || null;
  }

  function renderPicker(){
    const q = norm($('qSearch').value);
    const sel = $('pick');
    sel.innerHTML = '';
    const list = q ? state.products.filter(p => norm(p.code).includes(q) || norm(p.name).includes(q)) : state.products.slice();
    if(!list.length){
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Sin productos';
      sel.appendChild(opt);
      updatePreview(null);
      return;
    }
    list.sort((a,b)=> norm(a.name).localeCompare(norm(b.name)));
    for(const p of list){
      const opt = document.createElement('option');
      opt.value = p.code;
      opt.textContent = p.code + ' — ' + p.name + ' — ' + money(p.price) + ' — Stock:' + Number(p.stock || 0);
      sel.appendChild(opt);
    }
    updatePreview(findProduct(sel.value));
  }

  function renderQueue(){
    const tb = $('queueBody');
    tb.innerHTML = '';
    if(!state.queue.length){
      tb.innerHTML = '<tr><td colspan="5"><small style="color:rgba(255,255,255,.6);font-weight:900">Cola vacía.</small></td></tr>';
      return;
    }
    state.queue.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + it.code + '</td>' +
        '<td>' + it.name + '</td>' +
        '<td>' + money(it.price) + '</td>' +
        '<td>' + it.qty + '</td>' +
        '<td>' +
          '<button class="btn small secondary" data-act="edit" data-i="' + idx + '" type="button">Cant.</button> ' +
          '<button class="btn small danger" data-act="del" data-i="' + idx + '" type="button">X</button>' +
        '</td>';
      tb.appendChild(tr);
    });
  }

  function queueToSerializable(){
    return state.queue.map(it => ({ code: it.code, name: it.name, price: it.price, qty: it.qty }));
  }

  function addToQueue(){
    const code = $('pick').value;
    const qty = Math.max(1, Number($('qty').value || 1));
    const p = findProduct(code);
    if(!p) return alert('Seleccione un producto válido.');
    state.queue.push({ code: p.code, name: p.name, price: Number(p.price || 0), qty, updatedAt: Date.now() });
    renderQueue();
    toast('Agregado');
  }

  function clearQueue(){
    state.queue = [];
    renderQueue();
    toast('Cola limpia');
  }

  function barcodeDataURL(code){
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 320;
    JsBarcode(canvas, String(code), {
      format:'CODE128', displayValue:false, margin:0, height:230, width:6,
      background:'#ffffff', lineColor:'#000000'
    });
    return canvas.toDataURL('image/png', 1.0);
  }

  async function openPDF(){
    if(!state.queue.length) return alert('Cola vacía.');

    let w = Number($('lblW').value || 50);
    let h = Number($('lblH').value || 25);
    if(!isFinite(w) || w < 20) w = 50;
    if(!isFinite(h) || h < 20) h = 25;
    let ori = $('lblOri').value || 'landscape';
    if(ori === 'AUTO') ori = (w >= h ? 'landscape' : 'portrait');

    const labels = [];
    for(const it of state.queue){
      for(let i=0;i<it.qty;i++) labels.push(it);
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: ori, unit: 'mm', format: [w,h], compress: true });

    const m = 1.6, quiet = 1.6, nameY = 6.2, barcodeTop = 7.6;
    const barcodeH = h - barcodeTop - 1.2;

    function safeText(s){ return String(s || '').replace(/\s+/g, ' ').trim(); }
    function fitOneLine(docObj, text, maxWidth, startSize, minSize){
      let s = startSize;
      docObj.setFontSize(s);
      while(s > minSize && docObj.getTextWidth(text) > maxWidth){ s -= 0.2; docObj.setFontSize(s); }
      if(docObj.getTextWidth(text) <= maxWidth) return { size: s, text };
      const ell = '…';
      docObj.setFontSize(minSize);
      let lo = 0, hi = text.length;
      while(lo < hi){
        const mid = Math.ceil((lo + hi) / 2);
        const t = text.slice(0, mid) + ell;
        if(docObj.getTextWidth(t) <= maxWidth) lo = mid;
        else hi = mid - 1;
      }
      return { size: minSize, text: text.slice(0, lo) + ell };
    }

    for(let i=0;i<labels.length;i++){
      if(i > 0) doc.addPage([w,h], ori);
      const it = labels[i];
      const priceStr = money(it.price);
      const name = safeText(it.name);
      doc.setFillColor(255,255,255); doc.rect(0,0,w,h,'F');
      doc.setTextColor(0,0,0); doc.setFont('helvetica','bold');
      const rightX = w - m;
      doc.setFontSize(9.2);
      const priceW = doc.getTextWidth(priceStr);
      const maxNameW = (rightX - priceW - 2.2) - m;
      const fitted = fitOneLine(doc, name, Math.max(10, maxNameW), 9.2, 6.8);
      doc.setFontSize(fitted.size); doc.text(fitted.text || '—', m, nameY);
      doc.setFontSize(9.2); doc.text(priceStr, rightX, nameY, { align:'right' });
      const bx = m, by = barcodeTop, bw = w - (m * 2), bh = barcodeH;
      doc.setDrawColor(0,0,0); doc.setLineWidth(0.25); doc.setFillColor(255,255,255);
      doc.roundedRect(bx, by, bw, bh, 1.6, 1.6, 'FD');
      const img = barcodeDataURL(it.code);
      doc.addImage(img, 'PNG', bx + quiet, by + quiet, bw - (quiet * 2), bh - (quiet * 2));
    }

const queue = queueToSerializable();

const summary = queue
  .map(i => `${i.code}  ${i.name}  x${i.qty}`)
  .join('\n');

let applyToInventory = false;
try{
  applyToInventory = await showInventoryConfirm(summary);
}catch(_e){
  applyToInventory = false;
}

try{
  window.parent && window.parent.postMessage({
    type:'LABELS_PDF_DONE',
    queue,
    applyToInventory
  }, '*');
}catch(_e){}

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
    toast('PDF listo');
  }

  async function exportJSON(){
    const data = {
      exportedAt: new Date().toISOString(),
      products: state.products,
      queue: queueToSerializable()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'marckbusiness_generador_backup.json';
    a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
  }

  async function importExcelFile(file){
    const data = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(data, { type:'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
    const mapped = [];
    let bad = 0;
    for(const r of rows){
      const code = String(r.SKU ?? r.sku ?? r.CODIGO ?? r.codigo ?? '').trim();
      const name = String(r.NOMBRE ?? r.nombre ?? r.PRODUCTO ?? r.producto ?? '').trim();
      const price = Number(String(r.PRECIO ?? r.precio ?? '').replace(/[^0-9.]/g, ''));
      const stock = Math.max(0, Math.floor(Number(String(r.STOCK ?? r.stock ?? '').replace(/[^0-9]/g, '')) || 0));
      if(!code || !name || Number.isNaN(price)){ bad++; continue; }
      mapped.push({ code, name, price: Number(price.toFixed(2)), stock });
    }

    if(window.parent && typeof window.parent.idbPut === 'function'){
      for(const p of mapped){
        const prev = await window.parent.idbGet('products', p.code);
        await window.parent.idbPut('products', {
          ...(prev || {}),
          code: p.code,
          name: p.name,
          price: p.price,
          stock: p.stock,
          cost: Number(prev?.cost || 0),
          nameKey: norm(p.name),
          updatedAt: Date.now()
        });
      }
      try{ window.parent.postMessage({ type:'LABELS_REQUEST_PRODUCTS' }, '*'); }catch(_e){}
      toast('Excel importado');
      if(bad > 0) alert('Importados: ' + mapped.length + ' | Saltados: ' + bad);
      return;
    }
    alert('No se pudo importar al inventario principal.');
  }

  function wire(){
    $('qSearch').addEventListener('input', renderPicker);
    $('btnRefresh').addEventListener('click', ()=> {
      try{ window.parent && window.parent.postMessage({ type:'LABELS_REQUEST_PRODUCTS' }, '*'); }catch(_e){}
      renderPicker();
    });
    $('pick').addEventListener('change', ()=> updatePreview(findProduct($('pick').value)));
    $('btnAddToQueue').addEventListener('click', addToQueue);
    $('btnClearQueue').addEventListener('click', clearQueue);
    $('btnPDF').addEventListener('click', openPDF);
    $('btnExport').addEventListener('click', exportJSON);
    $('btnExcel').addEventListener('click', ()=> $('excelFile').click());
    $('excelFile').addEventListener('change', async (e)=>{
      const file = e.target.files?.[0];
      if(file) await importExcelFile(file);
      e.target.value = '';
    });
    $('btnWipe').addEventListener('click', ()=>{
      if(!confirm('¿Borrar solo la cola y la vista del generador?')) return;
      clearQueue();
    });
    $('queueBody').addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-act]');
      if(!b) return;
      const idx = Number(b.dataset.i);
      if(!Number.isFinite(idx)) return;
      if(b.dataset.act === 'del'){
        state.queue.splice(idx,1);
        renderQueue();
      }else if(b.dataset.act === 'edit'){
        const v = prompt('Nueva cantidad:', state.queue[idx]?.qty || 1);
        if(v === null) return;
        state.queue[idx].qty = Math.max(1, Number(v || 1));
        renderQueue();
      }
    });
  }

  window.addEventListener('message', (ev)=>{
    const data = ev.data || {};
    if(data.type !== 'MTR_PRODUCTS') return;
    const list = Array.isArray(data.products) ? data.products : [];
    state.products = list.map(p => ({
      code: String(p.code ?? '').trim(),
      name: String(p.name ?? '').trim(),
      price: Number(p.price ?? 0),
      cost: Number(p.cost ?? 0),
      stock: Math.max(0, Math.floor(Number(p.stock ?? 0)))
    })).filter(p => p.code && p.name);
    $('syncPill').textContent = '✅ Inventario sincronizado (' + state.products.length + ')';
    renderPicker();
  });

window.addEventListener('DOMContentLoaded', ()=>{
  try{
    const parentLogo = window.parent?.document?.getElementById('siteLogo');
    const src = parentLogo ? parentLogo.getAttribute('src') : '';
    if(src && $('logoImg')) $('logoImg').src = src;
  }catch(_e){}

  wire();
  renderPicker();
  updatePreview(null);

  try{
    window.parent && window.parent.postMessage({ type:'LABELS_READY' }, '*');
  }catch(_e){}
});
})();
function showInventoryConfirm(summary){
  return new Promise((resolve)=>{

    const modal = document.createElement("div");
    modal.style = `
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.6);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:9999;
    `;

    modal.innerHTML = `
      <div style="
        width:420px;
        background:#111827;
        border-radius:16px;
        padding:20px;
        color:white;
        font-family:system-ui;
        box-shadow:0 20px 60px rgba(0,0,0,.6);
      ">

        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <img src="../LOGO1.png" style="height:40px;">
          <div style="font-weight:900;font-size:16px;">
            Cargar etiquetas al inventario
          </div>
        </div>

        <div style="
          font-size:13px;
          margin-bottom:14px;
          white-space:pre-wrap;
          max-height:180px;
          overflow:auto;
        ">${summary}</div>

        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="btnNoInv" style="
            padding:8px 14px;
            border-radius:10px;
            border:1px solid #444;
            background:#222;
            color:white;
            cursor:pointer;
          ">No</button>

          <button id="btnYesInv" style="
            padding:8px 14px;
            border-radius:10px;
            border:none;
            background:#2b7cff;
            color:white;
            cursor:pointer;
            font-weight:700;
          ">Sí cargar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("#btnNoInv").onclick = ()=>{
      modal.remove();
      resolve(false);
    };

    modal.querySelector("#btnYesInv").onclick = ()=>{
      modal.remove();
      resolve(true);
    };

  });
}