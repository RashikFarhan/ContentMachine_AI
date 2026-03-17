const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { randomUUID: uuidv4 } = require('crypto');
const axios = require('axios');
const paths = require('../../paths');
require('dotenv').config({ path: paths.envFile });

const { getWorkspaceConfig } = require('../services/workspaceUtils');

// Helper to delay
const delay = ms => new Promise(res => setTimeout(res, ms));

router.post('/', async (req, res) => {
    try {
        const { keywords, workspaceId } = req.body;
        if (!keywords || !Array.isArray(keywords)) {
            return res.status(400).json({ error: "Missing or invalid keywords array" });
        }

        const ws = getWorkspaceConfig(workspaceId);

        let modelVersion = 'imagen-3.0-generate-001';
        let bossPromptTemplate = 'Create a cinematic, photorealistic 9:16 vertical image of [KEYWORD]. Maintain a dark, moody color scheme with dramatic lighting.';

        if (ws) {
            // Check mapping and fix any previously upgraded 4.0 models back to UI options if needed
            modelVersion = ws.imageGenModel || modelVersion;
            bossPromptTemplate = ws.imageGenPrompt || bossPromptTemplate;
            if (modelVersion.includes('imagen-4.0')) {
                modelVersion = 'imagen-3.0-generate-001';
            }
        }

        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
        }

        // Prepare directories to save downloaded images
        const publicMediaDir = path.join(paths.publicDir, 'media');
        if (!fs.existsSync(publicMediaDir)) {
            fs.mkdirSync(publicMediaDir, { recursive: true });
        }

        const results = [];

        for (const keyword of keywords) {
            try {
                const finalPrompt = bossPromptTemplate.replace(/\[KEYWORD\]/g, keyword);
                console.log(`[Google GenAI] Generating image for: ${keyword} using ${modelVersion}`);

                let b64Data = null;

                // BRANCH A: Imagen standard (Predict API)
                if (modelVersion.includes('imagen')) {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:predict?key=${API_KEY}`;
                    const payload = {
                        instances: [{ prompt: finalPrompt }],
                        parameters: { sampleCount: 1, aspectRatio: "9:16" }
                    };
                    const response = await axios.post(url, payload, { headers: { "Content-Type": "application/json" } });

                    if (response.data && response.data.predictions && response.data.predictions.length > 0) {
                        b64Data = response.data.predictions[0].bytesBase64Encoded;
                    }

                    // BRANCH B: Gemini Experimental Image Generators (GenerateContent API)
                } else if (modelVersion.includes('gemini')) {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${API_KEY}`;
                    const payload = {
                        contents: [{
                            parts: [{ text: finalPrompt }]
                        }]
                    };
                    const response = await axios.post(url, payload, { headers: { "Content-Type": "application/json" } });

                    // The experimental image arrays usually return the image as base64 in inlineData
                    if (response.data && response.data.candidates && response.data.candidates.length > 0) {
                        const parts = response.data.candidates[0].content?.parts || [];
                        const imagePart = parts.find(p => p.inlineData);
                        if (imagePart) {
                            b64Data = imagePart.inlineData.data;
                        } else {
                            // Failsafe in case it responds with text/URL instead of inline b64
                            console.log(`[Google GenAI] Warning: No inline image returned for ${keyword}. Parts:`, JSON.stringify(parts));
                        }
                    }
                }

                if (b64Data) {
                    const filename = `imagen_${Date.now()}_${uuidv4().split('-')[0]}.jpeg`;
                    const savePath = path.join(publicMediaDir, filename);

                    // Save image to disk
                    fs.writeFileSync(savePath, b64Data, { encoding: 'base64' });

                    // Format it like the pexels api return object
                    results.push({
                        keyword: keyword,
                        results: [
                            {
                                id: uuidv4(),
                                type: 'image',
                                url: `http://localhost:5000/media/${filename}`,
                                alt: keyword,
                                excluded: false
                            }
                        ]
                    });
                }

                // Small delay between requests to avoid abusing quota
                await delay(1500);
            } catch (err) {
                console.error(`[Google GenAI] Failed to generate image for "${keyword}":`, err?.response?.data || err.message);

                // Detailed error checking for the Limit: 0 quota issue
                const errData = err?.response?.data;
                const errMsg = errData?.error?.message || err.message;

                if (errMsg.includes('limit: 0') || errMsg.includes('Quota exceeded') || errMsg.includes('paid plans')) {
                    return res.status(403).json({
                        error: "Google AI Image Quota Blocked: This API key does not have image generation enabled (Limit: 0). You must either 'Set up billing' in Google AI Studio to unlock the free image quota, or use a different media provider like Pexels."
                    });
                }
                // Continue to next keyword instead of throwing entirely if it's a normal failure
            }
        }

        res.json({ results });
    } catch (e) {
        console.error("[generate-images] Route Error:", e);
        res.status(500).json({ error: e.message || 'Error occurred generating AI images' });
    }
});

module.exports = router;
