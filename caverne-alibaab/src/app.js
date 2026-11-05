const $ = (s) => document.querySelector(s);
const STORES = {
  items: 'caverne_alibaab_inventory_v1',
  kits: 'caverne_alibaab_kits_v1',
  travel: 'caverne_alibaab_travel_v1',
  loans: 'caverne_alibaab_loans_v1',
  movements: 'caverne_alibaab_movements_v1'
};
let items = [], kits = [], travel = [], loans = [], movements = [];
let editingId = null, editingTravelId = null, editingLoanId = null, photoData = '';
let stateUpdatedAt = new Date().toISOString();
let departureQueue = [];
let lastScanValue = '', lastScanAt = 0;
const statusNames = { stock: 'En stock', loaned: 'Emprunté / sorti', unavailable: 'Indisponible' };
const reasonNames = { repair: 'En réparation', lost: 'Perdu', out_of_service: 'Hors service' };
const movementNames = { entry: 'Entrée', exit: 'Sortie', return: 'Retour', departure: 'Départ' };
const travelStatusNames = { draft: 'Brouillon', ready: 'Préparé', in_progress: 'En cours', done: 'Terminé' };
const loanStatusNames = { draft: 'Brouillon', pending: 'En attente', validated: 'Validé', departed: 'En route', returned: 'Retourné' };
const loanItemStatusNames = { assigned: 'Prêt', departed: 'Départé', returned: 'Retourné' };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ip = s => s == null ? '' : String(s);
function openFromHash(){
  const m=location.hash.match(/^#item=(.+)$/);
  if(m){ const id=decodeURIComponent(m[1]); history.replaceState(null,'',location.pathname+location.search); if(items.some(i=>i.id===id)) openEdit(id); else alert("Cette fiche n'existe pas sur cet appareil. Restaure d'abord une sauvegarde."); }
}
function saveAll(){ persistAll(); render(); }
function persistAll(){
  stateUpdatedAt=new Date().toISOString(); const state={items,kits,travel,loans,movements,updatedAt:stateUpdatedAt};
  idb.set('state',state).catch(()=>alert("Enregistrement impossible : espace de stockage plein ? Fais une sauvegarde."));
  try { localStorage.setItem('caverne_alibaab_last_update',state.updatedAt); } catch(e) {}
}

// ---------- IndexedDB ----------
const idb = {
  db: null,
  open(){ return new Promise((res,rej)=>{ const r=indexedDB.open('caverne_alibaab',1); r.onupgradeneeded=()=>{ const d=r.result; if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); }; r.onsuccess=()=>{ this.db=r.result; res(); }; r.onerror=()=>rej(r.error); }); },
  get(k){ return new Promise((res,rej)=>{ const q=this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); },
  set(k,v){ return new Promise((res,rej)=>{ const t=this.db.transaction('kv','readwrite'); t.objectStore('kv').put(v,k); t.oncomplete=res; t.onerror=()=>rej(t.error); }); }
};

// ---------- lifecyle ----------
(async () => {
  try {
    await idb.open();
    let st = await idb.get('state');
    if (!st) {
      const oldItems = await idb.get('state.items') || JSON.parse(localStorage.getItem(STORES.items) || '[]');
      const oldKits  = await idb.get('state.kits') || JSON.parse(localStorage.getItem(STORES.kits) || '[]');
      st = { items: oldItems, kits: oldKits, travel: await idb.get('state.travel')||[], loans: await idb.get('state.loans')||[], movements: await idb.get('state.movements')||[] };
      if (oldItems.length || oldKits.length) await idb.set('state', st);
    }
    items = st.items || [];
    kits  = st.kits || [];
    travel = st.travel || [];
    loans = st.loans || [];
    movements = st.movements || []; stateUpdatedAt=st.updatedAt||stateUpdatedAt;
  } catch (e) { alert("Le stockage de l'appareil est indisponible (Navigation privée ?). Les données ne seront pas conservées."); }
  window.__bootTrace = [];
  window.__bootTrace.push('start');
  try { render(); window.__bootTrace.push('render-done'); } catch (e) { window.__bootTrace.push('render-ERR:' + e.message); }
  try { openFromHash(); window.__bootTrace.push('openFromHash'); } catch (e) { window.__bootTrace.push('openFromHash-ERR:' + e.message); }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); window.__bootTrace.push('storage'); } catch (e) { window.__bootTrace.push('storage-ERR:' + e.message); }
  try { if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(()=>{}); window.__bootTrace.push('sw'); } catch (e) { window.__bootTrace.push('sw-ERR:' + e.message); }
  try { initTravelForm(); window.__bootTrace.push('travel'); } catch (e) { window.__bootTrace.push('travel-ERR:' + e.message + ' | ' + (e.stack||'').split('\n')[1]); }
  try { initLoanForm(); window.__bootTrace.push('loan'); } catch (e) { window.__bootTrace.push('loan-ERR:' + e.message); }
  try { initScanner(); window.__bootTrace.push('scanner'); } catch (e) { window.__bootTrace.push('scanner-ERR:' + e.message); }
})();

