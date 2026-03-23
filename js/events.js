// ---------- Events ----------
function wireEvents(){
  if(!window.state) window.state = {};
  if(state._wired) return; // evita doble enlace de eventos
  state._wired = true;
  // Helpers (safe binding)
  const on = (id, ev, fn)=>{ const el = $(id); if(el) el.addEventListener(ev, fn); };
  const onClick = (id, fn)=>on(id, 'click', fn);
// Descuento (corrige IDs aquí (robusto)
  // En este sistema el input se llama: id="discValue"
  // Si mañana cambias el id, solo agrega el nuevo aquí.
  const discInput = $("discValue") || $("discountValue") || $("descuento") || $("discount");
  if(!discInput){
    // No es crítico: solo no habrá descuento manual desde UI
    // (evitamos warnings ruidosos en consola)
  } else {
    const safeRecalc = ()=>{
      try{
        if(typeof recalcCartTotals === "function") recalcCartTotals();
        if(typeof calcTotals === "function") calcTotals();
      }catch(_){}
    };
    discInput.addEventListener("input", ()=>{
      const v = Number(discInput.value || 0);
      // soporta ambos formatos: state.discount.value o state.discount
      if(!window.state) window.state = {};
      if(typeof state.discount === "object" && state.discount){
        state.discount.value = v;
      } else {
        state.discount = { value: v };
      }
      safeRecalc();
      if(typeof updateReceiptPreview === "function") updateReceiptPreview();
    });
  }
  // ====== HAMBURGER / SIDEBAR TOGGLE ======
  const isMobile = ()=> window.matchMedia("(max-width: 980px)").matches;

  function applySavedMenuState(){
    const saved = localStorage.getItem("mt_sidebar_collapsed");
    if(saved === "1") document.body.classList.add("sidebar-collapsed");
    else document.body.classList.remove("sidebar-collapsed");
  }
  applySavedMenuState();

  function closeMobileSidebar(){
    document.body.classList.remove("sidebar-open");
  }

  onClick("btnToggle", ()=>{
    // Mobile: abre/cierra drawer
    if(isMobile()){
      document.body.classList.toggle("sidebar-open");
      return;
    }
    // Desktop: colapsa/expande sidebar
    document.body.classList.toggle("sidebar-collapsed");
    localStorage.setItem("mt_sidebar_collapsed", document.body.classList.contains("sidebar-collapsed") ? "1" : "0");
  });

  // Overlay click (solo móvil)
  onClick("menuOverlay", closeMobileSidebar);

  // Si tocas un botón del menú, en móvil cerramos el drawer
  const nav = $("nav");
  if(nav){
    nav.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-view]");
      if(btn && isMobile()) closeMobileSidebar();
    });
  }

  // Escape para cerrar en móvil
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") closeMobileSidebar();
  });

  // Al cambiar tamaño, limpia estados cruzados
  window.addEventListener("resize", ()=>{
    if(!isMobile()){
      document.body.classList.remove("sidebar-open");
    }
  });

  // 📁 Elegir carpeta de Backups
  onClick("btnPickBackupFolder", async ()=>{
    try{
      await pickBackupFolder();
    }catch(e){
      console.error(e);
      alert("No se pudo abrir el selector de carpeta.\nUsa Chrome o Edge y abre el sistema en https o localhost.");
    }
  });
$("btnRepDaily").addEventListener("click", ()=>renderReport("daily"));
$("btnRepWeekly").addEventListener("click", ()=>renderReport("weekly"));
$("btnRepMonthly").addEventListener("click", ()=>renderReport("monthly"));

const btnRange = $("btnRepRange");
if(btnRange){
  btnRange.addEventListener("click", renderReportRange);
}

  // Nav
  $("nav").addEventListener("click",(e)=>{
    // Acción: ir al formulario de productos
    const act = e.target.closest("button[data-action]");
    if(act && act.dataset.action === "prodform"){
      if(!appReady) return;
      setView("products");
      // cerrar menú
      try{ $("nav").classList.add("hide"); }catch(e){}
      // bajar al formulario
      setTimeout(()=>{
        const form = $("prodFormCard");
        if(form) form.scrollIntoView({behavior:"smooth", block:"start"});
        try{ $("pCode") && $("pCode").focus(); }catch(e){}
      }, 60);
      return;
    }

    const btn = e.target.closest("button[data-view]");
    if(!btn) return;
    if(!appReady) return;
    setView(btn.dataset.view);
    // cerrar menú
    try{ $("nav").classList.add("hide"); }catch(e){}
  });

  // Hamburger toggle
  $("btnToggle").addEventListener("click", ()=>{
    $("nav").classList.toggle("hide");
  });

  // Descuento
