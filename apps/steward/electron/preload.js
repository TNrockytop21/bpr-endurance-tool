const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('irsdk', {
  // Replay control
  replayJump: (sessionTime) => ipcRenderer.invoke('irsdk:replay:jump', sessionTime),
  replaySpeed: (speed) => ipcRenderer.invoke('irsdk:replay:speed', speed),
  replayCamera: (carIdx, camGroup) => ipcRenderer.invoke('irsdk:replay:camera', carIdx, camGroup),
  getStatus: () => ipcRenderer.invoke('irsdk:status'),
});
