const $ = (s) => document.querySelector(s);
const STORES = {
  items: 'caverne_alibaab_inventory_v1',
  kits: 'caverne_alibaab_kits_v1',
  travel: 'caverne_alibaab_travel_v1',
  loans: 'caverne_alibaab_loans_v1',
  movements: 'caverne_alibaab_movements_v1'
};
let items = [], kits = [], travel = [], loans = [], movements = [], owners = [];
let editingId = null, editingTravelId = null, editingLoanId = null, editingKitId = null, photoData = '';
let stateUpdatedAt = new Date().toISOString();
let departureQueue = [];
let lastScanValue = '', lastScanAt = 0;
const statusNames = { stock: 'En stock', loaned: 'Emprunté / sorti', unavailable: 'Indisponible', partial: 'Partiellement sorti' };
const reasonNames = { repair: 'En réparation', lost: 'Perdu', out_of_service: 'Hors service' };
const movementNames = { entry: 'Entrée', exit: 'Sortie', return: 'Retour', departure: 'Départ' };
const travelStatusNames = { draft: 'Brouillon', ready: 'Préparé', in_progress: 'En cours', done: 'Terminé' };
const loanStatusNames = { draft: 'Brouillon', pending: 'En attente', validated: 'Validé', departed: 'En route', returned: 'Retourné' };
const loanItemStatusNames = { assigned: 'À préparer', departed: 'Sorti', returned: 'Retourné' };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ip = s => s == null ? '' : String(s);
function getAvailableQty(item){return Math.max(0,Number(item.stockQty??(item.status==='stock'?item.quantity:0))||0);}
function getLoanedQty(item){return Math.max(0,Number(item.loanedQty??(item.status==='loaned'?item.quantity:0))||0);}
function getUnavailableQty(item){return Math.max(0,Number(item.unavailableQty??(item.status==='unavailable'?item.quantity:0))||0);}
function displayStatus(item){if(getAvailableQty(item)>0&&getLoanedQty(item)>0)return 'partial';if(getLoanedQty(item)>0)return 'loaned';if(getAvailableQty(item)>0)return 'stock';return 'unavailable';}
function matchesStatus(item,status){if(status==='all')return true;if(status==='stock')return getAvailableQty(item)>0;if(status==='loaned')return getLoanedQty(item)>0;if(status==='unavailable')return getUnavailableQty(item)>0;return item.status===status;}
function ensureItemQtyState(item){if(item.stockQty==null&&item.loanedQty==null&&item.unavailableQty==null){const q=Math.max(1,Number(item.quantity)||1);item.stockQty=item.status==='stock'?q:0;item.loanedQty=item.status==='loaned'?q:0;item.unavailableQty=item.status==='unavailable'?q:0;}return item;}
function openFromHash(){
  const m=location.hash.match(/^#item=(.+)$/);
  if(m){ const id=decodeURIComponent(m[1]); history.replaceState(null,'',location.pathname+location.search); if(items.some(i=>i.id===id)) openEdit(id); else alert("Cette fiche n'existe pas sur cet appareil. Restaure d'abord une sauvegarde."); }
}
function saveAll(){ persistAll(); render(); }
const SYNC_COLLECTIONS=['items','kits','travel','loans','movements','owners'], stampSigs=new Map();
function stampKey(col,x){return col+':'+(x&&(x.id??x.token)!==undefined?(x.id??x.token):JSON.stringify(x));}
function stampSig(x){const {_u,...rest}=x||{};return JSON.stringify(rest);}
function seedStampSigs(){stampSigs.clear();const st={items,kits,travel,loans,movements,owners};for(const c of SYNC_COLLECTIONS)for(const x of st[c]||[])if(x&&typeof x==='object')stampSigs.set(stampKey(c,x),stampSig(x));}
function stampChanges(now){const st={items,kits,travel,loans,movements,owners};for(const c of SYNC_COLLECTIONS)for(const x of st[c]||[]){if(!x||typeof x!=='object')continue;const k=stampKey(c,x),sig=stampSig(x);if(stampSigs.get(k)!==sig){x._u=now;stampSigs.set(k,stampSig(x));}}}
let syncTimer=null;function scheduleSync(){clearTimeout(syncTimer);syncTimer=setTimeout(()=>{if(getSyncConfig().url&&navigator.onLine)syncNow('auto');},2500);}
function persistAll(){
  stateUpdatedAt=new Date().toISOString(); try{stampChanges(stateUpdatedAt);}catch(e){} const state={items,kits,travel,loans,movements,owners,updatedAt:stateUpdatedAt};
  scheduleSync();
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
      st = { items: oldItems, kits: oldKits, travel: await idb.get('state.travel')||[], loans: await idb.get('state.loans')||[], movements: await idb.get('state.movements')||[], owners: await idb.get('state.owners')||[] };
      if (oldItems.length || oldKits.length) await idb.set('state', st);
    }
    items = st.items || []; items.forEach(ensureItemUnits);
    kits  = st.kits || []; kits.forEach(ensureKitBarcode);
    travel = st.travel || []; travel.forEach(ensureTravelBarcode);
    loans = st.loans || [];
    movements = st.movements || []; owners = st.owners || []; stateUpdatedAt=st.updatedAt||stateUpdatedAt;
    seedStampSigs();
    // Migration additive : mémorise les identifiants créés pour les anciens enregistrements,
    // sans modifier l'horodatage de synchronisation ni écraser une version cloud plus récente.
    await idb.set('state',{...st,items,kits,travel,loans,movements,owners});
  } catch (e) { console.error('Démarrage / stockage', e); alert("Le stockage de l'appareil est indisponible (Navigation privée ?). Les données ne seront pas conservées.\n\nDétail technique : " + (e?.name || 'Erreur') + ' — ' + (e?.message || e?.target?.error?.message || 'inconnu')); }
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
  $('#statStock').textContent = items.reduce((n,x)=>n+(x.stockQty!=null?Number(x.stockQty)||0:(x.status==='stock'?Math.max(1,Number(x.quantity)||1):0)),0);
  $('#statLoaned').textContent = items.reduce((n,x)=>n+(x.loanedQty!=null?Number(x.loanedQty)||0:(x.status==='loaned'?Math.max(1,Number(x.quantity)||1):0)),0);
  $('#statUnavailable').textContent = items.reduce((n,x)=>n+(x.unavailableQty!=null?Number(x.unavailableQty)||0:(x.status==='unavailable'?Math.max(1,Number(x.quantity)||1):0)),0);
}
function renderKitsPrintBtn(){
  $('#printKitsBtn').onclick=()=>{ if(!kits.length)return alert('Aucun sac ou kit.'); kits.forEach(k=>printKit(k)); };
}
function renderInventory(){
  const q=$('#search').value.toLowerCase().trim(), sf=$('#statusFilter').value, cf=$('#categoryFilter').value;
  const cats=[...new Set(items.map(x=>x.category).filter(Boolean))].sort();
  $('#categoryFilter').innerHTML='<option value="all">Toutes catégories</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $('#categoryFilter').value=cats.includes(cf)?cf:'all';
  const filtered=items.filter(x=>matchesStatus(x,sf)&&(cf==='all'||x.category===cf)&&[x.name,x.brand,x.model,x.serial,x.category,x.location,x.holder,...(x.units||[]).flatMap(u=>[u.tag,u.barcode])].join(' ').toLowerCase().includes(q));
  $('#count').textContent=`${filtered.length} référence(s) · ${filtered.reduce((n,x)=>n+Math.max(1,Number(x.quantity)||1),0)} unité(s)`;
  $('#inventory').innerHTML=filtered.length?filtered.map(x=>`<article class="item-card">${x.photo?`<img src="${x.photo}" alt="">`:''}<div class="item-meta"><span class="pill">${esc(x.category)}</span><span class="pill ${esc(displayStatus(x)==='partial'?'loaned':displayStatus(x))}">${statusNames[displayStatus(x)]}</span></div><h3>${esc(x.name)}</h3><p>${esc([x.brand,x.model].filter(Boolean).join(' · ')||'Modèle non renseigné')}<br>Quantité totale : ${Math.max(1,Number(x.quantity)||1)}${x.stockQty!=null||x.loanedQty!=null?`<br>En stock : ${Number(x.stockQty)||0} · Sorti : ${Number(x.loanedQty)||0}`:''}<br>${x.serial?'N° série : '+esc(x.serial):'Sans numéro de série'}<br>${x.location?'Emplacement : '+esc(x.location):'Emplacement non renseigné'}${x.holder?'<br>Avec : '+esc(x.holder):''}${x.dueDate?'<br>Retour prévu : '+esc(x.dueDate):''}${x.status==='unavailable'&&x.reason?'<br>'+reasonNames[x.reason]:''}</p><div class="card-actions"><button class="btn subtle" data-edit="${x.id}">Modifier</button><button class="btn subtle" data-barcode="${x.id}">QR objet</button><button class="btn subtle" data-label-item="${x.id}">Étiquettes</button><button class="btn subtle" data-print="${x.id}">Fiche PDF</button><button class="btn subtle" data-printloan="${x.id}">Fiche location</button><button class="btn subtle" data-delete="${x.id}">Supprimer</button></div></article>`).join(''):'<div class="empty">Aucun équipement correspondant. Ajoute ton matériel.</div>';
}
function kitEntries(kit){const grouped=new Map();(kit.items||[]).forEach(entry=>{const itemId=typeof entry==='string'?entry:(entry.itemId||entry.id);if(!itemId)return;const qty=typeof entry==='string'?1:Math.max(1,Number(entry.qty)||1);grouped.set(itemId,(grouped.get(itemId)||0)+qty);});return [...grouped].map(([itemId,qty])=>({itemId,qty}));}

