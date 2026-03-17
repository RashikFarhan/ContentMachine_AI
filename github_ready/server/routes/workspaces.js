const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../data');
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');

// Ensure workspaces file exists
if (!fs.existsSync(WORKSPACES_FILE)) {
    fs.writeFileSync(WORKSPACES_FILE, JSON.stringify([]));
}

// Get all workspaces
router.get('/', (req, res) => {
    try {
        const data = fs.readFileSync(WORKSPACES_FILE);
        const workspaces = JSON.parse(data);
        res.json(workspaces);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read workspaces' });
    }
});

// Get YouTube Client Secret Files
router.get('/yt-secrets', (req, res) => {
    try {
        const credsDir = path.join(__dirname, '../../credentials');
        if (!fs.existsSync(credsDir)) {
            return res.json([]);
        }
        const files = fs.readdirSync(credsDir);
        const secrets = files.filter(f => f.startsWith('client_secret') && f.endsWith('.json'));
        res.json(secrets);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load secrets' });
    }
});

// Create new workspace
router.post('/', (req, res) => {
    try {
        const { name } = req.body;
        const data = fs.readFileSync(WORKSPACES_FILE);
        const workspaces = JSON.parse(data);

        const newWorkspace = {
            id: uuidv4(),
            name: name || 'New Workspace',
            bossPrompt: '',
            ttsProvider: 'edge', // default
            voice: 'en-US-AriaNeural', // default
            ttsSettings: {
                rate: 1.0
            },
            createdAt: new Date().toISOString()
        };

        const META_CONFIG_PATH = path.join(DATA_DIR, 'meta_config.json');
        if (fs.existsSync(META_CONFIG_PATH)) {
            newWorkspace.metaToken = fs.readFileSync(META_CONFIG_PATH, 'utf-8').trim();
        }

        workspaces.push(newWorkspace);
        fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(workspaces, null, 2));

        res.status(201).json(newWorkspace);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create workspace' });
    }
});

// Update workspace
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // { name, bossPrompt, ttsProvider, voice, ttsSettings }

        const data = fs.readFileSync(WORKSPACES_FILE);
        let workspaces = JSON.parse(data);

        const index = workspaces.findIndex(w => w.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        workspaces[index] = { ...workspaces[index], ...updates, updatedAt: new Date().toISOString() };

        fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(workspaces, null, 2));

        res.json(workspaces[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update workspace' });
    }
});

// Delete workspace
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const data = fs.readFileSync(WORKSPACES_FILE);
        let workspaces = JSON.parse(data);

        const filtered = workspaces.filter(w => w.id !== id);

        if (workspaces.length === filtered.length) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(filtered, null, 2));

        res.json({ message: 'Workspace deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete workspace' });
    }
});

module.exports = router;
