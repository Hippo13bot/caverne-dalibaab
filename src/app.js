const $ = (s) => document.querySelector(s);
const STORES = {
  items: 'caverne_alibaab_inventory_v1',
  kits: 'caverne_alibaab_kits_v1',
  travel: 'caverne_alibaab_travel_v1',
  loans: 'caverne_alibaab_loans_v1',
  movements: 'caverne_alibaab_movements_v1'
};
let items = [], kits = [], travel = [], loans = [], movements = [];
let editingId = null, photoData = '';
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
  idb.set('state.items', items).catch(()=>alert("Enregistrement impossible : espace de stockage plein ? Fais une sauvegarde."));
  idb.set('state.kits', kits); idb.set('state.travel', travel); idb.set('state.loans', loans); idb.set('state.movements', movements);
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
      const oldItems = JSON.parse(localStorage.getItem(STORES.items) || '[]');
      const oldKits  = JSON.parse(localStorage.getItem(STORES.kits) || '[]');
      st = { items: oldItems, kits: oldKits, travel: [], loans: [], movements: [] };
      if (oldItems.length || oldKits.length) await idb.set('state', st);
    }
    items = st.items || [];
    kits  = st.kits || [];
    travel = st.travel || [];
    loans = st.loans || [];
    movements = st.movements || [];
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
  $('#statTotal').textContent = items.length;
  $('#statStock').textContent = items.filter(x=>x.status==='stock').length;
  $('#statLoaned').textContent = items.filter(x=>x.status==='loaned').length;
  $('#statUnavailable').textContent = items.filter(x=>x.status==='unavailable').length;
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
  $('#count').textContent=`${filtered.length} équipement(s)`;
  $('#inventory').innerHTML=filtered.length?filtered.map(x=>`<article class="item-card">${x.photo?`<img src="${x.photo}" alt="">`:''}<div class="item-meta"><span class="pill">${esc(x.category)}</span><span class="pill ${esc(x.status)}">${statusNames[x.status]}</span></div><h3>${esc(x.name)}</h3><p>${esc([x.brand,x.model].filter(Boolean).join(' · ')||'Modèle non renseigné')}<br>${x.serial?'N° série : '+esc(x.serial):'Sans numéro de série'}<br>${x.location?'Emplacement : '+esc(x.location):'Emplacement non renseigné'}${x.holder?'<br>Avec : '+esc(x.holder):''}${x.dueDate?'<br>Retour prévu : '+esc(x.dueDate):''}${x.status==='unavailable'&&x.reason?'<br>'+reasonNames[x.reason]:''}</p><div class="card-actions"><button class="btn subtle" data-edit="${x.id}">Modifier</button><button class="btn subtle" data-qr="${x.id}">QR code</button><button class="btn subtle" data-print="${x.id}">Fiche PDF</button><button class="btn subtle" data-printloan="${x.id}">Fiche location</button><button class="btn subtle" data-delete="${x.id}">Supprimer</button></div></article>`).join(''):'<div class="empty">Aucun équipement correspondant. Ajoute ton matériel.</div>';
}
function renderKits(){
  $('#kits').innerHTML=kits.length?kits.map(k=>`<article class="item-card"><div class="item-meta"><span class="pill">SAC / KIT</span><span class="pill">${(k.items||[]).length} élément(s)</span></div><h3>${esc(k.name)}</h3><p>${esc(k.location||'Emplacement non renseigné')}<br>${esc(k.description||'')}<br>${(k.items||[]).map(id=>items.find(x=>x.id===id)?.name).filter(Boolean).map(esc).join(' · ')}</p><div class="card-actions"><button class="btn subtle" data-kit-delete="${k.id}">Supprimer le kit</button><button class="btn subtle" data-printkit="${k.id}">Fiche par sac</button></div></article>`).join('') : '<div class="empty">Aucun sac ou kit. Crée un kit pour regrouper ton matériel.</div>';
}
function renderTravel(){
  const list=$('#travelList');
  if(!travel.length){ list.innerHTML='<p class="muted small">Aucun scénario. Crée un « mat d\'emats » pour te préparer une journée.</p>'; return; }
  list.innerHTML = travel.map(t=>`<article class="item-card travel-card"><div class="item-meta"><span class="pill">TOURNAGE</span><span class="pill ${esc(t.status||'draft')}">${esc(travelStatusNames[t.status||'draft'])}</span></div><div><h3>${esc(t.name)}</h3><p>${esc(t.notes||'')}</p></div><div class="card-actions"><button class="btn subtle" data-travel-edit="${t.id}">Éditer</button><button class="btn subtle" data-travel-delete="${t.id}">Supprimer</button></div></article>`).join('');
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
  const d=$('#movementDate').value;
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
  $('#addTravelBtn').onclick=()=>{ renderTravel(); resetTravel(); $('#travelDialog').showModal(); };
  $('#closeTravel').onclick=$('#cancelTravel').onclick=()=>$('#travelDialog').close();
  $('#travelForm').onsubmit=e=>{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.currentTarget).entries()); d.needs=[]; const rows=$('#travelItems').querySelectorAll('.travel-row'); if(rows.length){ rows.forEach(r=>{ const label=r.querySelector('.travel-label').value.trim(); if(label){ d.needs.push({ label, qty: Math.max(1, Number(r.querySelector('.travel-qty').value)||1), notes: (r.querySelector('.travel-notes')||'').value.trim() }); } }); }
  d.id=uid(); d.status='draft'; travel.push(d); saveAll(); $('#travelDialog').close(); renderTravel(); };
  $('#addTravelItem').onclick=()=>{ const list=document.getElementById('travelItems'); const row=document.createElement('div'); row.className='travel-row'; row.innerHTML=`<input class="travel-label" placeholder="Ex. : Canon FX3 + 2 objectifs" style="flex:1"><input class="travel-qty" type="number" min="1" value="1" style="width:80px"><input class="travel-notes" placeholder="Requis / commentaire" style="width:220px"><button type="button" class="btn subtle small" id="removeTravelItem">Supprimer</button>`; list.appendChild(row); row.querySelector('#removeTravelItem').onclick=()=>row.remove(); };
}
function resetTravel(){ $('#travelForm').reset(); $('#travelItems').innerHTML=''; }
function fillTravelRows(travelFromDb){
  const t = travelFromDb || { name:'', notes:'', needs:[] };
  // filled at open
}

