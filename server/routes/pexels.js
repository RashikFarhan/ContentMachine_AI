// Redefining this file to use the Service I created earlier properly.
const express = require('express');
const router = express.Router();
const { searchMedia } = require('../services/pexelsService');

router.post('/', async (req, res) => {
    const { keywords } = req.body;

    if (!keywords || !Array.isArray(keywords)) {
        return res.status(400).json({ error: "Invalid keywords format." });
    }

    try {
        const results = await searchMedia(keywords);
        res.json({ results });
    } catch (error) {
        console.error("Pexels Route Error:", error);
        res.status(500).json({ error: "Failed to search media" });
    }
});

module.exports = router;
