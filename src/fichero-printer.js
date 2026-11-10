/* Pilote Bluetooth BLE pour FICHERO D11s / AiYin D11s.
 * Protocole documenté par rétro-ingénierie : service 0x18f0, écriture 0x2af1.
 * Étiquette 1 = QR objet (CA-XXXXXXXX), étiquette 2 = QR anti-perte + nom. Le rendu est envoyé en raster monochrome 96 x 240 px (203 dpi).
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

  const LW = 240, LH = 96; // canevas logique paysage (30 × 12 mm à 203 dpi)
  const FONT = 'Arial, Helvetica, sans-serif';
  function wrapLines(ctx, text, maxW) {
    const lines = []; let line = '';
    for (const rawWord of String(text).trim().split(/\s+/).filter(Boolean)) {
      let word = rawWord;
      while (ctx.measureText(word).width > maxW && word.length > 1) { // mot trop long : coupe au caractère
        let k = word.length - 1; while (k > 1 && ctx.measureText(word.slice(0, k)).width > maxW) k--;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, k)); word = word.slice(k);
      }
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxW) line = test; else { if (line) lines.push(line); line = word; }
    }
    if (line) lines.push(line); return lines;
  }
  function fitText(ctx, text, { maxW, maxLines, maxH, sizes }) {
    for (const size of sizes) {
      ctx.font = `bold ${size}px ${FONT}`;
      const lines = wrapLines(ctx, text, maxW);
      if (lines.length <= maxLines && lines.length * size * 1.1 <= maxH) return { size, lines };
    }
    const size = sizes[sizes.length - 1]; ctx.font = `bold ${size}px ${FONT}`;
    let lines = wrapLines(ctx, text, maxW);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines); let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '…';
    }
    return { size, lines };
  }
  function drawBlock(ctx, fit, x, top, height, color = '#000') { // bloc de texte centré verticalement dans [top, top+height]
    const lh = fit.size * 1.1, h = fit.lines.length * lh; let y = top + Math.max(0, (height - h) / 2);
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `bold ${fit.size}px ${FONT}`;
    for (const line of fit.lines) { ctx.fillText(line, x, Math.round(y)); y += lh; }
    return h;
  }
  function drawQr(ctx, qr, x, y, module) {
    const count = qr.getModuleCount(); ctx.fillStyle = '#000';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) ctx.fillRect(x + c * module, y + r * module, module, module);
  }
  function makeQr(value, level) { const qr = new QRCodeLib(0, level); qr.addData(value); qr.make(); return qr; }

  // Rendu logique 240 × 96 (noir sur blanc). Utilisé à la fois pour l'impression Bluetooth et la fenêtre d'impression.
  function drawLogical(label, type) {
    const logical = document.createElement('canvas'); logical.width = LW; logical.height = LH;
    const ctx = logical.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, LW, LH);
    const name = String(label.item?.name || 'MATÉRIEL').trim();
    if (type === 'object-qr') {
      // Étiquette 1 : QR d'identification le plus gros possible (version 1 = 21 modules × 4 points = 84 points), nom à droite,
      // et hashtag de l'exemplaire seulement s'il y a plusieurs quantités.
      const qr = makeQr(CavernCodes.objectQrValue(label.unit?.publicCode), 0);
      const count = qr.getModuleCount(), module = Math.floor(LH / (count + 1)), size = count * module; // ≥ 1 module de marge
      const qx = Math.floor((LH - size) / 2), qy = qx;
      if (size > LH) throw new Error('QR objet trop grand pour la tête d’impression.');
      drawQr(ctx, qr, qx, qy, module);
      const x0 = LH + 4, maxW = LW - x0 - 4, top = 5, area = LH - 10;
      const many = (label.item?.units?.length || 1) > 1, tag = String(label.unit?.tag || '').trim();
      if (many && tag) {
        const tagFit = fitText(ctx, tag, { maxW, maxLines: 1, maxH: 30, sizes: [24, 22, 20, 18, 16, 15, 14, 13, 12] });
        const tagH = Math.ceil(tagFit.size * 1.1) + 2;
        const nameFit = fitText(ctx, name, { maxW, maxLines: 2, maxH: area - tagH - 3, sizes: [26, 24, 22, 20, 18, 16, 15, 14, 13, 12, 11] });
        drawBlock(ctx, nameFit, x0, top, area - tagH - 3);
        drawBlock(ctx, tagFit, x0, top + area - tagH, tagH);
      } else {
        const nameFit = fitText(ctx, name, { maxW, maxLines: 3, maxH: area, sizes: [28, 26, 24, 22, 20, 18, 16, 15, 14, 13, 12, 11] });
        drawBlock(ctx, nameFit, x0, top, area);
      }
      return logical;
    }
    if (type === 'owner-qr') {
      const value = String(label.unit?.publicUrl || '');
      if (!value) throw new Error('Contenu du QR anti-perte absent.');
      let qr = null, module = 0; // essaie M puis L et garde le QR qui permet les plus gros points (4 max)
      for (const level of [0, 1]) {
        const cand = makeQr(value, level), m = Math.min(4, Math.floor(LH / (cand.getModuleCount() + 2)));
        if (m > module) { qr = cand; module = m; }
      }
      const count = qr.getModuleCount();
      if (module < 2) throw new Error('QR anti-perte trop dense pour le rouleau 30 × 14 mm (' + count + ' modules). Choisis « Contact direct » dans la fenêtre Étiquettes.');
      const quiet = Math.min(4, Math.floor((LH / module - count) / 2)), total = (count + quiet * 2) * module, qx = Math.floor((LH - total) / 2);
      drawQr(ctx, qr, qx + quiet * module, qx + quiet * module, module);
      const x0 = LH + 2, maxW = LW - x0 - 4, top = 5, area = LH - 10;
      const refFit = fitText(ctx, 'Réf. ' + String(label.unit?.tag || label.unit?.publicCode || ''), { maxW, maxLines: 1, maxH: 16, sizes: [13, 12, 11, 10, 9] });
      const footFit = fitText(ctx, 'SCANNEZ SI PERDU', { maxW: maxW - 6, maxLines: 1, maxH: 18, sizes: [14, 13, 12, 11, 10, 9] });
      const footH = Math.ceil(footFit.size * 1.1) + 5, refH = Math.ceil(refFit.size * 1.1) + 1;
      ctx.fillStyle = '#000'; ctx.fillRect(x0, top + area - footH, maxW, footH); // bandeau noir, texte blanc
      drawBlock(ctx, footFit, x0 + 3, top + area - footH, footH, '#fff');
      drawBlock(ctx, refFit, x0, top + area - footH - refH - 1, refH);
      const nameFit = fitText(ctx, name, { maxW, maxLines: 3, maxH: area - footH - refH - 5, sizes: [22, 20, 18, 16, 15, 14, 13, 12, 11] });
      drawBlock(ctx, nameFit, x0, top, area - footH - refH - 5);
      return logical;
    }
    throw new Error('Type d’étiquette inconnu : ' + type);
  }
  function drawLabel(label, type) {
    const logical = drawLogical(label, type);
    const native = document.createElement('canvas'); native.width = WIDTH; native.height = HEIGHT;
    const nctx = native.getContext('2d', { willReadFrequently: true });
    nctx.fillStyle = '#fff'; nctx.fillRect(0, 0, WIDTH, HEIGHT);
    nctx.translate(WIDTH, 0); nctx.rotate(Math.PI / 2); nctx.imageSmoothingEnabled = false; nctx.drawImage(logical, 0, 0);
    return toRaster(native);
  }
  function logicalDataUrl(label, type) { return drawLogical(label, type).toDataURL('image/png'); }

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

  async function print(labels, type = 'pair', onProgress = () => {}) {
    if (!characteristic) await connect();
    const total = labels.length * (type === 'pair' ? 2 : 1);
    if (!labels.length) throw new Error('Aucune étiquette sélectionnée.');
    let current = 0;
    for (let i = 0; i < labels.length; i++) {
      const types = type === 'pair' ? ['object-qr', 'owner-qr'] : [type];
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
  window.FicheroPrinter = { connect, print, disconnect, getInfo, logicalDataUrl };
})();
