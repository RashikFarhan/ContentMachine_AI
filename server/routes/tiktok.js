const express = require('express');
const router = express.Router();
const authService = require('../tiktok/auth');
const uploadService = require('../tiktok/upload');

// 1. Get Auth URL
router.get('/auth', (req, res) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!authService.isAuthenticated(workspaceId)) {
            const url = authService.getAuthUrl(workspaceId);
            res.json({ authenticated: false, url });
        } else {
            res.json({ authenticated: true });
        }
    } catch (error) {
        console.error('TikTok Auth Check Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. OAuth Callback
router.post('/oauth/callback', async (req, res) => {
    try {
        const { code, workspaceId } = req.body;
        console.log(`[TIKTOK ROUTE] /oauth/callback Hit with code length: ${code?.length}`);
        if (!code || !workspaceId) {
            return res.status(400).json({ error: 'Code or workspaceId not provided' });
        }

        console.log(`[TIKTOK ROUTE] Exchanging Code...`);
        const data = await authService.exchangeCodeForToken(code, workspaceId);
        console.log(`[TIKTOK ROUTE] Code Exchanged Successfully!`);
        res.json({ success: true, user: data });
    } catch (error) {
        console.error('TikTok Callback Error:', error);
        res.status(500).json({ error: 'Authentication failed.' });
    }
});

// 3. Upload Latest Video
router.post('/upload', async (req, res) => {
    try {
        const { workspaceId, videoUrl, title, description } = req.body;
        const result = await uploadService.uploadLatestVideo(workspaceId, videoUrl, title, description);
        res.json({ success: true, results: result });
    } catch (error) {
        console.error('TikTok Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
