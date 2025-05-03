const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const url = require('url');
const spotify = require('./spotify');
const axios = require('axios');
const fs = require('fs');
const fontList = require('font-list');

const SETTINGS_PATH = path.join(__dirname, 'settings.json');

function loadAppSettings() {
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH));
    } catch (e) { return {}; }
  }
  return {};
}

function saveAppSettings(newSettings) {
  let current = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try { current = JSON.parse(fs.readFileSync(SETTINGS_PATH)); } catch (e) { current = {}; }
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ ...current, ...newSettings }, null, 2));
}

let windowStates = loadAppSettings().windowStates || {};

let mainWindow;
let settingsWindow = null;
let artistTitleWindow = null;
let lyricsWindow = null;
let settings = {
  opacity: 1,
  radius: 1,
  alwaysOnTop: true,
  coverSize: 150
};

let loadedSettings = loadAppSettings().settings;
if (loadedSettings) {
  settings = { ...settings, ...loadedSettings };
}

let lyricsOffset = null;

function createSettingsWindow() {
  const state = windowStates.settingsWindow || {};
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: state.width || 340,
    height: state.height || 370,
    x: state.x,
    y: state.y,
    minWidth: 150,
    minHeight: 150,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    transparent: true,
    hasShadow: true,
    title: '',
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  settingsWindow.loadFile('settings.html');
  applySettings(settingsWindow, 'settings');
  settingsWindow.on('moved', saveAllWindowStates);
  settingsWindow.on('resize', saveAllWindowStates);
  settingsWindow.on('closed', () => { settingsWindow = null; });
  settingsWindow.webContents.on('did-finish-load', async () => {
    settingsWindow.webContents.send('settings-update', settings);
    const fonts = await fontList.getFonts().then(fonts => [...new Set(fonts.map(f => f.split(':')[0]))]).catch(() => ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy']);
    settingsWindow.webContents.send('system-fonts', fonts);
  });
}

ipcMain.on('open-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
    settingsWindow = null;
  } else {
    createSettingsWindow();
  }
});

ipcMain.on('settings-update', (event, newSettings) => {
  settings = { ...settings, ...newSettings };
  saveAppSettings({ settings });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setOpacity(settings.opacity !== undefined ? settings.opacity : 1);
    mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
    mainWindow.webContents.send('settings-update', settings);
  }
  if (lyricsWindow && !lyricsWindow.isDestroyed()) {
    lyricsWindow.setOpacity(settings.lyricsOpacity !== undefined ? settings.lyricsOpacity : 1);
    lyricsWindow.setAlwaysOnTop(settings.alwaysOnTop);
    lyricsWindow.webContents.send('settings-update', settings);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setOpacity(settings.settingsOpacity !== undefined ? settings.settingsOpacity : 1);
    settingsWindow.setAlwaysOnTop(true);
    settingsWindow.webContents.send('settings-update', settings);
  }
  if (artistTitleWindow && !artistTitleWindow.isDestroyed()) {
    artistTitleWindow.setOpacity(settings.opacity !== undefined ? settings.opacity : 1);
    artistTitleWindow.setAlwaysOnTop(true);
    artistTitleWindow.webContents.send('settings-update', settings);
  }
});

function applySettings(win, type) {
  if (!win) return;
  if (type === 'main') {
    win.setOpacity(settings.opacity !== undefined ? settings.opacity : 1);
  } else if (type === 'lyrics') {
    win.setOpacity(settings.lyricsOpacity !== undefined ? settings.lyricsOpacity : 1);
  } else if (type === 'settings') {
    win.setOpacity(settings.settingsOpacity !== undefined ? settings.settingsOpacity : 1);
  } else {
    win.setOpacity(settings.opacity !== undefined ? settings.opacity : 1);
  }
  win.setAlwaysOnTop(settings.alwaysOnTop);
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('settings-update', settings);
  });
}

