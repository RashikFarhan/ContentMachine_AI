/**
 * main.js — Electron main process for YT 2.0
 *
 * Boots the Express server in-process, then opens a BrowserWindow
 * that loads the React frontend.
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// ── Set the env flag BEFORE anything else loads ──
process.env.ELECTRON_APP = '1';
process.env.ELECTRON_USER_DATA = path.join(app.getPath('appData'), 'YT2.0');

// Now load paths (which triggers first-run setup)
const paths = require('./paths');

// Load the .env from the user-data location into process.env
require('dotenv').config({ path: paths.envFile });

let mainWindow = null;
const SERVER_PORT = process.env.PORT || 5000;
const isDev = !app.isPackaged;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: 'ContentMachieneAI',
        icon: path.join(__dirname, 'client', 'public', 'vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        show: false,                // show when ready-to-show
        backgroundColor: '#111111', // dark fallback while loading
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    if (isDev) {
        // In dev, the Vite dev server is expected to be running on 5173
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // In production, serve the built React app via Express
        mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ── IPC Handlers ──

// Native folder picker (used by Export Path feature in Phase 2)
ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Export Folder',
    });
    return result.canceled ? null : result.filePaths[0];
});

// Native file picker (for importing YouTube client_secret JSON)
ipcMain.handle('dialog:openFile', async (_event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        title: options?.title || 'Select File',
        filters: options?.filters || [{ name: 'JSON Files', extensions: ['json'] }],
    });
    return result.canceled ? null : result.filePaths[0];
});

// Get user-data path (so renderer can display it if needed)
ipcMain.handle('app:getUserDataPath', () => {
    return paths.userDataDir;
});

// ── App Lifecycle ──

app.whenReady().then(async () => {
    try {
        // Start the Express server in-process
        console.log('Electron: Starting Express server...');
        require('./server/index.js');

        // Give the server a moment to bind the port
        await new Promise(r => setTimeout(r, 500));

        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    } catch (err) {
        console.error('Fatal startup error:', err);
        require('fs').writeFileSync(path.join(app.getPath('userData'), 'crash.txt'), err.stack || err.message);
        dialog.showErrorBox("Startup Error", "Failed to start the background server.\n\n" + (err.stack || err.message));
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