onClick("btnApplyDisc", ()=>{
  const type = $("discType").value;
  const value = Number($("discValue").value||0);
  state.discount = { type, value };
  syncDiscUI();
  renderCart();
});

onClick("btnClearDisc", ()=>{
  state.discount = { type:"NONE", value:0 };
  syncDiscUI();
  renderCart();
});


  // Inventory
  $("invSearch").addEventListener("input", ()=>{ if(state.view==="inventory") renderInventory(); });
  $("btnInvRefresh").addEventListener("click", renderInventory);
  $("btnInvExportXLS").addEventListener("click", exportInventoryExcel);

  // Shipments
  $("shipSearch").addEventListener("input", renderShipments);
  $("shipFilter").addEventListener("change", renderShipments);
  $("btnShipRefresh").addEventListener("click", renderShipments);
  $("shipBody").addEventListener("click", async (e)=>{
    const view = e.target.closest("button[data-viewship]");
    const pay  = e.target.closest("button[data-payship]");
    const pend = e.target.closest("button[data-pendship]");
    const del  = e.target.closest("button[data-delship]");

    if(view){
      const id = view.dataset.viewship;
      const s = await idbGet("shipments", id);
      if(s && typeof openSaleDetailModal === "function"){
        await openSaleDetailModal(s, "shipment");
      }
    }
    if(pay){
      await markShipmentPaid(pay.dataset.payship);
    }
    if(pend){
      await markShipmentPending(pend.dataset.pendship);
      await renderShipments();
    }
    if(del){
      await deleteShipment(del.dataset.delship);
    }
  });

  // Cierre
  $("btnBuildClose").addEventListener("click", generateAndSaveClose);
  $("closeDate").addEventListener("change", async ()=>{ if(state.view==="close"){ await buildClose(); await renderSavedCloses(); } });
  $("closeFrom").addEventListener("change", ()=>{ if(state.view==="close") buildClose(); });
  $("closeTo").addEventListener("change", ()=>{ if(state.view==="close") buildClose(); });

  ["realCash","realCard","realTrans"].forEach(id=>{
    const el = $(id);
    if(el) el.addEventListener("input", ()=>{ if(state.view==="close") updateCloseDiffsFromCurrentInputs(); });
  });

  document.addEventListener("input", (e)=>{
    const el = e.target;
    if(!el || el.dataset?.realpayInput !== "1") return;
    if(state.view === "close") updateCloseDiffsFromCurrentInputs();
  });

  window.addEventListener('resize', ()=>{
    if(state.view !== 'close') return;
    try{
      const methods = getCloseMethodList(state.lastClose || {});
      ensureDynamicClosePayRows(methods);
    }catch(_){ }
  });

  $("btnCloseListRefresh").addEventListener("click", renderSavedCloses);
  $("closeSavedBody").addEventListener("click", async (e)=>{
    const v = e.target.closest("button[data-viewclose]");
    const d = e.target.closest("button[data-delclose]");
    if(v) await viewSavedClose(v.dataset.viewclose);
    if(d) await deleteSavedClose(d.dataset.delclose);
  });

  $("btnCloseCopy").addEventListener("click", copyClose);
  $("btnClosePDF").addEventListener("click", generateClosePDF);
  $("btnClosePNG").addEventListener("click", downloadClosePNG);
  $("btnCloseWA").addEventListener("click", openCloseWhatsApp);

  // Scan click: si hay código, agrega; si no, solo enfoca
  $("btnScan").addEventListener("click", async ()=>{
    const code = $("scanInput").value.trim();
    const qty = Number($("qtyInput").value||1);

    if(!code){
      $("scanInput").focus();
      $("scanInput").select();
      return;
    }
    const p = await getProductByCode(code);
    if(!p) { alert("No existe producto con código: " + code); return; }
    cartAdd(p, qty);
    $("scanInput").value="";
    $("qtyInput").value=1;
    $("scanInput").focus();
  });

  // Scan Enter
  $("scanInput").addEventListener("keydown", async (e)=>{
    if(e.key==="Enter"){
      e.preventDefault();
      const code = $("scanInput").value.trim();
      const qty = Number($("qtyInput").value||1);
      if(!code) return;
      const p = await getProductByCode(code);
      if(!p) { alert("No existe producto con código: " + code); return; }
      cartAdd(p, qty);
      $("scanInput").value="";
      $("qtyInput").value=1;
      $("scanInput").focus();
    }
  });

  // Search products for picker
  $("productSearch").addEventListener("input", refreshProductPicker);
  $("btnAddPicked").addEventListener("click", async ()=>{
    const code = $("productPicker").value;
    if(!code) return;
    const p = await getProductByCode(code);
    if(!p) return alert("Producto no existe.");
    cartAdd(p, Number($("qtyInput").value||1));
    $("qtyInput").value=1;
    $("scanInput").focus();
  });

  // Cart actions
  $("cartBody").addEventListener("click",(e)=>{
    const b = e.target.closest("button[data-act]");
    if(!b) return;
    const id = b.dataset.id;
    const act = b.dataset.act;
    if(act==="minus") cartInc(id,-1);
    if(act==="plus")  cartInc(id, 1);
    if(act==="del")   { state.cart = state.cart.filter(x=>String(x.id)!==String(id)); renderCart(); }
  });

  // Descuento por producto: al cambiar el campo, recalcula al instante
  $("cartBody").addEventListener("change",(e)=>{
    const el = e.target;
    if(!el || el.dataset.act!=="discVal") return;
    const id = el.dataset.id;
    const it = (state.cart||[]).find(x=>String(x.id)===String(id));
    if(!it) return;
    it.discValue = Math.max(0, Number(el.value||0));
    renderCart();
  });


  $("btnClearCart").addEventListener("click", cartClear);

  // Client find/save
  $("btnFindClient").addEventListener("click", async ()=>{
    const phone = $("cPhone").value.trim();
    if(!phone) return alert("Ingrese teléfono.");
    const c = await findClientByPhone(phone);
    if(!c){
      alert("No existe. Completa los datos y presiona Guardar.");
      state.selectedClient = null;
      updateReceiptPreview();
      return;
    }
    state.selectedClient = c;
    $("cNames").value = c.names || "";
    $("cLast").value  = c.last || "";
    $("cAddr").value  = c.addr || "";
    $("cIndic").value = c.indic || "";
    if($("cNit")) $("cNit").value = c.nit || "";
    alert("Cliente cargado.");
    updateReceiptPreview();
  });

  $("btnSaveClient").addEventListener("click", saveClientFromForm);

  $("btnUseWalkIn").addEventListener("click", ()=>{
    if($("saleType").value==="ENVIO"){
      alert("En ENVÍO no se permite venta sin cliente.");
      return;
    }
    state.selectedClient = null;
    $("cPhone").value="";
    $("cNames").value="";
    $("cLast").value="";
    if($("cNit")) $("cNit").value="";
    $("cAddr").value="";
    $("cIndic").value="";
    alert("Listo: venta MOSTRADOR sin cliente.");
    updateReceiptPreview();
  });