// ---------- dialogs: loan ----------
function initLoanForm(){
  $('#addLoanBtn').onclick=()=>{ renderLoans(); resetLoan(); $('#loanDialog').showModal(); };
  $('#closeLoan').onclick=$('#cancelLoan').onclick=()=>$('#loanDialog').close();
  $('#loanForm').onsubmit=e=>{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.currentTarget).entries()); d.items=[]; const rows=$('#loanRows').querySelectorAll('.loan-row'); if(rows.length){ rows.forEach(r=>{ const name=r.querySelector('.loan-name').value.trim(); if(name){ d.items.push({ name, brand:'', model:'', qty: Math.max(1,Number(r.querySelector('.loan-qty').value)||1), status:'assigned' }); } }); }
  d.id=uid(); d.status='draft'; loans.push(d); saveAll(); $('#loanDialog').close(); renderLoans(); };
  $('#itemForm').onsubmit=e=>{
    try{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.currentTarget).entries()); if(photoData) d.photo=photoData; d.id=uid(); d.status=d.status||'stock'; items.push(d); saveAll(); $('#itemDialog').close(); render(); }
    catch(err){ console.error('itemForm submit ERR', err); }
  };
  // dynamic rows
  const source = ()=> items.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} — ${esc(x.model||x.category)}</option>`).join('');
  $('#loanItemsSelect').innerHTML = source();
  // placeholder toggle: we keep the static select but will populate via JS at open; keep both selectors
}
function resetLoan(){ $('#loanForm').reset(); $('#loanRows').innerHTML=''; }
function resetForm(){ $('#itemForm').reset(); $('#photoPreview').hidden=true; }
function fillLoanRows(){
  const list=$('#loanRows'); list.innerHTML='';
  const sel=$(`#loanItemsSelect`);
  if(!sel.options.length){ list.innerHTML='<p class="muted small">Ajoute du matériel dans l\'inventaire.</p>'; return; }
  for(const o of sel.options){
    if(o.selected){
      const row=document.createElement('div'); row.className='loan-row';
      row.innerHTML=`<input class="loan-name" value="${esc(o.text)}" disabled style="flex:1"><input class="loan-qty" type="number" min="1" value="1" style="width:80px"><button type="button" class="btn subtle small" id="removeLoanRow">✕</button>`;
      list.appendChild(row);
      row.querySelector('#removeLoanRow').onclick=()=>{ row.remove(); renumberLoanSelected(); };
    }
  }
}
function renumberLoanSelected(){ /* pas besoin */ }