// ---------- render ----------
function render(){
  renderInventory();
  renderKits();
  renderTravel();
  renderLoans();
  renderMovements();
  renderStats();
  renderKitsPrintBtn();
}
function renderStats(){
  $('#statTotal').textContent = items.reduce((n,x)=>n+Math.max(1,Number(x.quantity)||1),0);
  $('#statStock').textContent = items.filter(x=>x.status==='stock').reduce((n,x)=>n+Math.max(1,Number(x.quantity)||1),0);
  $('#statLoaned').textContent = items.filter(x=>x.status==='loaned').reduce((n,x)=>n+Math.max(1,Number(x.quantity)||1),0);
  $('#statUnavailable').textContent = items.filter(x=>x.status==='unavailable').reduce((n,x)=>n+Math.max(1,Number(x.quantity)||1),0);
}
function renderKitsPrintBtn(){
  $('#printKitsBtn').onclick=()=>{ if(!kits.length)return alert('Aucun sac ou kit.'); kits.forEach(k=>printKit(k)); };
}
function renderInventory(){
  const q=$('#search').value.toLowerCase().trim(), sf=$('#statusFilter').value, cf=$('#categoryFilter').value;
  const cats=[...new Set(items.map(x=>x.category).filter(Boolean))].sort();
  $('#categoryFilter').innerHTML='<option value="all">Toutes catégories</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $('#categoryFilter').value=cats.includes(cf)?cf:'all';
  const filtered=items.filter(x=>(sf==='all'||x.status===sf)&&(cf==='all'||x.category===cf)&&[x.name,x.brand,x.model,x.serial,x.category,x.location,x.holder].join(' ').toLowerCase().includes(q));
  $('#count').textContent=`${filtered.length} référence(s) · ${filtered.reduce((n,x)=>n+Math.max(1,Number(x.quantity)||1),0)} unité(s)`;
  $('#inventory').innerHTML=filtered.length?filtered.map(x=>`<article class="item-card">${x.photo?`<img src="${x.photo}" alt="">`:''}<div class="item-meta"><span class="pill">${esc(x.category)}</span><span class="pill ${esc(x.status)}">${statusNames[x.status]}</span></div><h3>${esc(x.name)}</h3><p>${esc([x.brand,x.model].filter(Boolean).join(' · ')||'Modèle non renseigné')}<br>Quantité totale : ${Math.max(1,Number(x.quantity)||1)}<br>${x.serial?'N° série : '+esc(x.serial):'Sans numéro de série'}<br>${x.location?'Emplacement : '+esc(x.location):'Emplacement non renseigné'}${x.holder?'<br>Avec : '+esc(x.holder):''}${x.dueDate?'<br>Retour prévu : '+esc(x.dueDate):''}${x.status==='unavailable'&&x.reason?'<br>'+reasonNames[x.reason]:''}</p><div class="card-actions"><button class="btn subtle" data-edit="${x.id}">Modifier</button><button class="btn subtle" data-qr="${x.id}">QR code</button><button class="btn subtle" data-print="${x.id}">Fiche PDF</button><button class="btn subtle" data-printloan="${x.id}">Fiche location</button><button class="btn subtle" data-delete="${x.id}">Supprimer</button></div></article>`).join(''):'<div class="empty">Aucun équipement correspondant. Ajoute ton matériel.</div>';
}
function kitEntries(kit){ return (kit.items||[]).map(entry=>typeof entry==='string'?{itemId:entry,qty:1}:{itemId:entry.itemId||entry.id,qty:Math.max(1,Number(entry.qty)||1)}); }
function renderKits(){
  $('#kits').innerHTML=kits.length?kits.map(k=>{const entries=kitEntries(k),units=entries.reduce((n,e)=>n+e.qty,0);return `<article class="item-card"><div class="item-meta"><span class="pill">SAC / KIT</span><span class="pill">${entries.length} référence(s) · ${units} unité(s)</span></div><h3>${esc(k.name)}</h3><p>${esc(k.location||'Emplacement non renseigné')}<br>${esc(k.description||'')}<br>${entries.map(e=>{const x=items.find(i=>i.id===e.itemId);return x?`${esc(x.name)} × ${e.qty}`:''}).filter(Boolean).join(' · ')}</p><div class="card-actions"><button class="btn subtle" data-kit-delete="${k.id}">Supprimer le kit</button><button class="btn subtle" data-printkit="${k.id}">Fiche par sac</button></div></article>`}).join('') : '<div class="empty">Aucun sac ou kit. Crée un kit pour regrouper ton matériel.</div>';
}
function renderTravel(){
  const list=$('#travelList');
  if(!travel.length){ list.innerHTML='<p class="muted small">Aucun scénario. Crée un « mat d\'emats » pour te préparer une journée.</p>'; return; }
  list.innerHTML = travel.map(t=>`<article class="item-card travel-card"><div class="item-meta"><span class="pill">TOURNAGE</span><span class="pill ${esc(t.status||'draft')}">${esc(travelStatusNames[t.status||'draft'])}</span></div><div><h3>${esc(t.name)}</h3><p>${esc(t.notes||'')}</p><p class="muted small">${(t.needs||[]).map(n=>esc(n.label)+' ×'+(n.qty||1)).join(' · ')||'Aucun besoin renseigné'}</p></div><div class="card-actions"><button class="btn subtle" data-travel-qr="${t.id}">QR scénario</button><button class="btn subtle" data-travel-edit="${t.id}">Éditer</button><button class="btn subtle" data-travel-delete="${t.id}">Supprimer</button></div></article>`).join('');
}
function renderLoans(){
  const list=$('#loanList');
  if(!loans.length){ list.innerHTML='<p class="muted small">Aucune location. Crée un contrat de tournage.</p>'; return; }
  list.innerHTML = loans.map(l=>`
  <article class="item-card loan-card">
    <div class="item-meta">
      <span class="pill">LOCATION</span><span class="pill ${esc(l.status)}">${esc(loanStatusNames[l.status])}</span>
    </div>
    <div class="loan-head">
      <div><h3>${esc(l.client||'')} ${esc(l.firstname||'')}</h3><p>${esc(l.objectif||'')}</p></div>
      <div class="loan-dates"><strong>${esc(ip(l.startDate)||'—')}</strong> → <strong>${esc(ip(l.endDate)||'—')}</strong></div>
    </div>
    <p class="muted small">Contact : ${esc(l.contact||'—')}</p>
    <div class="loan-items">${l.items?.map(it=>`<div class="loan-item-row"><span class="pill ${esc(it.status)}">${esc(loanItemStatusNames[it.status])}</span><span>${esc(it.name||'?')}</span><span class="muted small">×${it.qty||1}</span></div>`).join('')||'<p class="muted small">Aucun matériel préparé.</p>'}</div>
    <div class="card-actions" style="margin-top:8px">
      <button class="btn subtle" data-loan-edit="${l.id}">Modifier</button>
      <button class="btn subtle" data-loan-depart="${l.id}">Départ</button>
      <button class="btn subtle" data-loan-print="${l.id}">Fiche PDF</button>
      <button class="btn subtle" data-loan-delete="${l.id}">Supprimer</button>
    </div>
  </article>`).join('');
}
function renderMovements(){
  const list=$('#movementList');
  const d=$('#movementDate')?.value||'';
  const day = d ? movements.filter(m=>m.date===d) : movements;
  if(!day.length){ list.innerHTML='<p class="muted small">Aucun mouvement.</p>'; return; }
  list.innerHTML = day.map(m=>`
  <div class="movement-row">
    <span class="pill ${esc(m.type)}">${esc(movementNames[m.type])}</span>
    <div><strong>${esc(m.itemName||'?')}</strong><span class="muted small"> ×${m.qty||1}</span></div>
    <div class="muted small">${esc(m.date)} · ${esc(m.holder||'')} · ${esc(m.note||'')}</div>
  </div>`).join('');
}

// ---------- dialogs: travel ----------
function initTravelForm(){
  $('#addTravelBtn').onclick=()=>{ editingTravelId=null; $('#travelDialogTitle').textContent='Nouveau scénario'; resetTravel(); $('#travelDialog').showModal(); };
  $('#closeTravel').onclick=$('#cancelTravel').onclick=()=>$('#travelDialog').close();
  $('#travelForm').onsubmit=e=>{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.currentTarget).entries()); d.needs=[]; const rows=$('#travelItems').querySelectorAll('.travel-row'); rows.forEach(r=>{ const label=r.querySelector('.travel-label').value.trim(); if(label){ d.needs.push({ label, qty: Math.max(1, Number(r.querySelector('.travel-qty').value)||1), notes: r.querySelector('.travel-notes').value.trim() }); } });
  const old=travel.find(x=>x.id===editingTravelId); d.id=editingTravelId||uid(); d.status=old?.status||'draft'; travel=old?travel.map(x=>x.id===d.id?{...old,...d}:x):[...travel,d]; editingTravelId=null; saveAll(); $('#travelDialog').close(); renderTravel(); };
  $('#addTravelItem').onclick=()=>{ const list=document.getElementById('travelItems'); const row=document.createElement('div'); row.className='travel-row'; row.innerHTML=`<input class="travel-label" placeholder="Ex. : Canon FX3 + 2 objectifs" style="flex:1"><input class="travel-qty" type="number" min="1" value="1" style="width:80px"><input class="travel-notes" placeholder="Requis / commentaire" style="width:220px"><button type="button" class="btn subtle small" id="removeTravelItem">Supprimer</button>`; list.appendChild(row); row.querySelector('#removeTravelItem').onclick=()=>row.remove(); };
}
function resetTravel(){ $('#travelForm').reset(); $('#travelItems').innerHTML=''; }
function fillTravelRows(travelFromDb){
  const t = travelFromDb || { name:'', notes:'', needs:[] };
  // filled at open
}