$("saleType").addEventListener("change", ()=>{
  if($("saleType").value==="ENVIO"){
    $("cPhone").focus();
  }
  syncClientDraftLive(); // refresca usando lo escrito
});


  $("payMethod").addEventListener("change", ()=>{ handlePayMethodUI(); updateReceiptPreview(); });
  $("mixCash")?.addEventListener("input", ()=>{ handlePayMethodUI(); updateReceiptPreview(); });
  $("mixCard")?.addEventListener("input", ()=>{ updateReceiptPreview(); });


  // Checkout
  $("btnCheckout").addEventListener("click", ()=>{ try{ playSaleTone(); }catch(e){} return checkout(); });

  // Receipt buttons
  $("btnCopyReceipt").addEventListener("click", copyReceipt);
  $("btnPDF").addEventListener("click", generatePDF);
  $("btnDownloadReceipt").addEventListener("click", downloadReceiptPNG);
  $("btnWhatsApp").addEventListener("click", openWhatsApp);

  // Clients table actions
  $("clientsBody").addEventListener("click", async (e)=>{
    const use = e.target.closest("button[data-useclient]");
    const del = e.target.closest("button[data-delclient]");
    if(use){
      const phone = use.dataset.useclient;
      const c = await findClientByPhone(phone);
      if(c){
        state.selectedClient = c;
        $("cPhone").value=c.phone; $("cNames").value=c.names; $("cLast").value=c.last; if($("cNit")) $("cNit").value=c.nit||""; $("cAddr").value=c.addr; $("cIndic").value=c.indic||"";
        setView("pos");
    postReloadOkCheck();
        updateReceiptPreview();
      }
    }
    if(del){
      if(!requireCode("borrar cliente")) return;
      const phone = del.dataset.delclient;
      if(confirm("¿Borrar cliente "+phone+"?")){
        await idbDel("clients", phone);
        await refreshKPIs();
        renderClients();
      }
    }
  });

  $("clientSearch").addEventListener("input", renderClients);
  $("btnClientRefresh").addEventListener("click", renderClients);

  // Products actions
  $("btnSaveProduct").addEventListener("click", saveProductFromForm);
  const _logoutBtn = $("btnLogoutAdmin");
  if(_logoutBtn) _logoutBtn.addEventListener("click", ()=>{ try{ logoutAdmin(); }catch(e){} });
  $("prodSearch").addEventListener("input", renderProducts);
  $("btnProdRefresh").addEventListener("click", ()=>{ renderProducts(); refreshProductPicker(); });

  $("productsBody").addEventListener("click", async (e)=>{
    const fill = e.target.closest("button[data-fillprod]");
    const del  = e.target.closest("button[data-delprod]");
    if(fill){
      if(!requireCode("editar producto")) return;
      const code = fill.dataset.fillprod;
      const p = await getProductByCode(code);
      if(!p) return;
      $("pCode").value = p.code;
      $("pName").value = p.name;
      $("pPrice").value= p.price;
      $("pCost").value= (p.cost ?? 0);
      $("pStock").value= p.stock;
      $("pCode").focus();
      const form = $("prodFormCard");
      if(form) form.scrollIntoView({behavior:"smooth", block:"start"});
    }
    if(del){
      if(!requireCode("borrar producto")) return;
      const code = del.dataset.delprod;
      if(confirm("¿Borrar producto "+code+"?")){
        await idbDel("products", code);
        await refreshKPIs();
        renderProducts();
        refreshProductPicker();
        renderInventory();
      }
    }
  });

  // Scroll a formulario crear/modificar
  onClick("btnGoProdForm", ()=>{
    const el = $("prodFormCard");
    if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
    try{ $("pCode")?.focus(); }catch(e){}
  });

  // Reports actions
 onClick("btnRepDaily", ()=>renderReport("daily"));
