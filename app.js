const SB_URL="https://lvoizfpdpvcqqhsrmflu.supabase.co";
const SB_KEY="sb_publishable_EjEA70CvIvAiU_v20wrL1A_F1jxNQmX";
const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const UPLOAD_URL=SB_URL+"/functions/v1/moto-click-admin-upload";
const WHATSAPP_NUMBER="";

const CATEGORIES=[
  ["","Todas"],["Motor","Motor"],["Freios","Freio"],["Transmissão","Transmissão"],["Suspensão","Suspensão"],
  ["Elétrica","Elétrica"],["Filtro","Filtro"],["Carenagem","Carenagem"],["Acessórios","Acessórios"],["Diversos","Diversos"]
];
const ICONS={"":"▦","Motor":"⚙","Freios":"◉","Transmissão":"⛓","Suspensão":"⌁","Elétrica":"ϟ","Filtro":"▥","Carenagem":"➤","Acessórios":"⌘","Diversos":"✺"};
const el=id=>document.getElementById(id);
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

let products=[];
let currentCategory="";
let searchText="";
let cart=JSON.parse(localStorage.getItem("mc_cart")||"{}");
let session=JSON.parse(sessionStorage.getItem("mc_session")||"null");
let editingProduct=null;
let currentImages=[];
let checkoutStep=1;
let checkoutData={delivery:"delivery",payment:"pix"};

function toast(msg){
  const t=el("toast");t.textContent=msg;t.classList.add("show");
  clearTimeout(window.__tt);window.__tt=setTimeout(()=>t.classList.remove("show"),2500);
}
function saveCart(){localStorage.setItem("mc_cart",JSON.stringify(cart));renderCart();renderProducts();}
function setSession(data){
  session=data;
  if(data)sessionStorage.setItem("mc_session",JSON.stringify(data));else sessionStorage.removeItem("mc_session");
  updateSessionUI();
}
function isAdmin(){return session?.role==="admin"&&!!session?.token}
function activeToken(){return session?.token||""}

function showView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  const map={store:"viewStore",cart:"viewCart",checkout:"viewCheckout",account:"viewAccount",editor:"viewEditor"};
  el(map[name]||"viewStore").classList.add("active");
  document.querySelectorAll(".mobile-bottom button").forEach(b=>b.classList.remove("active"));
  if(name==="store")document.querySelector('.mobile-bottom [data-go="store"]')?.classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}
document.addEventListener("click",e=>{
  const g=e.target.closest("[data-go]");
  if(g){e.preventDefault();showView(g.dataset.go);if(g.dataset.focusSearch) setTimeout(()=>el("searchInput").focus(),250);}
});

