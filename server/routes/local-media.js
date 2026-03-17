const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { randomUUID: uuidv4 } = require('crypto');
const fs = require('fs');
const paths = require('../../paths');

const mediaDir = path.join(paths.publicDir, 'media');
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, mediaDir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename
        const ext = path.extname(file.originalname);
        cb(null, `local_${Date.now()}_${uuidv4().split('-')[0]}${ext}`);
    }
});

const upload = multer({ storage: storage });

router.post('/upload', (req, res) => {
    upload.array('files', 100)(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error("Multer error:", err);
            return res.status(400).json({ error: err.message });
        } else if (err) {
            console.error("Unknown upload error:", err);
            return res.status(500).json({ error: 'Unknown upload error' });
        }
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No files uploaded' });
            }

            const uploadedMedia = req.files.map(file => {
                const isVideo = file.mimetype.startsWith('video');
                return {
                    id: uuidv4(),
                    type: isVideo ? 'video' : 'image',
                    url: `http://localhost:5000/media/${file.filename}`,
                    alt: file.originalname,
                    excluded: false
                };
            });

            res.json({ results: uploadedMedia });
        } catch (e) {
            console.error("Local Media Upload Error:", e);
            res.status(500).json({ error: e.message || 'Error occurred uploading media' });
        }
    });
});

module.exports = router;
