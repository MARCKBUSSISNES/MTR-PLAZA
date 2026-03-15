// ---------- Receipt (text + preview + PDF + PNG) ----------
function applyEnvReceiptSizing(saleType){
  const node = $("receiptBox");
  if(!node) return;
  try{ syncReceiptLogos(node); }catch(e){}

  // Clase para estilos ENVÍO (autoajuste / tipografía)
  node.classList.toggle("envio", saleType === "ENVIO");

  // Solo ENVÍO aplica tamaño configurable
  if(saleType === "ENVIO"){
    const w = Number(state.settings.envPngWidth || 360);
    node.style.width = Math.max(260, Math.min(520, w)) + "px";
  }else{
    node.style.width = ""; // vuelve a CSS default
  }
}

function getBestLogoSrc(){
  const inlineLogo = (() => {
    try{
      const v = localStorage.getItem(LOGO_DATAURL_KEY);
      return (v && String(v).startsWith("data:image/")) ? v : "";
    }catch(e){ return ""; }
  })();

  if(inlineLogo) return inlineLogo;

  const siteLogo = document.getElementById("siteLogo");
  const fromSite = siteLogo?.currentSrc || siteLogo?.getAttribute("src") || "";
  if(fromSite) return fromSite;

  const receiptLogo = document.querySelector("#receiptBox img.cornerLogo")?.getAttribute("src") || "";
  if(receiptLogo) return receiptLogo;

  return "LOGO1.png";
}

function syncReceiptLogos(root){
  const box = root || document;
  const src = getBestLogoSrc();
  box.querySelectorAll?.("img.cornerLogo").forEach(img=>{
    try{
      img.setAttribute("src", src);
      img.style.display = "";
      img.removeAttribute("hidden");
    }catch(e){}
  });
}

async function hydrateReceiptLogos(root){
  const box = root || document;
  const imgs = Array.from(box.querySelectorAll?.("img.cornerLogo") || []);
  if(!imgs.length) return;

  const src = getBestLogoSrc();

  await Promise.all(imgs.map(img => new Promise((resolve)=>{
    try{
      img.crossOrigin = "anonymous";
      img.style.display = "";
      img.removeAttribute("hidden");

      const done = ()=>resolve(true);
      const fail = async ()=>{
        try{
          if(typeof ensureLogoOrAsk === "function"){
            await ensureLogoOrAsk(box);
            const retry = localStorage.getItem(LOGO_DATAURL_KEY) || src || "LOGO1.png";
            img.src = retry;
            img.style.display = "";
            img.removeAttribute("hidden");
            setTimeout(done, 80);
            return;
          }
        }catch(e){}
        resolve(false);
      };

      if(img.getAttribute("src") !== src) img.src = src;

      if(img.complete && img.naturalWidth > 0){
        done();
        return;
      }

      img.onload = ()=>done();
      img.onerror = ()=>{ fail(); };

      if(!img.getAttribute("src")) img.src = src;
    }catch(e){
      resolve(false);
    }
  })));
}

function makeLiveReceipt(){
  const saleType = $("saleType").value;
  const payMethod = $("payMethod").value;
  const c = (saleType==="ENVIO") ? state.selectedClient : (state.selectedClient || null);
  return {
    ts: Date.now(),
    receiptNo: state.lastReceipt?.receiptNo || String($("rNo").textContent||"").replace("#","") || "------",
    shop: state.settings.shopName,
    saleType, payMethod,
    status: (saleType==="ENVIO") ? "PENDIENTE" : "PAGADO",
    client: c ? {phone:c.phone, names:c.names, last:c.last, nit:(c.nit||""), addr:c.addr, indic:c.indic} : null,
    items: state.cart.map(x=>({...x})),
    subtotal: cartSubtotal(),
    discountAmount: cartDiscountAmount(cartSubtotal()),
    total: cartTotal()
  };
}

function saleToReceiptText(s){
  if(!s) return "No hay recibo todavía.";
  const d = new Date(s.ts || Date.now()).toLocaleString();
  const client = s.client ? `${s.client.names} ${s.client.last}` : "MOSTRADOR";
  const phone  = s.client?.phone || "—";
  const nitVal = (s.client?.nit || "").trim();
  const addr   = s.client?.addr  || "—";
  const status = s.status ? `Estatus: ${s.status}` : "";
  const lines = [];
  lines.push(`★ *${s.shop}*`);
  lines.push(`Recibo #${s.receiptNo}`);
  lines.push(`Fecha: ${d}`);
  if(status) lines.push(status);
  if(s.payMethod==="MIXTO" && s.paySplit){
  lines.push(`Tipo: ${s.saleType} | Pago: MIXTO (E:${money(s.paySplit.EFECTIVO||0)} + T:${money(s.paySplit.TARJETA||0)})`);
}else{
  lines.push(`Tipo: ${s.saleType} | Pago: ${s.payMethod}`);
}
  lines.push(`Cliente: ${client}`);
  lines.push(`Tel: ${phone}`);
  if(nitVal) lines.push(`NIT: ${nitVal}`);
  lines.push(`Dir: ${addr}`);
  lines.push(`--------------------------------`);
for(const it of (s.items||[])){
  const gross = Number(it.qty || 0) * Number(it.price || 0);
  const disc  = Math.min(gross, Math.max(0, Number(it.discValue || 0)));
  const net   = Math.max(0, gross - disc);

  lines.push(`${it.qty} x ${it.name} = ${money(net)}`);

  if(disc > 0){
    lines.push(`   DESC. ITEM: -${money(disc)}`);
  }
}
  lines.push(`--------------------------------`);
lines.push(`SUBTOTAL: ${money(s.subtotal ?? s.total)}`);
lines.push(`DESCUENTO: ${money(s.discountAmount ?? 0)}`);

const envioMonto = Math.max(
  0,
  Number(s.total || 0) - Number(s.subtotal || 0) + Number(s.discountAmount || 0)
);

if ((s.saleType || "").toUpperCase() === "ENVIO" && envioMonto > 0) {
  lines.push(`ENVÍO: ${money(envioMonto)}`);
}

lines.push(`TOTAL: *${money(s.total)}*`);
  lines.push(`Gracias por tu compra 💗`);
  return lines.join("\n"); // <- SALTOS REALES
}