function buildCategories(){
  el("categoryList").innerHTML=CATEGORIES.map(([value,label])=>`<button data-cat="${esc(value)}"><span class="ci">${ICONS[value]||"✺"}</span><span>${esc(label)}</span></button>`).join("");
  el("fCategory").innerHTML=CATEGORIES.filter(x=>x[0]).map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join("");
  el("categoryList").querySelectorAll("button").forEach(btn=>btn.onclick=()=>{
    currentCategory=btn.dataset.cat||"";
    el("categoryList").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===btn));
    renderProducts();
    if(innerWidth<821)document.getElementById("produtos").scrollIntoView({behavior:"smooth"});
  });
  el("categoryList").querySelector("button")?.classList.add("active");
}
function productMatches(p){
  const q=searchText.toLowerCase();
  const text=(p.name+" "+p.model+" "+p.sku+" "+p.category+" "+(p.description||"")).toLowerCase();
  const catOk=!currentCategory||p.category===currentCategory||(currentCategory==="Filtro"&&/filtro/i.test(text));
  return catOk&&(!q||text.includes(q));
}
function productImage(p){
  const u=p.image_urls?.[0];
  return u?`<img src="${esc(u)}" alt="${esc(p.name)}" loading="lazy">`:`<div class="product-placeholder">${ICONS[p.category]||"⚙"}</div>`;
}
function renderProducts(){
  const list=products.filter(productMatches);
  const admin=isAdmin();
  el("adminActions").classList.toggle("hidden",!admin);
  el("productGrid").innerHTML=list.length?list.map(p=>{
    const stock=Number(p.stock||0),out=stock<=0;
    return `<article class="product-card">
      <div class="product-image">${productImage(p)}</div>
      <div class="product-info">
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-model">${esc(p.model||p.sku||p.category||"")}</div>
        <div class="product-price">${money(p.price)}</div>
        <div class="product-stock ${out?"out":""}">${out?"Sem estoque":`Estoque: ${stock}`}</div>
        <button class="add-btn" ${out?"disabled":""} onclick="addToCart('${p.id}')">${out?"Indisponível":"Adicionar ao carrinho"}</button>
        ${admin?`<div class="admin-card-actions">
          <button onclick="editProduct('${p.id}')">Editar</button>
          <button data-delete="${p.id}" onclick="deleteProductClick(this,'${p.id}')">Excluir</button>
        </div>`:""}
      </div>
    </article>`;
  }).join(""):`<div style="grid-column:1/-1;padding:42px;text-align:center;color:#708095">Nenhum produto encontrado.</div>`;
}
async function loadProducts(){
  el("productGrid").innerHTML='<div style="grid-column:1/-1;padding:42px;text-align:center;color:#708095">Carregando produtos...</div>';
  if(isAdmin()){
    const {data,error}=await sb.rpc("moto_click_admin_list_products",{p_token:activeToken()});
    if(error){setSession(null);toast("Sua sessão expirou.");return loadProducts();}
    products=data||[];
  }else{
    const {data,error}=await sb.from("moto_click_products").select("*").eq("active",true).order("featured",{ascending:false}).order("created_at",{ascending:false});
    if(error){el("productGrid").innerHTML='<div style="grid-column:1/-1;padding:42px;text-align:center;color:#b42323">Erro ao carregar o catálogo.</div>';return}
    products=data||[];
  }
  renderProducts();renderCart();
}
el("searchInput").addEventListener("input",e=>{searchText=e.target.value.trim();renderProducts();});
el("showAllBtn").onclick=()=>{currentCategory="";searchText="";el("searchInput").value="";el("categoryList").querySelectorAll("button").forEach((x,i)=>x.classList.toggle("active",i===0));renderProducts();};

function addToCart(id){cart[id]=(cart[id]||0)+1;saveCart();toast("Produto adicionado ao carrinho.");}
function changeQty(id,delta){cart[id]=(cart[id]||0)+delta;if(cart[id]<=0)delete cart[id];saveCart();}
function removeItem(id){delete cart[id];saveCart();}
function cartEntries(){
  return Object.entries(cart).map(([id,qty])=>[products.find(p=>String(p.id)===String(id)),qty]).filter(([p])=>p);
}
function cartTotals(){
  const items=cartEntries();const count=items.reduce((a,[p,q])=>a+q,0);const subtotal=items.reduce((a,[p,q])=>a+Number(p.price)*q,0);
  return {items,count,subtotal};
}
function cartRowHTML(p,q,page=false){
  return `<div class="cart-row">
    <div class="cart-thumb">${p.image_urls?.[0]?`<img src="${esc(p.image_urls[0])}" alt="">`:(ICONS[p.category]||"⚙")}</div>
    <div><div class="cart-name">${esc(p.name)}</div><div class="cart-price">${money(p.price)}</div>
      <div class="qty"><button onclick="changeQty('${p.id}',-1)">−</button><span>${q}</span><button onclick="changeQty('${p.id}',1)">+</button></div>
    </div>
    <button class="remove" onclick="removeItem('${p.id}')">⌫</button>
  </div>`;
}
function renderCart(){
  const {items,count,subtotal}=cartTotals();
  el("cartBadge").textContent=count;
  el("cartCountDesk").textContent=count;
  const html=items.length?items.map(([p,q])=>cartRowHTML(p,q)).join(""):'<div class="cart-empty">Seu carrinho está vazio.</div>';
  el("cartItemsDesk").innerHTML=html;
  el("cartItemsPage").innerHTML=html;
  el("cartSubtotalDesk").textContent=money(subtotal);el("cartTotalDesk").textContent=money(subtotal);
  el("cartSubtotalPage").textContent=money(subtotal);el("cartTotalPage").textContent=money(subtotal);
}
el("cartBtn").onclick=()=>showView(innerWidth<821?"cart":"cart");
el("mobileCartBtn").onclick=()=>showView("cart");
el("continueDeskBtn").onclick=()=>showView("store");
function startCheckout(){
  if(!cartTotals().count)return toast("Adicione produtos ao carrinho primeiro.");
  checkoutStep=1;showView("checkout");renderCheckout();
}
el("checkoutDeskBtn").onclick=startCheckout;el("checkoutPageBtn").onclick=startCheckout;

