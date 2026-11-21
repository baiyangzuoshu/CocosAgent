const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cocosLite', {
  openProject: () => ipcRenderer.invoke('project:open'),
  newProject: (name, scene) => ipcRenderer.invoke('project:new', name, scene),
  saveProject: (scene) => ipcRenderer.invoke('project:save', scene),
  buildWeb: (scene) => ipcRenderer.invoke('project:build-web', scene),
  openProjectLocation: () => ipcRenderer.invoke('project:open-location'),
});
