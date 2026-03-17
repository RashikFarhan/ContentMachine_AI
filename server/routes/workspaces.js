const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { randomUUID: uuidv4 } = require('crypto');
const paths = require('../../paths');

const DATA_DIR = paths.dataDir;
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
        const credsDir = paths.credentialsDir;
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
            systemPrompt: {
                role: 'You are a high-level Content Strategist and SEO Expert.',
                generalConstraints: '1. TITLE: Must be a high-CTR, "Pattern Interrupt" headline. SEO-optimized for reach. (Max 60 chars).\n2. SCRIPT: High-retention narrative starting with a strong hook.\n3. DESCRIPTION: 2 sentences of meta-data + 5 trending hashtags related to the content.',
                keywordRules: `   - Generate a dual-layer structure: an optimized 'keyword' for visual search and an array of 'trigger' phrases for script placement.
   - LIMITATION: You MUST NOT generate more than 6 to 8 unique 'keywords' total! Do NOT exceed 10 keywords under any circumstances.
   - 'trigger': MUST be an ARRAY of EXACT, verbatim 1-3 word phrases found in the generated script.
   - To cover the entire video duration without huge gaps, DO NOT add more unique keywords. Instead, REUSE the same keyword by adding MULTIPLE 'trigger' phrases to its array. (e.g., if "British Army" is mentioned at the beginning, middle, and end, put all occurrences into the trigger array for the "British Army" keyword).
   - CRITICAL: Space out the triggers throughout the ENTIRE script. There should NEVER be huge gaps (e.g., 30+ words) without a trigger!
   - 'keyword': A highly visual context noun (1-3 words max) optimized for stock photography/video search. Use your AI intelligence to logically decide between specific items vs. generalized concepts:
     * Rule A (Specific, Common Objects): If the trigger is a common, highly visual object that is easy to find natively on stock sites (e.g., "bucket", "tank", "sword", "campfire"), use the EXACT object name. Do NOT over-generalize simple objects (e.g. do not turn "bucket" into "ancient tools", do not turn "tank" into "military weapons").
     * Rule B (Abstract, Anachronistic, or Complex Concepts): If the trigger is too complex, historically bound, or abstract (e.g., "British Army" in an 1800s context, "government intervention"), DO NOT use the exact script words. Generalize it powerfully to capture the broader vibe and era (e.g., "ancient soldiers", "historic battle", "landscape").
     Always balance specificity and vibe to get the absolute best, most relevant stock media results.`
            },
            ttsProvider: 'edge', // default
            voice: 'en-US-AriaNeural', // default
            ttsSettings: {
                rate: 1.0
            },
            mediaSource: 'pexels', // 'pexels' or 'google_genai'
            imageGenModel: 'imagen-3.0-generate-001',
            imageGenPrompt: 'Create a cinematic, photorealistic 9:16 vertical image of [KEYWORD]. Maintain a dark, moody color scheme with dramatic lighting.',
            exportPath: '', // empty = default (%USERPROFILE%/Documents/YT2.0 Exports/)
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

// Import YouTube client_secret file from an external path into credentials dir
router.post('/import-yt-secret', (req, res) => {
    try {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: 'No file path provided' });

        const fs2 = require('fs');
        const p = require('path');
        if (!fs2.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

        const fileName = p.basename(filePath);
        const destPath = p.join(paths.credentialsDir, fileName);
        fs2.copyFileSync(filePath, destPath);

        res.json({ success: true, fileName });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
