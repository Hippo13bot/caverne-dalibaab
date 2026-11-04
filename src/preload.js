const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('caverneDesktop', { platform: process.platform });
