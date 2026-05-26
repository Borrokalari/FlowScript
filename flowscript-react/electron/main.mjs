import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { join, dirname } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const isDev = !app.isPackaged;

// ── Per-window state ──────────────────────────────────────────────────────────
// Each window tracks its own current file path and optional pending load content.
const windowFilePaths    = new Map(); // webContents.id → filePath
const pendingInitContent = new Map(); // webContents.id → flowscript JSON string
const pendingTextFile    = new Map(); // webContents.id → { content, filePath, fileName, language }

const winFrom   = (e) => BrowserWindow.fromWebContents(e.sender);
const getFilePath = (e) => windowFilePaths.get(e.sender.id) ?? null;
const setFilePath = (e, p) => p === null
  ? windowFilePaths.delete(e.sender.id)
  : windowFilePaths.set(e.sender.id, p);

// ── Config (first-launch detection) ──────────────────────────────────────────
let configPath = null; // initialised inside app.whenReady

function getConfig() {
  if (!configPath || !existsSync(configPath)) return {};
  try { return JSON.parse(readFileSync(configPath, 'utf-8')); } catch { return {}; }
}
function saveConfig(updates) {
  writeFileSync(configPath, JSON.stringify({ ...getConfig(), ...updates }, null, 2));
}

function getRecentFiles() {
  return getConfig().recentFiles ?? [];
}
function addToRecent(filePath) {
  if (!filePath) return;
  const fileName = filePath.split(/[\\/]/).pop();
  const filtered = getRecentFiles().filter((f) => f.filePath !== filePath);
  saveConfig({ recentFiles: [{ filePath, fileName }, ...filtered].slice(0, 10) });
}

// ── Templates ────────────────────────────────────────────────────────────────

function templatesFilePath() {
  return join(app.getPath('userData'), 'templates.json');
}
function getTemplates() {
  const p = templatesFilePath();
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return []; }
}
function writeTemplates(templates) {
  writeFileSync(templatesFilePath(), JSON.stringify(templates, null, 2));
}

// ── Tutorial file path ────────────────────────────────────────────────────────
function tutorialPath() {
  return isDev
    ? join(app.getAppPath(), 'public', 'tutorial.flowscript')
    : join(app.getAppPath(), 'dist',   'tutorial.flowscript');
}

function whatsNewPath() {
  return isDev
    ? join(app.getAppPath(), 'public', 'whats_new.md')
    : join(app.getAppPath(), 'dist',   'whats_new.md');
}

