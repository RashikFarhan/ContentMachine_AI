const express = require('express');
const router = express.Router();
const ttsManager = require('../services/tts/ttsManager');

// List Voices for a provider
// GET /api/tts/voices?provider=edge
router.get('/voices', async (req, res) => {
    try {
        const { provider } = req.query;
        if (!provider) {
            return res.status(400).json({ error: 'Provider is required' });
        }
        const voices = await ttsManager.listVoices(provider);
        res.json(voices);
    } catch (error) {
        console.error('Error fetching voices:', error);
        res.status(500).json({ error: 'Failed to fetch voices' });
    }
});

// Generate Speech (for final generation step)
// POST /api/tts/generate
router.post('/generate', async (req, res) => {
    try {
        const { provider, text, voiceId, options } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // Default provider logic if missing
        const activeProvider = provider || 'edge';

        const audioPath = await ttsManager.generateSpeech(activeProvider, text, voiceId, options);

        // Return relative URL for frontend to play
        // Assuming backend is at localhost:5000 and we serve public folder
        res.json({ audioUrl: audioPath });
    } catch (error) {
        console.error('Error generating speech:', error);
        res.status(500).json({ error: 'Failed to generate speech' });
    }
});

// Preview Voice
// POST /api/tts/preview
router.post('/preview', async (req, res) => {
    try {
        const { provider, voiceId } = req.body;
        if (!voiceId) {
            return res.status(400).json({ error: 'Voice ID is required' });
        }

        const audioPath = await ttsManager.generateSpeech(provider, "Hello, this is a test of my voice.", voiceId);
        res.json({ audioUrl: audioPath });
    } catch (error) {
        console.error('Error generating preview:', error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

module.exports = router;
