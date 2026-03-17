/**
 * paths.js — Centralized path resolver for the entire application.
 *
 * When running inside Electron (ELECTRON_APP=1), user data lives in
 * %APPDATA%/YT2.0/ so the shipped .exe contains zero personal data.
 *
 * When running in legacy dev mode (start-dev.bat), paths resolve to the
 * project folder exactly like before — zero behavior change.
 */

const path = require('path');
const fs = require('fs');

const IS_ELECTRON = !!process.env.ELECTRON_APP;

// ---------- Resolve the root project directory ----------
// In dev:      this file sits at <project_root>/paths.js
// In packaged: it will be inside the app.asar, but __dirname still works
const PROJECT_ROOT = __dirname;

// ---------- Resolve the user-data base directory ----------
let USER_DATA_DIR;

if (IS_ELECTRON) {
    // Electron's app.getPath('appData') is not available here because this
    // file is loaded before Electron's app module in some flows.
    // Instead, we use the ELECTRON_USER_DATA env var that main.js sets
    // before requiring any server code.
    USER_DATA_DIR = process.env.ELECTRON_USER_DATA
        || path.join(process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'), 'YT2.0');
} else {
    // Legacy dev mode: data lives inside server/ just like before
    USER_DATA_DIR = path.join(PROJECT_ROOT, 'server');
}

// ---------- Build individual paths ----------
const paths = {
    // Root of the project (where paths.js lives)
    projectRoot: PROJECT_ROOT,

    // Whether we are inside Electron
    isElectron: IS_ELECTRON,

    // User-data base directory
    userDataDir: USER_DATA_DIR,

    // Persistent user data (workspaces, history, tokens, etc.)
    dataDir: path.join(USER_DATA_DIR, 'data'),

    // The .env file (API keys)
    envFile: path.join(USER_DATA_DIR, '.env'),

    // OAuth credentials (YouTube client_secret + tokens)
    credentialsDir: IS_ELECTRON
        ? path.join(USER_DATA_DIR, 'credentials')
        : path.join(PROJECT_ROOT, 'credentials'),

    // Publicly-served static files (audio, media, videos)
    publicDir: path.join(PROJECT_ROOT, 'server', 'public'),

    // Temporary files for video generation jobs
    tempDir: path.join(USER_DATA_DIR, 'temp'),

    // Python tool scripts (change_speed.py, enforce_duration.py)
    toolsDir: path.join(PROJECT_ROOT, 'server', 'tools'),

    // Python video builder script
    videoBuilderDir: path.join(PROJECT_ROOT, 'server', 'video_builder'),

    // Server root (for cwd when spawning Python)
    serverRoot: path.join(PROJECT_ROOT, 'server'),

    // Bundled Python executables (produced by build_python.bat)
    pythonDistDir: path.join(PROJECT_ROOT, 'python-dist'),
};

/**
 * Returns the command + args array for spawning a Python script.
 *
 * In Electron packaged mode, we use the pre-built .exe from python-dist/.
 * In dev mode, we call 'python' with the .py script path.
 *
 * @param {'build_video'|'change_speed'|'enforce_duration'} scriptName
 * @param {string[]} args - Extra arguments to pass
 * @returns {{ cmd: string, args: string[] }}
 */
paths.getPythonCommand = function (scriptName, args = []) {
    const exePath = path.join(paths.pythonDistDir, `${scriptName}.exe`);

    if (IS_ELECTRON && fs.existsSync(exePath)) {
        return { cmd: exePath, args: [...args] };
    }

    // Dev mode: map script names to their .py file paths
    const scriptMap = {
        'build_video': path.join(paths.videoBuilderDir, 'build_video.py'),
        'change_speed': path.join(paths.toolsDir, 'change_speed.py'),
        'enforce_duration': path.join(paths.toolsDir, 'enforce_duration.py'),
    };

    return { cmd: 'python', args: [scriptMap[scriptName], ...args] };
};

// ---------- First-run setup ----------
// Ensure all user-data directories exist
const dirsToEnsure = [paths.dataDir, paths.credentialsDir, paths.tempDir];
for (const dir of dirsToEnsure) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Create a template .env if it doesn't exist yet
if (!fs.existsSync(paths.envFile)) {
    const template = [
        '# YT 2.0 — API Keys',
        '# Fill these in via the app\'s Settings > API Keys page, or edit manually.',
        'PORT=5000',
        'GEMINI_API_KEY=',
        'PEXELS_API_KEY=',
        'ELEVENLABS_API_KEY=',
        'ASSEMBLYAI_API_KEY=',
        'META_APP_ID=',
        'META_APP_SECRET=',
        'META_REDIRECT_URI=http://localhost:5173/auth/meta/callback',
        'NGROK_AUTHTOKEN=',
        ''
    ].join('\n');
    fs.writeFileSync(paths.envFile, template);
}

module.exports = paths;