// Attach form open/close to public buttons
document.addEventListener('click', async (e)=>{
  const edit=e.target.closest('[data-edit]'); if(edit){ openEdit(edit.dataset.edit); return; }
  const del=e.target.closest('[data-delete]'); if(del){ if(confirm('Supprimer définitivement cette fiche ?')){ items=items.filter(x=>x.id!==del.dataset.delete); kits=kits.map(k=>({...k,items:(k.items||[]).filter(id=>id!==del.dataset.delete)})); saveAll(); } return; }
  const qr=e.target.closest('[data-qr]'); if(qr){ const x=items.find(i=>i.id===qr.dataset.qr); const data=makeQR(qrLink(x.id)); $('#qrTitle').textContent=x.name; $('#qrImage').src=data; $('#qrDialog').showModal(); return; }
  const pr=e.target.closest('[data-print]'); if(pr){ const x=items.find(i=>i.id===pr.dataset.print); printItems([x],true); return; }
  const prl=e.target.closest('[data-printloan]'); if(prl){ const l=loans.find(x=>x.id===prl.dataset.printloan); if(l) printLoan(l); return; }
  const kd=e.target.closest('[data-kit-delete]'); if(kd){ if(confirm('Supprimer ce kit ?')){ kits=kits.filter(k=>k.id!==kd.dataset.kitDelete); saveAll(); } return; }
  const pk=e.target.closest('[data-printkit]'); if(pk){ const k=kits.find(x=>x.id===pk.dataset.printkit); if(k) printKit(k); return; }
  const td=e.target.closest('[data-travel-edit]'); if(td){ const t=travel.find(x=>x.id===td.dataset.travelEdit); if(t){ resetTravel(); $('#travelDialog').showModal(); } return; }
  const rev=e.target.closest('[data-travel-delete]'); if(rev){ if(confirm('Supprimer ce scénario ?')){ travel=travel.filter(x=>x.id!==rev.dataset.travelDelete); saveAll(); } return; }
  const ld=e.target.closest('[data-loan-edit]'); if(ld){ const l=loans.find(x=>x.id===ld.dataset.loanEdit); if(l){ resetLoan(); fillLoanRows(); $('#loanDialog').showModal(); } return; }
  const lv=e.target.closest('[data-loan-delete]'); if(lv){ if(confirm('Supprimer cette location ?')){ loans=loans.filter(x=>x.id!==lv.dataset.loanDelete); saveAll(); } return; }
  const dp=e.target.closest('[data-loan-depart]'); if(dp){ const l=loans.find(x=>x.id===dp.dataset.loanDepart); if(l){ populateDeparture(l); $('#departureDialog').showModal(); } return; }
  const lp=e.target.closest('[data-loan-print]'); if(lp){ const l=loans.find(x=>x.id===lp.dataset.loanPrint); if(l) printLoan(l); return; }
});

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===t));
  $('#inventoryView').hidden=t.dataset.view!=='inventory';
  $('#kitsView').hidden=t.dataset.view!=='kits';
  $('#tournoisView').hidden=t.dataset.view!=='tournois';
  $('#scannerView').hidden=t.dataset.view!=='scanner';
  $('#exportsView').hidden=t.dataset.view!=='exports';
});
$('#addBtn').onclick=()=>{ resetForm(); $('#itemDialog').showModal(); }

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
  const html=`<article class="sheet"><header><h1>LA CAVERNE D’ALIBAAB</h1><b>LOCATION DE TOURNAGE</b></header>
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
    <p class="serial">Identifiant : ${esc(loan.id)}</p>
    <p class="muted small">${esc(loan.notes||'')}</p>
  </article>`;
  const w=window.open('','_blank'); w.document.write(`<!doctype html><html><head><title>Fiche location</title><style>body{font-family:Arial;color:#171a1d;margin:0}.sheet{padding:28px;min-height:95vh;page-break-after:always}.sheet:last-child{page-break-after:auto}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{text-align:left;border-bottom:1px solid #ddd;padding:10px;border-collapse:collapse}th{width:180px;color:#555}.serial{margin-top:30px;color:#777;font-size:10px}.loan-meta th{display:none} @media print{.sheet{break-after:page}.sheet:last-child{break-after:auto}}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`); w.document.close(); }
