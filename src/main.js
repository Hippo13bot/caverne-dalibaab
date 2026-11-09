const { app, BrowserWindow, dialog } = require('electron');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 900, minHeight: 650,
    backgroundColor: '#171a1d',
    title: "La caverne d'Alibaab",
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault();
    const matches = devices.filter(d => /^(FICHERO|D11s)/i.test(d.deviceName || ''));
    if (!matches.length) return; // Electron peut réémettre l’événement à mesure que les appareils sont détectés.
    if (matches.length === 1) { callback(matches[0].deviceId); return; }
    const names = matches.map(d => d.deviceName || 'FICHERO / D11s');
    dialog.showMessageBox(win, { type: 'question', title: 'Choisir l’imprimante FICHERO', message: 'Quelle imprimante veux-tu connecter ?', buttons: [...names, 'Annuler'], cancelId: names.length }).then(({ response }) => {
      callback(response < matches.length ? matches[response].deviceId : '');
    }).catch(() => callback(''));
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
