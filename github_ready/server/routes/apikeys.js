const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../.env');

const targetKeys = [
    'GEMINI_API_KEY',
    'PEXELS_API_KEY',
    'ELEVENLABS_API_KEY',
    'NGROK_AUTHTOKEN',
    'ASSEMBLYAI_API_KEY'
];

router.get('/', (req, res) => {
    try {
        let content = '';
        if (fs.existsSync(ENV_PATH)) {
            content = fs.readFileSync(ENV_PATH, 'utf-8');
        }

        const currentKeys = {};

        content.split('\n').forEach(line => {
            const splitIdx = line.indexOf('=');
            if (splitIdx > -1) {
                const key = line.substring(0, splitIdx).trim();
                const val = line.substring(splitIdx + 1).trim();
                if (targetKeys.includes(key)) {
                    // removing quotes from the .env reading if any
                    currentKeys[key] = val.replace(/^["']|["']$/g, '');
                }
            }
        });

        const result = {};
        targetKeys.forEach(k => result[k] = currentKeys[k] || '');

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/', (req, res) => {
    try {
        const updates = req.body;

        let lines = [];
        if (fs.existsSync(ENV_PATH)) {
            const content = fs.readFileSync(ENV_PATH, 'utf-8');
            lines = content.split(/\r?\n/);
        }

        const newLines = [];
        const seenKeys = new Set();

        lines.forEach(line => {
            const splitIdx = line.indexOf('=');
            if (splitIdx > -1) {
                const key = line.substring(0, splitIdx).trim();
                if (targetKeys.includes(key)) {
                    seenKeys.add(key);
                    if (updates[key] !== undefined) {
                        newLines.push(`${key}=${updates[key]}`);
                    } else {
                        newLines.push(line);
                    }
                } else {
                    newLines.push(line);
                }
            } else {
                newLines.push(line);
            }
        });

        targetKeys.forEach(key => {
            if (!seenKeys.has(key) && updates[key] !== undefined) {
                newLines.push(`${key}=${updates[key]}`);
            }
        });

        fs.writeFileSync(ENV_PATH, newLines.join('\n'));

        // Update live process env vars
        Object.keys(updates).forEach(k => {
            if (targetKeys.includes(k) && updates[k] !== undefined) {
                process.env[k] = updates[k];
            }
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
