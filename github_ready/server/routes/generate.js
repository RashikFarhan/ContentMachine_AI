const express = require('express');
const router = express.Router();
const { generateContent } = require('../services/geminiService');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/config.json');

router.post('/', async (req, res) => {
    try {
        let bossPrompt = req.body.bossPrompt;
        const workspaceId = req.body.workspaceId;
        const specificFocus = req.body.specificFocus;

        // Fallback to legacy config.json if no prompt in body
        if (!bossPrompt) {
            if (!fs.existsSync(configPath)) {
                return res.status(500).json({ error: "Config not found. Please save a Boss Prompt first." });
            }
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            bossPrompt = config.bossPrompt;
        }

        if (!bossPrompt || bossPrompt.trim() === "") {
            return res.status(400).json({ error: "Boss Prompt is empty. Please configure it first." });
        }

        const result = await generateContent(bossPrompt, workspaceId, specificFocus);
        res.json(result);

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ error: "Failed to generate content", details: error.message });
    }
});

module.exports = router;