function renderKits(){
  kits.forEach(ensureKitBarcode);
  $('#kits').innerHTML=kits.length?kits.map(k=>{const entries=kitEntries(k),units=entries.reduce((n,e)=>n+e.qty,0);return `<article class="item-card"><div class="item-meta"><span class="pill">SAC / KIT</span><span class="pill">${entries.length} référence(s) · ${units} unité(s)</span></div><h3>${esc(k.name)}</h3><p>${esc(k.location||'Emplacement non renseigné')}<br>${esc(k.description||'')}<br>${entries.map(e=>{const x=items.find(i=>i.id===e.itemId);return x?`${esc(x.name)} × ${e.qty}`:''}).filter(Boolean).join(' · ')}</p><div class="card-actions"><button class="btn subtle" data-kit-barcode="${k.id}">Code-barres du kit</button><button class="btn subtle" data-kit-check="${k.id}">Contrôler</button><button class="btn subtle" data-kit-edit="${k.id}">Modifier</button><button class="btn subtle" data-kit-delete="${k.id}">Supprimer</button><button class="btn subtle" data-printkit="${k.id}">Fiche PDF</button></div></article>`}).join('') : '<div class="empty">Aucun sac ou kit. Crée un kit pour regrouper ton matériel.</div>';
}
function renderTravel(){
  travel.forEach(ensureTravelBarcode);
  const list=$('#travelList');
  if(!travel.length){ list.innerHTML='<p class="muted small">Aucun scénario. Crée un « mat d\'emats » pour te préparer une journée.</p>'; return; }
  list.innerHTML = travel.map(t=>`<article class="item-card travel-card"><div class="item-meta"><span class="pill">TOURNAGE</span><span class="pill ${esc(t.status||'draft')}">${esc(travelStatusNames[t.status||'draft'])}</span></div><div><h3>${esc(t.name)}</h3><p>${esc(t.notes||'')}</p><p class="muted small">${(t.needs||[]).map(n=>esc(n.label)+' ×'+(n.qty||1)).join(' · ')||'Aucun besoin renseigné'}</p></div><div class="card-actions"><button class="btn subtle" data-travel-prepare="${t.id}">Préparer</button><button class="btn subtle" data-travel-barcode="${t.id}">Code-barres scénario</button><button class="btn subtle" data-travel-edit="${t.id}">Éditer</button><button class="btn subtle" data-travel-delete="${t.id}">Supprimer</button></div></article>`).join('');
}
function renderLoans(){
  const list=$('#loanList');
  if(!loans.length){ list.innerHTML='<p class="muted small">Aucune location. Utilise « Nouvelle location » pour créer un contrat.</p>'; return; }
  const today=new Date().toISOString().slice(0,10);
  list.innerHTML = loans.map(l=>{
    const late=l.status==='departed'&&l.endDate&&l.endDate<today;
    const rows=(l.items||[]).map(it=>`<div class="loan-item-row"><span class="pill ${esc(it.status||'assigned')}">${esc(loanItemStatusNames[it.status]||'À préparer')}</span><span>${esc(it.name||'?')}</span><span class="muted small">Prévu ${it.qty||1} · Sorti ${it.departedQty||0} · Rendu ${it.returnedQty||0}</span></div>`).join('');
    return `<article class="item-card loan-card"><div class="item-meta"><span class="pill">LOCATION</span><span class="pill ${esc(l.status||'draft')}">${esc(loanStatusNames[l.status]||'Brouillon')}</span>${late?'<span class="pill unavailable">EN RETARD</span>':''}</div><div class="loan-head"><div><h3>${esc(l.client||'')} ${esc(l.firstname||'')}</h3><p>${esc(l.objectif||'')}</p></div><div class="loan-dates"><strong>${esc(ip(l.startDate)||'—')}</strong> → <strong>${esc(ip(l.endDate)||'—')}</strong></div></div><p class="muted small">Contact : ${esc(l.contact||'—')}${late?' · Date de retour dépassée':''}</p><div class="loan-items">${rows||'<p class="muted small">Aucun matériel préparé.</p>'}</div><div class="card-actions" style="margin-top:8px"><button class="btn subtle" data-loan-edit="${l.id}">Modifier</button><button class="btn subtle" data-loan-depart="${l.id}">Départ / compléter</button><button class="btn subtle" data-loan-print="${l.id}">Fiche PDF</button><button class="btn subtle" data-loan-delete="${l.id}">Supprimer</button></div></article>`;
  }).join('');
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
  $('#travelForm').onsubmit=e=>{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.currentTarget).entries()); d.needs=[]; const rows=$('#travelItems').querySelectorAll('.travel-row'); rows.forEach(r=>{ const label=r.querySelector('.travel-label').value.trim(); if(label){ d.needs.push({ itemId:r.querySelector('.travel-item-select')?.value||'', label, qty: Math.max(1, Number(r.querySelector('.travel-qty').value)||1), notes: r.querySelector('.travel-notes').value.trim() }); } });
  const old=travel.find(x=>x.id===editingTravelId); d.id=editingTravelId||uid(); d.status=old?.status||'draft'; travel=old?travel.map(x=>x.id===d.id?{...old,...d}:x):[...travel,d]; editingTravelId=null; saveAll(); $('#travelDialog').close(); renderTravel(); };
  $('#addTravelItem').onclick=()=>addTravelItemRow();
}
function resetTravel(){ $('#travelForm').reset(); $('#travelItems').innerHTML=''; }
function addTravelItemRow(initial={}){const row=document.createElement('div');row.className='travel-row';const options=items.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.model||x.category||'')}</option>`).join('');row.innerHTML=`<select class="travel-item-select" aria-label="Équipement de l'inventaire"><option value="">Choisir dans l’inventaire…</option>${options}</select><input class="travel-label" placeholder="Ou saisir un besoin libre" value="${esc(initial.label||'')}" style="flex:1"><input class="travel-qty" type="number" min="1" value="${Math.max(1,Number(initial.qty)||1)}" style="width:76px"><input class="travel-notes" placeholder="Note" value="${esc(initial.notes||'')}" style="width:150px"><button type="button" class="btn subtle small" aria-label="Supprimer">✕</button>`;const select=row.querySelector('.travel-item-select');select.value=initial.itemId||'';if(initial.itemId&&!select.value){const found=items.find(x=>x.id===initial.itemId);if(found)select.value=found.id;}select.onchange=()=>{const x=items.find(i=>i.id===select.value);if(x)row.querySelector('.travel-label').value=x.name;};row.querySelector('button').onclick=()=>row.remove();$('#travelItems').appendChild(row);}

function fillTravelRows(travelFromDb){
  const t = travelFromDb || { name:'', notes:'', needs:[] };
  // filled at open
}

// ---------- dialogs: loan ----------
function initLoanForm(){
  $('#addLoanBtn').onclick=()=>{ editingLoanId=null; $('#loanDialogTitle').textContent='Nouveau contrat'; refreshLoanOptions(); renderLoans(); resetLoan(); $('#loanDialog').showModal(); };
  $('#closeLoan').onclick=$('#cancelLoan').onclick=()=>$('#loanDialog').close();
  $('#loanForm').onsubmit=e=>{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.currentTarget).entries()); d.items=[]; const rows=$('#loanRows').querySelectorAll('.loan-row'); rows.forEach(r=>{ const itemId=r.dataset.itemId||''; const obj=items.find(x=>x.id===itemId); const name=r.querySelector('.loan-name').value.trim(); if(name){ { const prior=(loans.find(x=>x.id===editingLoanId)?.items||[]).find(it=>it.itemId===itemId); d.items.push({ itemId, name:obj?.name||name, brand:obj?.brand||'', model:obj?.model||'', qty:Math.max(1,Number(r.querySelector('.loan-qty').value)||1), status:prior?.status||'assigned', departedQty:prior?.departedQty||0, returnedQty:prior?.returnedQty||0 }); } } });
  const old=loans.find(x=>x.id===editingLoanId);if(old){(old.items||[]).forEach(prior=>{const stillThere=d.items.find(it=>it.itemId===prior.itemId);if(Number(prior.departedQty||0)>Number(prior.returnedQty||0)&&!stillThere)d.items.push(prior);else if(stillThere)stillThere.qty=Math.max(Number(stillThere.qty)||1,Number(prior.departedQty)||0);});}d.id=editingLoanId||uid(); d.status=old?.status||'draft'; d.createdAt=old?.createdAt||new Date().toISOString(); loans=old?loans.map(x=>x.id===d.id?{...old,...d}:x):[...loans,d]; editingLoanId=null; saveAll(); $('#loanDialog').close(); renderLoans(); };
  $('#itemForm').onsubmit=e=>{
    try{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.currentTarget).entries()); if(photoData) d.photo=photoData; const id=editingId||uid(); const old=items.find(x=>x.id===id); d.id=id; d.status=d.status||'stock'; d.ownerId=Object.prototype.hasOwnProperty.call(d,'ownerId')?d.ownerId:(old?.ownerId||''); if(old&&(old.stockQty!=null||old.loanedQty!=null||old.unavailableQty!=null)){const total=Math.max(1,Number(d.quantity)||1);d.loanedQty=Number(old.loanedQty)||0;d.unavailableQty=Number(old.unavailableQty)||0;if(total<d.loanedQty+d.unavailableQty)throw Error(`La quantité totale ne peut pas être inférieure aux unités déjà sorties ou indisponibles (${d.loanedQty+d.unavailableQty}).`);d.stockQty=total-d.loanedQty-d.unavailableQty;d.quantity=total;d.status=d.loanedQty>0?'loaned':d.stockQty>0?'stock':'unavailable';} if(!d.externalQr&&old?.externalQr)d.externalQr=old.externalQr; if(!d.photo&&old?.photo)d.photo=old.photo; items=old?items.map(x=>x.id===id?{...x,...d}:x):[...items,d]; if(old&&old.ownerId!==d.ownerId)(items.find(x=>x.id===id).units||[]).forEach(u=>u.ownerId=d.ownerId||''); const savedItem=items.find(x=>x.id===id);ensureItemUnits(savedItem);editingId=null;photoData='';saveAll();if(savedItem.units?.length)publishOwnerQrLabels(savedItem.units.map(unit=>({item:savedItem,unit}))).catch(()=>{});$('#itemDialog').close();render();refreshLoanOptions(); }
    catch(err){ console.error('itemForm submit ERR',err); alert('Impossible d’enregistrer cette fiche : '+err.message); }
  };
  $('#closeItem').onclick=$('#cancelItem').onclick=()=>{editingId=null;$('#itemDialog').close();}; $('#itemDialog').addEventListener('close',()=>{editingId=null;});
  $('#addKitBtn').onclick=()=>{ editingKitId=null;$('#kitDialogTitle').textContent='Créer un sac ou un kit';$('#kitForm').reset(); $('#kitRows').innerHTML=''; refreshKitOptions(); addKitItemRow(); $('#kitDialog').showModal(); };
  $('#addKitRow').onclick=addKitItemRow;
  $('#closeKit').onclick=$('#cancelKit').onclick=()=>{editingKitId=null;$('#kitDialog').close();};
  $('#kitForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries());const selected=[...$('#kitRows').querySelectorAll('.kit-row')].map(r=>({itemId:r.querySelector('.kit-item-select').value,qty:Math.max(1,Number(r.querySelector('.kit-item-qty').value)||1)})).filter(x=>x.itemId);const kit={id:editingKitId||uid(),name:d.name,location:d.location||'',description:d.description||'',items:selected};kits=editingKitId?kits.map(k=>k.id===editingKitId?kit:k):[...kits,kit];editingKitId=null;saveAll();$('#kitDialog').close();};
  // dynamic rows
  refreshLoanOptions(); $('#loanItemsSelect').onchange=fillLoanRows; $('#loanRows').innerHTML='';
}
function refreshLoanOptions(){ const sel=$('#loanItemsSelect'); if(!sel)return; const selected=new Set([...sel.selectedOptions].map(o=>o.value)); sel.innerHTML=items.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} — ${esc(x.model||x.category||'')}</option>`).join(''); [...sel.options].forEach(o=>o.selected=selected.has(o.value)); }
function refreshKitOptions(){ return items.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} — ${esc(x.model||x.category||'')}</option>`).join(''); }
function addKitItemRow(){const row=document.createElement('div');row.className='kit-row';row.innerHTML=`<select class="kit-item-select" aria-label="Matériel"><option value="">Choisir un matériel…</option>${refreshKitOptions()}</select><input class="kit-item-qty" type="number" min="1" value="1" aria-label="Quantité dans le kit"><button type="button" class="btn subtle small" aria-label="Supprimer la ligne">✕</button>`;row.querySelector('button').onclick=()=>row.remove();$('#kitRows').appendChild(row);}
function openEdit(id){ const x=items.find(i=>i.id===id); if(!x)return; editingId=id; photoData=''; resetForm(); renderOwnerSelect(); $('#dialogTitle').textContent='Modifier le matériel'; for(const [k,v] of Object.entries(x)){const el=$('#itemForm').elements.namedItem(k);if(el&&el.type!=='file')el.value=v??'';} if(x.photo){$('#photoPreview').src=x.photo;$('#photoPreview').hidden=false;} $('#itemDialog').showModal(); }
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

// ---------- propriétaires, identifiants unitaires et étiquettes ----------
function ownerById(id){return owners.find(o=>o.id===id)||null;}
function publicToken(){return crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});}
function renderOwnerSelect(){const el=$('#itemOwner');if(!el)return;const current=$('#itemForm')?.elements.ownerId?.value||'';el.innerHTML='<option value="">Propriétaire non renseigné</option>'+owners.map(o=>`<option value="${esc(o.id)}">${esc(o.name)}${o.organization?' · '+esc(o.organization):''}</option>`).join('');el.value=current;}
function tagPrefix(item){const c=String(item.category||'MAT').toUpperCase();const words=c.normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[A-Z0-9]+/g)||['MAT'];return words.map(w=>w[0]).join('').slice(0,3)||'MAT';}
function newUnitTag(item){const used=new Set(items.flatMap(x=>(x.units||[]).map(u=>u.tag)));let tag;do{tag='#'+tagPrefix(item)+'-'+Math.random().toString(36).slice(2,7).toUpperCase();}while(used.has(tag));return tag;}
function newPublicCode(){const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';const used=new Set(items.flatMap(x=>(x.units||[]).map(u=>u.publicCode).filter(Boolean)));for(let n=0;n<10000;n++){const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);const code=[...bytes].map(v=>alphabet[v%alphabet.length]).join('');if(!used.has(code))return code;}throw new Error('Impossible de générer une référence publique courte.');}
function ensureItemUnits(item){
  const qty=Math.max(1,Number(item.quantity)||1);if(!Array.isArray(item.units))item.units=[];
  while(item.units.length<qty){const token=publicToken();item.units.push({id:token,token,tag:newUnitTag(item)});}
  if(item.units.length>qty)item.units=item.units.slice(0,qty);
  const usedPublicCodes=new Set(items.filter(x=>x!==item).flatMap(x=>(x.units||[]).map(u=>u.publicCode).filter(Boolean)));
  item.units.forEach(u=>{
    if(!u.token)u.token=u.id||uid();if(!u.id)u.id=u.token;if(!u.tag)u.tag=newUnitTag(item);if(u.ownerId===undefined)u.ownerId=item.ownerId||'';
    // Migration additive : l'ancien Code 128 reste dans barcode et un éventuel EAN-13 déjà attribué reste dans ean13 ; tous deux restent reconnus au scan.
    if(!u.publicCode||usedPublicCodes.has(u.publicCode))u.publicCode=newPublicCode();
    usedPublicCodes.add(u.publicCode);
    if(!u.barcode)u.barcode='CA-'+String(u.tag).replace(/^#/,'');
  });return item.units;
}
function ensureKitBarcode(kit){if(!kit.barcode)kit.barcode='CA-KIT-'+String(kit.id||uid()).replace(/[^a-z0-9]/gi,'').slice(-10).toUpperCase();return kit.barcode;}
function ensureTravelBarcode(entry){if(!entry.barcode)entry.barcode='CA-TRV-'+String(entry.id||uid()).replace(/[^a-z0-9]/gi,'').slice(-10).toUpperCase();return entry.barcode;}
let editingOwnerId=null;
function renderOwners(){const box=$('#ownerList');if(!box)return;box.innerHTML=owners.length?owners.map(o=>`<article class="owner-row"><div><strong>${esc(o.name)}</strong><small>${esc(o.organization||'')}${o.phone?' · '+esc(o.phone):''}${o.email?' · '+esc(o.email):''}</small></div><span><button class="btn subtle small" data-owner-edit="${esc(o.id)}">Modifier</button> <button class="btn subtle small" data-owner-delete="${esc(o.id)}">Supprimer</button></span></article>`).join(''):'<p class="muted small">Aucun propriétaire enregistré.</p>';}
$('#manageOwnersBtn')?.addEventListener('click',()=>{renderOwners();$('#ownersDialog').showModal();});
$('#ownerForm')?.addEventListener('submit',e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries());const o={id:editingOwnerId||uid(),name:d.name.trim(),organization:d.organization.trim(),phone:d.phone.trim(),email:d.email.trim(),showPhone:$('#ownerShowPhone').checked,showEmail:$('#ownerShowEmail').checked};if(!o.name)return;owners=editingOwnerId?owners.map(x=>x.id===editingOwnerId?o:x):[...owners,o];editingOwnerId=null;e.currentTarget.reset();$('#ownerForm button[type=submit]').textContent='Ajouter le propriétaire';renderOwners();renderOwnerSelect();saveAll();});
$('#ownerList')?.addEventListener('click',e=>{const edit=e.target.closest('[data-owner-edit]');if(edit){const o=ownerById(edit.dataset.ownerEdit);if(!o)return;editingOwnerId=o.id;for(const k of ['name','organization','phone','email'])$('#ownerForm').elements[k].value=o[k]||'';$('#ownerShowPhone').checked=!!o.showPhone;$('#ownerShowEmail').checked=!!o.showEmail;$('#ownerForm button[type=submit]').textContent='Enregistrer les modifications';return;}const b=e.target.closest('[data-owner-delete]');if(!b)return;if(!confirm('Supprimer ce propriétaire ? Les matériels associés ne seront pas supprimés.'))return;owners=owners.filter(o=>o.id!==b.dataset.ownerDelete);items=items.map(x=>x.ownerId===b.dataset.ownerDelete?{...x,ownerId:''}:x);renderOwners();renderOwnerSelect();saveAll();});
$('#closeOwners')?.addEventListener('click',()=>{editingOwnerId=null;$('#ownerForm').reset();$('#ownerForm button[type=submit]').textContent='Ajouter le propriétaire';$('#ownersDialog').close();});
async function openLabels(prefillId=''){
  renderOwnerSelect();
  const list=$('#labelSelection');if(!list)return;
  items.forEach(ensureItemUnits);persistAll();
  const all=[];items.forEach(item=>ensureItemUnits(item).forEach((unit,index)=>all.push({item,unit,index})));
  list.innerHTML=all.length?all.map(({item,unit,index})=>`<div class="label-choice"><input type="checkbox" value="${esc(item.id)}::${esc(unit.token)}" ${prefillId===item.id?'checked':''}><span><b>${esc(item.name)}</b><small>${esc(unit.tag)} · QR ${esc(unit.publicCode||'à attribuer')} · exemplaire ${index+1}/${item.units.length}</small></span></div>`).join(''):'<p class="muted">Aucun matériel à étiqueter.</p>';
  if(!prefillId)list.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=false);
  $('#labelsDialog').showModal();
}
$('#printLabelsBtn')?.addEventListener('click',()=>openLabels());
$('#labelSelectAll')?.addEventListener('click',()=>$('#labelSelection').querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=true));
$('#labelSelectNone')?.addEventListener('click',()=>$('#labelSelection').querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=false));
$('#closeLabels')?.addEventListener('click',()=>$('#labelsDialog').close());$('#closeLabels2')?.addEventListener('click',()=>$('#labelsDialog').close());
function selectedLabelUnits(){
  const selected=[...$('#labelSelection').querySelectorAll('input:checked')];const labels=[];
  for(const checkbox of selected){const [itemId,token]=checkbox.value.split('::');const item=items.find(x=>x.id===itemId),unit=item?.units?.find(x=>x.token===token);if(item&&unit){if(!unit.publicCode)unit.publicCode=newPublicCode();labels.push({item,unit});}}
  persistAll();return labels;
}
function lostQrMode(){return $('#lostQrMode')?.value||localStorage.getItem('caverne_lost_mode')||'direct';}
function directContactValue(owner){
  // QR « contact direct » : seulement les coordonnées que le propriétaire a autorisées (showPhone / showEmail).
  if(owner.showPhone&&String(owner.phone||'').trim()){
    let d=String(owner.phone).replace(/[^\d+]/g,'');if(d.startsWith('00'))d='+'+d.slice(2);if(/^0\d{9}$/.test(d))d='+33'+d.slice(1);
    if(d.replace(/\D/g,'').length>=8)return 'tel:'+d;
  }
  if(owner.showEmail&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(owner.email||'').trim()))return 'mailto:'+String(owner.email).trim();
  return '';
}
async function publishOwnerQrLabels(labels){
  if(lostQrMode()==='direct'){ // aucune page web, aucun compte Supabase nécessaire : le QR contient directement tel: ou mailto:
    labels.forEach(({item,unit})=>{
      const owner=ownerById(unit.ownerId||item.ownerId);
      if(!owner)throw Error('Aucun propriétaire associé à « '+item.name+' ». Affecte un propriétaire à ce matériel.');
      const value=directContactValue(owner);
      if(!value)throw Error('« '+owner.name+' » n’a ni téléphone ni e-mail autorisé. Renseigne-le et active « afficher » pour l’un des deux dans la fiche du propriétaire, ou choisis « Page web » dans la fenêtre Étiquettes.');
      unit.publicUrl=value;
    });
    persistAll();return labels;
  }
  const cfg=getSyncConfig();
  if(!cfg.url||!cfg.key)throw Error('Configure Supabase dans Exports & impressions avant de publier les QR anti-perte.');
  const session=await ensureSyncSession(cfg);
  if(!session?.access_token)throw Error('Connecte-toi au compte propriétaire dans Exports & impressions avant de publier les QR anti-perte.');
  {const pc=window.CAVERNE_PUBLIC_CONFIG||{};if(String(pc.supabaseUrl||'').replace(/\/$/,'')!==cfg.url.replace(/\/$/,'')||String(pc.supabaseAnonKey||'')!==cfg.key)throw Error('Les QR courts ne sont pas encore activés (le QR long serait illisible sur 30 × 14 mm).\n\n1. Clique sur « Copier public-config.js » dans la fenêtre Étiquettes.\n2. Sur GitHub, ouvre src/public-config.js, colle le contenu à la place de l’ancien et enregistre (Commit).\n3. Attends la fin du déploiement GitHub Pages (onglet Actions), recharge l’app, puis relance l’impression.');}
  const base=(localStorage.getItem('caverne_portal_base')||$('#portalBaseUrl')?.value||'').trim().replace(/\/$/,'');
  if(!/^https:\/\//i.test(base))throw Error('Renseigne et publie d’abord l’adresse GitHub Pages dans Portail clients & collègues.');
  const rows=labels.map(({item,unit})=>{
    const owner=ownerById(unit.ownerId||item.ownerId);
    if(!owner)throw Error('Aucun propriétaire associé à « '+item.name+' ». Affecte un propriétaire à ce matériel.');
    return {id:unit.token,public_code:unit.publicCode,ean13:unit.ean13||null,owner_id:session.user.id,tag:unit.tag,item_name:item.name,brand:item.brand||'',model:item.model||'',owner_name:owner.name,organization:owner.organization||'',phone:owner.showPhone?owner.phone||'':'',email:owner.showEmail?owner.email||'':'',updated_at:new Date().toISOString()};
  });
  const url=cfg.url.replace(/\/$/,'')+'/rest/v1/caverne_public_labels?on_conflict=owner_id,tag';
  const response=await fetch(url,{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
  if(!response.ok)throw Error('Publication Supabase impossible (HTTP '+response.status+'). Vérifie que docs/ETIQUETTES-QR.sql a été exécuté.');
  const publicCfg=window.CAVERNE_PUBLIC_CONFIG||{};const compact=String(publicCfg.supabaseUrl||'').replace(/\/$/,'')===cfg.url.replace(/\/$/,'')&&String(publicCfg.supabaseAnonKey||'')===cfg.key;
  labels.forEach(({unit})=>{unit.publicUrl=compact?base+'/contact.html?i='+encodeURIComponent(unit.publicCode):base+'/contact.html?id='+encodeURIComponent(unit.token)+'&project='+encodeURIComponent(cfg.url)+'&key='+encodeURIComponent(cfg.key);});
  persistAll(); return labels;
}
async function printSelectedBarcodeLabels(){
  const labels=selectedLabelUnits(); if(!labels.length)return alert('Sélectionne au moins un exemplaire à imprimer.');
  const w=window.open('','_blank'); if(!w)return alert('Autorise les fenêtres surgissantes pour préparer le rouleau.');
  try{await publishOwnerQrLabels(labels);printLabelRoll(labels,'pair',w);$('#labelsDialog').close();}
  catch(err){if(!w.closed)w.close();alert('Impression des deux étiquettes : '+err.message);}
}
$('#printSelectedLabels')?.addEventListener('click',printSelectedBarcodeLabels);
async function connectFicheroPrinter(){
  const status=$('#ficheroPrinterStatus'); status.textContent='Recherche Bluetooth… Allume l’imprimante et garde-la à proximité.';
  const info=await FicheroPrinter.connect(); status.textContent='Connectée : '+info.name+' · prête à imprimer.'; return info;
}
$('#connectFicheroPrinter')?.addEventListener('click',()=>connectFicheroPrinter().catch(err=>{$('#ficheroPrinterStatus').textContent='Connexion impossible : '+err.message;}));
$('#printDirectFichero')?.addEventListener('click',async()=>{
  const labels=selectedLabelUnits(); if(!labels.length)return alert('Sélectionne au moins un exemplaire à imprimer.');
  const button=$('#printDirectFichero'),status=$('#ficheroPrinterStatus');button.disabled=true;
  try{
    status.textContent='Préparation des QR anti-perte…'; await publishOwnerQrLabels(labels); status.textContent='QR anti-perte : '+labels[0].unit.publicUrl;
    status.textContent='Connexion à l’imprimante FICHERO…'; const info=await FicheroPrinter.connect();
    await FicheroPrinter.print(labels,'pair',({current,total})=>{status.textContent='Impression : '+current+' / '+total+' étiquettes…';});
    status.textContent='Terminé : '+(labels.length*2)+' étiquettes ('+labels.length+' paires) envoyées à '+info.name+'.';persistAll();
  }catch(err){status.textContent='Erreur d’impression : '+err.message;alert('Impression FICHERO : '+err.message+'\n\nVérifie Supabase, le propriétaire affecté, GitHub Pages et la connexion Bluetooth.');}
  finally{button.disabled=false;}
});
function printLabelRoll(labels,type,w){
  // Même rendu 240 × 96 points que l'impression Bluetooth : l'aperçu correspond exactement à l'étiquette.
  const img=(l,t)=>`<div class="label"><img src="${FicheroPrinter.logicalDataUrl(l,t)}" alt="${t==='object-qr'?'QR objet':'QR anti-perte'}"></div>`;
  const html=labels.map(l=>type==='pair'?img(l,'object-qr')+img(l,'owner-qr'):img(l,type==='owner-qr'?'owner-qr':'object-qr')).join('');
  if(!w||w.closed)throw Error('La fenêtre d’impression a été fermée.');
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Étiquettes 30 × 14 mm</title><style>
  @page{size:30mm 14mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;width:30mm;background:#fff;color:#000}
  .label{width:30mm;height:14mm;overflow:hidden;display:flex;align-items:center;justify-content:center;break-after:page;page-break-after:always;background:#fff}
  .label:last-child{break-after:auto;page-break-after:auto}.label img{display:block;width:30mm;height:12mm;image-rendering:pixelated}
  @media screen{body{background:#ddd}.label{margin:5mm auto;box-shadow:0 1px 5px #777}}
  </style></head><body>${html}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);w.document.close();
}
async function printSelectedOwnerQrLabels(){
  const labels=selectedLabelUnits();if(!labels.length)return alert('Sélectionne au moins un exemplaire.');
  const w=window.open('','_blank');if(!w)return alert('Autorise les fenêtres surgissantes pour préparer les QR.');
  try{await publishOwnerQrLabels(labels);printLabelRoll(labels,'owner-qr',w);$('#labelsDialog').close();}
  catch(err){if(!w.closed)w.close();alert('QR anti-perte : '+err.message);}
}
$('#printOwnerQrLabels')?.addEventListener('click',printSelectedOwnerQrLabels);
if($('#lostQrMode'))$('#lostQrMode').value=localStorage.getItem('caverne_lost_mode')||'direct';
$('#lostQrMode')?.addEventListener('change',e=>localStorage.setItem('caverne_lost_mode',e.target.value));
$('#copyPublicConfig')?.addEventListener('click',async()=>{
  const cfg=getSyncConfig();if(!cfg.url||!cfg.key)return alert('Configure d’abord Supabase dans Exports & impressions.');
  try{const role=JSON.parse(atob(cfg.key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role;if(role==='service_role')return alert('Cette clé est une clé service_role : ne la publie jamais. Utilise la clé anon / publishable.');}catch(e){}
  const text="/* Configuration publique du portail anti-perte (clé anon/publishable uniquement). */\nwindow.CAVERNE_PUBLIC_CONFIG = {\n  supabaseUrl: '"+cfg.url.replace(/\/$/,'')+"',\n  supabaseAnonKey: '"+cfg.key+"'\n};\n";
  try{await navigator.clipboard.writeText(text);$('#ficheroPrinterStatus').textContent='Contenu de public-config.js copié : colle-le dans src/public-config.js sur GitHub.';}
  catch(e){prompt('Copie ce contenu dans src/public-config.js :',text);}
});

function qrLink(id){ return String(id); }
function makeQR(value,opts={}){ const qr=new QRCodeLib(0,0); qr.addData(String(value)); qr.make(); const count=qr.getModuleCount();if((count+2*(opts.margin??4))*2>96)throw new Error('QR trop dense pour le rouleau 30 × 14 mm ('+count+' modules). Configure src/public-config.js avec ton projet Supabase et republie GitHub Pages pour utiliser une URL courte.');const scale=10, margin=opts.margin??4, canvas=document.createElement('canvas'); canvas.width=canvas.height=(count+margin*2)*scale; const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#111';for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))ctx.fillRect((c+margin)*scale,(r+margin)*scale,scale,scale);return canvas.toDataURL('image/png'); }

// Attach form open/close to public buttons
document.addEventListener('click', async (e)=>{
  const edit=e.target.closest('[data-edit]'); if(edit){ openEdit(edit.dataset.edit); return; }
  const del=e.target.closest('[data-delete]'); if(del){ if(confirm('Supprimer définitivement cette fiche ?')){ items=items.filter(x=>x.id!==del.dataset.delete); kits=kits.map(k=>({...k,items:(k.items||[]).filter(entry=>(typeof entry==='string'?entry:(entry.itemId||entry.id))!==del.dataset.delete)})); saveAll(); } return; }
  const labelItem=e.target.closest('[data-label-item]');if(labelItem){openLabels(labelItem.dataset.labelItem);return;}
  const barcode=e.target.closest('[data-barcode]'); if(barcode){ const x=items.find(i=>i.id===barcode.dataset.barcode); if(x){ensureItemUnits(x);const unit=x.units[0];$('#qrTitle').textContent=x.name+' · '+unit.tag;$('#printQRBtn').textContent='Imprimer le QR objet';$('#qrImage').src=makeQR(CavernCodes.objectQrValue(unit.publicCode),{margin:1});$('#qrImage').alt='QR objet '+unit.publicCode;$('#qrDialog').showModal();} return; }
  const pr=e.target.closest('[data-print]'); if(pr){ const x=items.find(i=>i.id===pr.dataset.print); printItems([x],true); return; }
  const prl=e.target.closest('[data-printloan]'); if(prl){ const l=loans.find(x=>x.id===prl.dataset.printloan); if(l) printLoan(l); return; }
  const ke=e.target.closest('[data-kit-edit]');if(ke){const k=kits.find(x=>x.id===ke.dataset.kitEdit);if(k){editingKitId=k.id;$('#kitDialogTitle').textContent='Modifier le kit';$('#kitForm').reset();$('#kitRows').innerHTML='';$('#kitForm').elements.name.value=k.name||'';$('#kitForm').elements.location.value=k.location||'';$('#kitForm').elements.description.value=k.description||'';kitEntries(k).forEach(entry=>{addKitItemRow();const row=$('#kitRows').lastElementChild;row.querySelector('.kit-item-select').value=entry.itemId;row.querySelector('.kit-item-qty').value=entry.qty;});if(!kitEntries(k).length)addKitItemRow();$('#kitDialog').showModal();}return;}
  const kqr=e.target.closest('[data-kit-barcode]'); if(kqr){const k=kits.find(x=>x.id===kqr.dataset.kitBarcode);if(k){ensureKitBarcode(k);$('#qrTitle').textContent='Kit · '+k.name;$('#printQRBtn').textContent='Imprimer le code-barres';$('#qrImage').src=Code128Barcode.dataUri(k.barcode);$('#qrImage').alt='Code-barres '+k.barcode;persistAll();$('#qrDialog').showModal();}return;}
  const kcheck=e.target.closest('[data-kit-check]'); if(kcheck){const k=kits.find(x=>x.id===kcheck.dataset.kitCheck);if(k){openKitCheck(k,scannerMode==='return'?'return':scannerMode==='depart'?'depart':'inspect');}return;}
  const kd=e.target.closest('[data-kit-delete]'); if(kd){ if(confirm('Supprimer ce kit ?')){ kits=kits.filter(k=>k.id!==kd.dataset.kitDelete); saveAll(); } return; }
  const pk=e.target.closest('[data-printkit]'); if(pk){ const k=kits.find(x=>x.id===pk.dataset.printkit); if(k) printKit(k); return; }
  const tp=e.target.closest('[data-travel-prepare]'); if(tp){const t=travel.find(x=>x.id===tp.dataset.travelPrepare);if(t){t.status='ready';const missing=[];(t.needs||[]).forEach(n=>{const obj=items.find(i=>n.itemId&&i.id===n.itemId)||items.find(i=>i.name.trim().toLowerCase()===String(n.label||'').trim().toLowerCase());if(!obj){missing.push(n.label);return;}const q=departureQueue.find(z=>z.itemId===obj.id);if(q)q.qty+=Math.max(1,Number(n.qty)||1);else departureQueue.push({itemId:obj.id,name:obj.name,qty:Math.max(1,Number(n.qty)||1),status:'assigned'});});if(missing.length)alert('Besoins à associer à un équipement de l’inventaire :\n'+missing.join('\n'));saveAll();if(departureQueue.length){populateDeparture();$('#departureDialog').showModal();}}return;}
  const tq=e.target.closest('[data-travel-barcode]'); if(tq){const t=travel.find(x=>x.id===tq.dataset.travelBarcode);if(t){ensureTravelBarcode(t);$('#qrTitle').textContent='Scénario · '+t.name;$('#printQRBtn').textContent='Imprimer le code-barres';$('#qrImage').src=Code128Barcode.dataUri(t.barcode);$('#qrImage').alt='Code-barres '+t.barcode;persistAll();$('#qrDialog').showModal();}return;}
  const td=e.target.closest('[data-travel-edit]'); if(td){ const t=travel.find(x=>x.id===td.dataset.travelEdit); if(t){ editingTravelId=t.id; resetTravel(); $('#travelDialogTitle').textContent='Modifier le scénario'; $('#travelForm').elements.name.value=t.name||''; $('#travelForm').elements.notes.value=t.notes||''; (t.needs||[]).forEach(n=>addTravelItemRow(n)); $('#travelDialog').showModal(); } return; }
  const rev=e.target.closest('[data-travel-delete]'); if(rev){ if(confirm('Supprimer ce scénario ?')){ travel=travel.filter(x=>x.id!==rev.dataset.travelDelete); saveAll(); } return; }
  const ld=e.target.closest('[data-loan-edit]'); if(ld){ const l=loans.find(x=>x.id===ld.dataset.loanEdit); if(l){ editingLoanId=l.id; refreshLoanOptions(); resetLoan(); $('#loanDialogTitle').textContent='Modifier la location'; for(const k of ['client','firstname','contact','startDate','endDate','objectif']) $('#loanForm').elements[k].value=l[k]||''; const sel=$('#loanItemsSelect'); const mapped=(l.items||[]).map(it=>({...it,itemId:it.itemId||items.find(x=>x.name===it.name)?.id||''})); [...sel.options].forEach(o=>o.selected=mapped.some(it=>it.itemId===o.value)); fillLoanRows(); mapped.forEach(it=>{let r=[...$('#loanRows').children].find(row=>row.dataset.itemId===it.itemId);if(!r){r=document.createElement('div');r.className='loan-row';r.dataset.itemId=it.itemId||'';r.innerHTML=`<input class="loan-name" value="${esc(it.name||'Matériel') }" ${it.itemId?'disabled':''} style="flex:1"><input class="loan-qty" type="number" min="1" value="1" style="width:80px"><button type="button" class="btn subtle small">✕</button>`;$('#loanRows').appendChild(r);r.querySelector('button').onclick=()=>r.remove();}r.querySelector('.loan-qty').value=it.qty||1;}); $('#loanDialog').showModal(); } return; }
  const lv=e.target.closest('[data-loan-delete]'); if(lv){ const l=loans.find(x=>x.id===lv.dataset.loanDelete); if(l&&l.status==='departed'){alert('Cette location contient du matériel sorti. Enregistre d’abord tous les retours avant de pouvoir supprimer le contrat.');return;} if(confirm('Supprimer cette location ?')){ loans=loans.filter(x=>x.id!==lv.dataset.loanDelete); saveAll(); } return; }
  const dp=e.target.closest('[data-loan-depart]'); if(dp){ const l=loans.find(x=>x.id===dp.dataset.loanDepart); if(l){const pending=(l.items||[]).some(it=>(Number(it.qty)||1)>(Number(it.departedQty)||0));if(!pending){alert('Tout le matériel prévu a déjà été déclaré sorti. Pour le retour, utilise le scanner en mode RETOUR.');return;}populateDeparture(l); $('#departureDialog').showModal(); } return; }
  const lp=e.target.closest('[data-loan-print]'); if(lp){ const l=loans.find(x=>x.id===lp.dataset.loanPrint); if(l) printLoan(l); return; }
});

$('#closeQR')?.addEventListener('click',()=>$('#qrDialog').close());
$('#printQRBtn')?.addEventListener('click',()=>{const w=window.open('','_blank');if(!w)return alert('Autorise les fenêtres surgissantes pour imprimer le code.');w.document.write(`<!doctype html><html><head><title>${esc($('#qrTitle').textContent)}</title><style>body{font-family:Arial;text-align:center;padding:30px}img{width:min(90vw,600px);height:auto;max-height:65vh;object-fit:contain}h2{font-size:20px}</style></head><body><h2>${esc($('#qrTitle').textContent)}</h2><img src="${$('#qrImage').src}"><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();});

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===t));
  $('#inventoryView').hidden=t.dataset.view!=='inventory';
  $('#kitsView').hidden=t.dataset.view!=='kits';
  $('#tournoisView').hidden=t.dataset.view!=='tournois';
  $('#requestsView').hidden=t.dataset.view!=='requests'; if(t.dataset.view==='requests')loadOnlineRequests();
  $('#scannerView').hidden=t.dataset.view!=='scanner'; if(t.dataset.view!=='scanner'&&scannerActive)stopScanner();
  $('#exportsView').hidden=t.dataset.view!=='exports';
});
$('#addBtn').onclick=()=>{ resetForm(); renderOwnerSelect(); $('#itemDialog').showModal(); }
$('#search').addEventListener('input',renderInventory);$('#statusFilter').addEventListener('change',renderInventory);$('#categoryFilter').addEventListener('change',renderInventory);$('#movementDate').addEventListener('change',renderMovements);

