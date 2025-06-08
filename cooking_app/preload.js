// Preload script - bridges the renderer and main processes safely
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    askCookingQuestion: (question) => ipcRenderer.invoke('ask-cooking-question', question)
  }
);

window.addEventListener('DOMContentLoaded', () => {
  console.log('Kitchen Helper app loaded!')
});