// ── Window factory ────────────────────────────────────────────────────────────
function createWindow() {
  const iconPath = isDev
    ? join(app.getAppPath(), 'public', 'FlowScript_Logo.png')
    : join(app.getAppPath(), 'dist',   'FlowScript_Logo.png');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: 'FlowScript',
    icon: iconPath,
    frame: false,
    webPreferences: {
      preload: join(app.getAppPath(), 'dist-electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const wcId = win.webContents.id;
  win.on('maximize',   () => { if (!win.isDestroyed()) win.webContents.send('win:maximizeChange', true); });
  win.on('unmaximize', () => { if (!win.isDestroyed()) win.webContents.send('win:maximizeChange', false); });
  win.on('close', (e) => {
    e.preventDefault();
    win.webContents.send('win:checkUnsaved');
  });
  win.on('closed', () => {
    windowFilePaths.delete(wcId);
    pendingInitContent.delete(wcId);
    pendingTextFile.delete(wcId);
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173');
  } else {
    win.loadFile(join(app.getAppPath(), 'dist', 'index.html'));
  }

  return win;
}

// ── Window controls (per-window via event.sender) ─────────────────────────────
ipcMain.on('win:minimize',  (e) => winFrom(e)?.minimize());
ipcMain.on('win:maximize',  (e) => { const w = winFrom(e); if (w?.isMaximized()) w.unmaximize(); else w?.maximize(); });
ipcMain.on('win:close',     (e) => winFrom(e)?.close());
ipcMain.handle('win:isMaximized', (e) => winFrom(e)?.isMaximized() ?? false);

ipcMain.on('win:unsavedResponse', async (e, { isDirty, fileName }) => {
  const win = winFrom(e);
  if (!win) return;
  if (!isDirty) { win.destroy(); return; }
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Unsaved Changes',
    message: `Save changes to "${fileName}"?`,
    detail: 'Your changes will be lost if you don\'t save them.',
  });
  if (response === 0) { win.webContents.send('win:triggerSaveAndClose'); }
  else if (response === 1) { win.destroy(); }
});

ipcMain.on('win:savedAndReady', (e) => winFrom(e)?.destroy());

// ── File helpers ──────────────────────────────────────────────────────────────
function commitSave(e, filePath, content) {
  writeFileSync(filePath, content, 'utf-8');
  setFilePath(e, filePath);
  addToRecent(filePath);
  return { success: true, filePath, fileName: filePath.split(/[\\/]/).pop() };
}

async function showSaveDialog(e, content, fileType = 'flowscript') {
  const isFrame = fileType === 'frame';
  const result = await dialog.showSaveDialog(winFrom(e), {
    title:       isFrame ? 'Save Frame Walker File' : 'Save FlowScript File',
    defaultPath: getFilePath(e) ?? (isFrame ? 'Untitled.frame' : 'Untitled.flowscript'),
    filters:     isFrame
      ? [{ name: 'Frame Walker Files', extensions: ['frame'] }]
      : [{ name: 'FlowScript Files',   extensions: ['flowscript'] }],
  });
  if (result.canceled || !result.filePath) return { success: false };
  return commitSave(e, result.filePath, content);
}

// ── File IPC ──────────────────────────────────────────────────────────────────
ipcMain.handle('file:new', (e) => {
  setFilePath(e, null);
  return { success: true };
});

ipcMain.handle('file:newFrame', (e) => {
  setFilePath(e, null);
  return { success: true };
});

ipcMain.handle('file:open', async (e) => {
  const result = await dialog.showOpenDialog(winFrom(e), {
    title: 'Open File',
    filters: [
      { name: 'All Supported', extensions: ['flowscript', 'frame', 'txt', 'md'] },
      { name: 'FlowScript Files', extensions: ['flowscript'] },
      { name: 'Frame Walker Files', extensions: ['frame'] },
      { name: 'Text Files', extensions: ['txt', 'md'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return { success: false };
  const fp = result.filePaths[0];
  const content = readFileSync(fp, 'utf-8');
  const ext = fp.split('.').pop().toLowerCase();
  if (ext === 'flowscript' || ext === 'frame') { setFilePath(e, fp); addToRecent(fp); }
  return { success: true, content, filePath: fp, fileName: fp.split(/[\\/]/).pop() };
});

ipcMain.handle('file:loadTextLocally', (e, filePath) => {
  setFilePath(e, filePath);
  addToRecent(filePath);
  return { success: true };
});

ipcMain.handle('file:saveTextAs', async (e, content) => {
  const result = await dialog.showSaveDialog(winFrom(e), {
    title: 'Save Text File',
    defaultPath: getFilePath(e) ?? 'Untitled.txt',
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePath) return { success: false };
  return commitSave(e, result.filePath, content);
});

ipcMain.handle('file:save',   async (e, content, fileType) => {
  const fp = getFilePath(e);
  return fp ? commitSave(e, fp, content) : showSaveDialog(e, content, fileType);
});
ipcMain.handle('file:saveAs', async (e, content, fileType) => showSaveDialog(e, content, fileType));

// ── App / tutorial IPC ────────────────────────────────────────────────────────
ipcMain.handle('app:getInitialState', (e) => {
  const textPending = pendingTextFile.get(e.sender.id);
  if (textPending) {
    pendingTextFile.delete(e.sender.id);
    setFilePath(e, textPending.filePath);
    return { textFile: { content: textPending.content, fileName: textPending.fileName, language: textPending.language } };
  }
  const pending = pendingInitContent.get(e.sender.id);
  if (pending) {
    pendingInitContent.delete(e.sender.id);
    return { content: pending };
  }
  const cfg = getConfig();
  if (!cfg.hasLaunched) {
    saveConfig({ hasLaunched: true });
    const p = tutorialPath();
    if (existsSync(p)) return { content: readFileSync(p, 'utf-8') };
  }
  return {};
});

ipcMain.handle('app:getVersion',        () => app.getVersion());
ipcMain.handle('templates:getAll',     () => getTemplates());
ipcMain.handle('templates:save',       (_, template) => { writeTemplates([...getTemplates(), template]); return { success: true }; });
ipcMain.handle('templates:delete',     (_, id)       => { writeTemplates(getTemplates().filter(t => t.id !== id)); return { success: true }; });
ipcMain.handle('app:getPreferences',   () => getConfig().preferences ?? {});
ipcMain.handle('app:savePreferences',  (_, prefs) => { saveConfig({ preferences: prefs }); return { success: true }; });
ipcMain.handle('app:getRecentFiles',   () => getRecentFiles());
ipcMain.handle('app:clearRecentFiles', () => { saveConfig({ recentFiles: [] }); return { success: true }; });
ipcMain.handle('app:openRecentFile', async (e, filePath) => {
  if (!existsSync(filePath)) {
    saveConfig({ recentFiles: getRecentFiles().filter((f) => f.filePath !== filePath) });
    return { success: false, error: 'notFound' };
  }
  const content = readFileSync(filePath, 'utf-8');
  const ext = filePath.split('.').pop().toLowerCase();
  if (ext === 'flowscript') { setFilePath(e, filePath); addToRecent(filePath); }
  return { success: true, content, filePath, fileName: filePath.split(/[\\/]/).pop() };
});

ipcMain.handle('app:newWindow', () => {
  createWindow();
  return { success: true };
});

ipcMain.handle('app:openWhatsNew', () => {
  const p = whatsNewPath();
  if (!existsSync(p)) return { success: false };
  const content = readFileSync(p, 'utf-8');
  const win = createWindow();
  // filePath is null — saving triggers Save As instead of overwriting the system file
  pendingTextFile.set(win.webContents.id, { content, filePath: null, fileName: "What's New in FlowScript.md", language: 'markdown' });
  return { success: true };
});

ipcMain.handle('app:openTextInNewWindow', (_, content, filePath, fileName, language) => {
  const win = createWindow();
  pendingTextFile.set(win.webContents.id, { content, filePath, fileName, language });
  return { success: true };
});

ipcMain.handle('tutorial:getContent', () => {
  const p = tutorialPath();
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
});

ipcMain.handle('tutorial:openNewWindow', () => {
  const p = tutorialPath();
  if (!existsSync(p)) return { success: false };
  const win = createWindow();
  pendingInitContent.set(win.webContents.id, readFileSync(p, 'utf-8'));
  return { success: true };
});

ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url));

ipcMain.handle('app:isDevMode', () => {
  const candidates = [
    join(app.getAppPath(), 'fsdev.dll'),
    join(dirname(process.execPath), 'fsdev.dll'),
  ];
  return candidates.some(existsSync);
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  configPath = join(app.getPath('userData'), 'config.json');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
