// ---------- IndexedDB ----------
function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;

      if(!db.objectStoreNames.contains("clients")){
        const s = db.createObjectStore("clients", { keyPath:"phone" });
        s.createIndex("name", "nameKey", { unique:false });
      }
      if(!db.objectStoreNames.contains("products")){
        const s = db.createObjectStore("products", { keyPath:"code" });
        s.createIndex("name", "nameKey", { unique:false });
      }
      if(!db.objectStoreNames.contains("sales")){
        const s = db.createObjectStore("sales", { keyPath:"id" });
        s.createIndex("ts", "ts", { unique:false });
      }
      // NUEVO: shipments (envíos pendientes)
      if(!db.objectStoreNames.contains("shipments")){
        const s = db.createObjectStore("shipments", { keyPath:"id" });
        s.createIndex("ts", "ts", { unique:false });
        s.createIndex("status", "status", { unique:false });
      }
      // NUEVO: closes (cierres guardados)
      if(!db.objectStoreNames.contains("closes")){
        const s = db.createObjectStore("closes", { keyPath:"id" });
        s.createIndex("ts", "ts", { unique:false });
        s.createIndex("dateKey", "dateKey", { unique:false });
      }

      
      // NUEVO: movements (kardex perpetuo)
      if(!db.objectStoreNames.contains("movements")){
        const s = db.createObjectStore("movements", { keyPath:"id" });
        s.createIndex("ts", "ts", { unique:false });
        s.createIndex("code", "code", { unique:false });
      }

      // NUEVO: voids (anulaciones de ventas)
      if(!db.objectStoreNames.contains("voids")){
        const s = db.createObjectStore("voids", { keyPath:"id" });
        s.createIndex("ts", "ts", { unique:false });
        s.createIndex("saleId", "saleId", { unique:false });
      }

if(!db.objectStoreNames.contains("meta")){
        db.createObjectStore("meta", { keyPath:"key" });
      }
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

function tx(store, mode="readonly"){
  if(!db){
    throw new Error("DB no está lista todavía (db undefined). Recarga la página y espera 1-2 segundos.");
  }
  return db.transaction(store, mode).objectStore(store);
}
function idbGet(store, key){
  return new Promise((res,rej)=>{
    const r = tx(store).get(key);
    r.onsuccess=()=>res(r.result||null);
    r.onerror=()=>rej(r.error);
  });
}
function idbPut(store, val){
  return new Promise((res,rej)=>{
    const r = tx(store,"readwrite").put(val);
    r.onsuccess=()=>res(true);
    r.onerror=()=>rej(r.error);
  });
}
function idbDel(store, key){
  return new Promise((res,rej)=>{
    const r = tx(store,"readwrite").delete(key);
    r.onsuccess=()=>res(true);
    r.onerror=()=>rej(r.error);
  });
}
function idbAll(store){
  return new Promise((res,rej)=>{
    const r = tx(store).getAll();
    r.onsuccess=()=>res(r.result||[]);
    r.onerror=()=>rej(r.error);
  });
}
function idbClearAll(){
  return Promise.all([
    new Promise((res,rej)=>{ const r=db.transaction("clients","readwrite").objectStore("clients").clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); }),
    new Promise((res,rej)=>{ const r=db.transaction("products","readwrite").objectStore("products").clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); }),
    new Promise((res,rej)=>{ const r=db.transaction("sales","readwrite").objectStore("sales").clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); }),
    new Promise((res,rej)=>{ const r=db.transaction("shipments","readwrite").objectStore("shipments").clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); }),
    new Promise((res,rej)=>{ const r=db.transaction("closes","readwrite").objectStore("closes").clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); }),
    new Promise((res,rej)=>{ const r=db.transaction("voids","readwrite").objectStore("voids").clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); }),
    new Promise((res,rej)=>{ const r=db.transaction("meta","readwrite").objectStore("meta").clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); }),
    new Promise((res,rej)=>{ const r=db.transaction("movements","readwrite").objectStore("movements").clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); }),
  ]);
}