function updateReceiptPreview(){
  const s = state.lastReceipt || makeLiveReceipt();
  const saleType = s.saleType || $("saleType").value;

  applyEnvReceiptSizing(saleType);

  $("rShop").textContent = s.shop || state.settings.shopName || "Tienda de Ropa";
  $("rMeta").textContent = `Recibo • ${s.saleType || "MOSTRADOR"} • ${s.payMethod || "EFECTIVO"}`;
  $("rNo").textContent = "#" + (s.receiptNo || "------");
  $("rDate").textContent = new Date(s.ts || Date.now()).toLocaleString();

  const client = s.client ? `${s.client.names} ${s.client.last}` : "MOSTRADOR";
  $("rClient").textContent = client;
  $("rPhone").textContent = s.client?.phone || "—";
  if($("rNit")) $("rNit").textContent = s.client?.nit || "—";
  $("rAddr").textContent  = s.client?.addr || "—";
  $("rPay").textContent   = s.payMethod || $("payMethod").value;

  const badge = $("rStatusBadge");
  const status = s.status || (saleType==="ENVIO" ? "PENDIENTE" : "PAGADO");
  badge.classList.remove("hide","pending","paid");
  if(status === "PENDIENTE"){
    badge.textContent = "⏳ PENDIENTE";
    badge.classList.add("pending");
  }else{
    badge.textContent = "✅ PAGADO";
    badge.classList.add("paid");
  }

  // Indicaciones (cliente)
  $("rIndic").textContent = s.client?.indic || "—";

  const itemsDiv = $("rItems");
  itemsDiv.innerHTML = "";

  const isEnvio = (saleType === "ENVIO");
  const pay = (s.payMethod || $("payMethod").value || "EFECTIVO");

  // En ENVÍO: NO mostramos detalle de productos.
  // - Si es EFECTIVO: mostramos SOLO el TOTAL.
  // - Si es TARJETA/TRANSFERENCIA: mostramos SOLO la forma de pago.
  if(isEnvio){
    const subLine  = $("rSubLine");
    const discLine = $("rDiscLine");
    const payLine  = $("rPayLine");
    const totLine  = $("rTotalLine");
    if(subLine) subLine.classList.add("hide");
    if(discLine) discLine.classList.add("hide");
    if(payLine) payLine.classList.add("hide");
    if(totLine) totLine.classList.add("hide");

    const line = document.createElement("div");
    line.className = "line";
    if(pay === "EFECTIVO"){
      line.innerHTML = `<span>Total</span><span>${money(s.total ?? cartTotal())}</span>`;
    }else{
      line.innerHTML = `<span>Pago</span><span>${escapeHtml(pay)}</span>`;
    }
    itemsDiv.appendChild(line);
  }else{
    // MOSTRADOR: comportamiento actual (detalle + totales)
    const subLine  = $("rSubLine");
    const discLine = $("rDiscLine");
    const payLine  = $("rPayLine");
    const totLine  = $("rTotalLine");
    if(subLine) subLine.classList.remove("hide");
    if(discLine) discLine.classList.remove("hide");
    if(payLine) payLine.classList.remove("hide");
    if(totLine) totLine.classList.remove("hide");

    for(const it of (s.items||[])){
      const line = document.createElement("div");
      line.className="line";
      {
      const gross = Number(it.qty||0)*Number(it.price||0);
      const disc = Math.min(gross, Math.max(0, Number(it.discValue||0)));
      const net = Math.max(0, gross - disc);

      line.innerHTML = `<span>${it.qty} x ${escapeHtml(it.name)}</span><span>${money(net)}</span>`;
      itemsDiv.appendChild(line);

      // 🆕 mostrar descuento por producto si existe
      if(disc>0){
        const dline = document.createElement("div");
        dline.className = "line muted";
        dline.innerHTML = `<span>Descuento</span><span>-${money(disc)}</span>`;
        itemsDiv.appendChild(dline);
      }
      continue;
    }
}

    $("rSub").textContent = money(s.subtotal ?? cartSubtotal());
    $("rDisc").textContent = money(s.discountAmount ?? cartDiscountAmount(s.subtotal ?? cartSubtotal()));
    $("rTotal").textContent = money(s.total ?? cartTotal());
  }
  // Asegura logo visible también en MOSTRADOR/ENVÍO
  try{ syncReceiptLogos($("receiptBox")); }catch(e){}
  try{ hydrateReceiptLogos($("receiptBox")); }catch(e){}
  try{ ensureLogosSafe($("receiptBox")); }catch(e){}
}

