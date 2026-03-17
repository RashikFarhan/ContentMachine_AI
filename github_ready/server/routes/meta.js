const express = require('express');
const router = express.Router();
const authService = require('../meta/auth');
const uploadService = require('../meta/upload');

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
        console.error('Meta Auth Check Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. OAuth Callback (Handled by frontend redirect or backend?)
// Prompt says: "META_REDIRECT_URI=http://localhost:5173/auth/meta/callback"
// This implies the frontend receives the code. If so, frontend should call backend to exchange code.
// Let's assume frontend will capture `?code=` and call `/api/meta/oauth/callback` with code.

router.post('/oauth/callback', async (req, res) => {
    try {
        const { code, workspaceId } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'No code provided' });
        }

        const data = await authService.exchangeCodeForToken(code, workspaceId);
        res.json({ success: true, accounts: data.accounts });
    } catch (error) {
        console.error('Meta Callback Error:', error);
        res.status(500).json({ error: 'Authentication failed.' });
    }
});

// 3. Upload Latest Video
router.post('/upload', async (req, res) => {
    try {
        const workspaceId = req.body.workspaceId;
        const results = await uploadService.uploadLatestVideo(workspaceId);
        res.json({ success: true, results });
    } catch (error) {
        console.error('Meta Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
