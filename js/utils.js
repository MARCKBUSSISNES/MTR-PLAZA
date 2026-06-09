// ---------- Helpers ----------
function todayKey(ts=Date.now()){
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function weekKey(ts=Date.now()){
  const d = new Date(ts);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1)/7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}
function monthKey(ts=Date.now()){
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${y}-${m}`;
}
function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function normKey(s){
  return String(s||"").trim().toLowerCase().replace(/\s+/g," ");
}
function pad(n,len=6){ return String(n).padStart(len,"0"); }
function timeToMinutes(hhmm){
  const [h,m] = String(hhmm||"00:00").split(":").map(x=>Number(x||0));
  return (h*60)+(m||0);
}
function isWithinDateRange(ts, dateKey, fromHHMM, toHHMM){
  const d = new Date(ts);
  const dk = todayKey(ts);
  if(dk !== dateKey) return false;
  const mins = d.getHours()*60 + d.getMinutes();
  const a = timeToMinutes(fromHHMM);
  const b = timeToMinutes(toHHMM);
  // rango normal (no cruzando medianoche)
  return mins >= a && mins <= b;
}
async function clearStore(store){
  return new Promise((res, rej)=>{
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    const r = os.clear();

    r.onsuccess = () => res(true);
    r.onerror   = () => rej(r.error);
  });
}

function authorizeSaleVoid(){
  const cashier = prompt("Ingrese nombre del cajero:");
  if(cashier===null) return null;
  const cashierName = String(cashier||"").trim();
  if(!cashierName){
    alert("Debe ingresar el nombre del cajero.");
    return null;
  }

  const pass = prompt("Ingrese clave para anular venta:");
  if(pass===null) return null;
  const code = String(pass||"").trim();

  if(code === "363534") return { cashierName, role:"ADMIN" };
  if(code === "123456") return { cashierName, role:"CAJERO" };

  alert("Clave incorrecta.");
  return null;
}

function formatVoidItemsText(items){
  return (items||[]).map(it=> `${Number(it.qty||0)} x ${it.name || it.code || "PRODUCTO"}`).join(", ");
}

function isTsBetween(ts, startTs, endTs){
  const n = Number(ts||0);
  const a = Number(startTs||0);
  const b = Number(endTs||0);
  return n >= a && n <= b;
}

// ---------- UI Nav ----------
const views = {
  pos: {title:"Registro de Ventas)", sub:""},
  shipments: {title:"Envíos pendientes", sub:"Gestión de envíos: PENDIENTE/PAGADO."},
  kardex: {title:"Kardex", sub:"Movimientos perpetuos de inventario (entradas y salidas)."},
  clients: {title:"Clientes", sub:"Busca por teléfono, edita y usa para envíos."},
  reports: {title:"Reportes", sub:"Diario / Semanal / Mensual con historial de ventas (solo pagadas)."},
  products: {title:"Productos", sub:"Agrega productos con código, nombre, precio y stock."},
  inventory: {title:"Inventarios", sub:"Tabla de productos + stock actual."},
  close: {title:"Cierres", sub:"Cierres múltiples + cuadre por forma de pago."},
  settings: {title:"Ajustes", sub:"Nombre de tienda, tamaños ENVÍO y respaldos (exportar/importar)."}
};


async function renderReports(){
  // Wrapper requerido por setView("reports"). Mantiene compatibilidad sin alterar lógica existente.
  try{
    await renderReport("daily");
  }catch(err){
    console.error("renderReports failed:", err);
  }
}


function setView(v){
  // Robust: evita crasheos si llega un data-view inexistente
  if(!v || !views[v]){
    console.warn("Vista desconocida:", v);
    return;
  }

  state.view = v;


  // 🔥 Nav: resaltar el botón activo
  try{
    document.querySelectorAll("#nav button[data-view]").forEach(b=>{
      b.classList.toggle("active", b.dataset.view===v);
    });
  }catch(e){}

  const tEl = $("viewTitle");
  const sEl = $("viewSub");
  if(tEl) tEl.textContent = views[v].title || "";
  if(sEl) sEl.textContent = views[v].sub || "";

  // Mostrar/ocultar vistas solo si existen en el DOM
  for(const k in views){
    const el = $("view-"+k);
    if(el) el.classList.toggle("hide", k !== v);
  }

  // Acciones al entrar en ciertas vistas
  if(v==="kardex"){ renderKardex(); }
  if(v==="shipments"){ renderShipments(); }
  if(v==="products"){ renderProducts(); }
  if(v==="clients"){ renderClients(); }
  if(v==="inventory"){ renderInventory(); }

  // ✅ AQUÍ el cambio
  if(v==="reports"){
    if(typeof renderCashierReportFilter === "function") renderCashierReportFilter();
    const t = todayKey();

    if($("repFromDate")) $("repFromDate").value = t;
    if($("repToDate"))   $("repToDate").value   = t;

    if($("repFromTime")) $("repFromTime").value = "00:00";
    if($("repToTime"))   $("repToTime").value   = "23:59";

    renderReports();
  }

  if(v==="close"){ renderClosePanel(); }

  // POS Totales
  if(v==="pos"){
    const subtotal = calcSubtotal();
    const disc = calcDiscount();
    const total = calcGrand();

    const st = $("subTotal");
    const dt = $("discTotal");
    const gt = $("grandTotal");
    if(st) st.textContent = money(subtotal);
    if(dt) dt.textContent = money(disc);
    if(gt) gt.textContent = money(total);

    updateReceiptPreview();
  }
}

function cartAdd(product, qty=1){
  qty = Number(qty||1);
  if(qty<1) qty=1;

  state.cart.push({
    id: makeLineId(),
    code: product.code,
    name: product.name,
    price: Number(product.price||0),
    qty: qty,
    discValue: 0
  });

  renderCart();
}

function cartInc(lineId, delta){
  const it = state.cart.find(x=>String(x.id)===String(lineId));
  if(!it) return;
  it.qty += delta;
  if(it.qty<=0) state.cart = state.cart.filter(x=>String(x.id)!==String(lineId));
  renderCart();
}

function cartClear(){
  state.cart = [];
  renderCart();
}
