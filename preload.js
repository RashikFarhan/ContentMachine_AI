/**
 * preload.js — Secure bridge between Electron's main process and the renderer.
 *
 * Exposes only specific IPC methods via contextBridge so the React app
 * can call native features (file/folder pickers, etc.) without
 * direct access to Node.js or Electron internals.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Native folder picker
    selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

    // Native file picker (e.g. for importing YouTube client_secret)
    selectFile: (options) => ipcRenderer.invoke('dialog:openFile', options),

    // Get the user-data directory path
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),

    // Flag so the React app can detect Electron environment
    isElectron: true,
});