function createMainWindow() {
  const state = windowStates.mainWindow || {};
  mainWindow = new BrowserWindow({
    width: state.width || settings.coverSize,
    height: state.height || settings.coverSize,
    x: state.x,
    y: state.y,
    minWidth: 150,
    minHeight: 150,
    frame: false,
    alwaysOnTop: settings.alwaysOnTop,
    resizable: true,
    transparent: true,
    hasShadow: true,
    title: '',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'renderer.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.loadFile('index.html');
  applySettings(mainWindow, 'main');

  function syncLyricsWindow() {
    if (lyricsWindow && !lyricsWindow.isDestroyed()) {
      const [mainX, mainY] = mainWindow.getPosition();
      if (!lyricsOffset) {
        const [lyricsX, lyricsY] = lyricsWindow.getPosition();
        lyricsOffset = [lyricsX - mainX, lyricsY - mainY];
      }
      const desiredX = mainX + lyricsOffset[0];
      const desiredY = mainY + lyricsOffset[1];
      const [currentX, currentY] = lyricsWindow.getPosition();
      if (currentX !== desiredX || currentY !== desiredY) {
        lyricsWindow.setPosition(desiredX, desiredY);
      }
    }
  }

  mainWindow.on('move', syncLyricsWindow);
  mainWindow.on('moved', syncLyricsWindow);
  mainWindow.on('resize', saveAllWindowStates);
  mainWindow.on('closed', () => {
    app.quit();
  });
}

function createLyricsWindow() {
  const state = windowStates.lyricsWindow || {};
  if (lyricsWindow) {
    lyricsWindow.focus();
    return;
  }
  lyricsWindow = new BrowserWindow({
    width: state.width || 420,
    height: state.height || 520,
    x: state.x,
    y: state.y,
    minWidth: 250,
    minHeight: 200,
    frame: false,
    alwaysOnTop: settings.alwaysOnTop,
    resizable: true,
    transparent: true,
    hasShadow: true,
    title: '',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'renderer.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  lyricsWindow.loadFile('lyrics.html');
  applySettings(lyricsWindow, 'lyrics');
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [mainX, mainY] = mainWindow.getPosition();
    if (!lyricsOffset) {
      lyricsOffset = [40, 0];
    }
    lyricsWindow.setPosition(mainX + lyricsOffset[0], mainY + lyricsOffset[1]);
  }
  lyricsWindow.on('moved', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [mainX, mainY] = mainWindow.getPosition();
      const [lyricsX, lyricsY] = lyricsWindow.getPosition();
      lyricsOffset = [lyricsX - mainX, lyricsY - mainY];
    }
    saveAllWindowStates();
  });
  lyricsWindow.on('resize', saveAllWindowStates);
  lyricsWindow.on('closed', () => { lyricsWindow = null; });
}

ipcMain.on('open-lyrics', () => {
  if (lyricsWindow && !lyricsWindow.isDestroyed()) {
    lyricsWindow.close();
    lyricsWindow = null;
  } else {
    createLyricsWindow();
  }
});

ipcMain.on('ensure-lyrics-open', () => {
  if (!lyricsWindow || lyricsWindow.isDestroyed()) {
    createLyricsWindow();
  }
});

ipcMain.handle('fetch-lyrics', async (event, { artist, title, duration }) => {
  try {
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title
    });
    if (duration) params.append('duration', Math.round(duration));
    const url = `https://lrclib.net/api/get?${params.toString()}`;
    const res = await axios.get(url);
    const data = res.data;
    if (data.syncedLyrics) return data.syncedLyrics;
    if (data.plainLyrics) return data.plainLyrics;
    return null;
  } catch (e) {
    return null;
  }
});

async function startSpotifyAuthFlow() {
  const server = http.createServer(async (req, res) => {
    const q = url.parse(req.url, true);
    if (q.pathname === '/callback' && q.query.code) {
      res.end('Authentication complete! You can close this window.');
      server.close();
      await spotify.getTokenFromCode(q.query.code);
      if (mainWindow) mainWindow.webContents.send('spotify-auth-success');
    } else {
      res.end('Please wait...');
    }
  });
  server.listen(8888);
  shell.openExternal(spotify.getAuthUrl());
}

app.whenReady().then(async () => {
  createMainWindow();
  if (!spotify.getSavedToken()) {
    startSpotifyAuthFlow();
  }
});

ipcMain.handle('get-current-track', async () => {
  try {
    const data = await spotify.getCurrentTrack();
    return data;
  } catch (e) {
    return null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function saveAllWindowStates() {
  windowStates = {
    mainWindow: getWindowState(mainWindow),
    lyricsWindow: getWindowState(lyricsWindow),
    settingsWindow: getWindowState(settingsWindow),
    artistTitleWindow: getWindowState(artistTitleWindow)
  };
  saveAppSettings({ windowStates });
}

function getWindowState(win) {
  if (!win || win.isDestroyed()) return undefined;
  const [x, y] = win.getPosition();
  const [width, height] = win.getSize();
  return { x, y, width, height };
}

ipcMain.handle('get-system-fonts', async () => {
  try {
    const fonts = await fontList.getFonts();
    return [...new Set(fonts.map(f => f.split(':')[0]))];
  } catch (e) {
    return ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'];
  }
});

ipcMain.handle('get-settings', () => settings);