function handlePayMethodUI(){
  const pm = $("payMethod")?.value || "EFECTIVO";
  const wrap = $("mixPayWrap");
  if(!wrap) return;
  if(pm==="MIXTO"){
    wrap.style.display = "";
    // Autocompletar tarjeta con el restante
    const subtotal = cartSubtotal();
    const disc = cartDiscountAmount(subtotal);
    const total = Math.max(subtotal - disc, 0);
    const cash = Number($("mixCash")?.value || 0);
    const card = Math.max(0, Number((total - cash).toFixed(2)));
    if($("mixCard")) $("mixCard").value = isFinite(card) ? card : 0;
  }else{
    wrap.style.display = "none";
  }
}


async function copyReceipt(){
  const s = state.lastReceipt || makeLiveReceipt();
  const text = saleToReceiptText(s);
  try{
    await navigator.clipboard.writeText(text);
    alert("Recibo copiado. Pégalo en WhatsApp.");
  }catch{
    alert("No se pudo copiar automáticamente. Intenta copiar manualmente desde WhatsApp.");
  }
}

function normalizePhoneForWA(phone){
  const raw = String(phone||"").trim();
  if(!raw) return "";
  // Deja solo dígitos (WhatsApp wa.me usa solo números)
  let d = raw.replace(/\D+/g,"");
  if(!d) return "";
  // Guatemala: si son 8 dígitos, asumimos +502
  if(d.length === 8) d = "502" + d;
  // Si viene con 00 prefix (ej. 00502...), lo normalizamos
  if(d.startsWith("00")) d = d.slice(2);
  return d;
}
function getClientPhoneFromReceipt(s){
  // 1) del recibo guardado 2) del draft del panel 3) del cliente seleccionado
  const a = s?.client?.phone;
  const b = $("cPhone")?.value;
  const c = state.selectedClient?.phone;
  return normalizePhoneForWA(a || b || c || "");
}
function openWhatsAppForReceipt(s){
  const r = s || state.lastReceipt || makeLiveReceipt();
  const text = saleToReceiptText(r);
  const phone = getClientPhoneFromReceipt(r);

  // Si hay teléfono, abre chat directo. Si no, abre WhatsApp con el texto listo.
  const url = phone
    ? ("https://wa.me/" + phone + "?text=" + encodeURIComponent(text))
    : ("https://wa.me/?text=" + encodeURIComponent(text));

  window.open(url, "_blank");
}
function openWhatsApp(){
  openWhatsAppForReceipt(state.lastReceipt || makeLiveReceipt());
}


// --- Seguridad (código para borrar/editar) ---
// ===== CÓDIGO DE EDICIÓN (solo 1 vez por sesión) =====
const EDIT_CODE = "363534";
const EDIT_OK_KEY = "mb_edit_ok_v1";

// ===== MODAL MENSAJE (OK) =====
let __okModalEnter = false;
let __okModalReload = false;

function showCheckoutLoading(msg){
  const ov = document.getElementById("checkoutLoading");
  const m = document.getElementById("checkoutLoadingMsg");
  if(m) m.textContent = String(msg || "Espera un momento.");
  if(ov){
    ov.classList.add("show");
    ov.setAttribute("aria-hidden","false");
  }
}
function hideCheckoutLoading(){
  const ov = document.getElementById("checkoutLoading");
  if(ov){
    ov.classList.remove("show");
    ov.setAttribute("aria-hidden","true");
  }
}
function postReloadOkCheck(){
  try{
    const s = sessionStorage.getItem("mt_post_reload_ok");
    if(!s) return;
    sessionStorage.removeItem("mt_post_reload_ok");
    const o = JSON.parse(s || "{}");
    setTimeout(()=>showOkModal(o.title || "Registro exitoso", o.msg || "Venta registrada.", {enter:true}), 120);
  }catch(e){}
}

function showOkModal(title, msg, opts){
  const ov = document.getElementById("okModalOverlay");
  const t = document.getElementById("okModalTitle");
  const m = document.getElementById("okModalMsg");
  const b = document.getElementById("okModalBtn");
  if(!ov || !t || !m || !b){ alert(msg || title); return; }
  t.textContent = title || "Mensaje";
  m.textContent = msg || "";
  __okModalEnter = !!(opts && opts.enter);
  __okModalReload = !!(opts && opts.reload);
  ov.setAttribute("aria-hidden", "false");
  ov.classList.add("show");
  setTimeout(()=>{ try{ b.focus(); }catch(e){} }, 30);
}
function closeOkModal(){
  const ov = document.getElementById("okModalOverlay");
  const b = document.getElementById("okModalBtn");
  if(b && document.activeElement === b){ try{ b.blur(); }catch(e){} }
  if(ov){
    ov.classList.remove("show");
    ov.setAttribute("aria-hidden", "true");
  }
  if(__okModalReload){ try{ location.reload(); }catch(e){} }
}
// Enter para aceptar cuando el modal está abierto
document.addEventListener("keydown", (e)=>{
  const ov = document.getElementById("okModalOverlay");
  if(!ov || !ov.classList.contains("show")) return;
  if(e.key === "Enter"){
    e.preventDefault();
    closeOkModal();
  }
});
function showBlockedProducts(){
  showOkModal("Modificación de productos bloqueada","", {enter:true, reload:true});
}



function requireCode(action){
  // ya autorizado en esta pestaña
  if(sessionStorage.getItem(EDIT_OK_KEY) === "1") return true;

  // abrir modal personalizado (sin prompt del navegador)
  openEditCodeModal(action);
  return false; // el usuario reintenta el botón después de autorizar
}