// ---------- dialogs: loan ----------
function initLoanForm(){
  $('#addLoanBtn').onclick=()=>{ editingLoanId=null; $('#loanDialogTitle').textContent='Nouveau contrat'; refreshLoanOptions(); renderLoans(); resetLoan(); $('#loanDialog').showModal(); };
  $('#closeLoan').onclick=$('#cancelLoan').onclick=()=>$('#loanDialog').close();
  $('#loanForm').onsubmit=e=>{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.currentTarget).entries()); d.items=[]; const rows=$('#loanRows').querySelectorAll('.loan-row'); rows.forEach(r=>{ const itemId=r.dataset.itemId||''; const obj=items.find(x=>x.id===itemId); const name=r.querySelector('.loan-name').value.trim(); if(name){ d.items.push({ itemId, name:obj?.name||name, brand:obj?.brand||'', model:obj?.model||'', qty:Math.max(1,Number(r.querySelector('.loan-qty').value)||1), status:'assigned' }); } });
  const old=loans.find(x=>x.id===editingLoanId); d.id=editingLoanId||uid(); d.status=old?.status||'draft'; d.createdAt=old?.createdAt||new Date().toISOString(); loans=old?loans.map(x=>x.id===d.id?{...old,...d}:x):[...loans,d]; editingLoanId=null; saveAll(); $('#loanDialog').close(); renderLoans(); };
  $('#itemForm').onsubmit=e=>{
    try{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.currentTarget).entries()); if(photoData) d.photo=photoData; const id=editingId||uid(); const old=items.find(x=>x.id===id); d.id=id; d.status=d.status||'stock'; if(!d.externalQr&&old?.externalQr)d.externalQr=old.externalQr; if(!d.photo&&old?.photo)d.photo=old.photo; items=old?items.map(x=>x.id===id?{...x,...d}:x):[...items,d]; editingId=null; photoData=''; saveAll(); $('#itemDialog').close(); render(); refreshLoanOptions(); }
    catch(err){ console.error('itemForm submit ERR',err); alert('Impossible d’enregistrer cette fiche : '+err.message); }
  };
  $('#closeItem').onclick=$('#cancelItem').onclick=()=>{editingId=null;$('#itemDialog').close();}; $('#itemDialog').addEventListener('close',()=>{editingId=null;});
  $('#addKitBtn').onclick=()=>{ $('#kitForm').reset(); $('#kitRows').innerHTML=''; refreshKitOptions(); addKitItemRow(); $('#kitDialog').showModal(); };
  $('#addKitRow').onclick=addKitItemRow;
  $('#closeKit').onclick=$('#cancelKit').onclick=()=>$('#kitDialog').close();
  $('#kitForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries());const selected=[...$('#kitRows').querySelectorAll('.kit-row')].map(r=>({itemId:r.querySelector('.kit-item-select').value,qty:Math.max(1,Number(r.querySelector('.kit-item-qty').value)||1)})).filter(x=>x.itemId);kits.push({id:uid(),name:d.name,location:d.location||'',description:d.description||'',items:selected});saveAll();$('#kitDialog').close();};
  // dynamic rows
  refreshLoanOptions(); $('#loanItemsSelect').onchange=fillLoanRows; $('#loanRows').innerHTML='';
}
function refreshLoanOptions(){ const sel=$('#loanItemsSelect'); if(!sel)return; const selected=new Set([...sel.selectedOptions].map(o=>o.value)); sel.innerHTML=items.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} — ${esc(x.model||x.category||'')}</option>`).join(''); [...sel.options].forEach(o=>o.selected=selected.has(o.value)); }
function refreshKitOptions(){ return items.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} — ${esc(x.model||x.category||'')}</option>`).join(''); }
function addKitItemRow(){const row=document.createElement('div');row.className='kit-row';row.innerHTML=`<select class="kit-item-select" aria-label="Matériel"><option value="">Choisir un matériel…</option>${refreshKitOptions()}</select><input class="kit-item-qty" type="number" min="1" value="1" aria-label="Quantité dans le kit"><button type="button" class="btn subtle small" aria-label="Supprimer la ligne">✕</button>`;row.querySelector('button').onclick=()=>row.remove();$('#kitRows').appendChild(row);}
function openEdit(id){ const x=items.find(i=>i.id===id); if(!x)return; editingId=id; photoData=''; resetForm(); $('#dialogTitle').textContent='Modifier le matériel'; for(const [k,v] of Object.entries(x)){const el=$('#itemForm').elements.namedItem(k);if(el&&el.type!=='file')el.value=v??'';} if(x.photo){$('#photoPreview').src=x.photo;$('#photoPreview').hidden=false;} $('#itemDialog').showModal(); }
function resetLoan(){ $('#loanForm').reset(); $('#loanRows').innerHTML=''; }
function resetForm(){ $('#itemForm').reset(); $('#photoPreview').hidden=true; photoData=''; }
function fillLoanRows(){
  const list=$('#loanRows'); list.innerHTML='';
  const sel=$(`#loanItemsSelect`);
  if(!sel.options.length){ list.innerHTML='<p class="muted small">Ajoute du matériel dans l\'inventaire.</p>'; return; }
  for(const o of sel.options){
    if(o.selected){
      const row=document.createElement('div'); row.className='loan-row'; row.dataset.itemId=o.value;
      row.innerHTML=`<input class="loan-name" value="${esc(o.text)}" disabled style="flex:1"><input class="loan-qty" type="number" min="1" value="1" style="width:80px"><button type="button" class="btn subtle small" id="removeLoanRow">✕</button>`;
      list.appendChild(row);
      row.querySelector('#removeLoanRow').onclick=()=>{ row.remove(); renumberLoanSelected(); };
    }
  }
}
function renumberLoanSelected(){ /* pas besoin */ }