function setStep(n){checkoutStep=n;renderCheckout();}
function renderCheckout(){
  document.querySelectorAll("[data-step-ind]").forEach(s=>s.classList.toggle("active",Number(s.dataset.stepInd)===Math.min(checkoutStep,3)));
  const {items,subtotal}=cartTotals();
  if(checkoutStep===1){
    el("checkoutBody").innerHTML=`
      <h3 style="margin-top:0">Resumo do carrinho</h3>
      <div class="order-summary">${items.map(([p,q])=>`<div class="summary-item"><span>${q}x ${esc(p.name)}</span><b>${money(Number(p.price)*q)}</b></div>`).join("")}
      <div class="sum-total"><span>Total</span><span>${money(subtotal)}</span></div></div>
      <div class="checkout-actions"><button class="btn secondary" onclick="showView('cart')">Voltar ao carrinho</button><button class="btn primary" onclick="setStep(2)">Continuar</button></div>`;
  }else if(checkoutStep===2){
    el("checkoutBody").innerHTML=`
      <div class="checkout-grid">
        <div>
          <h3 style="margin-top:0">Endereço de entrega</h3>
          <div class="form-group"><label>CEP</label><input id="coCep" value="${esc(checkoutData.cep||"")}"></div>
          <div class="form-group"><label>Endereço</label><input id="coAddress" value="${esc(checkoutData.address||"")}"></div>
          <div class="form-group"><label>Cidade / UF</label><input id="coCity" value="${esc(checkoutData.city||"")}"></div>
        </div>
        <div>
          <h3 style="margin-top:0">Método de entrega</h3>
          <label class="option-card"><input type="radio" name="delivery" value="delivery" ${checkoutData.delivery!=="pickup"?"checked":""}><span><strong>Entrega</strong><small>Frete calculado no atendimento</small></span></label>
          <label class="option-card"><input type="radio" name="delivery" value="pickup" ${checkoutData.delivery==="pickup"?"checked":""}><span><strong>Retirar na loja</strong><small>Combine a retirada no atendimento</small></span></label>
        </div>
      </div>
      <div class="checkout-actions"><button class="btn secondary" onclick="setStep(1)">Voltar</button><button class="btn primary" onclick="saveDeliveryAndNext()">Ir para pagamento</button></div>`;
  }else if(checkoutStep===3){
    el("checkoutBody").innerHTML=`
      <h3 style="margin-top:0">Forma de pagamento</h3>
      ${["pix|Pix|À vista","credit|Cartão de crédito|Consulte as condições","debit|Cartão de débito|No atendimento","cash|Dinheiro|Combine com a loja"].map(x=>{const [v,t,s]=x.split("|");return `<label class="option-card"><input type="radio" name="payment" value="${v}" ${checkoutData.payment===v?"checked":""}><span><strong>${t}</strong><small>${s}</small></span></label>`}).join("")}
      <div class="order-summary" style="margin-top:16px"><div class="sum-line"><span>Produtos</span><b>${money(subtotal)}</b></div><div class="sum-line"><span>Frete</span><span>A calcular</span></div><div class="sum-total"><span>Total parcial</span><span>${money(subtotal)}</span></div></div>
      <div class="checkout-actions"><button class="btn secondary" onclick="setStep(2)">Voltar</button><button class="btn primary" onclick="finishCheckout()">Finalizar pedido</button></div>`;
  }else{
    const num=checkoutData.orderNo;
    el("checkoutBody").innerHTML=`<div class="success"><div class="success-icon">✓</div><h2>Pedido preparado!</h2><p>Seu pedido foi montado com sucesso. Agora envie os detalhes para a Moto Click confirmar frete, prazo e pagamento.</p><div class="order-number">Pedido #${num}</div><br><button class="btn green" onclick="sendWhatsApp()">Ir para o WhatsApp</button><div style="height:8px"></div><button class="btn secondary" onclick="finishAndReturn()">Voltar para a loja</button></div>`;
  }
}
function saveDeliveryAndNext(){
  checkoutData.cep=el("coCep").value.trim();checkoutData.address=el("coAddress").value.trim();checkoutData.city=el("coCity").value.trim();
  checkoutData.delivery=document.querySelector('input[name="delivery"]:checked')?.value||"delivery";
  setStep(3);
}
function finishCheckout(){
  checkoutData.payment=document.querySelector('input[name="payment"]:checked')?.value||"pix";
  checkoutData.orderNo=String(Date.now()).slice(-6);
  checkoutStep=4;renderCheckout();
}
function orderMessage(){
  const {items,subtotal}=cartTotals();
  const pay={pix:"Pix",credit:"Cartão de crédito",debit:"Cartão de débito",cash:"Dinheiro"}[checkoutData.payment]||checkoutData.payment;
  return `Olá, Moto Click! Quero confirmar o pedido #${checkoutData.orderNo||""}\n\n${items.map(([p,q])=>`• ${q}x ${p.name} — ${money(Number(p.price)*q)}`).join("\n")}\n\nSubtotal: ${money(subtotal)}\nEntrega: ${checkoutData.delivery==="pickup"?"Retirada na loja":"Entrega"}\nEndereço: ${checkoutData.address||"-"} / ${checkoutData.city||"-"} / CEP ${checkoutData.cep||"-"}\nPagamento: ${pay}`;
}
function sendWhatsApp(){
  const msg=orderMessage();
  if(WHATSAPP_NUMBER)window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,"_blank");
  else{navigator.clipboard?.writeText(msg);toast("Pedido copiado. Falta configurar o número do WhatsApp da loja.");}
}
function finishAndReturn(){cart={};saveCart();checkoutData={delivery:"delivery",payment:"pix"};showView("store");}
el("checkoutBack").onclick=()=>checkoutStep>1?setStep(checkoutStep-1):showView("cart");

