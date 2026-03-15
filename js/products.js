// ---------- Products ----------

function lockProductCodeField(){
  const el = $("pCode");
  if(!el) return;
  el.readOnly = true;
  el.setAttribute("readonly", "readonly");
  el.setAttribute("aria-readonly", "true");
}

async function generateNextProductCode(){
  const all = await idbAll("products");
  if(!all || all.length === 0) return "1";

  let max = 0;
  for(const p of all){
    const num = parseInt(String(p.code ?? "").trim(), 10);
    if(!isNaN(num) && num > max) max = num;
  }
  return String(max + 1);
}

async function prepareNextProductCode(){
  lockProductCodeField();
  const el = $("pCode");
  if(!el) return;
  el.value = await generateNextProductCode();
}

async function saveProductFromForm(){
  let code = $("pCode").value.trim();
  const name = $("pName").value.trim();
  const price = Number($("pPrice").value);
  const cost = Number($("pCost").value);
  const stock = Number($("pStock").value);

  if(!code){
    code = await generateNextProductCode();
  }

  if(!name) return alert("Ingrese Nombre.");
  if(isNaN(price) || price < 0) return alert("Precio inválido.");
  if(isNaN(cost) || cost < 0) return alert("Costo inválido.");
  if(isNaN(stock) || stock < 0) return alert("Stock inválido.");

  const exists = await idbGet("products", code);
  if(exists){
    if(!requireCode("editar producto")) return;
  }

  const product = {
    code,
    name,
    price,
    cost,
    stock,
    nameKey: normKey(name),
    updatedAt: Date.now()
  };

  await idbPut("products", product);

  {
    const prev = exists ? Number(exists.stock || 0) : 0;
    const delta = Number(stock) - prev;
    if(delta !== 0){
      await logMovement({
        type: (delta > 0 ? "INGRESO" : "AJUSTE"),
        code,
        name,
        qty: delta,
        stockAfter: stock,
        refType: "PRODUCTO",
        refId: code,
        note: exists ? "Edición de stock" : "Alta de producto"
      });
    }
  }

  showOkModal("Registro exitoso", "Producto guardado.", {enter:true});
  $("pName").value = "";
  $("pPrice").value = "";
  $("pCost").value = "";
  $("pStock").value = "";
  await prepareNextProductCode();

  await refreshKPIs();
  await renderProducts();
  await refreshProductPicker();
}

async function getProductByCode(code){
  return await idbGet("products", code);
}

async function renderProducts(){
  const q = normKey($("prodSearch").value);
  const all = await idbAll("products");
  const list = q ? all.filter(p => normKey(p.code).includes(q) || (p.nameKey || "").includes(q)) : all;

  const tb = $("productsBody");
  tb.innerHTML = "";
  for(const p of list.sort((a, b) => (a.nameKey || "").localeCompare(b.nameKey || ""))){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.code)}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${money(p.price)}</td>
      <td>${money(p.cost || 0)}</td>
      <td>${Number(p.stock || 0)}</td>
      <td>
        <button class="btn small" data-fillprod="${escapeHtml(p.code)}">Editar</button>
        <button class="btn danger small" data-delprod="${escapeHtml(p.code)}">Borrar</button>
      </td>
    `;
    tb.appendChild(tr);
  }
}

async function refreshProductPicker(){
  const q = normKey($("productSearch").value);
  const all = await idbAll("products");
  const list = q ? all.filter(p => (p.nameKey || "").includes(q) || normKey(p.code).includes(q)) : all;

  const sel = $("productPicker");
  sel.innerHTML = "";
  if(list.length === 0){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No hay productos (agrega en Productos)";
    sel.appendChild(opt);
    return;
  }
  for(const p of list.slice(0, 300)){
    const opt = document.createElement("option");
    opt.value = p.code;
    opt.textContent = `${p.name} — ${p.code} — ${money(p.price)} — Stock:${p.stock}`;
    sel.appendChild(opt);
  }
}