function logoutAdmin(){
  try{ sessionStorage.removeItem(EDIT_OK_KEY); }catch(e){}
  try{ closeEditCodeModal(); }catch(e){}
}

function openEditCodeModal(action){
  const ov = document.getElementById("editCodeOverlay");
  const title = document.getElementById("editCodeTitle");
  const msg = document.getElementById("editCodeMsg");
  const inp = document.getElementById("editCodeInput");
  const err = document.getElementById("editCodeErr");

  if(!ov || !inp) return alert("No se pudo abrir el cuadro de código.");

  if(title) title.textContent = "Acceso requerido";
  if(msg) msg.textContent = `Ingrese el código para ${action}:`;
  if(err) err.textContent = "";
  inp.value = "";

  ov.classList.add("show");
  ov.setAttribute("aria-hidden", "false");

  setTimeout(()=>{
    try{ inp.focus(); }catch(e){}
  }, 30);
}

function closeEditCodeModal(){
  const ov = document.getElementById("editCodeOverlay");
  const inp = document.getElementById("editCodeInput");
  const err = document.getElementById("editCodeErr");

  if(inp){
    try{ inp.blur(); }catch(e){}
    inp.value = "";
  }

  if(err) err.textContent = "";

  if(ov){
    ov.classList.remove("show");
    ov.setAttribute("aria-hidden", "true");
  }
}

function confirmEditCode(){
  const inp = document.getElementById("editCodeInput");
  const err = document.getElementById("editCodeErr");
  const code = (inp && inp.value ? String(inp.value).trim() : "");

  if(code !== EDIT_CODE){
    showBlockedProducts();
    return;
  }

  sessionStorage.setItem(EDIT_OK_KEY, "1");
  if(err) err.textContent = "";
  closeEditCodeModal();
}

// Cerrar modal con ESC
document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape"){
    const ov = document.getElementById("editCodeOverlay");
    if(ov && ov.classList.contains("show")) closeEditCodeModal();
  }
});


// --- Seguridad (código para backup/restore) ---
function requireBackupCode(action){
  const code = prompt(`Ingrese el código para ${action}:`);
  if(code===null) return false;
  if(String(code).trim() !== "22782522"){
    alert("Código incorrecto.");
    return false;
  }
  return true;
}

// --- Captura PNG robusta (evita blanco/opaco) ---
async function capturePNG(node, filename, scaleOverride=null){
  if(!node) throw new Error("Nodo no encontrado.");
  if(!window.html2canvas) throw new Error("html2canvas no disponible.");

  document.body.classList.add("capture-mode");
  await new Promise(r=>requestAnimationFrame(r));

  const scale = scaleOverride ? Number(scaleOverride) : 2;

  // 1) Antes de capturar, saneamos e hidratamos logos para evitar canvas tainted
  await ensureLogoOrAsk(node);
  await ensureLogosSafe(node);
  await hydrateReceiptLogos(node);
  await new Promise(r=>setTimeout(r, 80));

  async function doCapture(){
    const canvas = await html2canvas(node, {
      backgroundColor:"#ffffff",
      scale: Math.max(1, Math.min(4, scale)),
      useCORS: true,
      allowTaint: false,      // importante: si queda tainted, preferimos fallar y reintentar con logo inline
      logging: false,
      removeContainer: true
    });

    return await new Promise((resolve,reject)=>{
      canvas.toBlob((blob)=>{
        if(!blob) return reject(new Error("PNG bloqueado o en blanco."));
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(()=>URL.revokeObjectURL(url), 3000);
        resolve(true);
      }, "image/png", 1.0);
    });
  }

  try{
    return await doCapture();
  }catch(e){
    const msg = (e && e.message) ? String(e.message) : String(e||"");
    // Error típico: "Tainted canvases may not be exported"
    if(/tainted|exported|toBlob/i.test(msg)){
      // Si no tenemos logo inline guardado, pedimos cargarlo una vez y reintentamos
      let data = localStorage.getItem(LOGO_DATAURL_KEY);
      if(!data){
        const picked = await promptLogoUpload();
        if(picked){
          await ensureLogosSafe(node);
          return await doCapture();
        }
      }else{
        await ensureLogosSafe(node);
        return await doCapture();
      }
    }
    throw e;
  }finally{
    document.body.classList.remove("capture-mode");
  }
}
// ====== LABEL 10x10 (ENVÍO) helpers ======
const ENV_LABEL_MM = 100;                 // 10cm
const ENV_LABEL_MARGIN_MM = 3;            // margen impresión (ajusta si tu impresora lo necesita)
const ENV_LABEL_PX = Math.round(ENV_LABEL_MM * 96 / 25.4); // 100mm -> ~378px (a 96dpi)