onClick("btnRepWeekly", ()=>renderReport("weekly"));
onClick("btnRepMonthly", ()=>renderReport("monthly"));


  $("salesBody").addEventListener("click", async (e)=>{
    const view = e.target.closest("button[data-viewsale]");
    const del  = e.target.closest("button[data-delsale]");
    if(view){
      const id = view.dataset.viewsale;
      const s = await idbGet("sales", id);
      if(s && typeof openSaleDetailModal === "function"){
        await openSaleDetailModal(s, "sale");
      }
    }
    if(del){
      const id = del.dataset.delsale;
      const sale = await idbGet("sales", id);
      if(!sale) return;
      if(!confirm("¿Anular venta?")) return;

      const ok = (typeof voidSaleRecord === "function") ? await voidSaleRecord(sale) : false;
      if(!ok) return;

      await refreshKPIs();
      await renderReport("daily");
      await buildClose();
      showOkModal("Venta anulada","La venta fue anulada y quedó registrada en auditoría.",{enter:true});
    }
  });

  // Backup / restore (con clave) 
  $("btnBackup").addEventListener("click", async ()=>{
    if(!requireBackupCode("exportar backup")) return;
    await exportJSON();
  });

  $("btnRestore").addEventListener("click", ()=>{
    if(!requireBackupCode("importar backup")) return;
    $("restoreFile").click();
  });

  $("restoreFile").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    try{ await importJSON(file); }
    catch(err){ alert("Error importando: " + err.message); }
    e.target.value="";
  });

  // Live updates on receipt while typing (EN TIEMPO REAL)
