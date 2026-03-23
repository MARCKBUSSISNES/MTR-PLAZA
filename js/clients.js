// ---------- Clients ----------
async function findClientByPhone(phone){
  phone = String(phone||"").trim();
  if(!phone) return null;
  return await idbGet("clients", phone);
}

async function saveClientFromForm(){
  const phone = $("cPhone").value.trim();
  const names = $("cNames").value.trim();
  const last  = $("cLast").value.trim();
  const nit   = ($("cNit")?.value || "").trim();
  const addr  = $("cAddr").value.trim();
  const indic = $("cIndic").value.trim();

  if(!phone) return alert("Ingrese teléfono.");
  if(!names || !last || !addr) return alert("Complete Nombres, Apellidos y Dirección.");

  const client = {
    phone,
    names, last, nit, addr, indic,
    nameKey: normKey(names+" "+last),
    updatedAt: Date.now()
  };
  await idbPut("clients", client);
  state.selectedClient = client;
  showOkModal("Registro exitoso","Registro guardado.", {enter:true});;
  await refreshKPIs();
  if(state.view==="clients") renderClients();
  updateReceiptPreview();
}

async function renderClients(){
  const q = normKey($("clientSearch").value);
  const all = await idbAll("clients");
  const list = q ? all.filter(c => normKey(c.phone).includes(q) || (c.nameKey||"").includes(q) || normKey(c.addr).includes(q)) : all;

  const tb = $("clientsBody");
  tb.innerHTML = "";
  for(const c of list.sort((a,b)=> (a.nameKey||"").localeCompare(b.nameKey||""))){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.phone)}</td>
      <td>${escapeHtml(c.names)} ${escapeHtml(c.last)}</td>
      <td><small>${escapeHtml(c.addr)}</small></td>
      <td>
        <button class="btn small" data-useclient="${escapeHtml(c.phone)}">Usar</button>
        <button class="btn danger small" data-delclient="${escapeHtml(c.phone)}">Borrar</button>
      </td>
    `;
    tb.appendChild(tr);
  }
}
