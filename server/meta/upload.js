const fs = require('fs');
const path = require('path');
const axios = require('axios');
const auth = require('./auth');
const { getWorkspaceConfig } = require('../services/workspaceUtils');
const paths = require('../../paths');

const getPublicUrl = () => process.env.PUBLIC_URL || 'http://localhost:5000';
// WARNING: Instagram requires a public HTTPS URL. Localhost will fail for Instagram unless tunneled.

class MetaUploader {

    async uploadLatestVideo(workspaceId, videoUrlStr, customTitle, customDescription) {
        let targetAccount = null;
        const configPath = path.join(paths.dataDir, 'meta_config.json');

        const wsConfig = getWorkspaceConfig(workspaceId);
        let parsedMetaConfig = null;
        if (wsConfig && wsConfig.metaToken && wsConfig.metaToken.trim().length > 0) {
            try {
                parsedMetaConfig = JSON.parse(wsConfig.metaToken);
            } catch (e) {
                console.warn("Meta: Workspace metaToken is invalid JSON, falling back.");
            }
        }

        // Check for manual configuration (Page Access Token)
        if (parsedMetaConfig || fs.existsSync(configPath)) {
            const config = parsedMetaConfig || JSON.parse(fs.readFileSync(configPath));
            console.log(`Meta: Using ${parsedMetaConfig ? 'Workspace' : 'Global'} configuration for upload.`);

            // Try to fetch Instagram Business Account ID attached to this Page
            let instagramId = null;
            try {
                const igRes = await axios.get(`https://graph.facebook.com/v18.0/${config.page_id}`, {
                    params: {
                        fields: 'instagram_business_account',
                        access_token: config.page_access_token
                    }
                });
                if (igRes.data.instagram_business_account) {
                    instagramId = igRes.data.instagram_business_account.id;
                    console.log(`Meta: Found linked Instagram Business Account: ${instagramId}`);
                } else {
                    console.log("Meta: No Instagram Business Account linked to this Page.");
                }
            } catch (err) {
                console.error("Meta: Failed to fetch Instagram Account ID.", err.response?.data || err.message);
            }

            targetAccount = {
                page_id: config.page_id,
                page_name: config.page_name,
                page_access_token: config.page_access_token,
                instagram_id: instagramId,
                instagram_username: 'Linked Account'
            };

        } else {
            // Fallback to original Auth flow
            if (!auth.isAuthenticated()) {
                throw new Error("Not authenticated with Meta. Please login first.");
            }
            const tokenData = auth.getTokenData();
            targetAccount = tokenData.accounts.find(a => a.instagram_id) || tokenData.accounts[0];
        }

        if (!targetAccount) {
            throw new Error("No Page or Instagram account found execution context.");
        }

        // 2. Load Video Data
        let absoluteVideoPath = null;
        let title = customTitle;
        let description = customDescription;

        if (videoUrlStr) {
            const relPath = videoUrlStr.replace('http://localhost:5000', '');
            absoluteVideoPath = path.join(paths.publicDir, relPath);
        }

        if (!absoluteVideoPath || !fs.existsSync(absoluteVideoPath)) {
            const wsIdStr = workspaceId || 'default';
            let LATEST_VIDEO_PATH = path.join(paths.dataDir, `latest_video_${wsIdStr}.json`);

            if (!fs.existsSync(LATEST_VIDEO_PATH)) {
                // Fallback for older generations
                LATEST_VIDEO_PATH = path.join(paths.dataDir, `latest_video.json`);
                if (!fs.existsSync(LATEST_VIDEO_PATH)) {
                    throw new Error(`No latest video found to upload for workspace ${wsIdStr}.`);
                }
            }

            const videoData = JSON.parse(fs.readFileSync(LATEST_VIDEO_PATH));
            absoluteVideoPath = videoData.video_path;

            if (!title) title = videoData.title || 'New Reel';
            if (!description) description = videoData.description || '#shorts #reels';
        }

        if (!fs.existsSync(absoluteVideoPath)) {
            throw new Error(`Video file not found: ${absoluteVideoPath}`);
        }

        if (!title) title = 'New Reel';
        if (!description) description = '#shorts #reels';

        console.log(`Meta: Uploading to Page: ${targetAccount.page_name} (IG: ${targetAccount.instagram_username || 'None'})`);

        const results = { instagram: null, facebook: null };
        const filename = path.basename(absoluteVideoPath);
        let videoUrl = `${getPublicUrl()}/videos/${filename}`;

        const caption = `${title}\n\n${description}`;

        // Uses Page Access Token for both (which works for IG if linked)
        const accessToken = targetAccount.page_access_token;

        // 3. Instagram Upload (Reels API - Requires URL)
        if (targetAccount.instagram_id) {
            try {
                console.log("Meta: Starting Instagram Reel Upload...");

                if (videoUrl.includes('localhost') || videoUrl.includes('127.0.0.1')) {
                    console.warn("WARNING: Instagram API requires a public HTTPS URL. Localhost URLs are not supported.");
                    console.warn("SUGGESTION: Use a tunneling service like 'ngrok' to expose your local server, or deploy to a public server.");
                    console.warn("Skipping Instagram Upload to prevent API errors. Facebook Upload (binary) will proceed.");
                    results.instagram = { success: false, error: "Skipped: Instagram requires public HTTPS URL (localhost detected). Use ngrok." };
                } else {
                    // Step 1: Create Container
                    const containerRes = await axios.post(`https://graph.facebook.com/v18.0/${targetAccount.instagram_id}/media`, null, {
                        params: {
                            media_type: 'REELS',
                            video_url: videoUrl,
                            caption: caption,
                            access_token: accessToken
                        }
                    });

                    const containerId = containerRes.data.id;

                    // Step 2: Check Status (Wait for processing)
                    await this.waitForContainer(containerId, accessToken);

                    // Step 3: Publish
                    const publishRes = await axios.post(`https://graph.facebook.com/v18.0/${targetAccount.instagram_id}/media_publish`, null, {
                        params: {
                            creation_id: containerId,
                            access_token: accessToken
                        }
                    });

                    results.instagram = { success: true, id: publishRes.data.id };
                    console.log("Meta: Instagram Upload Success:", publishRes.data.id);
                }


            } catch (error) {
                console.error("Meta: Instagram Upload Failed.", error.response?.data || error.message);
                results.instagram = { success: false, error: error.response?.data?.error?.message || error.message };
            }
        } else {
            console.log("Meta: Skipping Instagram (No connected account).");
        }

        // 4. Facebook Upload (Page Video API - Supports Binary)
        if (targetAccount.page_id) {
            try {
                console.log("Meta: Starting Facebook Reel Upload...");
                const FormData = require('form-data');
                const form = new FormData();

                form.append('access_token', targetAccount.page_access_token); // Page Token for Page Post
                form.append('description', caption);
                form.append('source', fs.createReadStream(absoluteVideoPath));

                const fbRes = await axios.post(`https://graph.facebook.com/v18.0/${targetAccount.page_id}/videos`, form, {
                    headers: {
                        ...form.getHeaders()
                    }
                });

                results.facebook = { success: true, id: fbRes.data.id };
                console.log("Meta: Facebook Upload Success:", fbRes.data.id);

            } catch (error) {
                console.error("Meta: Facebook Upload Failed.", error.response?.data || error.message);
                results.facebook = { success: false, error: error.response?.data?.error?.message || error.message };
            }
        }

        return results;
    }

    async waitForContainer(containerId, accessToken) {
        let attempts = 0;
        while (attempts < 60) {
            const statusRes = await axios.get(`https://graph.facebook.com/v18.0/${containerId}`, {
                params: { fields: 'status_code,status', access_token: accessToken }
            });
            const status = statusRes.data.status_code;

            if (status === 'FINISHED') return true;
            if (status === 'ERROR') throw new Error("Container processing failed.");

            await new Promise(r => setTimeout(r, 5000));
            attempts++;
        }
        throw new Error("Container processing timed out.");
    }
}

module.exports = new MetaUploader();
