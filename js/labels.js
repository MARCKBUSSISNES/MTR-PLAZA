/* ===== Generador de Etiquetas (segmentado) ===== */
(function(){
  const APP_URL = 'labels/labels_app.html';
  const LOGO_FILE = 'LOGO1.png';
  let inventoryPromptBusy = false;

  function $(id){ return document.getElementById(id); }

  async function getProductsPayload(){
    if(typeof window.idbAll !== 'function') return [];
    const products = await window.idbAll('products');
    return (products || []).map(p => ({
      code: String(p.code ?? '').trim(),
      name: String(p.name ?? '').trim(),
      price: Number(p.price ?? 0),
      cost: Number(p.cost ?? 0),
      stock: Math.max(0, Math.floor(Number(p.stock ?? 0)))
    })).filter(p => p.code && p.name);
  }

  async function sendInventoryToLabels(){
    const frame = $('labelsFrame');
    if(!frame || !frame.contentWindow) return;
    try{
      const products = await getProductsPayload();
      frame.contentWindow.postMessage({
        type: 'MTR_PRODUCTS',
        products,
        logoFile: LOGO_FILE
      }, '*');
    }catch(err){
      console.error('No se pudo enviar inventario al generador:', err);
    }
  }

  async function addLabelsToInventory(queue){
    if(typeof window.idbGet !== 'function' || typeof window.idbPut !== 'function') {
      throw new Error('La base de datos principal no está disponible.');
    }

    const byCode = new Map();
    for(const item of (queue || [])){
      const code = String(item.code ?? '').trim();
      const qty = Math.max(0, Math.floor(Number(item.qty ?? 0)));
      if(!code || !qty) continue;

      const prev = byCode.get(code) || {
        code,
        name: String(item.name ?? '').trim(),
        qty: 0
      };
      prev.qty += qty;
      if(!prev.name) prev.name = String(item.name ?? '').trim();
      byCode.set(code, prev);
    }

    for(const row of byCode.values()){
      const prod = await window.idbGet('products', row.code);
      if(!prod) continue;

      const currentStock = Math.max(0, Math.floor(Number(prod.stock ?? 0)));
      prod.stock = currentStock + row.qty;
      await window.idbPut('products', prod);

      if(typeof window.logMovement === 'function'){
        try{
          await window.logMovement({
            type: 'INGRESO',
            code: prod.code,
            name: prod.name,
            qty: row.qty,
            stockAfter: prod.stock,
            refType: 'ETIQUETAS',
            refId: 'LABELS_PDF_DONE',
            note: 'Carga por etiquetas generadas'
          });
        }catch(_e){}
      }
    }

    try{ if(typeof window.renderProducts === 'function') await window.renderProducts(); }catch(_e){}
    try{ if(typeof window.renderInventory === 'function') await window.renderInventory(); }catch(_e){}
    try{ if(typeof window.refreshProductPicker === 'function') await window.refreshProductPicker(); }catch(_e){}
    try{ if(typeof window.refreshKPIs === 'function') await window.refreshKPIs(); }catch(_e){}
  }

  function ensureFrameLoaded(){
    const frame = $('labelsFrame');
    if(!frame) return;
    const current = frame.getAttribute('src') || '';
    if(!current || !current.includes(APP_URL)){
      frame.setAttribute('src', APP_URL);
    }
  }

  function buildQueueSummary(queue){
    const byCode = new Map();
    let totalLabels = 0;

    for(const item of (queue || [])){
      const code = String(item.code ?? '').trim();
      const qty = Math.max(0, Math.floor(Number(item.qty ?? 0)));
      const name = String(item.name ?? '').trim();
      if(!code || !qty) continue;

      totalLabels += qty;
      const prev = byCode.get(code) || { code, name, qty: 0 };
      prev.qty += qty;
      if(!prev.name) prev.name = name;
      byCode.set(code, prev);
    }

    const lines = [];
    lines.push('Se generaron ' + totalLabels + ' etiqueta(s).');
    lines.push('');
    lines.push('Resumen:');
    for(const row of byCode.values()){
      lines.push('- ' + (row.name || row.code) + ' (' + row.code + '): +' + row.qty);
    }
    lines.push('');
    lines.push('¿Deseas cargar estas etiquetas al inventario?');
    return lines.join('\n');
  }

  window.openLabelsModal = function openLabelsModal(){
    const modal = $('labelsModal');
    const frame = $('labelsFrame');
    if(!modal || !frame){
      console.error('No se encontró labelsModal o labelsFrame en index.html');
      return;
    }
    ensureFrameLoaded();
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => { sendInventoryToLabels(); }, 120);
    setTimeout(() => { sendInventoryToLabels(); }, 500);
  };

  window.closeLabelsModal = function closeLabelsModal(){
    const modal = $('labelsModal');
    if(!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  };

  window.addEventListener('message', async (ev) => {
    const data = ev.data || {};
    if(data.type === 'LABELS_READY'){
      await sendInventoryToLabels();
      return;
    }

    if(data.type === 'LABELS_REQUEST_PRODUCTS'){
      await sendInventoryToLabels();
      return;
    }

    if(data.type === 'LABELS_PDF_DONE'){
      if(inventoryPromptBusy) return;
      inventoryPromptBusy = true;
      try{
        const queue = Array.isArray(data.queue) ? data.queue : [];
        if(!queue.length) return;

        if(!data.applyToInventory) return;

        await addLabelsToInventory(queue);
        window.alert('✅ Inventario actualizado con las etiquetas generadas.');
      }catch(err){
        console.error(err);
        window.alert('❌ No se pudo actualizar el inventario.');
      } finally {
        inventoryPromptBusy = false;
      }
    }
  });

  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      const modal = $('labelsModal');
      if(modal && modal.style.display !== 'none') window.closeLabelsModal();
    }
  });
})();
let __labelsConfirmResolver = null;

function showLabelsConfirmModal(summaryText){
  return new Promise((resolve)=>{
    __labelsConfirmResolver = resolve;

    const ov = document.getElementById("labelsConfirmOverlay");
    const box = document.getElementById("labelsConfirmSummary");

    if(box) box.textContent = summaryText || "";

    if(ov){
      ov.style.display = "flex";
      ov.classList.add("show");
      ov.setAttribute("aria-hidden", "false");
    }
  });
}

function closeLabelsConfirmModal(answer){
  const ov = document.getElementById("labelsConfirmOverlay");

  if(ov){
    ov.classList.remove("show");
    ov.setAttribute("aria-hidden", "true");
    ov.style.display = "none";
  }

  if(__labelsConfirmResolver){
    __labelsConfirmResolver(!!answer);
    __labelsConfirmResolver = null;
  }
}