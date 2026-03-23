/* ============================================================
   POS Boutique Offline (IndexedDB)
   - Mantiene diseño y funciones originales
   - + Inventarios en menú
   - + Descuentos (Q/%)
   - + Cierres múltiples por día + cuadre por forma de pago
   - + Envíos pendientes: PENDIENTE/PAGADO (solo PAGADO pasa a ventas)
   - + Tamaños PNG/PDF configurables SOLO para ENVÍO (con código 363534)
============================================================ */

const DB_NAME = "pos_boutique_offline_v1";
const DB_VER = 9; // bumped for anulaciones (voids)
let db;
let appReady = false; // evita clicks antes de que IndexedDB esté lista

// ============================================================
// Logo seguro para exportación PNG (evita "Tainted canvas")
// - Intenta inline (DataURL) desde localStorage o LOGO1.png
// - Si no puede (por ejemplo file://), pide al usuario cargar el logo 1 vez
// ============================================================
const LOGO_DATAURL_KEY = "MB_LOGO_DATAURL_V1";

async function fileToDataURL(file){
  return await new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(r.result);
    r.onerror = ()=>reject(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(file);
  });
}

async function promptLogoUpload(){
  return await new Promise((resolve)=>{
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.style.position = "fixed";
    inp.style.left = "-99999px";
    document.body.appendChild(inp);
    inp.addEventListener("change", async ()=>{
      try{
        const f = inp.files && inp.files[0];
        if(!f){ resolve(null); return; }
        const data = await fileToDataURL(f);
        localStorage.setItem(LOGO_DATAURL_KEY, data);
        resolve(data);
      }catch(e){
        resolve(null);
      }finally{
        inp.remove();
      }
    }, {once:true});
    inp.click();
  });
}

async function getInlineLogoDataURL(){
  let data = localStorage.getItem(LOGO_DATAURL_KEY);
  if(data) return data;

  // intento 0: si el logo YA está cargado en el DOM, lo convertimos a DataURL (funciona incluso en file:// en muchos navegadores)
  try{
    const img = document.getElementById("siteLogo") || document.querySelector(".cornerLogo") || document.querySelector("img[src*='LOGO']");
    if(img && img.complete && img.naturalWidth>0){
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img,0,0);
      const durl = c.toDataURL("image/png", 1.0);
      if(durl && durl.startsWith("data:image")){
        localStorage.setItem(LOGO_DATAURL_KEY, durl);
        return durl;
      }
    }
  }catch(e){ /* ignore */ }

  // intento 1: fetch LOGO1.png (funciona bien en http/https)
  try{
    if(location.protocol==="file:") throw new Error("skip file fetch");
    const _logoFile = (document.getElementById("siteLogo")?.getAttribute("src") || "LOGO1.png");
    const resp = await fetch(_logoFile, {cache:"no-store"});
    if(resp && resp.ok){
      const blob = await resp.blob();
      data = await fileToDataURL(blob);
      localStorage.setItem(LOGO_DATAURL_KEY, data);
      return data;
    }
  }catch(e){ /* ignore */ }

  // intento 2: en file:// o si falló fetch, pedimos al usuario seleccionar el logo
  return null;
}

async function ensureLogosSafe(root){
  if(!root) return;
  const siteSrc = (document.getElementById("siteLogo")?.getAttribute("src") || "LOGO1.png").trim();
  const siteFile = siteSrc.split("/").pop();
  // set crossOrigin siempre
  root.querySelectorAll("img").forEach(img=>{ try{ img.crossOrigin = "anonymous"; }catch(e){} });

  const data = await getInlineLogoDataURL();
  if(!data) return;

  root.querySelectorAll("img").forEach(img=>{
    const src = (img.getAttribute("src")||"").trim();
    if(src === siteSrc || src.endsWith('/'+siteFile) || src.includes(siteFile) || src.includes('LOGO1.png')){
      img.setAttribute("src", data);
    }
  });
}

async function ensureLogoOrAsk(node){
  if(!node) return;
  // 1) intenta sanear (DOM->DataURL / fetch->DataURL) y reemplazar
  await ensureLogosSafe(node);

  // En file:// muchos navegadores bloquean export PNG si el logo no está inline.
  // Pedimos el logo 1 sola vez para guardarlo como DataURL y evitar canvases 'tainted'.
  try{
    const hasInline = !!localStorage.getItem(LOGO_DATAURL_KEY);
    const prompted = localStorage.getItem("MB_LOGO_PROMPTED_V1")==="1";
    if(location.protocol==="file:" && !hasInline && !prompted){
      localStorage.setItem("MB_LOGO_PROMPTED_V1","1");
      const picked = await promptLogoUpload();
      if(picked){ await ensureLogosSafe(node); }
    }
  }catch(e){}

  // 2) espera a que carguen imágenes
  await new Promise(r=>setTimeout(r, 60));

  // 3) si el logo sigue sin cargar, pedimos cargarlo 1 vez
  const imgs = Array.from(node.querySelectorAll("img"));
  const logoImgs = imgs.filter(img=>{
    const src = (img.getAttribute("src")||"").trim();
    const siteFile = (document.getElementById('siteLogo')?.getAttribute('src')||'LOGO1.png').split('/').pop();
    return src.includes(siteFile) || src.includes('LOGO1') || src.startsWith('data:image/');
  });

  // Si hay al menos una imagen y ninguna cargó, forzamos selección
  const anyBad = logoImgs.length && logoImgs.every(img=> !(img.naturalWidth > 0));
  if(anyBad){
    const picked = await promptLogoUpload();
    if(picked){
      await ensureLogosSafe(node);
      await new Promise(r=>setTimeout(r, 60));
    }
  }
}



