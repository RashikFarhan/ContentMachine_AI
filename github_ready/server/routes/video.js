const express = require('express');
const router = express.Router();
const videoService = require('../services/videoService');
const fs = require('fs');
const path = require('path');

const getStatusPath = (wsId) => path.join(__dirname, `../data/video_status_${wsId}.json`);

// POST /api/video/generate
router.post('/generate', async (req, res) => {
    try {
        const { workspaceId } = req.body;
        if (workspaceId) {
            fs.writeFileSync(getStatusPath(workspaceId), JSON.stringify({ status: 'generating' }));
        }

        const result = await videoService.buildVideo(req.body);

        if (workspaceId) {
            fs.writeFileSync(getStatusPath(workspaceId), JSON.stringify({ status: 'completed', videoUrl: result.videoUrl }));
        }

        res.json(result);
    } catch (error) {
        console.error('Video Generation Error:', error);
        if (req.body.workspaceId) {
            fs.writeFileSync(getStatusPath(req.body.workspaceId), JSON.stringify({ status: 'error', error: error.message }));
        }
        res.status(500).json({ error: 'Failed to generate video', details: error.message });
    }
});

// GET /api/video/status/:workspaceId
router.get('/status/:workspaceId', (req, res) => {
    try {
        const p = getStatusPath(req.params.workspaceId);
        if (fs.existsSync(p)) {
            res.json(JSON.parse(fs.readFileSync(p, 'utf-8')));
        } else {
            res.json({ status: 'idle' });
        }
    } catch (e) {
        res.json({ status: 'idle' });
    }
});

// DELETE /api/video/status/:workspaceId
router.delete('/status/:workspaceId', (req, res) => {
    try {
        const p = getStatusPath(req.params.workspaceId);
        if (fs.existsSync(p)) {
            fs.unlinkSync(p);
        }
        res.json({ status: 'cleared' });
    } catch (e) {
        res.json({ status: 'error', error: e.message });
    }
});

module.exports = router;
