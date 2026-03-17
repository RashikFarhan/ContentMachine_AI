const express = require('express');
const router = express.Router();
const authService = require('../youtube/auth');
const uploadService = require('../youtube/upload');

// 1. Get Auth URL (or check status)
router.get('/auth', async (req, res) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!authService.isAuthenticated(workspaceId)) {
            const url = await authService.getAuthUrl(workspaceId);
            res.json({ authenticated: false, url });
        } else {
            res.json({ authenticated: true });
        }
    } catch (error) {
        console.error('YouTube Auth Check Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. OAuth Callback
router.post('/oauth2callback', async (req, res) => {
    try {
        console.log('YouTube Callback Received:', req.body);
        const { code, workspaceId } = req.body;
        if (!code) {
            console.error('No code found in request body');
            return res.status(400).json({ error: 'No code provided' });
        }

        await authService.saveToken(code, workspaceId);
        res.json({ success: true, message: 'Authentication successful! You can close this window now.' });
    } catch (error) {
        console.error('YouTube Callback Error:', error);
        res.status(500).json({ error: 'Authentication failed.' });
    }
});

// 3. Upload Latest Generated Video
router.post('/upload', async (req, res) => {
    try {
        const { workspaceId, videoUrl, title, description } = req.body;
        const result = await uploadService.uploadLatestVideo(workspaceId, videoUrl, title, description);
        res.json({ success: true, videoId: result.id });
    } catch (error) {
        console.error('YouTube Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
