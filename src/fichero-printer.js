/* Pilote Bluetooth BLE pour FICHERO D11s / AiYin D11s.
 * Protocole documenté par rétro-ingénierie : service 0x18f0, écriture 0x2af1.
 * Le rendu est envoyé en raster monochrome 96 x 240 px (203 dpi).
 */
(() => {
  const SERVICE = '000018f0-0000-1000-8000-00805f9b34fb';
  const WRITE = '00002af1-0000-1000-8000-00805f9b34fb';
  const NOTIFY = '00002af0-0000-1000-8000-00805f9b34fb';
  const WIDTH = 96, HEIGHT = 240; // tête native 96 px (14 mm) × avance 240 px (30 mm)
  let device = null, characteristic = null, server = null;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const command = (...bytes) => new Uint8Array(bytes);

  async function connect() {
    if (!navigator.bluetooth) throw new Error('Bluetooth direct indisponible dans ce navigateur. Utilise l’application Mac/Windows ou Chrome/Edge compatible Web Bluetooth.');
    if (device?.gatt?.connected && characteristic) return getInfo();
    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'FICHERO' }, { namePrefix: 'D11s' }],
      optionalServices: [SERVICE, '0000ff00-0000-1000-8000-00805f9b34fb']
    });
    device.addEventListener('gattserverdisconnected', () => { characteristic = null; server = null; });
    server = await device.gatt.connect();
    let service;
    try { service = await server.getPrimaryService(SERVICE); }
    catch (_) { service = await server.getPrimaryService('0000ff00-0000-1000-8000-00805f9b34fb'); }
    try { characteristic = await service.getCharacteristic(WRITE); }
    catch (_) { characteristic = await service.getCharacteristic('0000ff02-0000-1000-8000-00805f9b34fb'); }
    try {
      const notify = await service.getCharacteristic(NOTIFY);
      await notify.startNotifications();
    } catch (_) { /* Les notifications sont facultatives pour l’impression. */ }
    return getInfo();
  }

  async function write(bytes) {
    if (!characteristic) throw new Error('Imprimante non connectée.');
    const chunkSize = 20; // taille BLE universelle, compatible avec le MTU minimal
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.slice(offset, Math.min(offset + chunkSize, bytes.length));
      if (characteristic.writeValueWithoutResponse && characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else if (characteristic.writeValueWithResponse) {
        await characteristic.writeValueWithResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
      if (chunkSize === 20) await sleep(8);
    }
  }

  async function getInfo() {
    return { name: device?.name || 'FICHERO / D11s', connected: !!device?.gatt?.connected };
  }

  function drawLabel(label, type) {
    // Canvas logique paysage 240 × 96, pivoté vers le raster natif 96 × 240.
    const logical=document.createElement('canvas');logical.width=240;logical.height=96;
    const ctx=logical.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,240,96);
    const finish=()=>{
      const native=document.createElement('canvas');native.width=WIDTH;native.height=HEIGHT;
      const nctx=native.getContext('2d',{willReadFrequently:true});
      nctx.fillStyle='#fff';nctx.fillRect(0,0,WIDTH,HEIGHT);
      nctx.translate(WIDTH,0);nctx.rotate(Math.PI/2);nctx.imageSmoothingEnabled=false;nctx.drawImage(logical,0,0);
      return toRaster(native);
    };
    if(type==='barcode'){
      if(!window.EAN13Barcode?.valid(label.unit?.ean13))throw new Error('EAN-13 absent ou invalide pour '+(label.item?.name||'cet objet'));
      EAN13Barcode.draw(ctx,label.unit.ean13,{x:3,y:1,moduleWidth:2,barHeight:64,textY:84,fontSize:10,quiet:11});
      return finish();
    }
    const value=String(label.unit?.publicUrl||'');
    if(!value)throw new Error('URL publique absente. Publie d’abord la fiche anti-perte.');
    const qr=new QRCodeLib(0,0);qr.addData(value);qr.make();
    const count=qr.getModuleCount(),quiet=4,module=2,total=(count+quiet*2)*module;
    if(total>96)throw new Error('QR trop dense pour le rouleau 30 × 14 mm ('+count+' modules). Configure src/public-config.js pour utiliser une URL courte, puis republie GitHub Pages.');
    const qx=Math.floor((96-total)/2),qy=Math.floor((96-total)/2);
    ctx.fillStyle='#fff';ctx.fillRect(qx,qy,total,total);ctx.fillStyle='#000';
    for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))ctx.fillRect(qx+(c+quiet)*module,qy+(r+quiet)*module,module,module);
    const name=String(label.item?.name||'MATÉRIEL').trim();
    ctx.fillStyle='#000';ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='bold 12px Arial';
    const words=name.split(/\s+/);let lines=[''],line=0;
    for(const word of words){const test=(lines[line]+' '+word).trim();if(ctx.measureText(test).width<=134)lines[line]=test;else if(line===0){line=1;lines[1]=word;}else{lines[1]=lines[1].replace(/…?$/,'…');break;}}
    ctx.fillText(lines[0],100,25,136);if(lines[1])ctx.fillText(lines[1],100,40,136);
    ctx.font='bold 10px Arial';ctx.fillText('Réf. '+String(label.unit?.tag||label.unit?.publicCode||''),100,61,136);
    ctx.font='bold 9px Arial';ctx.fillText('SCANNEZ SI PERDU',100,82,136);
    return finish();
  }

  function toRaster(canvas) {
    const { data } = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, WIDTH, HEIGHT);
    const raster = new Uint8Array((WIDTH / 8) * HEIGHT);
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4;
      const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      if (lum < 160) raster[y * (WIDTH / 8) + (x >> 3)] |= (0x80 >> (x & 7));
    }
    return raster;
  }

  async function print(labels, type = 'barcode', onProgress = () => {}) {
    if (!characteristic) await connect();
    const total = labels.length * (type === 'pair' ? 2 : 1);
    if (!labels.length) throw new Error('Aucune étiquette sélectionnée.');
    let current = 0;
    for (let i = 0; i < labels.length; i++) {
      const types = type === 'pair' ? ['barcode', 'owner-qr'] : [type];
      for (const labelType of types) {
      const raster = await drawLabel(labels[i], labelType);
      await write(command(0x10, 0xff, 0x10, 0x00, 0x01)); // densité normale
      await write(command(0x10, 0xff, 0x84, 0x00));       // papier à espace / gap
      await write(new Uint8Array(12));                   // réveil
      await write(command(0x10, 0xff, 0xfe, 0x01));       // activation AiYin
      const header = command(0x1d, 0x76, 0x30, 0x00, WIDTH / 8, 0x00, HEIGHT & 0xff, HEIGHT >> 8);
      await write(header);
      await write(raster);
      await write(command(0x1d, 0x0c));                  // avance à l'étiquette suivante
      await write(command(0x10, 0xff, 0xfe, 0x45));       // fin d'impression AiYin
      current++;
      onProgress({ current, total });
      await sleep(350);
      }
    }
    return getInfo();
  }

  async function disconnect() {
    if (device?.gatt?.connected) device.gatt.disconnect();
    device = null; server = null; characteristic = null;
  }
  window.FicheroPrinter = { connect, print, disconnect, getInfo };
})();