// ---------- Movements (Kardex) ----------
function mkMoveId(){
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
async function logMovement(mv){
  // mv: {type, code, name, qty, stockAfter, refType, refId, note}
  const row = {
    id: mkMoveId(),
    ts: Date.now(),
    type: mv.type || "MOV",
    code: mv.code || "",
    name: mv.name || "",
    qty: Number(mv.qty||0),
    stockAfter: (mv.stockAfter===undefined? null : Number(mv.stockAfter)),
    refType: mv.refType || "",
    refId: mv.refId || "",
    note: mv.note || ""
  };
  await idbPut("movements", row);
}
async function getShiftStartTs(){
  const m = await idbGet("meta","shiftStartTs");
  return m?.value ? Number(m.value) : null;
}

async function setShiftStartTs(ts){
  await idbPut("meta", { key:"shiftStartTs", value: Number(ts||Date.now()) });
}

// ===== ÚLTIMO CIERRE (para cierres múltiples por día) =====
async function getLastCloseTs(dateKey){
  const m = await idbGet("meta", "lastCloseTs_" + (dateKey||todayKey()));
  return m?.value ? Number(m.value) : null;
}
async function setLastCloseTs(dateKey, ts){
  await idbPut("meta", { key: "lastCloseTs_" + (dateKey||todayKey()), value: Number(ts||Date.now()) });
}

async function clearPaidShipments(){
  const all = await idbAll("shipments");
  const paid = all.filter(s => (s.status||"PENDIENTE")==="PAGADO" && (s.saleId || s.paidAt));
  for(const s of paid){
    await idbDel("shipments", s.id);
  }
  return true;
}
async function clearAllShipments(){
  // borra SOLO shipments
  return new Promise((res, rej)=>{
    const r = db.transaction("shipments","readwrite").objectStore("shipments").clear();
    r.onsuccess = ()=>res(true);
    r.onerror = ()=>rej(r.error);
  });
}
function toLocalTs(dateStr, timeStr){
  const d = String(dateStr||"").trim();
  const t = String(timeStr||"00:00").trim();
  if(!d) return null;
  // "YYYY-MM-DDTHH:MM" en local
  const dt = new Date(`${d}T${t}:00`);
  const ts = dt.getTime();
  return Number.isFinite(ts) ? ts : null;
}

async function renderReportRange(){
  state.reportMode = "range";
  const all = await idbAll("sales");

  const fd = $("repFromDate")?.value || todayKey();
  const ft = $("repFromTime")?.value || "00:00";
  const td = $("repToDate")?.value || fd;
  const tt = $("repToTime")?.value || "23:59";

  const a = toLocalTs(fd, ft);
  const b = toLocalTs(td, tt);
  if(a===null || b===null) return alert("Rango inválido. Revisa fechas/horas.");

  const start = Math.min(a,b);
  const end   = Math.max(a,b);

  let list = all.filter(s => {
    const ts = Number(s.ts||0);
    return ts >= start && ts <= end;
  });
  const cashierFilter = $("repCashierFilter")?.value || "";
  if(cashierFilter){
    list = list.filter(s => normKey(s.cashierName || "") === normKey(cashierFilter));
  }

  if(typeof updateReportTotals === "function") updateReportTotals(list);
  else{
    const total = list.reduce((sum,s)=> sum + Number(s.total||0), 0);
    $("repCount").textContent = list.length;
    $("repTotal").textContent = money(total);
  }

  const tb = $("salesBody");
  tb.innerHTML = "";
  for(const s of list.sort((x,y)=>Number(y.ts||0)-Number(x.ts||0))){
    const when = new Date(s.ts).toLocaleString();
    const c = s.client ? `${s.client.names} ${s.client.last}` : "MOSTRADOR";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><small>${escapeHtml(when)}</small><br><small>#${escapeHtml(s.receiptNo||"")}</small></td>
      <td>${escapeHtml(c)}<br><small>${escapeHtml(s.saleType||"")}</small></td>
      <td>${escapeHtml(s.cashierName || "SIN REGISTRO")}</td>
      <td>${escapeHtml(typeof saleDetailPayment === "function" ? saleDetailPayment(s) : (s.payMethod||""))}</td>
      <td>${money(s.total)}</td>
      <td>
        <button class="btn small" data-viewsale="${escapeHtml(s.id)}">Ver</button>
        <button class="btn danger small" data-delsale="${escapeHtml(s.id)}">Borrar</button>
      </td>
    `;
    tb.appendChild(tr);
  }
}
