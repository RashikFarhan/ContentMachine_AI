const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const paths = require('../paths');

// Load .env from the centralized location (user-data dir in Electron, server/ in dev)
require('dotenv').config({ path: paths.envFile });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static(paths.publicDir));

// In production / Electron, serve the built React app
const clientDistPath = path.join(paths.projectRoot, 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
}

// Load Routes
const configRoutes = require('./routes/config');
const generateRoutes = require('./routes/generate');
const pexelsRoutes = require('./routes/pexels');
const workspaceRoutes = require('./routes/workspaces');
const ttsRoutes = require('./routes/tts');
const videoRoutes = require('./routes/video');
const youtubeRoutes = require('./routes/youtube');
const metaRoutes = require('./routes/meta');
const tiktokRoutes = require('./routes/tiktok');
const apikeysRoutes = require('./routes/apikeys');
const generateImagesRoutes = require('./routes/generate-images');
const localMediaRoutes = require('./routes/local-media');

app.use('/api/config', configRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/pexels', pexelsRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/tiktok', tiktokRoutes);
app.use('/api/apikeys', apikeysRoutes);
app.use('/api/generate-images', generateImagesRoutes);
app.use('/api/local-media', localMediaRoutes);


// Generic OAuth Callback window messenger
app.get('/auth/:provider/callback', (req, res) => {
    const provider = req.params.provider.toUpperCase();
    console.log(`[PROXY] Hit callback for ${provider} with code length: ${req.query.code?.length}`);
    const code = req.query.code || '';
    const error = req.query.error || '';
    res.send(`
        <html>
            <body style="background:#111; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
                <h2>Authenticating with ${provider}...</h2>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ 
                            type: '${provider}_AUTH_CODE', 
                            code: '${code}', 
                            error: '${error}' 
                        }, '*');
                        document.body.innerHTML += "<p>Authentication successful. You can close this window.</p>";
                        setTimeout(() => window.close(), 1000);
                    } else {
                        document.body.innerHTML += "<p>Authentication completed. You can safely close this window.</p>";
                    }
                </script>
            </body>
        </html>
    `);
});


// Ensure data directory exists (paths.js handles first-run creation,
// but this is a safety net for legacy dev mode)
if (!fs.existsSync(paths.dataDir)) {
    fs.mkdirSync(paths.dataDir, { recursive: true });
}

// Ensure config.json exists (legacy step 1 support)
const configPath = path.join(paths.dataDir, 'config.json');
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ bossPrompt: "" }));
}

// Clear stale video generation locks on startup
try {
    const files = fs.readdirSync(paths.dataDir);
    for (const file of files) {
        if (file.startsWith('video_status_') && file.endsWith('.json')) {
            fs.unlinkSync(path.join(paths.dataDir, file));
        }
    }
} catch (e) {
    console.error("Failed to clear stale video status files:", e);
}

// SPA catch-all: serve index.html for all non-API routes (production/Electron)
if (fs.existsSync(clientDistPath)) {
    app.get(/^(?!\/api).*/, (req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

// Start Server
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);

    if (process.env.NGROK_AUTHTOKEN) {
        try {
            const ngrok = require('@ngrok/ngrok');
            const listener = await ngrok.forward({
                authtoken: process.env.NGROK_AUTHTOKEN,
                addr: PORT
            });
            const url = listener.url();
            console.log(`Ngrok Tunnel Running at: ${url}`);
            process.env.PUBLIC_URL = url;

            // Also update any .env files or global objects if needed
        } catch (err) {
            console.error("Error starting ngrok:", err);
            // If the tunnel is already online, fallback to ENV or default
            if (err.message && err.message.includes('already online')) {
                console.log('Ngrok tunnel already active. Please ensure it maps to port ' + PORT);
                // The URL is inside the error message, extract it if possible
                const match = err.message.match(/endpoint '(.*?)' is already/);
                if (match && match[1]) {
                    process.env.PUBLIC_URL = match[1];
                    console.log(`Fallback PUBLIC_URL: ${process.env.PUBLIC_URL}`);
                }
            }
        }
    }
});