/** Construye un nodo 10x10 para ENVÍO (para PNG) */
/** Construye un nodo 10x10 para ENVÍO (para PNG) */
function buildEnvLabelNode(s){
  const wrap = document.createElement("div");
  wrap.id = "envLabelTmp";
  wrap.style.width = ENV_LABEL_PX + "px";
  wrap.style.height = ENV_LABEL_PX + "px";
  wrap.style.background = "#fff";
  wrap.style.position = "fixed";
  wrap.style.left = "-99999px";
  wrap.style.top = "0";
  wrap.style.padding = "10px";
  wrap.style.boxSizing = "border-box";
  wrap.style.border = "2px solid #000";
  wrap.style.overflow = "hidden";
  wrap.style.fontFamily = "Arial, sans-serif";
  wrap.style.color = "#000";
  wrap.style.fontWeight = "900";

  // Layout: header + contenido + footer (footer pegado abajo)
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.gap = "6px";

  // ====== DATOS ======
  const shop = (s.shop || state?.settings?.shopName || "Tienda").toString();
  const d = new Date(s.ts || Date.now()).toLocaleString();
  const envioNo = (s.receiptNo || "----").toString();
  const status = (s.status || "PENDIENTE").toString().toUpperCase();

  const client = s.client ? `${s.client.names || ""} ${s.client.last || ""}`.trim() : "MOSTRADOR";
  const phone  = s.client?.phone || "—";
  const nit    = s.client?.nit   || "—";
  const addr   = s.client?.addr  || "—";

  // Comentario / indicaciones (varios nombres posibles)
  const indic = (s.client?.indic ?? s.client?.comment ?? s.comment ?? s.shipComment ?? "—");

  // Total / Pago
  const total = (s.total ?? s.grandTotal ?? 0);
  const pay   = (s.payMethod || s.paymentMethod || "EFECTIVO").toString().toUpperCase();
  const isCash = (pay === "EFECTIVO" || pay === "CASH");

  // Logo: preferir DataURL guardado para evitar fallos al exportar
  const logoSrc = getBestLogoSrc();

  // ====== CABECERA (Logo + Tienda + # Envío) ======
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "8px";

  const left = document.createElement("div");
  left.style.lineHeight = "1.05";
  left.innerHTML = `
    <div style="font-weight:1000;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(shop)}</div>
    <div style="font-weight:1000;font-size:14px;">ENVÍO #${escapeHtml(envioNo)}</div>
    <div style="font-weight:900;font-size:10px;color:#555;">${escapeHtml(d)}</div>
  `;

  const logo = document.createElement("img");
  logo.src = logoSrc;
  logo.alt = "LOGO";
  logo.style.height = "80px";
  logo.style.width = "80px";
  logo.style.objectFit = "contain";
  logo.style.borderRadius = "10px";
  logo.style.border = "1px solid rgba(0,0,0,.08)";
  logo.style.padding = "3px";
  logo.style.background = "#fff";
  logo.onerror = ()=>{ logo.style.display="none"; };

  header.appendChild(left);
  header.appendChild(logo);
  wrap.appendChild(header);

  // ====== CLIENTE / TEL (tel más grande) ======
  const info = document.createElement("div");
  info.style.lineHeight = "1.12";
  info.innerHTML = `
    <div style="font-weight:1100;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(client)}</div>

    <div style="margin-top:4px;display:inline-block;border:2px solid #000;border-radius:14px;padding:6px 10px;font-weight:1200;font-size:24px;letter-spacing:.3px;">
      ${escapeHtml(phone)}
    </div>

    <div style="margin-top:4px;font-weight:1100;font-size:13px;">NIT: ${escapeHtml(nit)}</div>

    <div style="margin-top:4px;font-weight:1100;font-size:12px;color:#000;">
      ESTATUS: <span style="font-weight:1300;font-size:14px;">${escapeHtml(status)}</span>
    </div>
  `;
  wrap.appendChild(info);

  // ====== CONTENIDO (Dirección + Indicaciones) ======
  const content = document.createElement("div");
  content.style.flex = "1 1 auto";
  content.style.minHeight = "0";
  content.style.border = "2px solid #000";
  content.style.borderRadius = "8px";
  content.style.padding = "6px";
  content.style.boxSizing = "border-box";
  content.style.overflow = "hidden";
  content.style.lineHeight = "1.15";

  const addrEl = document.createElement("div");
  addrEl.style.fontWeight = "1000";
  addrEl.style.whiteSpace = "pre-wrap";
  addrEl.style.wordBreak = "break-word";
  addrEl.style.overflowWrap = "anywhere";
  addrEl.textContent = "Dirección: " + (addr || "—");

  const commEl = document.createElement("div");
  commEl.style.marginTop = "5px";
  commEl.style.fontWeight = "900";
  commEl.style.whiteSpace = "pre-wrap";
  commEl.style.wordBreak = "break-word";
  commEl.style.overflowWrap = "anywhere";
  commEl.textContent = "Indicaciones: " + (indic || "—");

    // Layout interno: 2 bloques con altura fija y auto-ajuste
  content.style.display = "flex";
  content.style.flexDirection = "column";
  content.style.gap = "6px";

  const addrBox = document.createElement("div");
  addrBox.style.flex = "0 0 48%";
  addrBox.style.minHeight = "0";
  addrBox.style.overflow = "hidden";
  addrBox.style.borderBottom = "2px solid #000";
  addrBox.style.paddingBottom = "4px";

  const commBox = document.createElement("div");
  commBox.style.flex = "1 1 auto";
  commBox.style.minHeight = "0";
  commBox.style.overflow = "hidden";

  addrEl.style.fontSize = "18px";
  commEl.style.fontSize = "16px";

  addrBox.appendChild(addrEl);
  commBox.appendChild(commEl);
  content.appendChild(addrBox);
  content.appendChild(commBox);
  wrap.appendChild(content);

  // Auto-ajuste: grande si cabe, pequeño si no cabe (por campo)
  requestAnimationFrame(()=>{
    autoFitTextToBox(addrBox, addrEl, 20, 9);
    autoFitTextToBox(commBox, commEl, 18, 8);
  });

  // ====== FOOTER (pegado abajo) ======
  const payBox = document.createElement("div");
  payBox.style.marginTop = "auto";
  payBox.style.borderTop = "2px solid #000";
  payBox.style.paddingTop = "6px";
  payBox.style.lineHeight = "1.05";

  payBox.innerHTML = isCash
    ? `
      <div style="display:flex;justify-content:space-between;font-weight:1300;font-size:22px;">
        <span>TOTAL</span><span>${money(total)}</span>
      </div>
      <div style="margin-top:4px;font-weight:1200;font-size:18px;">
        <span style="opacity:.95">PAGO:</span> <span style="font-weight:1400">${escapeHtml(pay)}</span>
      </div>
    `
    : `
      <div style="display:flex;justify-content:space-between;font-weight:1300;font-size:20px;">
        <span>PAGO</span><span style="font-weight:1400">${escapeHtml(pay)}</span>
      </div>
    `;

  wrap.appendChild(payBox);

  return wrap;
}


