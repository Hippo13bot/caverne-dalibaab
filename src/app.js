const $ = (s) => document.querySelector(s);
const STORE = 'caverne_alibaab_inventory_v1';
const KITSTORE = 'caverne_alibaab_kits_v1';
let items = [], kits = [];
// Stockage IndexedDB (bien plus de place que localStorage, indispensable pour les photos sur iPhone)
const idb = {
  db: null,
  open(){ return new Promise((res,rej)=>{ const r=indexedDB.open('caverne_alibaab',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>{this.db=r.result;res();}; r.onerror=()=>rej(r.error); }); },
  get(k){ return new Promise((res,rej)=>{ const q=this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); },
  set(k,v){ return new Promise((res,rej)=>{ const t=this.db.transaction('kv','readwrite'); t.objectStore('kv').put(v,k); t.oncomplete=res; t.onerror=()=>rej(t.error); }); }
};
function persist(){ idb.set('state',{items,kits}).catch(()=>alert("Enregistrement impossible : espace de stockage plein ? Fais une sauvegarde.")); }
let editingId = null, photoData = '';
const statusNames = {stock:'En stock',loaned:'Emprunté / sorti',unavailable:'Indisponible'};
const reasonNames = {repair:'En réparation',lost:'Perdu',out_of_service:'Hors service'};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){persist();render();}
function compressImage(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const scale=Math.min(1,1400/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.78));};im.onerror=reject;im.src=r.result;};r.onerror=reject;r.readAsDataURL(file);});}
function render(){
 const q=$('#search').value.toLowerCase().trim(), sf=$('#statusFilter').value, cf=$('#categoryFilter').value;
 const cats=[...new Set(items.map(x=>x.category).filter(Boolean))].sort();
 $('#categoryFilter').innerHTML='<option value="all">Toutes catégories</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
 $('#categoryFilter').value=cats.includes(cf)?cf:'all';
 $('#statTotal').textContent=items.length;$('#statStock').textContent=items.filter(x=>x.status==='stock').length;$('#statLoaned').textContent=items.filter(x=>x.status==='loaned').length;$('#statUnavailable').textContent=items.filter(x=>x.status==='unavailable').length;
 const filtered=items.filter(x=>(sf==='all'||x.status===sf)&&(cf==='all'||x.category===cf)&&[x.name,x.brand,x.model,x.serial,x.category,x.location,x.holder].join(' ').toLowerCase().includes(q));
 $('#count').textContent=`${filtered.length} équipement(s)`;
 $('#inventory').innerHTML=filtered.length?filtered.map(x=>`<article class="item-card">${x.photo?`<img src="${x.photo}" alt="">`:''}<div class="item-meta"><span class="pill">${esc(x.category)}</span><span class="pill ${esc(x.status)}">${statusNames[x.status]}</span></div><h3>${esc(x.name)}</h3><p>${esc([x.brand,x.model].filter(Boolean).join(' · ')||'Modèle non renseigné')}<br>${x.serial?'N° série : '+esc(x.serial):'Sans numéro de série'}<br>${x.location?'Emplacement : '+esc(x.location):'Emplacement non renseigné'}${x.holder?'<br>Avec : '+esc(x.holder):''}${x.dueDate?'<br>Retour prévu : '+esc(x.dueDate):''}${x.status==='unavailable'&&x.reason?'<br>'+reasonNames[x.reason]:''}</p><div class="card-actions"><button class="btn subtle" data-edit="${x.id}">Modifier</button><button class="btn subtle" data-qr="${x.id}">QR code</button><button class="btn subtle" data-print="${x.id}">Fiche PDF</button><button class="btn subtle" data-delete="${x.id}">Supprimer</button></div></article>`).join(''):'<div class="empty">Aucun équipement correspondant. Ajoute du matériel ou modifie tes filtres.</div>';
 renderKits();
}
function renderKits(){
 $('#kits').innerHTML=kits.length?kits.map(k=>`<article class="item-card"><div class="item-meta"><span class="pill">SAC / KIT</span><span class="pill">${(k.items||[]).length} élément(s)</span></div><h3>${esc(k.name)}</h3><p>${esc(k.location||'Emplacement non renseigné')}<br>${esc(k.description||'')}<br>${(k.items||[]).map(id=>items.find(x=>x.id===id)?.name).filter(Boolean).map(esc).join(' · ')}</p><div class="card-actions"><button class="btn subtle" data-kit-delete="${k.id}">Supprimer le kit</button></div></article>`).join(''):'<div class="empty">Aucun sac ou kit. Crée un kit pour regrouper ton matériel.</div>';
}
function resetForm(){ $('#itemForm').reset();photoData='';editingId=null;$('#photoPreview').hidden=true;$('#dialogTitle').textContent='Ajouter du matériel';}
$('#addBtn').onclick=()=>{resetForm();$('#itemDialog').showModal();};
$('#closeItem').onclick=$('#cancelItem').onclick=()=>$('#itemDialog').close();
$('#photo').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{photoData=await compressImage(f);$('#photoPreview').src=photoData;$('#photoPreview').hidden=false;}catch{alert("Impossible de lire cette image.");}};
$('#itemForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries());d.quantity=Math.max(1,Number(d.quantity||1));d.price=d.price?Number(d.price):null;d.photo=photoData;d.id=editingId||uid();if(editingId&&!photoData)d.photo=items.find(x=>x.id===editingId)?.photo||'';if(!d.name.trim())return;items=editingId?items.map(x=>x.id===editingId?d:x):[d,...items];save();$('#itemDialog').close();};
function openEdit(id){const x=items.find(i=>i.id===id);if(!x)return;resetForm();editingId=x.id;$('#dialogTitle').textContent='Modifier le matériel';for(const [k,v] of Object.entries(x)){const el=$(`[name="${k}"]`);if(el&&v!==null&&v!==undefined)el.value=v;}photoData=x.photo||'';if(photoData){$('#photoPreview').src=photoData;$('#photoPreview').hidden=false;}$('#itemDialog').showModal();}
// QR code 100 % local (aucun serveur). Sur le web : le QR contient un lien ; l'appareil photo de l'iPhone ouvre la fiche.
function qrLink(id){return /^https?:/.test(location.protocol)?location.origin+location.pathname+'#item='+id:'caverne-alibaab:'+id;}
function makeQR(text){const Q=window.QRCodeLib;let q;for(let t=3;t<=40;t++){try{q=new Q(t,0);q.addData(text);q.make();break;}catch(e){q=null;}}if(!q)return '';const n=q.getModuleCount(),m=4,px=10,size=(n+2*m)*px,c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,size,size);g.fillStyle='#171a1d';for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))g.fillRect((k+m)*px,(r+m)*px,px,px);return c.toDataURL('image/png');}
function openFromHash(){const m=location.hash.match(/^#item=(.+)$/);if(m){const id=decodeURIComponent(m[1]);history.replaceState(null,'',location.pathname+location.search);if(items.some(i=>i.id===id))openEdit(id);else alert("Cette fiche n'existe pas sur cet appareil. Restaure d'abord une sauvegarde.");}}
$('#inventory').onclick=async e=>{
 const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]'),qr=e.target.closest('[data-qr]'),pr=e.target.closest('[data-print]');
 if(edit){openEdit(edit.dataset.edit);}
 if(del&&confirm('Supprimer définitivement cette fiche ?')){items=items.filter(x=>x.id!==del.dataset.delete);kits=kits.map(k=>({...k,items:(k.items||[]).filter(id=>id!==del.dataset.delete)}));save();}
 if(qr){const x=items.find(i=>i.id===qr.dataset.qr);const data=makeQR(qrLink(x.id));$('#qrTitle').textContent=x.name;$('#qrImage').src=data;$('#qrDialog').showModal();}
 if(pr){const x=items.find(i=>i.id===pr.dataset.print);printItems([x],true);}
};
$('#search').oninput=render;$('#statusFilter').onchange=render;$('#categoryFilter').onchange=render;
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===t));$('#inventoryView').hidden=t.dataset.view!=='inventory';$('#kitsView').hidden=t.dataset.view!=='kits';$('#exportsView').hidden=t.dataset.view!=='exports';});
$('#addKitBtn').onclick=()=>{const s=$('#kitItems');s.innerHTML=items.map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.model||x.category)}</option>`).join('');$('#kitDialog').showModal();};
$('#closeKit').onclick=$('#cancelKit').onclick=()=>$('#kitDialog').close();
$('#kitForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries());d.items=[...$('#kitItems').selectedOptions].map(o=>o.value);d.id=uid();kits.push(d);save();$('#kitDialog').close();};
$('#kits').onclick=e=>{const b=e.target.closest('[data-kit-delete]');if(b&&confirm('Supprimer ce kit ?')){kits=kits.filter(k=>k.id!==b.dataset.kitDelete);save();}};
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href);}
function csv(){const cols=['name','category','brand','model','serial','quantity','status','reason','location','holder','loanDate','dueDate','price','purchaseDate','warranty','condition','notes'];const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';download('caverne-alibaab-inventaire.csv',[cols.join(';'),...items.map(x=>cols.map(k=>q(k==='status'?statusNames[x[k]]:k==='reason'?reasonNames[x[k]]:x[k])).join(';'))].join('\r\n'),'text/csv;charset=utf-8');}
$('#csvBtn').onclick=$('#csvBtn2').onclick=csv;
async function backup(){const json=JSON.stringify({version:1,items,kits},null,2),name='caverne-alibaab-sauvegarde.json';
 try{const f=new File([json],name,{type:'application/json'});if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Sauvegarde La caverne d’Alibaab'});return;}}catch(e){if(e&&e.name==='AbortError')return;}
 download(name,json,'application/json');}
$('#backupBtn').onclick=$('#backupBtn2').onclick=backup;
$('#restoreBtn').onclick=()=>$('#restoreFile').click();
$('#restoreFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data.items))throw Error('Fichier non reconnu');if(confirm('Restaurer cette sauvegarde remplacera les données de cet appareil. Continuer ?')){items=data.items;kits=Array.isArray(data.kits)?data.kits:[];save();}}catch(err){alert('Sauvegarde invalide : '+err.message);}e.target.value='';};
function printItems(list,individual=false){
 const html=list.map(x=>`<article class="sheet"><header><h1>LA CAVERNE D’ALIBAAB</h1><b>FICHE MATÉRIEL</b></header>${x.photo?`<img class="photo" src="${x.photo}">`:''}<h2>${esc(x.name)}</h2><p class="category">${esc(x.category)} · ${statusNames[x.status]}</p><table>${[['Marque',x.brand],['Modèle',x.model],['N° de série',x.serial],['Quantité',x.quantity],['Emplacement',x.location],['Détenteur',x.holder],['Retour prévu',x.dueDate],['Prix d’achat',x.price?x.price+' €':''],['Date d’achat',x.purchaseDate],['Garantie',x.warranty],['État physique',x.condition],['Notes',x.notes]].filter(r=>r[1]).map(r=>`<tr><th>${r[0]}</th><td>${esc(r[1])}</td></tr>`).join('')}</table><p class="serial">Identifiant : ${esc(x.id)}</p></article>`).join('');
 const w=window.open('','_blank');w.document.write(`<!doctype html><html><head><title>Fiches matériel</title><style>body{font-family:Arial;color:#171a1d;margin:0}.sheet{padding:28px;min-height:95vh;page-break-after:always}.sheet:last-child{page-break-after:auto}header{display:flex;justify-content:space-between;border-bottom:3px solid #e7a72d;padding-bottom:12px}h1{font-size:18px}h2{font-size:30px;margin-bottom:5px}.category{color:#9a6b12}.photo{max-width:300px;max-height:210px;object-fit:contain;margin:20px 0}table{border-collapse:collapse;width:100%;margin-top:22px}th,td{text-align:left;border-bottom:1px solid #ddd;padding:10px}th{width:180px;color:#555}.serial{margin-top:30px;color:#777;font-size:10px}@media print{.sheet{break-after:page}.sheet:last-child{break-after:auto}}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}
$('#printAllBtn').onclick=()=>printItems(items);
$('#printEachBtn').onclick=()=>printItems(items,true);
$('#closeQr').onclick=()=>$('#qrDialog').close();
$('#printQr').onclick=()=>{const src=$('#qrImage').src,title=$('#qrTitle').textContent;const w=window.open('','_blank');w.document.write(`<html><body style="font-family:Arial;text-align:center;padding:30px"><h2>${esc(title)}</h2><img src="${src}" style="width:300px"><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();};

// Mouvement réduit : le GIF est remplacé par une image fixe
if(matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelectorAll('img.logo,img.hero-gif').forEach(i=>i.src='icons/icon-192.png');}
// Astuce d'installation iPhone
try{const ios=/iPad|iPhone|iPod/.test(navigator.userAgent),standalone=navigator.standalone||matchMedia('(display-mode: standalone)').matches;if(ios&&!standalone&&!localStorage.getItem('tip_done'))$('#installTip').hidden=false;}catch(e){}
$('#closeTip').onclick=()=>{$('#installTip').hidden=true;try{localStorage.setItem('tip_done','1')}catch(e){}};
(async()=>{
  try{await idb.open();let st=await idb.get('state');
    if(!st){st={items:JSON.parse(localStorage.getItem(STORE)||'[]'),kits:JSON.parse(localStorage.getItem(KITSTORE)||'[]')};if(st.items.length||st.kits.length)await idb.set('state',st);}
    items=st.items||[];kits=st.kits||[];
  }catch(e){alert("Le stockage de l'appareil est indisponible (navigation privée ?). Les données ne seront pas conservées.");}
  render();openFromHash();
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist();}catch(e){}
  if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
window.addEventListener('hashchange',openFromHash);
