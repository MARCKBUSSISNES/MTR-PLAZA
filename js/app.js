// ---------- Init ----------
(async function init(){
  try{
    db = await openDB();
    appReady = true;

    await loadSettings();
    syncDiscUI();
    renderCart();
    await refreshKPIs();
    await refreshProductPicker();
    await renderProducts();
    await prepareNextProductCode();
    await renderInventory();
    await renderClients();
    await renderSavedCloses();
    updateReceiptPreview();

    const cd = $("closeDate");
    if(cd && !cd.value) cd.value = todayKey();

    wireEvents();
    setView("pos");
    postReloadOkCheck();
  }catch(err){
    console.error(err);
    alert("Error iniciando el sistema: " + (err?.message || err));
  }
})();
const reloadBtn = document.getElementById("reloadBtn");

// recargar sistema
reloadBtn.onclick = () => location.reload();

let isDragging = false;
let offsetX = 0;
let offsetY = 0;

// cargar posición guardada
const savedPos = JSON.parse(localStorage.getItem("reloadBtnPos") || "null");

if(savedPos){
  reloadBtn.style.left = savedPos.x + "px";
  reloadBtn.style.top = savedPos.y + "px";
  reloadBtn.style.bottom = "auto";
  reloadBtn.style.right = "auto";
}

// empezar arrastre
reloadBtn.addEventListener("mousedown",(e)=>{
  isDragging = true;
  offsetX = e.clientX - reloadBtn.offsetLeft;
  offsetY = e.clientY - reloadBtn.offsetTop;
});

// mover
document.addEventListener("mousemove",(e)=>{
  if(!isDragging) return;

  const x = e.clientX - offsetX;
  const y = e.clientY - offsetY;

  reloadBtn.style.left = x + "px";
  reloadBtn.style.top = y + "px";
  reloadBtn.style.bottom = "auto";
  reloadBtn.style.right = "auto";
});

// soltar y guardar posición
document.addEventListener("mouseup",()=>{
  if(!isDragging) return;

  isDragging = false;

  const pos = {
    x: reloadBtn.offsetLeft,
    y: reloadBtn.offsetTop
  };

  localStorage.setItem("reloadBtnPos", JSON.stringify(pos));
});