function updateSessionUI(){
  const logged=!!session?.token;
  el("accountLabel").textContent=logged?(session.display_name||session.username||"Conta"):"Entrar";
  el("guestAccount").classList.toggle("hidden",logged);
  el("loggedAccount").classList.toggle("hidden",!logged);
  if(logged){
    el("loggedName").textContent=session.display_name||session.username;
    el("loggedRole").textContent=isAdmin()?"Administrador":"Cliente";
    el("adminAccountText").classList.toggle("hidden",!isAdmin());
    el("customerAccountText").classList.toggle("hidden",isAdmin());
  }
  el("adminActions").classList.toggle("hidden",!isAdmin());
}
el("accountBtn").onclick=()=>showView("account");el("mobileAccountBtn").onclick=()=>showView("account");
function inlineMsg(id,msg){const m=el(id);m.textContent=msg;m.style.display="block";}
el("loginForm").onsubmit=async e=>{
  e.preventDefault();
  const username=el("loginUser").value.trim(),password=el("loginPassword").value;
  if(!username||!password)return;
  const {data,error}=await sb.rpc("moto_click_login",{p_username:username,p_password:password});
  if(error||!data?.token)return inlineMsg("loginMessage","Usuário ou senha inválidos.");
  setSession(data);el("loginPassword").value="";inlineMsg("loginMessage","Acesso realizado com sucesso.");
  await loadProducts();setTimeout(()=>showView("store"),450);
};
el("registerForm").onsubmit=async e=>{
  e.preventDefault();
  const name=el("registerName").value.trim(),username=el("registerUser").value.trim(),password=el("registerPassword").value;
  if(password.length<6)return inlineMsg("registerMessage","Use uma senha com pelo menos 6 caracteres.");
  const {data,error}=await sb.rpc("moto_click_customer_register",{p_display_name:name,p_username:username,p_password:password});
  if(error)return inlineMsg("registerMessage","Não foi possível criar a conta: "+error.message);
  inlineMsg("registerMessage",data?.message||"Conta criada. Agora você já pode entrar.");
};
el("logoutBtn").onclick=async()=>{
  try{
    if(isAdmin())await sb.rpc("moto_click_admin_logout",{p_token:activeToken()});
    else if(session?.token)await sb.rpc("moto_click_customer_logout",{p_token:activeToken()});
  }catch(e){}
  setSession(null);await loadProducts();showView("store");toast("Você saiu da conta.");
};