function autoFitTextToBox(boxEl, textEl, maxPx, minPx){
  if(!boxEl || !textEl) return;
  const max = Number(maxPx||18);
  const min = Number(minPx||8);
  for(let fs=max; fs>=min; fs-=0.5){
    textEl.style.fontSize = fs + "px";
    // fuerza layout
    if(textEl.scrollHeight <= boxEl.clientHeight && textEl.scrollWidth <= boxEl.clientWidth){
      break;
    }
  }
}

function fitEnvLabelToBox(node){
  // bajamos font-size global del contenedor hasta que no desborde
  let fs = 12; // arranque
  node.style.fontSize = fs + "px";

  // intentamos hasta 6px
  for(let i=0;i<20;i++){
    // si desborda, bajamos
    if(node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth){
      fs -= 0.5;
      node.style.fontSize = fs + "px";
      if(fs <= 6) break;
    }else{
      break;
    }
  }
}


// PNG (preferir html2canvas; fallback SVG)
// PNG (preferir html2canvas; fallback SVG)
async function downloadReceiptPNG(){
  // Evitar doble descarga (el navegador bloquea descargas múltiples)
  const now = Date.now();
  if(state && state._dlInProgress) return;
  if(state && state._dlLock && (now - state._dlLock) < 8000) return;
  if(state){ state._dlLock = now; state._dlInProgress = true; }

  try{
  const s = state.lastReceipt || makeLiveReceipt();
  const isEnv = (s.saleType === "ENVIO");

  // ====== ENVÍO: PNG 10x10 usando label temporal ======
  if(isEnv){
    if(!window.html2canvas){
      alert("html2canvas no está disponible. Usa PDF.");
      return;
    }

    const node = buildEnvLabelNode(s);
    document.body.appendChild(node);
    try{ await ensureLogoOrAsk(node); }catch(e){}
    fitEnvLabelToBox(node);

    try{
      const scale = Number(state.settings.envPngScale || 2);
      await capturePNG(node, `envio_${(s.receiptNo||"----")}_10x10.png`, scale);
    }catch(e){
      alert("No se pudo generar PNG de ENVÍO. Intenta con PDF. " + (e?.message||""));
    }finally{
      node.remove();
    }
    return;
  }

  // ====== MOSTRADOR: PNG desde #receiptBox ======
  const node = $("receiptBox");
  if(!node) return;
  try{ syncReceiptLogos(node); }catch(e){}
  try{ await ensureLogoOrAsk(node); }catch(e){}
  try{ await hydrateReceiptLogos(node); }catch(e){}
  await new Promise(r=>setTimeout(r, 80));

  // 1) html2canvas robusto
  if(window.html2canvas){
    try{
      await capturePNG(node, `recibo_${(s.receiptNo||"----")}.png`, 2);
      return;
    }catch(e){
      // seguimos al fallback
    }
  }

  // 2) fallback SVG foreignObject
  const w = node.offsetWidth;
  const h = node.offsetHeight;

  const clone = node.cloneNode(true);
  clone.style.boxShadow="none";

  const wrapper = document.createElement("div");
  wrapper.style.width = w+"px";
  wrapper.style.height = h+"px";
  wrapper.style.background = "#fff";
  wrapper.appendChild(clone);

  const html = new XMLSerializer().serializeToString(wrapper);
  const data = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${html}
        </div>
      </foreignObject>
    </svg>
  `;
  const svgBlob = new Blob([data], {type:"image/svg+xml;charset=utf-8"});
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = ()=>{
    const cnv = $("cnv");
    const sc = 2;
    cnv.width = w*sc;
    cnv.height = h*sc;

    const ctx = cnv.getContext("2d");
    ctx.setTransform(sc,0,0,sc,0,0);
    ctx.fillStyle="#fff";
    ctx.fillRect(0,0,w,h);
    ctx.drawImage(img, 0,0);
    URL.revokeObjectURL(url);

    cnv.toBlob((blob)=>{
      if(!blob) return alert("Tu navegador bloqueó el PNG. Usa PDF o Copiar texto.");
      const a = document.createElement("a");
      const u = URL.createObjectURL(blob);
      a.href = u;
      a.download = `recibo_${(s.receiptNo||"----")}.png`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(u), 1000);
    }, "image/png");
  };
  img.onerror = ()=>{
    URL.revokeObjectURL(url);
    alert("Tu navegador bloqueó el PNG. Usa PDF o Copiar texto.");
  };
  img.src = url;
  }finally{
    if(state) state._dlInProgress = false;
  }
}

function receiptToPrintableHTML(s){
  const d = new Date(s.ts || Date.now()).toLocaleString();
  const clientName = s.client ? `${s.client.names} ${s.client.last}` : "MOSTRADOR";
  const phone = s.client?.phone || "—";
  const nit   = (s.client?.nit || "—");
  const addr  = s.client?.addr  || "—";

  const rows = (s.items||[]).map(it=>{
    const line = (it.qty||0) * (it.price||0);
    return `
      <tr>
        <td style="text-align:center">${it.qty}</td>
        <td>${escapeHtml(it.name)}</td>
        <td style="text-align:right">${money(it.price)}</td>
        <td style="text-align:right">${money(line)}</td>
      </tr>
    `;
  }).join("");

  const sub = Number(s.subtotal ?? 0);
  const disc = Number(s.discountAmount ?? 0);
  const total = Number(s.total ?? 0);
  const pay = (s.payMethod || s.paymentMethod || "EFECTIVO").toString().toUpperCase();

  const logoSrc = getBestLogoSrc();

  const isEnv = (s.saleType === "ENVIO");

  const pageW = ENV_LABEL_MM;        // 100mm
  const pageH = ENV_LABEL_MM;        // 100mm
  const pageM = ENV_LABEL_MARGIN_MM; // 3mm

  const pageCss = isEnv
    ? `@page{ size: ${pageW}mm ${pageH}mm; margin: ${pageM}mm; }`
    : `@page{ margin: 12mm; }`;

  const boxWidth = isEnv
    ? `max-width: ${Math.max(50, Math.min(120, pageW))}mm;`
    : `max-width: 820px;`;

  // Para ENVÍO, forzamos una altura real (área imprimible) para que el "fit" funcione y no se corte.
  const boxExtra = isEnv
    ? `height: ${Math.max(10, (pageH - (pageM*2)))}mm; display:flex; flex-direction:column;`
    : ``;

  const statusLine = s.status
    ? `<div class="meta" style="margin-top:6px;color:#111;font-weight:1000;font-size:14px">Estatus: ${escapeHtml(s.status)}</div>`
    : ``;

  return `
  <!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Recibo ${escapeHtml(s.receiptNo || "")}</title>

    <style>
      ${pageCss}
      body{ font-family: Arial, sans-serif; margin: 0; color:#111; background:#fff7fb; }
      .box{ position:relative; ${boxWidth} ${boxExtra} margin: 0 auto; border:2px solid #fbcfe8; border-radius:16px; padding:16px; background:#fff; box-sizing:border-box; overflow:hidden; }
      .cornerLogo{ position:absolute; top:12px; right:12px; width:60px; height:60px; object-fit:contain; border-radius:14px; border:1px solid #eee; padding:4px; background:#fff; }
      .bar{ height:8px; border-radius:999px; background: linear-gradient(90deg, #ff4fb7, #a855f7); margin-bottom:12px; }
      h1{ margin:0; font-size:18px; color:#7b2fb4; padding-right:70px; }
      .meta{ margin-top:4px; color:#444; font-size:12px; font-weight:700; }
      .grid{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:14px; }
      .card{ border:1px solid #eee; border-radius:12px; padding:12px; }
      .label{ color:#666; font-size:12px; font-weight:700; }
      .val{ font-size:13px; font-weight:900; margin-top:3px; white-space:pre-wrap; word-break:break-word; }
      .fitField{ height:64px; overflow:hidden; }
      table{ width:100%; border-collapse:collapse; margin-top:14px; }
      th,td{ border-bottom:1px solid #eee; padding:8px; font-size:13px; }
      th{ background:#ffe4f1; text-align:left; }
      .totalRow{ display:flex; justify-content:space-between; margin-top:10px; font-weight:1200; font-size:16px; }
      .box .footer .totalRow{ font-size:20px; }
      .foot{ margin-top:12px; color:#444; font-size:12px; font-weight:700; }
      .content{ flex:1 1 auto; min-height:0; }
      .footer{ margin-top:auto; }
      .phoneBig{ display:inline-block; font-size:24px; font-weight:1000; border:2px solid #111; border-radius:14px; padding:6px 10px; letter-spacing:.3px; }

      @media print{
        body{ background:#fff; }
        .box{ border:none; border-radius:0; }
      }
    
/* ===== LOADING SPINNER (COBRAR) ===== */
#checkoutLoading.ok-modal{ z-index:9999; }
.loading-card{
  width:min(420px,100%);
  background:linear-gradient(180deg, rgba(28,28,30,.98), rgba(18,18,20,.98));
  border:1px solid rgba(255,255,255,.08);
  border-radius:18px;
  box-shadow:0 24px 70px rgba(0,0,0,.6);
  overflow:hidden;
  color:#fff;
}
.loading-body{ padding:18px; display:flex; align-items:center; gap:14px; }
.loading-spinner{
  width:56px; height:56px;
  border-radius:999px;
  border:6px solid rgba(255,255,255,.20);
  border-top-color: var(--pink);
  animation: spin 1s linear infinite;
  flex:0 0 auto;
}
@keyframes spin{ to{ transform: rotate(360deg); } }
.loading-text b{ display:block; font-weight:1000; letter-spacing:.2px; }
.loading-text small{ display:block; margin-top:4px; opacity:.85; font-weight:800; }

</style>

    <script>
      // Ajusta el contenido SOLO para ENVÍO (10x10) bajando font-size si se desborda
      (function(){
        var IS_ENV = ${isEnv ? "true" : "false"};

        function fit(){
          if(!IS_ENV) return;

          var box = document.querySelector('.box');
          if(!box) return;

          // Si no hay una altura real, no intentes medir
          if(box.clientHeight === 0 || box.clientWidth === 0) return;

          var fs = 12;
          box.style.fontSize = fs + 'px';

          for(var i=0;i<40;i++){
            var overflowH = box.scrollHeight > box.clientHeight;
            var overflowW = box.scrollWidth  > box.clientWidth;

            if(overflowH || overflowW){
              fs -= 0.5;
              box.style.fontSize = fs + 'px';
              if(fs <= 6) break;
            }else{
              break;
            }
          }

          // Auto-fit por campo (Dirección / Indicaciones)
          var fitField = function(sel, max, min){
            var el = document.querySelector(sel);
            if(!el) return;
            var fs2 = max;
            for(var k=0;k<60;k++){
              el.style.fontSize = fs2 + "px";
              if(el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth) break;
              fs2 -= 0.5;
              if(fs2 <= min){ el.style.fontSize = min + "px"; break; }
            }
          };
          if(IS_ENV){
            fitField(".fitAddr", 18, 8);
            fitField(".fitIndic", 16, 7.5);
          }
        }

window.addEventListener('load', function(){
  // 2 pasadas para asegurar layout + imágenes
  if(typeof fit === "function"){
    fit();
    setTimeout(fit, 150);
    setTimeout(fit, 350);
  }

  // Botón para elegir carpeta de backups
  const btnPick = document.getElementById("btnPickBackupFolder");
  if(btnPick){
    btnPick.addEventListener("click", async function(){
      try{
        await pickBackupFolder();
      }catch(err){
        console.error(err);
        alert("No se pudo abrir el selector de carpeta. Usa Chrome/Edge y abre en https/localhost.\n\nDetalle: " + (err?.message || err));
      }
    });
  }else{
    // Solo para debug
    console.warn("No existe #btnPickBackupFolder al cargar (puede estar en otra vista).");
  }
});


      })();
    <\/script>
  </head>

  <body onload="setTimeout(function(){window.print();},250)">
    <div class="box">
      <img class="cornerLogo" src="${logoSrc}" onerror="this.style.display='none'" alt="Logo" />
      <div class="bar"></div>
      <h1>${escapeHtml(s.shop || "Tienda de Ropa")} — Recibo #${escapeHtml(s.receiptNo || "")}</h1>
      <div class="meta">${escapeHtml(d)} • Tipo: ${escapeHtml(s.saleType || "MOSTRADOR")}${isEnv ? "" : " • Pago: " + escapeHtml(s.payMethod || "EFECTIVO")}</div>
      ${statusLine}

      <div class="content">
      <div class="grid">
        <div class="card">
          <div class="label">Cliente</div>
          <div class="val">${escapeHtml(clientName)}</div>
          <div class="label" style="margin-top:10px">Teléfono</div>
          <div class="val ${isEnv ? "phoneBig" : ""}">${escapeHtml(phone)}</div>
          <div class="label" style="margin-top:10px">NIT</div>
          <div class="val">${escapeHtml(nit)}</div>
        </div>
        <div class="card">
          <div class="label">Dirección</div>
          <div class="val fitField fitAddr">${escapeHtml(addr)}</div>
        </div>
        ${isEnv ? `
        <div class="card">
          <div class="label">Indicaciones</div>
          <div class="val fitField fitIndic">${escapeHtml(indic)}</div>
        </div>
        ` : ``}
      </div>

      ${isEnv ? `` : `
      <table>
        <thead>
          <tr>
            <th style="width:70px;text-align:center">Cant</th>
            <th>Producto</th>
            <th style="width:120px;text-align:right">Precio</th>
            <th style="width:120px;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="4">Sin items</td></tr>`}
        </tbody>
      </table>
      `}
      </div>
      <div class="footer">

      ${isEnv
        ? ( (pay === "EFECTIVO" || pay === "CASH")
            ? `<div class="totalRow"><div>TOTAL</div><div>${money(total)}</div></div>`
            : `<div class="totalRow"><div>PAGO</div><div>${escapeHtml(pay)}</div></div>` )
        : `
      <div class="totalRow"><div>SUBTOTAL</div><div>${money(sub)}</div></div>
      <div class="totalRow"><div>DESCUENTO</div><div>${money(disc)}</div></div>
      <div class="totalRow"><div>TOTAL</div><div>${money(total)}</div></div>
      `}

      <div class="foot">Gracias por tu compra 💗</div>
      </div>
    </div>
  </body>
  </html>
  `;
}


function generatePDF(){
  const now = Date.now();
  if(state && state._pdfLock && (now - state._pdfLock) < 1500) return;
  if(state) state._pdfLock = now;
  const s = state.lastReceipt || makeLiveReceipt();

  if(s.saleType === "ENVIO"){
    const ok = s.client && s.client.phone && s.client.names && s.client.last && s.client.addr;
    if(!ok) return alert("Para ENVÍO debes tener cliente completo antes de generar el PDF.");
  }

  const html = receiptToPrintableHTML(s);
  const w = window.open("", "_blank");
  if(!w) return alert("Tu navegador bloqueó la ventana emergente. Permite popups para generar PDF.");
  w.document.open();
  w.document.write(html);
  w.document.close();
}
