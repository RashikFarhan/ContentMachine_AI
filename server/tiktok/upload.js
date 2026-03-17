const fs = require('fs');
const path = require('path');
const axios = require('axios');
const auth = require('./auth');
const paths = require('../../paths');

class TiktokUploader {
    async uploadLatestVideo(workspaceId, videoUrl, customTitle, customDescription) {
        if (!auth.isAuthenticated(workspaceId)) {
            throw new Error("Not authenticated with TikTok for this workspace.");
        }

        // Using getValidToken automatically checks expiration and tries to refresh if needed
        const accessToken = await auth.getValidToken(workspaceId);

        let absoluteVideoPath = null;
        if (videoUrl) {
            const relPath = videoUrl.replace('http://localhost:5000', '');
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
        }

        if (!fs.existsSync(absoluteVideoPath)) {
            throw new Error(`Video file not found: ${absoluteVideoPath}`);
        }

        const stat = fs.statSync(absoluteVideoPath);
        const fileSize = stat.size;

        console.log(`TikTok: Starting Upload. Video Size: ${fileSize} bytes.`);

        try {
            // 1. Initialize Upload
            const initData = {
                source_info: {
                    source: "FILE_UPLOAD",
                    video_size: fileSize,
                    chunk_size: fileSize,
                    total_chunk_count: 1
                }
            };

            const initHeaders = {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8'
            };

            const initRes = await axios.post('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', initData, { headers: initHeaders });

            if (initRes.data.error && initRes.data.error.code !== 'ok') {
                throw new Error(`TikTok Init Error: ${initRes.data.error.message}`);
            }

            const { publish_id, upload_url } = initRes.data.data;
            console.log(`TikTok: Initialization Success (Inbox mode). Publish ID: ${publish_id}`);

            // 2. Upload Binary File to Upload URL
            const fileStream = fs.createReadStream(absoluteVideoPath);

            await axios.put(upload_url, fileStream, {
                headers: {
                    'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
                    'Content-Type': 'video/mp4'
                }
            });

            console.log(`TikTok: Video Binary Uploaded Successfully.`);
            return { success: true, publish_id };

        } catch (error) {
            console.error("TikTok Upload Error:", error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || error.message);
        }
    }
}

module.exports = new TiktokUploader();