// ---------- exports ----------
$('#csvBtn').onclick=$('#csvBtn2').onclick=csv;
async function backup(){ const json=JSON.stringify({version:2,items,kits,travel,loans,movements,owners,exportedAt:new Date().toISOString()},null,2); const name='caverne-alibaab-sauvegarde.json'; const f=new File([json],name,{type:'application/json'}); if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[f]})){ await navigator.share({files:[f],title:'Sauvegarde La caverne d’Alibaab'}); return; } download(name,json,'application/json'); }
$('#backupBtn').onclick=$('#backupBtn2').onclick=backup;
$('#restoreBtn').onclick=()=>$('#restoreFile').click();
$('#restoreFile').onchange=async e=>{ const f=e.target.files[0]; if(!f)return; try{ const data=JSON.parse(await f.text()); if(!Array.isArray(data.items))throw Error('Fichier non reconnu'); if(confirm('Restaurer cette sauvegarde remplacera les données de cet appareil. Continuer ?')){ items=data.items||[]; kits=data.kits||[]; travel=data.travel||[]; loans=data.loans||[]; movements=data.movements||[]; owners=data.owners||[]; saveAll(); } }catch(err){ alert('Sauvegarde invalide : '+err.message); } e.target.value=''; };
function download(name,content,type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function csv(){
  const cols=['name','category','brand','model','serial','quantity','stockQty','loanedQty','unavailableQty','status','reason','location','holder','loanDate','dueDate','price','purchaseDate','warranty','condition','barcodes','tags','notes'];
  const q=v=>'"'+String(v??'').replace(/\"/g,'""')+'"';
  const rows=items.map(x=>{ensureItemUnits(x);return cols.map(k=>{
    if(k==='status')return q(statusNames[displayStatus(x)]||x.status);
    if(k==='reason')return q(reasonNames[x[k]]||x[k]);
    if(k==='barcodes')return q((x.units||[]).map(u=>u.barcode).join(' | '));
    if(k==='tags')return q((x.units||[]).map(u=>u.tag).join(' | '));
    return q(x[k]);
  }).join(';');});
  download('caverne-alibaab-inventaire.csv',[cols.map(q).join(';'),...rows].join('\r\n'),'text/csv;charset=utf-8');
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
  const src=loan?.items?.length?loan.items.map(it=>({...it,qty:Math.max(0,(Number(it.qty)||1)-(Number(it.departedQty)||0))})).filter(it=>it.qty>0):departureQueue;
  $('#departureTitle').textContent=loan?`Départ · ${loan.client||''} ${loan.firstname||''}`:'Départ — validation du matériel scanné';
  src.forEach(it=>{
    const row=document.createElement('div'); row.className='depart-row'; row.dataset.itemId=it.itemId||'';
    row.innerHTML=`<input type="checkbox" class="departCheck" checked><input type="text" class="departName" value="${esc(it.name||it.itemId)}" readonly><input type="number" class="departQty" min="1" value="${Math.max(1,Number(it.qty)||1)}"><select class="departStatus"><option value="departed" selected>À sortir</option><option value="skip">Ne pas sortir</option></select>`;
    box.appendChild(row);
  });
  $('#departureCount').textContent=src.length;
}
$('#validateDeparture').onclick=()=>{
  const rows=[...$('#departureItems').querySelectorAll('.depart-row')];
  const selected=rows.filter(r=>r.querySelector('.departCheck').checked).map(r=>{const itemId=r.dataset.itemId,obj=items.find(x=>x.id===itemId),requested=Math.max(1,Number(r.querySelector('.departQty').value)||1),status=r.querySelector('.departStatus').value;return {itemId,name:r.querySelector('.departName').value,qty:obj&&status==='departed'?Math.min(requested,getAvailableQty(obj)):requested,status};}).filter(s=>!items.some(x=>x.id===s.itemId)||s.status!=='departed'||s.qty>0);
  if(!selected.length)return alert('Aucune unité disponible à sortir. Vérifie les quantités ou le stock.');
  const date=new Date().toISOString().slice(0,10), client=departureLoan?`${departureLoan.client||''} ${departureLoan.firstname||''}`.trim():'Départ manuel';
  selected.forEach(s=>{
    const obj=items.find(x=>x.id===s.itemId);
    if(obj&&s.status==='departed'){ensureItemQtyState(obj);const qty=Math.min(s.qty,Number(obj.stockQty)||0);obj.stockQty=Math.max(0,(Number(obj.stockQty)||0)-qty);obj.loanedQty=(Number(obj.loanedQty)||0)+qty;obj.holder=client;obj.loanDate=departureLoan?.startDate||date;obj.dueDate=departureLoan?.endDate||'';syncItemLegacyStatus(obj);} 
    if(s.status==='departed')movements.push({id:uid(),date,type:'departure',itemId:s.itemId||null,itemName:s.name,qty:s.qty,holder:client,note:departureLoan?`Location ${departureLoan.id}`:'Départ scanné'});
  });
  if(departureLoan){
    departureLoan.items=(departureLoan.items||[]).map(it=>{const found=selected.find(s=>s.itemId&&s.itemId===it.itemId&&s.status==='departed'); return found?{...it,departedQty:Math.min(Number(it.qty)||1,(Number(it.departedQty)||0)+Number(found.qty||0)),status:'departed'}:it;});
    if(departureLoan.items.some(it=>Number(it.departedQty||0)>Number(it.returnedQty||0)))departureLoan.status='departed';
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
let scanner=null, scannerMode='scan', scannerActive=false, scanAudioContext=null, kitCheck=null;
let keyboardScanBuffer='', keyboardScanLastAt=0;
function initScanner(){
  document.querySelectorAll('.mode-btn[data-mode]').forEach(b=>b.onclick=()=>setScannerMode(b.dataset.mode));
  // Les lecteurs USB/Bluetooth en mode clavier envoient le code puis Entrée.
  document.addEventListener('keydown',event=>{
    if($('#scannerView')?.hidden)return;
    if(event.target?.closest('input,textarea,select,[contenteditable="true"]'))return;
    const now=Date.now();
    if(event.key==='Enter'||event.key==='Tab'){
      const value=keyboardScanBuffer;keyboardScanBuffer='';keyboardScanLastAt=0;
      if(value.length>=5){event.preventDefault();onScanSuccess(value);}
      return;
    }
    if(event.key.length===1 && event.key.charCodeAt(0)>=32 && event.key.charCodeAt(0)<=126){
      if(now-keyboardScanLastAt>250)keyboardScanBuffer='';
      keyboardScanBuffer+=event.key;keyboardScanLastAt=now;
      if(keyboardScanBuffer.length>100)keyboardScanBuffer=keyboardScanBuffer.slice(-100);
    }
  });
  $('#readerHelp')?.addEventListener('click',()=>alert('LECTEUR USB / BLUETOOTH / WI-FI\n\n1. Allume le lecteur et active le mode clavier (HID / Keyboard Wedge).\n2. Pour Bluetooth : associe-le dans les réglages Bluetooth de macOS, Windows, iPhone ou iPad.\n3. Pour Wi-Fi : configure le lecteur ou son dongle en mode clavier réseau/HID selon sa notice. Un lecteur Wi-Fi propriétaire qui envoie des données via une application ou un serveur nécessitera son protocole exact.\n4. Ouvre cet onglet SCANNERS, clique dans la page puis scanne. Le lecteur doit envoyer Entrée (ou Tab) après le code.\n\nUn lecteur HID n’a pas besoin d’être appairé depuis La Caverne : le système le présente comme un clavier.'));
  $('#scanToggle').onclick=async()=>{ if(!scannerActive) await unlockScanFeedback(); scannerActive?stopScanner():startScanner(); };
}
function setScannerMode(mode){
  scannerMode=mode;
  document.querySelectorAll('.mode-btn[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  const labels={scan:'Scanner un code-barres ou un ancien QR pour associer / ouvrir une fiche.',depart:'Scanner les équipements à sortir : ils seront ajoutés à une liste à valider.',return:'Scanner les équipements rendus : leur statut repassera en stock.'};
  $('#scanModeLabel').textContent=labels[mode]||'';
}
async function startScanner(){
  if(scannerActive)return;
  $('#scanContainer').hidden=false; $('#scanError').hidden=true;
  try{
    scanner=new Html5Qrcode('scanContainer',{formatsToSupport:[Html5QrcodeSupportedFormats.QR_CODE,Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.CODE_128]});
    await scanner.start({facingMode:'environment'},{fps:18,qrbox:(w,h)=>{const side=Math.max(150,Math.min(300,w-24,h-24));return {width:side,height:side};},aspectRatio:1.333, videoConstraints:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}},onScanSuccess,()=>{});
    scannerActive=true; $('#scanToggle').textContent='Arrêter la caméra'; $('#scanStatus').textContent='Caméra prête.';
  }catch(err){ scanner=null; $('#scanError').textContent='Impossible de lancer la caméra. Sur iPhone, ouvre l’app depuis Safari ou l’écran d’accueil et autorise l’accès à la caméra. '+(err?.message||''); $('#scanError').hidden=false; }
}
async function stopScanner(){
  if(scanner){try{if(scannerActive)await scanner.stop();scanner.clear();}catch(e){} scanner=null;}
  scannerActive=false; $('#scanContainer').hidden=true; $('#scanToggle').textContent='Lancer la caméra ▸';
}
function findItemByScannedCode(value){
  const rawCode=String(value||'').trim();
  const objectPublicCode=window.CavernCodes?.parseObjectQr(rawCode)||'';
  const code=objectPublicCode||rawCode;
  // Les étiquettes publiques contiennent une URL contact.html?id=TOKEN&project=…&key=… .
  // Dans l'application, on extrait le jeton de l'exemplaire pour retrouver sa fiche locale.
  let publicLabelId='',publicCode='';
  try{
    const url=new URL(code);
    if(/(?:^|\/)contact\.html$/i.test(url.pathname)){publicLabelId=url.searchParams.get('id')||'';publicCode=url.searchParams.get('i')||'';}
  }catch(e){}
  return items.find(x=>
    x.id===parseItemFromScannedText(code)||
    (publicLabelId&&Array.isArray(x.units)&&x.units.some(unit=>unit.token===publicLabelId||unit.id===publicLabelId))||
    (publicCode&&Array.isArray(x.units)&&x.units.some(unit=>unit.publicCode===publicCode))||
    x.qrCode===code||x.serial===code||x.barcode===code||x.externalQr===code||(x.units||[]).some(unit=>unit.ean13===code||unit.barcode===code||unit.legacyBarcode===code||unit.tag===code||unit.token===code||unit.id===code||unit.publicCode===code)
  );
}
async function unlockScanFeedback(){
  try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;if(!scanAudioContext)scanAudioContext=new Ctx();if(scanAudioContext.state==='suspended')await scanAudioContext.resume();
    // iOS n'autorise l'audio qu'après une action utilisateur : on déverrouille ici, au toucher du bouton caméra.
    const osc=scanAudioContext.createOscillator(),gain=scanAudioContext.createGain();gain.gain.value=0.00001;osc.connect(gain);gain.connect(scanAudioContext.destination);osc.start();osc.stop(scanAudioContext.currentTime+0.015);
  }catch(e){console.warn('Audio scanner indisponible',e);}
}
function showScanFlash(ok=true,title='SCAN RÉUSSI',detail='Matériel reconnu'){
  let flash=$('#scanFlash');
  if(!flash){flash=document.createElement('div');flash.id='scanFlash';flash.className='scan-flash';$('#scannerView')?.prepend(flash);}
  flash.className='scan-flash '+(ok?'success':'failure');
  flash.innerHTML=`<strong>${ok?'✓':'!' } ${esc(title)}</strong><span>${esc(detail)}</span>`;
  flash.hidden=false;clearTimeout(window.__scanFlashTimer);window.__scanFlashTimer=setTimeout(()=>{flash.hidden=true;},1250);
}
function scanFeedback(){
  showScanFlash(true,'SCAN RÉUSSI',lastScanValue||'Code détecté');
  try{if(navigator.vibrate)navigator.vibrate([55,35,55]);}catch(e){}
  try{const ctx=scanAudioContext;if(ctx&&ctx.state==='running'){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(1050,ctx.currentTime);gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.10,ctx.currentTime+.008);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.12);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.13);}}catch(e){console.warn('Bip scanner impossible',e);}
}
function onScanSuccess(decodedText){
  const safe=String(decodedText||'').trim(), now=Date.now();
  if(!safe||(safe===lastScanValue&&now-lastScanAt<850))return;
  lastScanValue=safe;lastScanAt=now;
  const label=$('#scanStatus');
  // Pendant un contrôle détaillé, chaque QR matériel scanné coche une unité du kit.
  if(kitCheck){
    const checkedItem=findItemByScannedCode(safe);if(!checkedItem){showScanFlash(false,'CODE INCONNU','Non associé à ce kit');label.textContent='Code non reconnu pour ce kit : '+safe.slice(0,50);return;}
    const line=kitCheck.lines.find(z=>z.itemId===checkedItem.id);if(!line){label.textContent=`${checkedItem.name} ne fait pas partie du kit « ${kitCheck.kit.name} ».`;addScanLog('Hors kit : '+checkedItem.name,'unknown');return;}
    if(line.scanned>=line.required){label.textContent=`Quantité déjà complète pour ${checkedItem.name} (${line.required}/${line.required}).`;return;}
    line.scanned++;scanFeedback();renderKitCheck();label.textContent=`✓ ${checkedItem.name} · ${line.scanned}/${line.required}`;addScanLog(`${kitCheck.mode==='return'?'Retour':'Contrôle'} kit : ${checkedItem.name} ${line.scanned}/${line.required}`,'ok');return;
  }
  const scannedKitByBarcode=kits.find(k=>k.barcode===safe);const kitId=parseKitFromScannedText(safe), scannedKit=scannedKitByBarcode||kits.find(k=>k.id===kitId);
  if(scannedKit){scanFeedback();openKitCheck(scannedKit,scannerMode==='return'?'return':scannerMode==='depart'?'depart':'inspect');label.textContent=`Kit « ${scannedKit.name} » : contrôle détaillé ouvert.`;addScanLog('Kit : '+scannedKit.name,'ok');return;}
  if(scannerMode==='scan'){
    const travelId=parseTravelFromScannedText(safe), scenario=travel.find(t=>t.barcode===safe||t.id===travelId);
    if(scenario){const missing=[];let added=0;(scenario.needs||[]).forEach(n=>{const found=items.find(i=>n.itemId&&i.id===n.itemId)||items.find(i=>i.name.trim().toLowerCase()===String(n.label||'').trim().toLowerCase());if(found){const queued=departureQueue.find(q=>q.itemId===found.id);if(queued)queued.qty+=Math.max(1,Number(n.qty)||1);else departureQueue.push({itemId:found.id,name:found.name,qty:Math.max(1,Number(n.qty)||1),status:'assigned'});added++;}else missing.push(n.label);});label.textContent=`Scénario « ${scenario.name} » : ${added} équipement(s) ajouté(s) à la préparation.`;$('#scanResults').innerHTML=`<p><strong>${scenario.name}</strong> · ${added} ajouté(s)${missing.length?' · '+missing.length+' besoin(s) à associer':''}</p><button class="btn primary" id="openDepartureQueue">Vérifier la préparation</button>`;$('#openDepartureQueue').onclick=()=>{populateDeparture();$('#departureDialog').showModal();};addScanLog('Scénario : '+scenario.name,'ok');return;}
  }
  const x=findItemByScannedCode(safe);
  if(scannerMode==='scan'){
    if(x){scanFeedback();openEdit(x.id);label.textContent=`Fiche ouverte : ${x.name}`;addScanLog('✓ '+x.name,'ok');}
    else {showScanFlash(false,'CODE NON ASSOCIÉ','Matériel introuvable dans cet inventaire');
      const choice=prompt('Code reconnu mais non associé.\nColle ce code dans la fiche d’un matériel existant ou saisis le nom du matériel à créer.\n\nCode : '+safe+'\n\nNom du matériel (laisser vide pour ignorer) :');
      if(choice){const name=choice.trim();if(name){const existing=items.find(i=>i.name.toLowerCase()===name.toLowerCase());if(existing){existing.externalQr=safe;saveAll();label.textContent=`QR associé à ${existing.name}`;addScanLog('QR associé : '+existing.name,'ok');}else{if(confirm(`Créer une fiche « ${name} » avec ce QR ?`)){editingId=null;resetForm();$('#itemForm').elements.name.value=name;$('#itemForm').elements.externalQr.value=safe;$('#itemDialog').showModal();}}}}
      else {label.textContent='QR mémorisé non associé : '+safe.slice(0,70);addScanLog('? '+safe.slice(0,70),'unknown');}
    }
  }else if(scannerMode==='depart'){
    if(!x){showScanFlash(false,'CODE INCONNU','Aucun équipement associé');label.textContent='Code non associé à un équipement. Passe en mode SCAN pour l’associer.';addScanLog('? '+safe.slice(0,60),'unknown');return;}
    const queued=departureQueue.find(q=>q.itemId===x.id);const already=Number(queued?.qty)||0;const max=Math.max(0,Number(x.stockQty??(x.status==='stock'?x.quantity:0))||0);if(max<=0){label.textContent=`Aucune unité disponible en stock pour ${x.name}.`;return;}if(already>=max){label.textContent=`Quantité maximale atteinte pour ${x.name} (${max}).`;return;}if(queued)queued.qty=already+1;else departureQueue.push({itemId:x.id,name:x.name,qty:1,status:'assigned'});scanFeedback();label.textContent=`✓ ${x.name} · ${queued?'quantité scannée mise à jour':'ajouté à la liste'} (${(queued?.qty)||1} / ${max}).`;addScanLog('+ '+x.name+' · '+(queued?.qty||1)+' scanné(s)','ok');
    $('#scanResults').innerHTML=`<p><strong>${departureQueue.length}</strong> matériel(s) dans la liste de départ.</p><button class="btn primary" id="openDepartureQueue">Vérifier et valider le départ</button>`;
    $('#openDepartureQueue').onclick=()=>{populateDeparture();$('#departureDialog').showModal();};
  }else if(scannerMode==='return'){
    if(!x){label.textContent='Code non associé à un équipement.';return;}
    scanFeedback();
    const previousHolder=x.holder||'';ensureItemQtyState(x);const qty=Math.min(1,Number(x.loanedQty)||0);if(qty<=0){label.textContent=`Aucune unité de ${x.name} n’est actuellement déclarée sortie.`;return;}x.loanedQty=Math.max(0,(Number(x.loanedQty)||0)-qty);x.stockQty=(Number(x.stockQty)||0)+qty;syncItemLegacyStatus(x);
    registerLoanReturn(x.id,qty);
    movements.push({id:uid(),date:new Date().toISOString().slice(0,10),type:'return',itemId:x.id,itemName:x.name,qty,holder:previousHolder,note:'Retour validé par scanner'});
    saveAll();label.textContent=`↩ ${x.name} rendu en stock.`;addScanLog('↩ '+x.name,'ok');
  }
}
function openKitCheck(kit,mode='depart'){
  kitCheck={kit,mode,lines:kitEntries(kit).map(entry=>{const item=items.find(i=>i.id===entry.itemId);return {itemId:entry.itemId,name:item?.name||'Matériel supprimé',required:entry.qty,scanned:0,missing:!item};}).filter(x=>!x.missing)};
  renderKitCheck();$('#kitCheckTitle').textContent=(mode==='return'?'Retour du kit · ':mode==='depart'?'Départ du kit · ':'Contenu du kit · ')+kit.name;
  $('#kitCheckHint').textContent=mode==='return'?'Scanne chaque code-barres rendu, ou ajuste les quantités manuellement.':mode==='depart'?'Scanne chaque code-barres à sortir, ou ajuste les quantités manuellement.':'Scanne les codes-barres (ou anciens QR) des éléments pour vérifier leur présence, ou ajuste les quantités manuellement.';
  $('#kitCheckDialog').showModal();
}
function renderKitCheck(){
  if(!kitCheck)return;const box=$('#kitCheckRows');
  box.innerHTML=kitCheck.lines.map((line,index)=>`<div class="kit-check-row" data-line="${index}"><div><strong>${esc(line.name)}</strong><small>${line.scanned} scanné(s) sur ${line.required}</small></div><div class="kit-check-controls"><button type="button" class="btn subtle" data-kit-minus="${index}" aria-label="Retirer une unité">−</button><b>${line.scanned}/${line.required}</b><button type="button" class="btn subtle" data-kit-plus="${index}" aria-label="Ajouter une unité">＋</button></div></div>`).join('')||'<p class="muted">Aucun matériel valide dans ce kit.</p>';
  const total=kitCheck.lines.reduce((n,l)=>n+l.required,0),done=kitCheck.lines.reduce((n,l)=>n+l.scanned,0);
  $('#kitCheckProgress').textContent=`${done} / ${total} unités contrôlées`;
  $('#kitCheckComplete').disabled=done===0;
}
$('#kitCheckRows').addEventListener('click',e=>{const plus=e.target.closest('[data-kit-plus]'),minus=e.target.closest('[data-kit-minus]');if(!kitCheck||(!plus&&!minus))return;const index=Number((plus||minus).dataset[plus?'kitPlus':'kitMinus']),line=kitCheck.lines[index];if(!line)return;line.scanned=Math.max(0,Math.min(line.required,line.scanned+(plus?1:-1)));renderKitCheck();});
$('#kitCheckComplete').onclick=()=>{
  if(!kitCheck)return;const {kit,mode,lines}=kitCheck;const selected=lines.filter(l=>l.scanned>0);if(!selected.length)return;
  if(mode==='inspect'){kitCheck=null;$('#kitCheckDialog').close();$('#scanStatus').textContent=`Contrôle du contenu de « ${kit.name} » terminé.`;addScanLog('Contenu vérifié : '+kit.name,'ok');return;}
  if(mode==='depart'){
    selected.forEach(l=>{const q=departureQueue.find(x=>x.itemId===l.itemId);if(q)q.qty=Math.max(0,Number(q.qty)||0)+l.scanned;else departureQueue.push({itemId:l.itemId,name:l.name,qty:l.scanned,status:'assigned'});});
    kitCheck=null;$('#kitCheckDialog').close();populateDeparture();$('#departureDialog').showModal();
  }else{
    const date=new Date().toISOString().slice(0,10);
    selected.forEach(l=>{const obj=items.find(x=>x.id===l.itemId);if(!obj)return;const previousHolder=obj.holder||'';ensureItemQtyState(obj);const available=Math.max(0,Number(obj.loanedQty)||0);if(available<=0){addScanLog('Aucune quantité sortie : '+obj.name,'unknown');return;}const qty=Math.min(l.scanned,available);if(obj.stockQty!=null||obj.loanedQty!=null){obj.loanedQty=Math.max(0,available-qty);obj.stockQty=Math.max(0,Number(obj.stockQty)||0)+qty;syncItemLegacyStatus(obj);}else{obj.status='stock';obj.holder='';obj.dueDate='';obj.loanDate='';}
      registerLoanReturn(obj.id,qty);
      movements.push({id:uid(),date,type:'return',itemId:obj.id,itemName:obj.name,qty,holder:previousHolder,note:`Retour du kit ${kit.name}`});
    });
    kitCheck=null;$('#kitCheckDialog').close();saveAll();$('#scanStatus').textContent=`Retour du kit « ${kit.name} » enregistré.`;addScanLog('Retour kit : '+kit.name,'ok');
  }
};
$('#closeKitCheck').onclick=$('#cancelKitCheck').onclick=()=>{kitCheck=null;$('#kitCheckDialog').close();};
function registerLoanReturn(itemId,qty){
  let remaining=Math.max(0,Number(qty)||0);
  const candidates=loans.filter(loan=>(loan.items||[]).some(it=>it.itemId===itemId&&Math.max(0,Number(it.departedQty??it.qty)||0)>Math.max(0,Number(it.returnedQty)||0))).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  for(const loan of candidates){for(const it of (loan.items||[]).filter(x=>x.itemId===itemId)){if(remaining<=0)break;const out=Math.max(0,Number(it.departedQty??it.qty)||0),already=Math.max(0,Number(it.returnedQty)||0),take=Math.min(remaining,Math.max(0,out-already));if(!take)continue;it.returnedQty=already+take;remaining-=take;if(it.returnedQty>=out)it.status='returned';}}
  loans.forEach(loan=>{const tracked=(loan.items||[]).filter(it=>Number(it.departedQty||0)>0);if(tracked.length&&tracked.every(it=>Number(it.returnedQty||0)>=Number(it.departedQty||0))&&(loan.items||[]).every(it=>Number(it.departedQty||0)>=Number(it.qty||1)))loan.status='returned';});
}
function syncItemLegacyStatus(item){const stock=Math.max(0,Number(item.stockQty)||0),loaned=Math.max(0,Number(item.loanedQty)||0),unavailable=Math.max(0,Number(item.unavailableQty)||0);item.quantity=stock+loaned+unavailable;item.status=loaned>0?'loaned':stock>0?'stock':'unavailable';if(!loaned){item.holder='';item.loanDate='';item.dueDate='';}}
function parseKitFromScannedText(text){const m=String(text||'').match(/(?:caverne-alibaab:kit=|kit=)([^\s&]+)/i);return m?decodeURIComponent(m[1]):null;}
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
function getSyncConfig(){let c={};try{c=JSON.parse(localStorage.getItem(SYNC_KEY)||'{}');}catch(e){}
  const pc=window.CAVERNE_PUBLIC_CONFIG||{};if((!c.url||!c.key)&&pc.supabaseUrl&&pc.supabaseAnonKey)c={url:pc.supabaseUrl,key:pc.supabaseAnonKey}; // pré-remplissage : il ne reste qu'à se connecter
  return c;}
function getSyncSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch(e){return null;}}
async function ensureSyncSession(cfg){let session=getSyncSession();if(!session?.access_token)return null;const expiry=Number(session.expires_at||0);if(expiry&&expiry>Date.now()/1000+90)return session;if(!session.refresh_token)return session;const r=await fetch(cfg.url.replace(/\/$/,'')+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok)return session;session=await r.json();localStorage.setItem(SESSION_KEY,JSON.stringify(session));return session;}
function setSyncStatus(msg,ok=false){const el=$('#syncStatus');if(el){el.textContent=msg;el.classList.toggle('sync-ok',ok);}
  const tag=document.querySelector('.local-tag');if(tag){const cfgOk=!!getSyncConfig().url;tag.lastChild.textContent=' '+(ok?'SYNCHRO ✓ '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):!cfgOk?'MODE LOCAL':!navigator.onLine?'HORS LIGNE':'SYNCHRO À VÉRIFIER');tag.title=msg;}}
const LAST_SYNC_KEY='caverne_alibaab_last_synced';
function markSynced(iso){try{localStorage.setItem(LAST_SYNC_KEY,iso);}catch(e){}}
function mergeStates(local,remote){
  // Fusion élément par élément (id), le plus récemment modifié (_u) gagne ; rien n'est perdu côté ajouts.
  const lt=Date.parse(local.updatedAt||0)||0,rt=Date.parse(remote.updatedAt||0)||0,out={};
  for(const c of SYNC_COLLECTIONS){const map=new Map(),order=[];
    for(const x of remote[c]||[]){const k=stampKey(c,x);map.set(k,x);order.push(k);}
    for(const x of local[c]||[]){const k=stampKey(c,x);
      if(!map.has(k)){map.set(k,x);order.push(k);continue;}
      const r=map.get(k),lu=Date.parse(x?._u||0)||0,ru=Date.parse(r?._u||0)||0;
      if(lu>ru||(lu===ru&&lt>=rt))map.set(k,x);}
    out[c]=order.map(k=>map.get(k));}
  out.updatedAt=new Date().toISOString();return out;
}
let syncBusy=false;
function applyState(data){items=data.items||[];kits=data.kits||[];travel=data.travel||[];loans=data.loans||[];movements=data.movements||[];owners=data.owners||[];stateUpdatedAt=data.updatedAt||new Date().toISOString();seedStampSigs();idb.set('state',{items,kits,travel,loans,movements,owners,updatedAt:stateUpdatedAt}).catch(()=>{});render();refreshLoanOptions();}
function snapshot(){return {items,kits,travel,loans,movements,owners,updatedAt:stateUpdatedAt};}
async function syncNow(direction='auto'){
  if(direction==='auto'){if(syncBusy)return;syncBusy=true;try{await syncCore(direction);}finally{syncBusy=false;}return;}
  return syncCore(direction);
}
async function syncCore(direction){
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
    const pushState=async(state)=>{const r=await fetch(base,{method:'POST',headers,body:JSON.stringify({owner_id:session.user.id,payload:state,updated_at:state.updatedAt})});if(!r.ok)throw Error('Écriture Supabase : HTTP '+r.status);markSynced(state.updatedAt);};
    const ls=Date.parse(localStorage.getItem(LAST_SYNC_KEY)||0)||0,lt=Date.parse(local.updatedAt||0)||0;
    if(remote&&remote.payload){
      const rp=remote.payload,rt=Date.parse(rp.updatedAt||remote.updated_at||0)||0;
      if(!(local.items||[]).length&&(rp.items||[]).length){applyState(rp);markSynced(rp.updatedAt||remote.updated_at);setSyncStatus('Données récupérées depuis Supabase.',true);return;} // jamais écraser le cloud avec un appareil vide
      if(rt===lt){markSynced(local.updatedAt);setSyncStatus('Synchronisé',true);return;}
      if(rt>ls&&lt>ls){const merged=mergeStates(local,rp);applyState(merged);await pushState(snapshot());setSyncStatus('Modifications des deux appareils fusionnées',true);return;}
      if(rt>lt){applyState(rp);markSynced(rp.updatedAt||remote.updated_at);setSyncStatus('Version en ligne récupérée',true);return;}
    }
    await pushState(local);setSyncStatus('Synchronisé',true);
  }catch(err){setSyncStatus(navigator.onLine?'Synchronisation impossible : '+err.message:'Hors ligne : la synchro reprendra automatiquement.');}
}
$('#saveSyncConfig').onclick=()=>{const url=$('#supabaseUrl').value.trim(),key=$('#supabaseKey').value.trim();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!key){alert('Vérifie l’URL du projet et la clé anon/public.');return;}localStorage.setItem(SYNC_KEY,JSON.stringify({url,key}));setSyncStatus('Projet enregistré. Connecte-toi avec ton compte partagé.');};
$('#syncPush').onclick=()=>syncNow('push');$('#syncPull').onclick=()=>syncNow('pull');$('#syncNow').onclick=()=>syncNow('auto');
async function authSupabase(mode){const cfg=getSyncConfig();if(!cfg.url||!cfg.key){alert('Enregistre d’abord l’URL et la clé Supabase.');return;}const email=$('#syncEmail').value.trim(),password=$('#syncPassword').value;if(!email||!password){alert('Saisis ton e-mail et ton mot de passe.');return;}try{const endpoint=mode==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';const r=await fetch(cfg.url.replace(/\/$/,'')+endpoint,{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const data=await r.json();if(!r.ok)throw Error(data.msg||data.message||data.error_description||'Authentification refusée');if(data.access_token){localStorage.setItem(SESSION_KEY,JSON.stringify(data));setSyncStatus('Connecté : '+email,true);await syncNow('auto');}else setSyncStatus('Compte créé. Vérifie ton e-mail si la confirmation est activée.');}catch(err){setSyncStatus('Connexion impossible : '+err.message);}}
$('#syncSignUp').onclick=()=>authSupabase('signup');$('#syncSignIn').onclick=()=>authSupabase('signin');$('#syncSignOut').onclick=()=>{localStorage.removeItem(SESSION_KEY);setSyncStatus('Déconnecté de Supabase.');};
const syncCfg=getSyncConfig();if($('#supabaseUrl'))$('#supabaseUrl').value=syncCfg.url||'';if($('#supabaseKey'))$('#supabaseKey').value=syncCfg.key||'';
window.addEventListener('online',()=>syncNow('auto'));window.addEventListener('offline',()=>setSyncStatus('Hors ligne : la synchro reprendra automatiquement.'));
window.addEventListener('focus',()=>{if(getSyncConfig().url)syncNow('auto');});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&getSyncConfig().url)syncNow('auto');else if(document.visibilityState==='hidden'&&getSyncConfig().url&&navigator.onLine){clearTimeout(syncTimer);syncNow('auto');}});
window.addEventListener('pagehide',()=>{if(getSyncConfig().url&&navigator.onLine)syncNow('auto');});
setInterval(()=>{if(document.visibilityState==='visible'&&getSyncConfig().url&&navigator.onLine)syncNow('auto');},20000);
setTimeout(()=>{if(getSyncConfig().url)syncNow('auto');else setSyncStatus('Configure Supabase pour activer la synchronisation.');},1500);
// ---------- online loan request portal ----------
function portalHeaders(session){return {'apikey':getSyncConfig().key,'Authorization':'Bearer '+session.access_token,'Content-Type':'application/json','Accept':'application/json','Prefer':'return=representation'};}
function portalStatusLabel(s){return ({pending:'En attente',approved:'Acceptée',rejected:'Refusée',changes_requested:'Modification proposée',cancelled:'Annulée'})[s]||s;}
function portalSetStatus(msg,ok=false){const el=$('#portalStatus');if(el){el.textContent=msg;el.classList.toggle('sync-ok',ok);}}
async function portalOwner(){const cfg=getSyncConfig();const session=await ensureSyncSession(cfg);if(!cfg.url||!cfg.key||!session?.access_token)throw Error('Configure Supabase et connecte-toi au compte propriétaire dans Exports & impressions.');return {cfg,session};}
async function publishPortalCatalog(){try{const {cfg,session}=await portalOwner();const catalog={items:items.map(x=>({id:x.id,name:x.name,category:x.category||'',brand:x.brand||'',model:x.model||'',availableQty:getAvailableQty(ensureItemQtyState(x))})),kits:kits.map(k=>({id:k.id,name:k.name,items:kitEntries(k).map(e=>({itemId:e.itemId,qty:e.qty}))}))};const r=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/caverne_public_catalog',{method:'POST',headers:{...portalHeaders(session),'Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify({owner_id:session.user.id,catalog,updated_at:new Date().toISOString()})});if(!r.ok)throw Error('Publication catalogue : HTTP '+r.status);portalSetStatus('Catalogue publié : '+catalog.items.length+' équipements et '+catalog.kits.length+' kits.',true);return true;}catch(e){portalSetStatus(e.message);return false;}}
async function loadOnlineRequests(){const box=$('#requestAdminList');if(!box)return;box.innerHTML='<p class="muted">Chargement des demandes…</p>';try{const {cfg,session}=await portalOwner();const url=cfg.url.replace(/\/$/,'')+'/rest/v1/caverne_loan_requests?owner_id=eq.'+encodeURIComponent(session.user.id)+'&select=*&order=created_at.desc';const r=await fetch(url,{headers:portalHeaders(session)});if(!r.ok)throw Error('Lecture des demandes : HTTP '+r.status);const rows=await r.json();if(!rows.length){box.innerHTML='<div class="empty">Aucune demande reçue pour le moment.</div>';return;}box.innerHTML=rows.map(x=>`<article class="item-card"><div class="item-meta"><span class="pill">DEMANDE EN LIGNE</span><span class="pill ${esc(x.status)}">${esc(portalStatusLabel(x.status))}</span></div><h3>${esc(x.requester_name)}${x.organization?' · '+esc(x.organization):''}</h3><p>${esc(x.requester_email)}${x.requester_phone?' · '+esc(x.requester_phone):''}<br>${esc(x.start_date)} → ${esc(x.end_date)}${x.purpose?'<br>'+esc(x.purpose):''}</p><div class="loan-items">${(x.requested_items||[]).map(it=>`<div class="loan-item-row"><span>${esc(it.name||'Matériel')}</span><span class="muted small">× ${Number(it.qty)||1}</span></div>`).join('')}</div>${x.notes?'<p class="muted small">'+esc(x.notes)+'</p>':''}${x.admin_message?'<p class="note small">Réponse : '+esc(x.admin_message)+'</p>':''}<div class="card-actions">${x.status==='pending'||x.status==='changes_requested'?`<button class="btn primary" data-request-accept="${esc(x.id)}">Accepter et créer le prêt</button><button class="btn subtle" data-request-change="${esc(x.id)}">Proposer une modification</button><button class="btn subtle" data-request-reject="${esc(x.id)}">Refuser</button>`:''}</div></article>`).join('');}catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>';}}
async function updateOnlineRequest(id,status,message=''){const {cfg,session}=await portalOwner();const url=cfg.url.replace(/\/$/,'')+'/rest/v1/caverne_loan_requests?id=eq.'+encodeURIComponent(id)+'&owner_id=eq.'+encodeURIComponent(session.user.id);const r=await fetch(url,{method:'PATCH',headers:portalHeaders(session),body:JSON.stringify({status,admin_message:message,updated_at:new Date().toISOString()})});if(!r.ok)throw Error('Mise à jour de la demande : HTTP '+r.status);}
async function acceptOnlineRequest(id){const {cfg,session}=await portalOwner();const url=cfg.url.replace(/\/$/,'')+'/rest/v1/caverne_loan_requests?id=eq.'+encodeURIComponent(id)+'&owner_id=eq.'+encodeURIComponent(session.user.id)+'&select=*';const r=await fetch(url,{headers:portalHeaders(session)});if(!r.ok)throw Error('Lecture de la demande impossible.');const rows=await r.json(),req=rows[0];if(!req)throw Error('Demande introuvable.');if(req.status==='approved')throw Error('Cette demande est déjà acceptée.');const mapped=(req.requested_items||[]).map(it=>{const obj=items.find(x=>x.id===it.itemId);return {itemId:it.itemId||'',name:obj?.name||it.name||'Matériel',brand:obj?.brand||'',model:obj?.model||'',qty:Math.max(1,Number(it.qty)||1),status:'assigned',departedQty:0,returnedQty:0};});const missing=mapped.filter(x=>!x.itemId||!items.some(i=>i.id===x.itemId));const shortages=mapped.filter(x=>{const obj=items.find(i=>i.id===x.itemId);return obj&&getAvailableQty(ensureItemQtyState(obj))<x.qty;});let warning='';if(missing.length)warning+='\nMatériel absent de l’inventaire : '+missing.map(x=>x.name).join(', ');if(shortages.length)warning+='\nQuantité actuellement disponible insuffisante : '+shortages.map(x=>x.name).join(', ');if(warning&&!confirm('Attention :'+warning+'\n\nCréer quand même le prêt ?'))return;const loanId='webreq-'+req.id;if(!loans.some(x=>x.id===loanId)){loans.push({id:loanId,client:req.requester_name,firstname:'',contact:[req.requester_email,req.requester_phone].filter(Boolean).join(' · '),startDate:req.start_date,endDate:req.end_date,objectif:req.purpose||'Demande en ligne',notes:req.notes||'',items:mapped,status:'validated',createdAt:req.created_at||new Date().toISOString(),requestId:req.id});saveAll();}await updateOnlineRequest(id,'approved','Demande acceptée. Le prêt est créé dans La Caverne d’Alibaab.');await syncNow('auto');await loadOnlineRequests();}
$('#refreshRequests')?.addEventListener('click',loadOnlineRequests);
$('#publishCatalog')?.addEventListener('click',publishPortalCatalog);
$('#portalBaseUrl')?.addEventListener('change',e=>localStorage.setItem('caverne_portal_base',e.target.value.trim()));
if($('#portalBaseUrl'))$('#portalBaseUrl').value=localStorage.getItem('caverne_portal_base')||'';
$('#makePortalLink')?.addEventListener('click',async()=>{try{const {cfg,session}=await portalOwner();const base=$('#portalBaseUrl').value.trim();if(!base)throw Error('Saisis d’abord l’adresse GitHub Pages de ton site publié.');const u=new URL('demande.html',base.endsWith('/')?base:base+'/');u.searchParams.set('owner',session.user.id);u.searchParams.set('project',cfg.url);u.searchParams.set('key',cfg.key);$('#portalLink').value=u.toString();$('#portalLink').focus();$('#portalLink').select();portalSetStatus('Lien créé. Copie-le et partage-le à tes clients et collègues.',true);}catch(e){portalSetStatus(e.message);}});
$('#requestAdminList')?.addEventListener('click',async e=>{const a=e.target.closest('[data-request-accept]'),r=e.target.closest('[data-request-reject]'),c=e.target.closest('[data-request-change]');try{if(a){if(!confirm('Accepter cette demande et créer le prêt dans tes locations ?'))return;await acceptOnlineRequest(a.dataset.requestAccept);}else if(r){const msg=prompt('Motif du refus (facultatif) :')??null;if(msg===null)return;await updateOnlineRequest(r.dataset.requestReject,'rejected',msg);await loadOnlineRequests();}else if(c){const msg=prompt('Explique les modifications proposées (dates, quantités, matériel…) :');if(msg===null||!msg.trim())return;await updateOnlineRequest(c.dataset.requestChange,'changes_requested',msg);await loadOnlineRequests();}}catch(err){alert(err.message);}});

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
