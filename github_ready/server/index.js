const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Load Routes
const configRoutes = require('./routes/config');
const generateRoutes = require('./routes/generate');
const pexelsRoutes = require('./routes/pexels');
const workspaceRoutes = require('./routes/workspaces');
const ttsRoutes = require('./routes/tts');
const videoRoutes = require('./routes/video');
const youtubeRoutes = require('./routes/youtube');
const metaRoutes = require('./routes/meta');
const apikeysRoutes = require('./routes/apikeys');

app.use('/api/config', configRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/pexels', pexelsRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/apikeys', apikeysRoutes);


// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Ensure config.json exists (legacy step 1 support, or migrate to default workspace concept)
const configPath = path.join(dataDir, 'config.json');
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ bossPrompt: "" }));
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
        }
    }
});