function qrLink(id){ return String(id); }
function makeQR(value){ const qr=new QRCodeLib(0,0); qr.addData(String(value)); qr.make(); const count=qr.getModuleCount(), scale=10, margin=6, canvas=document.createElement('canvas'); canvas.width=canvas.height=(count+margin*2)*scale; const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#111';for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))ctx.fillRect((c+margin)*scale,(r+margin)*scale,scale,scale);return canvas.toDataURL('image/png'); }

// Attach form open/close to public buttons
document.addEventListener('click', async (e)=>{
  const edit=e.target.closest('[data-edit]'); if(edit){ openEdit(edit.dataset.edit); return; }
  const del=e.target.closest('[data-delete]'); if(del){ if(confirm('Supprimer définitivement cette fiche ?')){ items=items.filter(x=>x.id!==del.dataset.delete); kits=kits.map(k=>({...k,items:(k.items||[]).filter(id=>id!==del.dataset.delete)})); saveAll(); } return; }
  const qr=e.target.closest('[data-qr]'); if(qr){ const x=items.find(i=>i.id===qr.dataset.qr); const data=makeQR(qrLink(x.id)); $('#qrTitle').textContent=x.name; $('#qrImage').src=data; $('#qrDialog').showModal(); return; }
  const pr=e.target.closest('[data-print]'); if(pr){ const x=items.find(i=>i.id===pr.dataset.print); printItems([x],true); return; }
  const prl=e.target.closest('[data-printloan]'); if(prl){ const l=loans.find(x=>x.id===prl.dataset.printloan); if(l) printLoan(l); return; }
  const kd=e.target.closest('[data-kit-delete]'); if(kd){ if(confirm('Supprimer ce kit ?')){ kits=kits.filter(k=>k.id!==kd.dataset.kitDelete); saveAll(); } return; }
  const pk=e.target.closest('[data-printkit]'); if(pk){ const k=kits.find(x=>x.id===pk.dataset.printkit); if(k) printKit(k); return; }
  const tq=e.target.closest('[data-travel-qr]'); if(tq){const t=travel.find(x=>x.id===tq.dataset.travelQr);if(t){$('#qrTitle').textContent='Scénario · '+t.name;$('#qrImage').src=makeQR('caverne-alibaab:travel='+t.id);$('#qrDialog').showModal();}return;}
  const td=e.target.closest('[data-travel-edit]'); if(td){ const t=travel.find(x=>x.id===td.dataset.travelEdit); if(t){ editingTravelId=t.id; resetTravel(); $('#travelDialogTitle').textContent='Modifier le scénario'; $('#travelForm').elements.name.value=t.name||''; $('#travelForm').elements.notes.value=t.notes||''; (t.needs||[]).forEach(n=>{ $('#addTravelItem').click(); const r=$('#travelItems').lastElementChild; r.querySelector('.travel-label').value=n.label||''; r.querySelector('.travel-qty').value=n.qty||1; r.querySelector('.travel-notes').value=n.notes||''; }); $('#travelDialog').showModal(); } return; }
  const rev=e.target.closest('[data-travel-delete]'); if(rev){ if(confirm('Supprimer ce scénario ?')){ travel=travel.filter(x=>x.id!==rev.dataset.travelDelete); saveAll(); } return; }
  const ld=e.target.closest('[data-loan-edit]'); if(ld){ const l=loans.find(x=>x.id===ld.dataset.loanEdit); if(l){ editingLoanId=l.id; refreshLoanOptions(); resetLoan(); $('#loanDialogTitle').textContent='Modifier la location'; for(const k of ['client','firstname','contact','startDate','endDate','objectif']) $('#loanForm').elements[k].value=l[k]||''; const sel=$('#loanItemsSelect'); const mapped=(l.items||[]).map(it=>({...it,itemId:it.itemId||items.find(x=>x.name===it.name)?.id||''})); [...sel.options].forEach(o=>o.selected=mapped.some(it=>it.itemId===o.value)); fillLoanRows(); mapped.forEach(it=>{let r=[...$('#loanRows').children].find(row=>row.dataset.itemId===it.itemId);if(!r){r=document.createElement('div');r.className='loan-row';r.dataset.itemId=it.itemId||'';r.innerHTML=`<input class="loan-name" value="${esc(it.name||'Matériel') }" ${it.itemId?'disabled':''} style="flex:1"><input class="loan-qty" type="number" min="1" value="1" style="width:80px"><button type="button" class="btn subtle small">✕</button>`;$('#loanRows').appendChild(r);r.querySelector('button').onclick=()=>r.remove();}r.querySelector('.loan-qty').value=it.qty||1;}); $('#loanDialog').showModal(); } return; }
  const lv=e.target.closest('[data-loan-delete]'); if(lv){ if(confirm('Supprimer cette location ?')){ loans=loans.filter(x=>x.id!==lv.dataset.loanDelete); saveAll(); } return; }
  const dp=e.target.closest('[data-loan-depart]'); if(dp){ const l=loans.find(x=>x.id===dp.dataset.loanDepart); if(l){ populateDeparture(l); $('#departureDialog').showModal(); } return; }
  const lp=e.target.closest('[data-loan-print]'); if(lp){ const l=loans.find(x=>x.id===lp.dataset.loanPrint); if(l) printLoan(l); return; }
});

$('#closeQR')?.addEventListener('click',()=>$('#qrDialog').close());
$('#printQRBtn')?.addEventListener('click',()=>{const w=window.open('','_blank');if(!w)return alert('Autorise les fenêtres surgissantes pour imprimer le QR.');w.document.write(`<!doctype html><html><head><title>${esc($('#qrTitle').textContent)}</title><style>body{font-family:Arial;text-align:center;padding:30px}img{width:420px;height:420px;object-fit:contain;image-rendering:pixelated}h2{font-size:20px}</style></head><body><h2>${esc($('#qrTitle').textContent)}</h2><img src="${$('#qrImage').src}"><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();});

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===t));
  $('#inventoryView').hidden=t.dataset.view!=='inventory';
  $('#kitsView').hidden=t.dataset.view!=='kits';
  $('#tournoisView').hidden=t.dataset.view!=='tournois';
  $('#scannerView').hidden=t.dataset.view!=='scanner'; if(t.dataset.view!=='scanner'&&scannerActive)stopScanner();
  $('#exportsView').hidden=t.dataset.view!=='exports';
});
$('#addBtn').onclick=()=>{ resetForm(); $('#itemDialog').showModal(); }
$('#search').addEventListener('input',renderInventory);$('#statusFilter').addEventListener('change',renderInventory);$('#categoryFilter').addEventListener('change',renderInventory);$('#movementDate').addEventListener('change',renderMovements);

// ---------- exports ----------
$('#csvBtn').onclick=$('#csvBtn2').onclick=csv;
async function backup(){ const json=JSON.stringify({version:1,items,kits,travel,loans,movements,exportedAt:new Date().toISOString()},null,2); const name='caverne-alibaab-sauvegarde.json'; const f=new File([json],name,{type:'application/json'}); if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[f]})){ await navigator.share({files:[f],title:'Sauvegarde La caverne d’Alibaab'}); return; } download(name,json,'application/json'); }
$('#backupBtn').onclick=$('#backupBtn2').onclick=backup;
$('#restoreBtn').onclick=()=>$('#restoreFile').click();
$('#restoreFile').onchange=async e=>{ const f=e.target.files[0]; if(!f)return; try{ const data=JSON.parse(await f.text()); if(!Array.isArray(data.items))throw Error('Fichier non reconnu'); if(confirm('Restaurer cette sauvegarde remplacera les données de cet appareil. Continuer ?')){ items=data.items||[]; kits=data.kits||[]; travel=data.travel||[]; loans=data.loans||[]; movements=data.movements||[]; saveAll(); } }catch(err){ alert('Sauvegarde invalide : '+err.message); } e.target.value=''; };
function download(name,content,type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function csv(){
  const cols=['name','category','brand','model','serial','quantity','status','reason','location','holder','loanDate','dueDate','price','purchaseDate','warranty','condition','notes'];
  const q=v=>'"'+String(v??'').replace(/\"/g,'""')+'"';
  download('caverne-alibaab-inventaire.csv', [
    cols.join(';'),
    ...items.map(x=>cols.map(k=>k==='status'?statusNames[x[k]]:k==='reason'?reasonNames[x[k]]:x[k])).join(';')
  ].join('\r\n'),'text/csv;charset=utf-8');
}
function printItems(list,individual=false){
  const html=list.map(x=>`<article class="sheet"><header><h1>LA CAVERNE D’ALIBAAB</h1><b>FICHE MATÉRIEL</b></header>${x.photo?`<img class="photo" src="${x.photo}">`:''}<h2>${esc(x.name)}</h2><p class="category">${esc(x.category)} · ${statusNames[x.status]}</p><table>${[['Marque',x.brand],['Modèle',x.model],['N° de série',x.serial],['Quantité',x.quantity],['Emplacement',x.location],['Détenteur',x.holder],['Retour prévu',x.dueDate],['Prix d’achat',x.price?x.price+' €':''],['Date d’achat',x.purchaseDate],['Garantie',x.warranty],['État physique',x.condition],['Notes',x.notes]].filter(r=>r[1]).map(r=>`<tr><th>${r[0]}</th><td>${esc(r[1])}</td></tr>`).join('')}</table><p class="serial">Identifiant : ${esc(x.id)}</p></article>`).join('');
  const w=window.open('','_blank'); w.document.write(`<!doctype html><html><head><title>Fiches matériel</title><style>body{font-family:Arial;color:#171a1d;margin:0}.sheet{padding:28px;min-height:95vh;page-break-after:always}.sheet:last-child{page-break-after:auto}header{display:flex;justify-content:space-between;border-bottom:3px solid #e7a72d;padding-bottom:12px}h1{font-size:18px}h2{font-size:30px;margin-bottom:5px}.category{color:#9a6b12}.photo{max-width:300px;max-height:210px;object-fit:contain;margin:20px 0}table{border-collapse:collapse;width:100%;margin-top:22px}th,td{text-align:left;border-bottom:1px solid #ddd;padding:10px}th{width:180px;color:#555}.serial{margin-top:30px;color:#777;font-size:10px}@media print{.sheet{break-after:page}.sheet:last-child{break-after:auto}}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`); w.document.close(); }
function printLoan(loan){
  // Fiche de location : en-tête + équipement préparé avec statut
  const itemsList = loan.items?.map(it=>`<tr><th>${esc(it.name||it.itemId)}</th><td>${it.qty||1}</td><td>${esc(loanItemStatusNames[it.status])}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aucun équipement préparé.</td></tr>';
  const html=`<article class="sheet"><header><h1>LA CAVERNE D’ALIBAAB</h1><b>CONTRAT DE LOCATION / MISE À DISPOSITION</b></header>
    <table class="loan-meta">
      <tr><th>Client</th><td>${esc(loan.client||'—')}</td></tr>
      <tr><th>Prénom</th><td>${esc(loan.firstname||'—')}</td></tr>
      <tr><th>Contact</th><td>${esc(loan.contact||'—')}</td></tr>
      <tr><th>Début</th><td>${esc(loan.startDate||'—')}</td></tr>
      <tr><th>Fin</th><td>${esc(loan.endDate||'—')}</td></tr>
      <tr><th>Objectif</th><td>${esc(loan.objectif||'—')}</td></tr>
      <tr><th>Statut</th><td>${esc(loanStatusNames[loan.status]||'—')}</td></tr>
    </table>
    <table class="loan-items"><tr><th>Équipement</th><th>Qté</th><th>État</th></tr>${itemsList}</table>
    <p class="muted small">${esc(loan.notes||'')}</p><div class="signatures"><div>Signature du loueur<br><br>Date :</div><div>Signature du bénéficiaire<br><br>Date :</div></div>
    <p class="serial">Contrat : ${esc(loan.id)}</p>
  </article>`;
  const w=window.open('','_blank'); w.document.write(`<!doctype html><html><head><title>Fiche location</title><style>body{font-family:Arial;color:#171a1d;margin:0}.sheet{padding:28px;min-height:95vh;page-break-after:always}.sheet:last-child{page-break-after:auto}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{text-align:left;border-bottom:1px solid #ddd;padding:10px;border-collapse:collapse}th{width:180px;color:#555}.serial{margin-top:30px;color:#777;font-size:10px}.loan-meta th{display:none} @media print{.sheet{break-after:page}.sheet:last-child{break-after:auto}}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`); w.document.close(); }
function printKit(kit){
  const itemsList = kitEntries(kit).map(entry=>{ const x=items.find(i=>i.id===entry.itemId); if(!x) return `<tr><th>?</th><td>${entry.qty}</td><td>Supprimé</td><td>—</td></tr>`; return `<tr><th>${esc(x.name)}</th><td>${entry.qty}</td><td>${x.location?esc(x.location):'—'}</td><td>${esc(x.holder||'')}</td></tr>`; }).join('');
  const html=`<article class="sheet"><header><h1>LA CAVERNE D’ALIBAAB</h1><b>FICHE PAR SAC</b><h2 style="margin:0">${esc(kit.name)}</h2></header>
    <p class="category">${esc(kit.location||'—')}</p>
    ${kit.description?`<p class="notes">${esc(kit.description)}</p>`:''}
    <table class="loan-items"><tr><th>Équipement</th><th>Qté</th><th>Emplacement</th><th>Avec</th></tr>${itemsList}</table>
    <p class="serial">Identifiant : ${esc(kit.id)}</p>
  </article>`;
  const w=window.open('','_blank'); w.document.write(`<!doctype html><html><head><title>Fiche par sac</title><style>body{font-family:Arial;color:#171a1d;margin:0}.sheet{padding:28px;min-height:95vh;page-break-after:always}.sheet:last-child{page-break-after:auto}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{text-align:left;border-bottom:1px solid #ddd;padding:10px;border-collapse:collapse}th{width:180px;color:#555}.serial{margin-top:30px;color:#777;font-size:10px} @media print{.sheet{break-after:page}.sheet:last-child{break-after:auto}}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`); w.document.close(); }
$('#printAllBtn').onclick=()=>printItems(items);
$('#printEachBtn').onclick=()=>printItems(items,true);
$('#printKitsBtn').onclick=()=>{ if(!kits.length)return alert('Aucun sac ou kit.'); kits.forEach(k=>printKit(k)); };
$('#printDepartBtn').onclick=()=>{ if(departureQueue.length){ populateDeparture(); $('#departureDialog').showModal(); } else alert('Ajoute des objets en mode DÉPART, puis valide.'); };

// ---------- departure: scan queue + contract handover ----------
let departureLoan = null;
function populateDeparture(loan){
  departureLoan=loan||null;
  const box=$('#departureItems'); box.innerHTML='';
  const src=loan?.items?.length?loan.items:departureQueue;
  $('#departureTitle').textContent=loan?`Départ · ${loan.client||''} ${loan.firstname||''}`:'Départ — validation du matériel scanné';
  src.forEach(it=>{
    const row=document.createElement('div'); row.className='depart-row'; row.dataset.itemId=it.itemId||'';
    row.innerHTML=`<input type="checkbox" class="departCheck" checked><input type="text" class="departName" value="${esc(it.name||it.itemId)}" readonly><input type="number" class="departQty" min="1" value="${Math.max(1,Number(it.qty)||1)}"><select class="departStatus"><option value="departed" selected>À sortir</option><option value="returned">Déjà rendu</option></select>`;
    box.appendChild(row);
  });
  $('#departureCount').textContent=src.length;
}
$('#validateDeparture').onclick=()=>{
  const rows=[...$('#departureItems').querySelectorAll('.depart-row')];
  const selected=rows.filter(r=>r.querySelector('.departCheck').checked).map(r=>({itemId:r.dataset.itemId,name:r.querySelector('.departName').value,qty:Math.max(1,Number(r.querySelector('.departQty').value)||1),status:r.querySelector('.departStatus').value}));
  if(!selected.length)return alert('Sélectionne au moins un objet.');
  const date=new Date().toISOString().slice(0,10), client=departureLoan?`${departureLoan.client||''} ${departureLoan.firstname||''}`.trim():'Départ manuel';
  selected.forEach(s=>{
    const obj=items.find(x=>x.id===s.itemId);
    if(obj&&s.status==='departed'){ obj.status='loaned'; obj.holder=client; obj.loanDate=departureLoan?.startDate||date; obj.dueDate=departureLoan?.endDate||''; }
    movements.push({id:uid(),date,type:'departure',itemId:s.itemId||null,itemName:s.name,qty:s.qty,holder:client,note:departureLoan?`Location ${departureLoan.id}`:'Départ scanné'});
  });
  if(departureLoan){
    departureLoan.items=(departureLoan.items||[]).map(it=>{const found=selected.find(s=>s.itemId&&s.itemId===it.itemId); return found?{...it,status:'departed'}:it;});
    departureLoan.status='departed';
  }
  saveAll();
  const html=generateDeparturePDF(client,'—',date,selected,'Vérifier le matériel au retour.',departureLoan);
  const w=window.open('','_blank'); if(w){w.document.write(html);w.document.close();} else alert('Autorise les fenêtres surgissantes pour imprimer le PDF.');
  departureQueue=[]; departureLoan=null; $('#departureDialog').close(); render();
};
function generateDeparturePDF(client,lieu,date,selected,note,loan){
  const rows=selected.map(s=>`<tr><td>${esc(s.name)}</td><td>${s.qty}</td><td>${s.status==='departed'?'Sorti':'Non sorti'}</td></tr>`).join('');
  const html=`<article class="sheet"><header><h1>LA CAVERNE D’ALIBAAB</h1><b>BORDEREAU DE MISE À DISPOSITION</b></header><table class="loan-meta"><tr><th>Client</th><td>${esc(client)}</td></tr><tr><th>Contact</th><td>${esc(loan?.contact||'—')}</td></tr><tr><th>Début</th><td>${esc(loan?.startDate||date)}</td></tr><tr><th>Fin prévue</th><td>${esc(loan?.endDate||'—')}</td></tr><tr><th>Objet</th><td>${esc(loan?.objectif||'—')}</td></tr><tr><th>Date de départ</th><td>${esc(date)}</td></tr></table><table class="loan-items"><tr><th>Matériel</th><th>Qté</th><th>Contrôle</th></tr>${rows}</table><p>${esc(note||'')}</p><div class="signatures"><div>Signature du loueur</div><div>Signature du bénéficiaire</div></div><p class="serial">Contrat : ${esc(loan?.id||'Départ manuel')} · Généré le ${esc(date)}</p></article>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bordereau de départ</title><style>body{font-family:Arial;color:#171a1d;margin:0}.sheet{padding:32px;max-width:900px;margin:auto}header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #e7a72d;padding-bottom:12px}h1{font-size:19px}table{border-collapse:collapse;width:100%;margin:18px 0}th,td{text-align:left;padding:11px;border-bottom:1px solid #ddd}.loan-meta th{width:180px}.signatures{display:flex;gap:50px;margin-top:70px}.signatures div{border-top:1px solid #555;padding-top:8px;flex:1;min-height:55px}.serial{font-size:10px;color:#777;margin-top:35px}@media print{.sheet{padding:18mm}}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`;
}
$('#printDepartBtn').onclick=()=>{ if(departureQueue.length){populateDeparture();$('#departureDialog').showModal();} else alert('Scanne des objets en mode DÉPART avant de valider.'); };
$('#closeDeparture').onclick=$('#cancelDeparture').onclick=()=>$('#departureDialog').close();

// ---------- scanner ----------
let scanner=null, scannerMode='scan', scannerActive=false;
function initScanner(){
  document.querySelectorAll('.mode-btn[data-mode]').forEach(b=>b.onclick=()=>setScannerMode(b.dataset.mode));
  $('#scanToggle').onclick=()=>scannerActive?stopScanner():startScanner();
}
function setScannerMode(mode){
  scannerMode=mode;
  document.querySelectorAll('.mode-btn[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  const labels={scan:'Scanner un QR de garantie ou une étiquette pour associer / ouvrir une fiche.',depart:'Scanner les équipements à sortir : ils seront ajoutés à une liste à valider.',return:'Scanner les équipements rendus : leur statut repassera en stock.'};
  $('#scanModeLabel').textContent=labels[mode]||'';
}
async function startScanner(){
  if(scannerActive)return;
  $('#scanContainer').hidden=false; $('#scanError').hidden=true;
  try{
    scanner=new Html5Qrcode('scanContainer');
    await scanner.start({facingMode:'environment'},{fps:10,qrbox:(w,h)=>({width:Math.min(260,w-30),height:Math.min(260,h-30)}),aspectRatio:1.0},onScanSuccess,()=>{});
    scannerActive=true; $('#scanToggle').textContent='Arrêter la caméra'; $('#scanStatus').textContent='Caméra prête.';
  }catch(err){ scanner=null; $('#scanError').textContent='Impossible de lancer la caméra. Sur iPhone, ouvre l’app depuis Safari ou l’écran d’accueil et autorise l’accès à la caméra. '+(err?.message||''); $('#scanError').hidden=false; }
}
async function stopScanner(){
  if(scanner){try{if(scannerActive)await scanner.stop();scanner.clear();}catch(e){} scanner=null;}
  scannerActive=false; $('#scanContainer').hidden=true; $('#scanToggle').textContent='Lancer la caméra ▸';
}
function findItemByScannedCode(value){
  const code=String(value||'').trim();
  return items.find(x=>x.id===parseItemFromScannedText(code)||x.qrCode===code||x.serial===code||x.barcode===code||x.externalQr===code);
}
function scanFeedback(){try{if(navigator.vibrate)navigator.vibrate(90);const Ctx=window.AudioContext||window.webkitAudioContext;if(Ctx){const ctx=new Ctx(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=880;gain.gain.value=.045;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.09);osc.onended=()=>ctx.close();}}catch(e){}}
function onScanSuccess(decodedText){
  const safe=String(decodedText||'').trim(), now=Date.now();
  if(!safe||(safe===lastScanValue&&now-lastScanAt<1800))return;
  lastScanValue=safe;lastScanAt=now;
  const label=$('#scanStatus');
  if(scannerMode==='scan'){
    const travelId=parseTravelFromScannedText(safe), scenario=travel.find(t=>t.id===travelId);
    if(scenario){const missing=[];let added=0;(scenario.needs||[]).forEach(n=>{const found=items.find(i=>[i.name,i.brand+' '+i.model].some(v=>v&&v.toLowerCase().includes(String(n.label||'').toLowerCase()))||String(n.label||'').toLowerCase().includes(i.name.toLowerCase()));if(found&&!departureQueue.some(q=>q.itemId===found.id)){departureQueue.push({itemId:found.id,name:found.name,qty:n.qty||1,status:'assigned'});added++;}else if(!found)missing.push(n.label);});label.textContent=`Scénario « ${scenario.name} » : ${added} équipement(s) ajouté(s) à la préparation.`;$('#scanResults').innerHTML=`<p><strong>${scenario.name}</strong> · ${added} ajouté(s)${missing.length?' · '+missing.length+' besoin(s) à associer':''}</p><button class="btn primary" id="openDepartureQueue">Vérifier la préparation</button>`;$('#openDepartureQueue').onclick=()=>{populateDeparture();$('#departureDialog').showModal();};addScanLog('Scénario : '+scenario.name,'ok');return;}
  }
  const x=findItemByScannedCode(safe);
  if(scannerMode==='scan'){
    if(x){scanFeedback();openEdit(x.id);label.textContent=`Fiche ouverte : ${x.name}`;addScanLog('✓ '+x.name,'ok');}
    else {
      const choice=prompt('QR code reconnu mais non associé.\nColle ce code dans la fiche d’un matériel existant ou saisis le nom du matériel à créer.\n\nCode : '+safe+'\n\nNom du matériel (laisser vide pour ignorer) :');
      if(choice){const name=choice.trim();if(name){const existing=items.find(i=>i.name.toLowerCase()===name.toLowerCase());if(existing){existing.externalQr=safe;saveAll();label.textContent=`QR associé à ${existing.name}`;addScanLog('QR associé : '+existing.name,'ok');}else{if(confirm(`Créer une fiche « ${name} » avec ce QR ?`)){editingId=null;resetForm();$('#itemForm').elements.name.value=name;$('#itemForm').elements.externalQr.value=safe;$('#itemDialog').showModal();}}}}
      else {label.textContent='QR mémorisé non associé : '+safe.slice(0,70);addScanLog('? '+safe.slice(0,70),'unknown');}
    }
  }else if(scannerMode==='depart'){
    if(!x){label.textContent='QR non associé à un équipement. Passe en mode SCAN pour l’associer.';addScanLog('? '+safe.slice(0,60),'unknown');return;}
    const queued=departureQueue.find(q=>q.itemId===x.id);if(queued){queued.qty=Math.min(Math.max(1,Number(x.quantity)||1),Number(queued.qty||1)+1);}else departureQueue.push({itemId:x.id,name:x.name,qty:1,status:'assigned'});scanFeedback();label.textContent=`✓ ${x.name} · ${queued?'quantité scannée mise à jour':'ajouté à la liste'} (${queued?.qty||1} / ${Math.max(1,Number(x.quantity)||1)}).`;addScanLog('+ '+x.name+' · '+(queued?.qty||1)+' scanné(s)','ok');
    $('#scanResults').innerHTML=`<p><strong>${departureQueue.length}</strong> matériel(s) dans la liste de départ.</p><button class="btn primary" id="openDepartureQueue">Vérifier et valider le départ</button>`;
    $('#openDepartureQueue').onclick=()=>{populateDeparture();$('#departureDialog').showModal();};
  }else if(scannerMode==='return'){
    if(!x){label.textContent='QR non associé à un équipement.';return;}
    scanFeedback();
    const previousHolder=x.holder||'';x.status='stock';x.holder='';x.dueDate='';x.loanDate='';
    loans.forEach(l=>{(l.items||[]).forEach(it=>{if(it.itemId===x.id)it.status='returned';});if((l.items||[]).length&&l.items.every(it=>it.status==='returned'))l.status='returned';});
    movements.push({id:uid(),date:new Date().toISOString().slice(0,10),type:'return',itemId:x.id,itemName:x.name,qty:1,holder:previousHolder,note:'Retour validé par scanner'});
    saveAll();label.textContent=`↩ ${x.name} rendu en stock.`;addScanLog('↩ '+x.name,'ok');
  }
}
function addScanLog(label,kind){const ul=$('#scanLog');const li=document.createElement('li');li.className=kind||'';li.textContent=label;ul.prepend(li);while(ul.children.length>20)ul.lastElementChild.remove();}
function parseTravelFromScannedText(text){const m=String(text||'').match(/(?:caverne-alibaab:travel=|travel=)([^\s&]+)/i);return m?decodeURIComponent(m[1]):null;}
function parseItemFromScannedText(text){
  const s=String(text||'').trim();
  const patterns=[/#item=([^&]+)/i,/(?:caverne-alibaab:item=|item=)([^\s&]+)/i,/\/item\/([a-z0-9-]{8,64})/i];
  for(const re of patterns){const m=s.match(re);if(m)return decodeURIComponent(m[1]);}
  return /^[a-z0-9-]{8,64}$/i.test(s)?s:null;
}

$('#photo').onchange=async e=>{
  const f=e.target.files[0]; if(!f)return;
  try{ photoData=await compressImage(f); $('#photoPreview').src=photoData; $('#photoPreview').hidden=false; }
  catch(e){ alert("Impossible de lire l'image."); }
};
// "Rechercher le matériel à partir de la photo" (opçãonel — OCR en français needs network)
document.addEventListener('click', e=>{
  const btn=e.target.closest('#photoSearchBtn');
  if(btn){ e.preventDefault(); runOcrAndSearch(); }
});
async function runOcrAndSearch(){
  const input=$('#photo'); const f=input.files[0]; if(!f){ alert('Prends d\'abord une photo.'); return; }
  const box=$('#ocrBox'); box.hidden=false; box.textContent='Lecture en cours (moteur OCR, besoin du réseau)…';
  let txt='';
  try{
    const mod=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    const Tesseract=mod.default || mod.Tesseract;
    const worker=await Tesseract.createWorker('fra');
    const result=await worker.recognize(f); txt=result.data;
    await worker.terminate();
  }catch(err){
    box.textContent='OCR indisponible (réseau). Retour à la recherche textuelle.';
  }
  if(txt){
    const raw=String(txt.text||''); const words=raw.split(/\s+/).filter(w=>w.length>2);
    let cands=[];
    words.forEach(w=>{ const re=new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'); items.forEach(x=>{ if(re.test(x.name||'')||re.test(x.model||'')||re.test(x.brand||'')||re.test(x.serial||'')) cands.push(x); }); });
    cands=[...new Map(cands.map(x=>[x.id,x])).values()];
    if(cands.length){
      const pick=prompt('Matériel correspondant à la photo :\n'+cands.map((x,i)=>`${i+1}. ${x.name} — ${x.brand||''} ${x.model||''}`).join('\n')+'\n\nNuméro de la fiche à reprendre (ou annuler pour lire la plaque) :');
      if(pick!=null && /^\d+$/.test(pick)&&Number(pick)>=1&&Number(pick)<=cands.length){ const x=cands[Number(pick)-1]; for(const [k,v] of Object.entries({name:x.name,brand:x.brand||'',model:x.model||'',serial:x.serial||'',category:x.category||'Autre'})){const el=$('#itemForm').elements.namedItem(k);if(el)el.value=v;} box.textContent='Informations de la fiche reprises. Vérifie-les avant enregistrement.'; return; }
    }
    const lines=raw.split(/\n+/).map(x=>x.trim()).filter(x=>x.length>2);
    const brands=['Sony','Canon','Panasonic','Blackmagic','RED','ARRI','Nikon','Fujifilm','DJI','Sennheiser','Rode','Shure','Zoom','Apple','Aputure','Godox','Nanlite','Manfrotto','Sigma','Tamron'];
    const brand=brands.find(b=>new RegExp('\\b'+b+'\\b','i').test(raw))||'';
    const serialMatch=raw.match(/(?:S\/?N|SERIAL|SER\.?NO|N°\s*SÉRIE|Nº\s*SÉRIE)\s*[:#-]?\s*([A-Z0-9-]{5,})/i)||raw.match(/\b[A-Z0-9]{2,}[-][A-Z0-9-]{3,}\b/);
    const modelLine=lines.find(line=>brand&&new RegExp(brand,'i').test(line))||lines.find(line=>/[A-Z]/.test(line)&&/\d/.test(line))||'';
    const model=modelLine.replace(new RegExp(brand,'i'),'').replace(/[^A-Z0-9 ._-]/gi,' ').trim().slice(0,50);
    const nameEl=$('#itemForm').elements.namedItem('name'),brandEl=$('#itemForm').elements.namedItem('brand'),modelEl=$('#itemForm').elements.namedItem('model'),serialEl=$('#itemForm').elements.namedItem('serial');
    if(brand&&!brandEl.value)brandEl.value=brand;if(model&&!modelEl.value)modelEl.value=model;if(serialMatch&&!serialEl.value)serialEl.value=serialMatch[1]||serialMatch[0];if(!nameEl.value&&brand)nameEl.value=[brand,model].filter(Boolean).join(' ');
    box.textContent=brand||model||serialMatch?'Lecture proposée : vérifie les champs préremplis, car l’OCR peut se tromper.':'Aucune information exploitable détectée. Saisis les champs manuellement.';
  } else { box.textContent='Aucun texte lu.'; }
}

// ---------- cloud synchronization (Supabase REST, optional) ----------
const SYNC_KEY='caverne_alibaab_supabase_config', SESSION_KEY='caverne_alibaab_supabase_session';
function getSyncConfig(){try{return JSON.parse(localStorage.getItem(SYNC_KEY)||'{}');}catch(e){return {};}}
function getSyncSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch(e){return null;}}
async function ensureSyncSession(cfg){let session=getSyncSession();if(!session?.access_token)return null;const expiry=Number(session.expires_at||0);if(expiry&&expiry>Date.now()/1000+90)return session;if(!session.refresh_token)return session;const r=await fetch(cfg.url.replace(/\/$/,'')+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok)return session;session=await r.json();localStorage.setItem(SESSION_KEY,JSON.stringify(session));return session;}
function setSyncStatus(msg,ok=false){const el=$('#syncStatus');if(el){el.textContent=msg;el.classList.toggle('sync-ok',ok);}}
function applyState(data){items=data.items||[];kits=data.kits||[];travel=data.travel||[];loans=data.loans||[];movements=data.movements||[];stateUpdatedAt=data.updatedAt||new Date().toISOString();idb.set('state',{items,kits,travel,loans,movements,updatedAt:stateUpdatedAt}).catch(()=>{});render();refreshLoanOptions();}
function snapshot(){return {items,kits,travel,loans,movements,updatedAt:stateUpdatedAt};}
async function syncNow(direction='auto'){
  const cfg=getSyncConfig(); if(!cfg.url||!cfg.key){setSyncStatus('Configure Supabase pour activer la synchronisation.');return;}
  const base=cfg.url.replace(/\/$/,'')+'/rest/v1/caverne_state';
  let session=await ensureSyncSession(cfg); if(!session?.access_token){setSyncStatus('Connecte-toi au compte Supabase sur cet appareil.');return;}
  const headers={'apikey':cfg.key,'Authorization':'Bearer '+session.access_token,'Content-Type':'application/json','Accept':'application/json','Prefer':'resolution=merge-duplicates,return=representation'};
  try{
    const response=await fetch(base+'?owner_id=eq.'+encodeURIComponent(session.user.id)+'&select=*',{headers});if(response.status===401){setSyncStatus('Session expirée : reconnecte-toi.');return;}if(!response.ok)throw Error('Lecture Supabase : HTTP '+response.status);
    const rows=await response.json(), local=snapshot(), remote=rows[0];
    if(direction==='pull'){
      if(!remote)throw Error('Aucune sauvegarde distante. Fais une première synchronisation dans le sens « Envoyer ».');
      if(!confirm('Remplacer les données de cet appareil par la version en ligne ?'))return;
      applyState(remote.payload||{});setSyncStatus('Données récupérées depuis Supabase.',true);return;
    }
    if(direction==='push'){
      if(!confirm('Envoyer les données de cet appareil vers la base partagée ?'))return;
      const r=await fetch(base,{method:'POST',headers,body:JSON.stringify({owner_id:session.user.id,payload:local,updated_at:local.updatedAt})});if(!r.ok)throw Error('Écriture Supabase : HTTP '+r.status);
      setSyncStatus('Synchronisation envoyée avec succès.',true);return;
    }
    if(remote&&remote.payload){const rt=Date.parse(remote.payload.updatedAt||remote.updated_at||0),lt=Date.parse(local.updatedAt||0);if(rt>lt){applyState(remote.payload);setSyncStatus('Version en ligne récupérée.',true);return;}if(rt===lt){setSyncStatus('Déjà synchronisé · '+new Date().toLocaleTimeString('fr-FR'),true);return;}}
    const r=await fetch(base,{method:'POST',headers,body:JSON.stringify({owner_id:session.user.id,payload:local,updated_at:local.updatedAt})});if(!r.ok)throw Error('Écriture Supabase : HTTP '+r.status);
    setSyncStatus('Synchronisé · '+new Date().toLocaleTimeString('fr-FR'),true);
  }catch(err){setSyncStatus('Synchronisation impossible : '+err.message);}
}
$('#saveSyncConfig').onclick=()=>{const url=$('#supabaseUrl').value.trim(),key=$('#supabaseKey').value.trim();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!key){alert('Vérifie l’URL du projet et la clé anon/public.');return;}localStorage.setItem(SYNC_KEY,JSON.stringify({url,key}));setSyncStatus('Projet enregistré. Connecte-toi avec ton compte partagé.');};
$('#syncPush').onclick=()=>syncNow('push');$('#syncPull').onclick=()=>syncNow('pull');$('#syncNow').onclick=()=>syncNow('auto');
async function authSupabase(mode){const cfg=getSyncConfig();if(!cfg.url||!cfg.key){alert('Enregistre d’abord l’URL et la clé Supabase.');return;}const email=$('#syncEmail').value.trim(),password=$('#syncPassword').value;if(!email||!password){alert('Saisis ton e-mail et ton mot de passe.');return;}try{const endpoint=mode==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';const r=await fetch(cfg.url.replace(/\/$/,'')+endpoint,{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const data=await r.json();if(!r.ok)throw Error(data.msg||data.message||data.error_description||'Authentification refusée');if(data.access_token){localStorage.setItem(SESSION_KEY,JSON.stringify(data));setSyncStatus('Connecté : '+email,true);await syncNow('auto');}else setSyncStatus('Compte créé. Vérifie ton e-mail si la confirmation est activée.');}catch(err){setSyncStatus('Connexion impossible : '+err.message);}}
$('#syncSignUp').onclick=()=>authSupabase('signup');$('#syncSignIn').onclick=()=>authSupabase('signin');$('#syncSignOut').onclick=()=>{localStorage.removeItem(SESSION_KEY);setSyncStatus('Déconnecté de Supabase.');};
const syncCfg=getSyncConfig();if($('#supabaseUrl'))$('#supabaseUrl').value=syncCfg.url||'';if($('#supabaseKey'))$('#supabaseKey').value=syncCfg.key||'';
window.addEventListener('online',()=>syncNow('auto'));window.addEventListener('focus',()=>{if(getSyncConfig().url)syncNow('auto');});
setInterval(()=>{if(getSyncConfig().url&&navigator.onLine)syncNow('auto');},60000);
// Legacy JSON URL import remains available
$('#importUrlBtn').onclick=async ()=>{const url=$('#importUrl').value.trim();if(!url){alert('URL invalide.');return;}$('#importNote').textContent='Récupération…';try{const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!Array.isArray(data.items))throw Error('Fichier JSON non reconnu.');if(!confirm('Remplacer les données locales par ce fichier ?'))return;applyState(data);$('#importNote').textContent='Import terminé : '+items.length+' équipements.';}catch(err){$('#importNote').textContent='Erreur : '+err.message;}};
$('#importFileBtn').onclick=()=>$('#importFile').click();
$('#importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data.items))throw Error('Fichier invalide.');if(!confirm('Remplacer les données locales par cette sauvegarde ?'))return;applyState(data);$('#importNote').textContent='Import terminé.';}catch(err){alert('Fichier invalide : '+err.message);}e.target.value='';};

// ---------- bootstrap: ensure buttons used by event delegation exist ----------
document.addEventListener('DOMContentLoaded', ()=>{
  // no-op (boot already bound)
});

// expose for console debugging
window.__alibaab = { items, kits, travel, loans, movements, scannerMode, departureQueue };
