const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const paths = require('../../paths');

const configPath = path.join(paths.dataDir, 'config.json');

// Helper to read config
const readConfig = () => {
    try {
        if (!fs.existsSync(configPath)) {
            return { bossPrompt: "" };
        }
        const data = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading config:", err);
        return { bossPrompt: "" };
    }
};

// Helper to write config
const writeConfig = (data) => {
    try {
        fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error("Error writing config:", err);
        return false;
    }
};

// GET current config (Boss Prompt)
router.get('/', (req, res) => {
    const config = readConfig();
    res.json(config);
});

// POST update config (Boss Prompt)
router.post('/', (req, res) => {
    const { bossPrompt } = req.body;
    if (typeof bossPrompt !== 'string') {
        return res.status(400).json({ error: "Invalid bossPrompt format" });
    }

    const config = readConfig();
    config.bossPrompt = bossPrompt;

    if (writeConfig(config)) {
        res.json({ success: true, bossPrompt });
    } else {
        res.status(500).json({ error: "Failed to save config" });
    }
});

module.exports = router;