el("newProductBtn").onclick=()=>openEditor(null);
function editProduct(id){const p=products.find(x=>String(x.id)===String(id));if(p)openEditor(p);}
function openEditor(p){
  if(!isAdmin())return;
  editingProduct=p;currentImages=[...(p?.image_urls||[])];
  el("editorTitle").textContent=p?"Editar produto":"Novo produto";
  el("fName").value=p?.name||"";el("fSku").value=p?.sku||"";el("fModel").value=p?.model||"";
  el("fCategory").value=p?.category||"Motor";el("fPrice").value=p?.price??"";el("fStock").value=p?.stock??0;
  el("fDescription").value=p?.description||"";el("fFeatured").checked=!!p?.featured;el("fActive").checked=p?!!p.active:true;el("fImages").value="";
  renderPreviews();showView("editor");
}
function renderPreviews(){
  el("imagePreviews").innerHTML=currentImages.map((url,i)=>`<div class="preview"><img src="${esc(url)}" alt=""><button type="button" onclick="removePreview(${i})">×</button></div>`).join("");
}
function removePreview(i){currentImages.splice(i,1);renderPreviews();}
async function uploadFiles(productId,files){
  const urls=[];
  for(const file of files){
    const fd=new FormData();fd.append("file",file);fd.append("productId",productId);
    const r=await fetch(UPLOAD_URL,{method:"POST",headers:{"x-admin-token":activeToken()},body:fd});
    const j=await r.json();if(!r.ok)throw new Error(j.error||"Falha no upload");urls.push(j.url);
  }
  return urls;
}
el("productForm").onsubmit=async e=>{
  e.preventDefault();if(!isAdmin())return;
  const btn=el("saveProductBtn");btn.disabled=true;btn.textContent="Salvando...";
  try{
    let payload={
      id:editingProduct?.id||null,name:el("fName").value.trim(),sku:el("fSku").value.trim(),model:el("fModel").value.trim(),
      category:el("fCategory").value,price:Number(el("fPrice").value||0),stock:Number(el("fStock").value||0),
      description:el("fDescription").value.trim(),featured:el("fFeatured").checked,active:el("fActive").checked,image_urls:currentImages
    };
    let id=payload.id;
    if(!id){
      const {data,error}=await sb.rpc("moto_click_admin_save_product",{p_token:activeToken(),p_product:payload});if(error)throw error;id=data;payload.id=id;
    }
    const files=[...el("fImages").files];
    if(files.length){const uploaded=await uploadFiles(id,files);payload.image_urls=[...currentImages,...uploaded];}
    const {error}=await sb.rpc("moto_click_admin_save_product",{p_token:activeToken(),p_product:payload});if(error)throw error;
    toast("Produto salvo com sucesso.");await loadProducts();showView("store");
  }catch(err){toast("Erro ao salvar: "+(err.message||err));}
  finally{btn.disabled=false;btn.textContent="Salvar produto";}
};
async function deleteProductClick(btn,id){
  if(btn.dataset.confirmed!=="1"){
    btn.dataset.confirmed="1";btn.textContent="Confirmar exclusão";btn.style.background="#fff1f1";
    setTimeout(()=>{if(btn.isConnected){btn.dataset.confirmed="0";btn.textContent="Excluir";btn.style.background=""}},4000);return;
  }
  btn.disabled=true;
  const {error}=await sb.rpc("moto_click_admin_delete_product",{p_token:activeToken(),p_id:id});
  if(error){toast("Erro ao excluir.");btn.disabled=false;return}
  toast("Produto excluído.");delete cart[id];saveCart();await loadProducts();
}

buildCategories();
updateSessionUI();
loadProducts();
renderCart();