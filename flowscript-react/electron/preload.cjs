const { contextBridge, ipcRenderer } = require('electron');

let maximizeChangeListener = null;

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  newFile:          ()                    => ipcRenderer.invoke('file:new'),
  newFrame:         ()                    => ipcRenderer.invoke('file:newFrame'),
  openFile:         ()                    => ipcRenderer.invoke('file:open'),
  saveFile:         (content, fileType)   => ipcRenderer.invoke('file:save',   content, fileType),
  saveFileAs:       (content, fileType)   => ipcRenderer.invoke('file:saveAs', content, fileType),
  loadTextLocally:  (filePath)       => ipcRenderer.invoke('file:loadTextLocally', filePath),
  saveTextAs:       (content)        => ipcRenderer.invoke('file:saveTextAs', content),
  getVersion:        ()           => ipcRenderer.invoke('app:getVersion'),
  getPreferences:    ()           => ipcRenderer.invoke('app:getPreferences'),
  savePreferences:   (prefs)      => ipcRenderer.invoke('app:savePreferences', prefs),
  // Templates
  getTemplates:      ()           => ipcRenderer.invoke('templates:getAll'),
  saveTemplate:      (template)   => ipcRenderer.invoke('templates:save', template),
  deleteTemplate:    (id)         => ipcRenderer.invoke('templates:delete', id),
  // Recent files
  getRecentFiles:   ()           => ipcRenderer.invoke('app:getRecentFiles'),
  clearRecentFiles: ()           => ipcRenderer.invoke('app:clearRecentFiles'),
  openRecentFile:   (filePath)   => ipcRenderer.invoke('app:openRecentFile', filePath),
  // App / windows
  newWindow:            ()                                    => ipcRenderer.invoke('app:newWindow'),
  openWhatsNew:         ()                                    => ipcRenderer.invoke('app:openWhatsNew'),
  openTextInNewWindow:  (content, fp, fileName, lang)        => ipcRenderer.invoke('app:openTextInNewWindow', content, fp, fileName, lang),
  getInitialState:       () => ipcRenderer.invoke('app:getInitialState'),
  getTutorialContent:    () => ipcRenderer.invoke('tutorial:getContent'),
  openTutorialNewWindow: () => ipcRenderer.invoke('tutorial:openNewWindow'),
  // Window controls
  minimize:    () => ipcRenderer.send('win:minimize'),
  maximize:    () => ipcRenderer.send('win:maximize'),
  close:       () => ipcRenderer.send('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  onMaximizeChange: (cb) => {
    if (maximizeChangeListener) {
      ipcRenderer.removeListener('win:maximizeChange', maximizeChangeListener);
    }
    maximizeChangeListener = (_, val) => cb(val);
    ipcRenderer.on('win:maximizeChange', maximizeChangeListener);
  },
  onCheckUnsaved: (cb) => {
    const wrapped = () => cb();
    ipcRenderer.on('win:checkUnsaved', wrapped);
    return () => ipcRenderer.removeListener('win:checkUnsaved', wrapped);
  },
  sendUnsavedResponse: (data) => ipcRenderer.send('win:unsavedResponse', data),
  onTriggerSaveAndClose: (cb) => {
    const wrapped = () => cb();
    ipcRenderer.on('win:triggerSaveAndClose', wrapped);
    return () => ipcRenderer.removeListener('win:triggerSaveAndClose', wrapped);
  },
  sendSavedAndReady: () => ipcRenderer.send('win:savedAndReady'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  isDevMode:    ()    => ipcRenderer.invoke('app:isDevMode'),
});