const state = {
  view: "pos",
  cart: [],
  selectedClient: null,
  lastReceipt: null,  // puede ser venta o envío (pending/paid)
  lastClose: null,
  discount: { type:"NONE", value:0 },
  settings: {
    shopName: "Tienda de Ropa",
    autoPDF:true,
    autoPNG:true,
    envPngWidth: 360,
    envPngScale: 2,
    envPdfWidthMM: 80,
    envPdfMarginMM: 6
  }
};
state.backup = {
  dirHandle: null,
  enabled: true
};
const $ = (id)=>document.getElementById(id);
// Sincroniza UI de descuentos con el estado actual
function syncDiscUI(){
  const d = state.discount || {type:"NONE", value:0};
  const typeEl = $("discType");
  const valEl  = $("discValue");
  if(typeEl) typeEl.value = d.type || "NONE";

  // Si no hay descuento, dejamos vacío para que no moleste
  if(valEl){
    if(!d.type || d.type==="NONE") valEl.value = "";
    else valEl.value = String(d.value ?? 0);
    valEl.disabled = (!d.type || d.type==="NONE");
  }
}

const money = (n)=> "Q" + (Number(n||0)).toFixed(2);

// ===== DESCUENTO POR PRODUCTO (FUNCIONAL) =====
function makeLineId(){
  return "L" + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

function lineGross(it){
  return Number(it?.price||0) * Number(it?.qty||0);
}

function lineItemDiscount(it){
  const gross = lineGross(it);
  const v = Math.max(0, Number(it?.discValue||0));
  return Math.min(gross, v);
}

function lineNet(it){
  return Math.max(0, lineGross(it) - lineItemDiscount(it));
}

// ---------- Cart math + UI ----------
function calcSubtotal(){
  return (state.cart||[]).reduce((sum,it)=> sum + lineGross(it),0);
}

function calcLineDiscountTotal(){
  return (state.cart||[]).reduce((sum,it)=> sum + lineItemDiscount(it),0);
}

function calcGeneralDiscount(baseAmount){
  const d = state.discount || { type:"NONE", value:0 };
  const type = String(d.type || "NONE").toUpperCase();
  const value = Math.max(0, Number(d.value || 0));
  const base = Math.max(0, Number(baseAmount || 0));

  if(!base || !value || type === "NONE") return 0;
  if(type === "%") return Math.min(base, base * (value / 100));
  if(type === "Q") return Math.min(base, value);
  return 0;
}

function calcDiscount(){
  const lineDiscount = calcLineDiscountTotal();
  const baseAfterLineDiscount = Math.max(0, calcSubtotal() - lineDiscount);
  const generalDiscount = calcGeneralDiscount(baseAfterLineDiscount);
  return lineDiscount + generalDiscount;
}

function calcGrand(){
  return Math.max(0, calcSubtotal() - calcDiscount());
}
// -------- Compat helpers (evita errores por funciones renombradas) --------
function cartSubtotal(){ return calcSubtotal(); }
function cartLineDiscountAmount(){ return calcLineDiscountTotal(); }
function cartGeneralDiscountAmount(subtotal){
  const base = Math.max(0, Number((subtotal ?? calcSubtotal()) || 0) - calcLineDiscountTotal());
  return calcGeneralDiscount(base);
}
function cartDiscountAmount(){ return calcDiscount(); }
function cartTotal(){ return calcGrand(); }
// Alias usado por paneles antiguos
function idbGetAll(){ return idbAll.apply(null, arguments); }

function renderCart(){
  const tbody = $("cartBody");
  if(!tbody) return;

  // Compat: asegura id y descuento por línea
  (state.cart||[]).forEach(it=>{
    if(!it.id) it.id = makeLineId();
    if(it.discValue==null) it.discValue = 0;
  });

  const cart = state.cart || [];
  if(!cart.length){
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Carrito vacío</td></tr>`;
  }else{
    tbody.innerHTML = cart.map(it=>{
      const id = String(it.id);
      const qty = Number(it.qty||0);
      const price = Number(it.price||0);
      const disc = lineItemDiscount(it);
      const net  = lineNet(it);

      return `
        <tr>
          <td class="qty">
            <button class="mini" data-act="minus" data-id="${id}">−</button>
            <span class="q">${qty}</span>
            <button class="mini" data-act="plus" data-id="${id}">+</button>
          </td>
          <td class="name">
            <div class="t">${escapeHtml(String(it.name||""))}</div>
            <div class="s muted">${escapeHtml(String(it.code||""))}</div>
          </td>
          <td class="price">${money(price)}</td>
          <td class="disc">
            <input type="number" class="mini"
                   min="0" step="0.01"
                   value="${Number(it.discValue||0) ? Number(it.discValue||0) : ""}"
                   placeholder="0.00"
                   data-act="discVal" data-id="${id}"
                   style="width:92px; text-align:right;" />
            <div class="muted" style="font-size:11px; text-align:right; margin-top:4px;">
              -${money(disc)}
            </div>
          </td>
          <td class="line">${money(net)}</td>
          <td class="act">
            <button class="mini danger" data-act="del" data-id="${id}">✕</button>
          </td>
        </tr>`;
    }).join("");
  }

  // Totales
  const subEl = $("subTotal"); if(subEl) subEl.textContent = money(calcSubtotal());
  const discEl = $("discTotal"); if(discEl) discEl.textContent = money(calcDiscount());
  const grandEl = $("grandTotal"); if(grandEl) grandEl.textContent = money(calcGrand());

  if(typeof updateReceiptPreview === "function") updateReceiptPreview();
}