function printKit(kit){
  const itemsList = (kit.items||[]).map(id=>{ const x=items.find(i=>i.id===id); if(!x) return `<tr><th>?</th><td>?</td><td>Supprimé</td></tr>`; return `<tr><th>${esc(x.name)}</th><td>${x.quantity}</td><td>${x.location?esc(x.location):'—'}</td><td>${esc(x.holder||'')}</td></tr>`; }).join('');
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

// ---------- departure ----------
let departureLoan = null;
function populateDeparture(loan){
  departureLoan = loan || null;
  const box=$('#departureItems'); box.innerHTML='';
  const src = loan?.items?.length
    ? loan.items
    : items.map(x=>({ itemId:x.id, name:x.name, brand:x.brand, model:x.model, qty:1, status:'assigned' }));
  const tpl = src.map(it=>`
    <div class="depart-row">
      <input type="checkbox" class="departCheck">
      <input type="text" class="departName" value="${esc(it.name||it.itemId)}" disabled>
      <input type="number" class="departQty" min="1" value="${it.qty||1}">
      <select class="departStatus"><option value="departed" ${it.status==='departed'?'selected':''}>Départé</option><option value="returned" ${it.status==='returned'?'selected':''}>Retourné</option></select>
    </div>`).join('');
  box.innerHTML = tpl;
}
$('#departureTitle').textContent = departureLoan ? `Départ · ${departureLoan.client}` : 'Départ — validation';
const dutyField = $('#departureTitle');
$('#validateDeparture').onclick=async ()=>{
  const box=$('#departureItems');
  const names=[];
  const rows=box.querySelectorAll('.depart-row');
  const qty=new Map(); rows.forEach(r=>{ qty.set(r.querySelector('.departName').value, Math.max(1,Number(r.querySelector('.departQty').value)||1)); });
  const selected=[];
  rows.forEach(r=>{ if(r.querySelector('.departCheck').checked){ selected.push({ name:r.querySelector('.departName').value, qty:qty.get(r.querySelector('.departName').value), status:r.querySelector('.departStatus').value }); } });
  if(!selected.length){ alert('Sélectionne au moins un objet.'); return; }
  const form=$('#departureDialog').querySelector('form'); // not a form, skip
  const date=$('#dateField') ? $('#dateField').value : new Date().toISOString().slice(0,10);
  const lieu=$('#lieuField') ? $('#lieuField').value.trim() : '—';
  const client=$('#clientField') ? $('#clientField').value.trim() : departureLoan?.client || '—';
  const note=$('#noteField') ? $('#noteField').value.trim() : '';
  // create a small movement log entry for each selected
  const mDate=date;
  selected.forEach(s=>{
    movements.push({ id:uid(), date:mDate, type:'departure', itemId:null, itemName:s.name, qty:s.qty, holder:client, note:lieu+` — ${s.status}` });
  });
  saveAll();
  const html=generateDeparturePDF(client,lieu,date,selected,note,departureLoan);
  const w=window.open('','_blank'); w.document.write(html); w.document.close();
  $('#departureDialog').close();
};
function generateDeparturePDF(client,lieu,date,selected,note,loan){
  const rows=selected.map(s=>`<tr><th>${esc(s.name)}</th><td>${s.qty}</td><td>${esc(s.status)}</td></tr>`).join('');
  const meta='';
  const loanLines='';
  const html=`<article class="sheet"><header><h1>LA CAVERNE D’ALIBAAB</h1><b>LIEU DE DÉPART — VALIDÉ</b></header>
    <table class="loan-meta">
      <tr><th>Date</th><td>${esc(date)}</td></tr>
      <tr><th>Lieu / objet</th><td>${esc(lieu)}</td></tr>
      <tr><th>Client</th><td>${esc(client)}</td></tr>
      <tr><th>Contact</th><td>${esc(loan?.contact||'')}</td></tr>
      <tr><th>Début / Fin</th><td>${esc(loan?.startDate||'')} / ${esc(loan?.endDate||'')}</td></tr>
      <tr><th>Status</th><td>VALIDÉ pour départ</td></tr>
    </table>
    <table class="loan-items"><tr><th>Équipement</th><th>Qté</th><th>Statut</th></tr>${rows}</table>
    <p class="muted small">${esc(note||'')}</p>
    <p class="serial">Identifiant : ${esc(date+lieu)}</p>
  </article>`;
  return `<!doctype html><html><head><title>Lieu de départ</title><style>body{font-family:Arial;color:#171a1d;margin:0}.sheet{padding:28px;min-height:95vh;page-break-after:always}.sheet:last-child{page-break-after:auto}table{border-collapse:collapse;width:100%;margin:10px 0}.sheet th,.sheet td{padding:10px;border-bottom:1px solid #ddd;text-align:left;border-collapse:collapse}.sheet th{width:180px;color:#555}.serial{margin-top:30px;color:#777;font-size:10px} @media print{.sheet{break-after:page}.sheet:last-child{break-after:auto}}.loan-meta th{display:none}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`;
}
// form fields for departure (quick mode)
document.addEventListener('click', e=>{ if(e.target.closest('#addQuickDepart')){ $('#dateField').value=new Date().toISOString().slice(0,10); $('#departureDialog').showModal(); } });
// keyboard: close departure dialog
$('#closeDeparture').onclick=$('#cancelDeparture').onclick=()=>$('#departureDialog').close();

// ---------- scanner ----------
let scanner=null, scannerMode='scan', scannerActive=false;
function initScanner(){
  // mode buttons
  document.querySelectorAll('.mode-btn').forEach(b=>b.onclick=()=>setScannerMode(b.dataset.mode));
  $('#scanToggle').onclick=(e)=>{ e.stopPropagation(); if(scannerActive){ stopScanner(); } else { startScanner(); } };
}
function setScannerMode(mode){
  scannerMode=mode;
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  const labels={scan:'Scanner une étiquette (QR) pour ouvrir la fiche.',depart:'Scanner un objet pour l\'ajouter à la liste de départ.',return:'Scanner un objet pour le ramener en stock.'};
  $('#scanModeLabel').textContent=labels[mode]||'';
  if(scannerActive){ stopScanner(); startScanner(); }
}
async function startScanner(){
  if(scannerActive) return;
  $('#scanContainer').hidden=false;
  const video=document.getElementById('scanVideo');
  const canvas=document.getElementById('scanCanvas');
  let scanSize='auto';
  try{
    scanner=new Html5Qrcode('scanContainer');
    await scanner.start({ video, locateQr: true }, (decodedText, decodedResult)=>{
      onScanSuccess(decodedText, decodedResult);
    }, (error)=>{});
    scannerActive=true;
    $('#scanStatus').textContent='Caméra prête — '+(scannerMode==='scan'?'scanner le QR':'choisir un mode');
  }catch(err){
    $('#scanError').textContent='Impossible de lancer la caméra. Autorise le contrôle de la caméra dans les réglages du navigateur.';
    $('#scanError').hidden=false;
  }
}
function stopScanner(){
  if(scanner){
    scanner.stop().then(()=>{ scanner.clear(); scanner = null; }).catch(()=>{});
    scannerActive=false;
    $('#scanContainer').hidden=true;
    $('#scanError').hidden=true;
  }
}
function onScanSuccess(decodedText, decodedResult){
  const safe=decodedText.trim();
  const label=$('#scanStatus');
  const t=$('#scanModeLabel');
  if(scannerMode==='scan'){
    // try to open an item
    const id = parseItemFromScannedText(safe);
    if(id){
      const x=items.find(i=>i.id===id);
      if(x){ openEdit(x.id); label.textContent='Fiche ouverte.'; $('#scanLog').innerHTML+=`<li class="ok">✓ ${esc(x.name)}</li>`; }
      else { label.textContent='QR reconnu, mais aucune fiche sur cet appareil.'; }
    } else {
      // generic QR → log
      label.textContent='QR décodé, pas d\'item correspondant (attente).';
      $('#scanLog').innerHTML+=`<li class="unknown">? ${esc(safe.slice(0,60))}</li>`;
    }
  } else if(scannerMode==='depart'){
    const id = parseItemFromScannedText(safe);
    if(!id){ label.textContent='QR non reconnu comme fiche d\'objet.'; return; }
    const x=items.find(i=>i.id===id); if(!x){ label.textContent='Fiche introuvable.'; return; }
    departureQueue.push({ itemId:x.id, name:x.name, qty:1, status:'departed' });
    label.textContent=`✓ ${esc(x.name)} → liste de départ.`;
    $('#scanLog').innerHTML+=`<li class="ok">+ ${esc(x.name)} (départ)</li>`;
  } else if(scannerMode==='return'){
    const id = parseItemFromScannedText(safe);
    if(!id){ label.textContent='QR non reconnu.'; return; }
    const x=items.find(i=>i.id===id); if(!x){ label.textContent='Fiche introuvable.'; return; }
    x.status='stock';
    if(x.holder){ x.holder=''; }
    if(x.dueDate){ x.dueDate=''; }
    x.loanDate='';
    movements.push({ id:uid(), date:new Date().toISOString().slice(0,10), type:'return', itemId:x.id, itemName:x.name, qty:1, holder:'', note:'Retour en stock via scanner.' });
    saveAll();
    label.textContent=`↩ ${esc(x.name)} rendu en stock.`;
    $('#scanLog').innerHTML+=`<li class="ok">↩ ${esc(x.name)} (retour)</li>`;
  }
  if(!isNaN(label)){}
}
function parseItemFromScannedText(text){
  // formats: caverne-alibaab:item=ID ; #item=ID ; item=ID ; plain ID ; URLs
  let s=text.trim();
  const m=s.match(/#item=([^&]+)/i); if(m) return decodeURIComponent(m[1]);
  const m2=s.match(/(?:caverne-alibaab:item|item=)([^\s&]+)/i); if(m2) return decodeURIComponent(m2[1]);
  const m3=s.match(/^[a-z0-9\-]{8,64}$/i); if(m3) return m3[0];
  return null;
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
    txt=await worker.recognize(f);
    await worker.terminate();
  }catch(err){
    box.textContent='OCR indisponible (réseau). Retour à la recherche textuelle.';
  }
  if(txt){
    const words=txt.text().split(/\s+/).filter(w=>w.length>2);
    let cands=[], all=items.map(x=>x.name+x.model+x.brand+x.serial).join(' ');
    // simple scoring
    words.forEach(w=>{ const re=new RegExp(w,'i'); items.forEach(x=>{ if(re.test(x.name)||re.test(x.model)||re.test(x.brand)||re.test(x.serial)) cands.push(x); }); });
    cands=[...new Set(cands)];
    if(cands.length){
      const pick=prompt('Objet correspondant (choix) :\n'+cands.map((x,i)=>`${i+1}. ${esc(x.name)} — ${esc(x.model||x.category)}`).join('\n'));
      if(pick!=null && /^\d+$/.test(pick)&&Number(pick)<=cands.length){ const x=cands[Number(pick)-1]; Object.assign($('#itemForm').elements, { name:x.name, brand:x.brand||'', model:x.model||'', serial:x.serial||'', category:x.category||'Camera' }); $('#photoPreview').hidden=true; box.textContent='Préremplissage appliqué.'; }
      else box.textContent='Aucun choix effectué.';
    } else { box.textContent='Aucun objet ne correspond à la photo.'; }
  } else { box.textContent='Aucun texte lu.'; }
}

// ---------- import / cloud sync ----------
$('#importUrlBtn').onclick=async ()=>{
  const url=$('#importUrl').value.trim(); if(!url){ alert('URL invalide.'); return; }
  $('#importNote').textContent='Récupération…';
  try{
    const r=await fetch(url, { mode:'cors' }); if(!r.ok) throw Error('HTTP '+r.status);
    const data=await r.json();
    if(!data || !Array.isArray(data.items)) throw Error('Données incomplètes (champs attendus : items).');
    if(!confirm('Importer sur cet appareil va combler les listes existantes. Continuer ?')){ return; }
    items=data.items; kits=data.kits||[]; travel=data.travel||[]; loans=data.loans||[]; movements=data.movements||[];
    saveAll();
    $('#importNote').textContent='Imported ✅ '+items.length+' articles, '+loans.length+' locations.';
  }catch(err){ $('#importNote').textContent='Erreur : '+err.message; }
};
// file import (hidden input reused)
$('#importFileBtn').onclick=()=>$('#importFile').click();
$('#importFile').onchange=async e=>{ const f=e.target.files[0]; if(!f)return; try{ const data=JSON.parse(await f.text()); if(!data||!Array.isArray(data.items))throw Error('Fichier invalide.'); if(!confirm('Importer ce JSON sur cet appareil. Continuer ?'))return; items=data.items; kits=data.kits||[]; travel=data.travel||[]; loans=data.loans||[]; movements=data.movements||[]; saveAll(); $('#importNote').textContent='Imported ✅ '+items.length+' articles.'; }catch(err){ alert('Fichier invalide : '+err.message); } e.target.value=''; };

// ---------- bootstrap: ensure buttons used by event delegation exist ----------
document.addEventListener('DOMContentLoaded', ()=>{
  // no-op (boot already bound)
});

// expose for console debugging
window.__alibaab = { items, kits, travel, loans, movements, scannerMode, departureQueue };
