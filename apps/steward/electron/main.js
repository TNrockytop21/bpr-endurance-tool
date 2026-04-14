const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

const isDev = !app.isPackaged;
const DEV_URL = process.env.VITE_DEV_URL || 'http://localhost:5179';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#060608',
    title: 'BPR Race Control',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ---------------------------------------------------------------
// IPC: iRacing SDK (replay control) — placeholder for Phase 2
// ---------------------------------------------------------------
// These handlers will use node-irsdk-2023 to control the local
// iRacing instance. For now they log and return stubs.

ipcMain.handle('irsdk:replay:jump', async (event, sessionTime) => {
  console.log(`[irsdk] replay jump to sessionTime=${sessionTime}`);
  // TODO: BroadcastMsg(ReplaySearchSessionTime, sessionTime)
  return { ok: true, sessionTime };
});

ipcMain.handle('irsdk:replay:speed', async (event, speed) => {
  console.log(`[irsdk] replay speed=${speed}`);
  // TODO: BroadcastMsg(ReplaySetPlaySpeed, speed)
  return { ok: true, speed };
});

ipcMain.handle('irsdk:replay:camera', async (event, carIdx, camGroup) => {
  console.log(`[irsdk] camera -> car=${carIdx} group=${camGroup}`);
  // TODO: BroadcastMsg(CamSwitchNum, carIdx, camGroup)
  return { ok: true, carIdx, camGroup };
});

ipcMain.handle('irsdk:status', async () => {
  // TODO: return real connection status from node-irsdk-2023
  return { connected: false, message: 'iRacing SDK not yet integrated' };
});