["cPhone","cNames","cLast","cAddr"].forEach(id=>{
  const el = $(id);
  if(!el) return;
  el.addEventListener("input", syncClientDraftLive);
  el.addEventListener("change", syncClientDraftLive);
});

  // Focus scan input by pressing F2
 window.addEventListener("keydown",(e)=>{
  if(e.key === "F2"){
    e.preventDefault();
    const s = $("scanInput");
    if(!s) return;
    s.focus();
    s.select();
  }
});


  // Settings save
  const btnSave = $("btnSaveSettings");
if(btnSave) btnSave.addEventListener("click", saveSettings);


  // Kardex
  onClick("btnKRefresh", renderKardex);
  onClick("btnKClear", clearKardex);
  onClick("btnKExportExcel", exportKardexExcel);
  ["kSearch","kType","kFromDate","kToDate"].forEach(id=>{
    const el=$(id);
    if(!el) return;
    el.addEventListener("input", ()=>renderKardex());
    el.addEventListener("change", ()=>renderKardex());
  });

  onClick("btnKClearFilters", ()=>{
    if($("kSearch")) $("kSearch").value = "";
    if($("kType")) $("kType").value = "";
    if($("kFromDate")) $("kFromDate").value = "";
    if($("kToDate")) $("kToDate").value = "";
    renderKardex();
  });


  // Crear producto desde panel del generador
  const _btnGenCreate = document.getElementById("btnGenCreateProd");
  if(_btnGenCreate){
    _btnGenCreate.addEventListener("click", async ()=>{
      try{
        const code = (document.getElementById("genPCode")?.value || "").trim();
        const name = (document.getElementById("genPName")?.value || "").trim();
        const price = Number(document.getElementById("genPPrice")?.value || 0);
        const cost  = Number(document.getElementById("genPCost")?.value || 0);
        const stock = Number(document.getElementById("genPStock")?.value || 0);
        if(!code) return alert("Ingrese Código (SKU/barras).");
        if(!name) return alert("Ingrese Nombre.");
        if(!isFinite(price) || price<0) return alert("Precio inválido.");
        if(!isFinite(cost)  || cost<0)  return alert("Costo inválido.");
        if(!isFinite(stock) || stock<0) return alert("Stock inválido.");

        const exists = await idbGet("products", code);
        if(exists){
          if(!requireCode("editar producto")) return;
        }
        await idbPut("products", {
          code, name,
          price: Number(price.toFixed(2)),
          cost:  Number(cost.toFixed(2)),
          stock: Math.floor(stock),
          nameKey: normKey(name),
          updatedAt: Date.now()
        });
        await logMovement({ ts: Date.now(), code, name, delta: Math.floor(stock) - Math.floor(Number(exists?.stock||0)), note: "Creado/actualizado desde Generador" });

        // limpiar campos
        ["genPCode","genPName","genPPrice","genPCost","genPStock"].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=""; });

        // refrescar tablas
        try{ await renderProducts(); }catch(e){}
        try{ await renderInventory(); }catch(e){}
        // reenviar inventario al generador
        try{ sendInventoryToLabels(); setTimeout(sendInventoryToLabels, 250); }catch(e){}
        alert("Producto guardado en inventario.");
      }catch(err){
        console.error(err);
        alert("No se pudo guardar el producto: " + err.message);
      }
    });
  }

}


  const __saleDetailOverlay = $("saleDetailOverlay");
  if(__saleDetailOverlay){
    __saleDetailOverlay.addEventListener("click", (e)=>{
      if(e.target === __saleDetailOverlay) closeSaleDetailModal();
    });
  }
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && $("saleDetailOverlay") && $("saleDetailOverlay").style.display !== "none"){
      closeSaleDetailModal();
    }
  });
