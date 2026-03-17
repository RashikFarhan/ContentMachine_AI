const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { randomUUID: uuidv4 } = require('crypto');
const paths = require('../../paths');

// Load .env from centralized location
require('dotenv').config({ path: paths.envFile });

const TEMP_DIR = paths.tempDir;
const OUTPUT_DIR = path.join(paths.publicDir, 'videos');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

class VideoService {

    async downloadMedia(url, outputPath) {
        if (!url) return null;
        try {
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                timeout: 20000 // Force drop hanging network sockets after 20s
            });

            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    // Check if file is empty
                    const stats = fs.statSync(outputPath);
                    if (stats.size === 0) {
                        fs.unlinkSync(outputPath); // Remove empty file
                        console.warn(`Downloaded empty file: ${url}`);
                        resolve(null);
                    } else {
                        resolve(outputPath);
                    }
                });
                writer.on('error', (err) => {
                    fs.unlinkSync(outputPath); // Clean up on error
                    reject(err);
                });
            });
        } catch (e) {
            console.error(`Failed to download ${url}:`, e.message);
            return null;
        }
    }

    async buildVideo(data) {
        // data = { script, audioUrl (relative), keywords, mediaResults (array of Pexels objects), settings, title, description }

        const jobId = uuidv4();
        console.log(`Starting video build job ${jobId}...`);

        const jobDir = path.join(TEMP_DIR, jobId);
        if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

        const mediaBaseDir = path.join(jobDir, 'media');
        if (!fs.existsSync(mediaBaseDir)) fs.mkdirSync(mediaBaseDir, { recursive: true });

        // 1. Prepare Paths
        // Audio path is relative from public, need absolute
        const audioPath_abs = path.join(paths.publicDir, data.audioUrl.replace('/audio/', 'audio/'));

        // 2. Download Media
        const mediaStructure = {}; // keyword -> [absolute_paths]

        // Ensure data.mediaResults is valid
        if (data.mediaResults && Array.isArray(data.mediaResults)) {
            for (const group of data.mediaResults) {
                const keyword = group.keyword;
                if (!keyword || !group.results) continue;

                // Sanitize keyword for folder name
                const safeKeyword = keyword.replace(/[^a-zA-Z0-9]/g, '_');
                const keywordDir = path.join(mediaBaseDir, safeKeyword);
                if (!fs.existsSync(keywordDir)) fs.mkdirSync(keywordDir, { recursive: true });

                const validPaths = [];
                // Download ALL results provided (or a generous limit if too many)
                // We'll take up to 15 to ensure variety but avoid infinite downloads
                const items = group.results.slice(0, 15);

                for (const item of items) {
                    if (!item.url) continue;

                    const ext = item.type === 'video' ? '.mp4' : '.jpg';
                    const filename = `${item.id}${ext}`;
                    const destPath = path.join(keywordDir, filename);

                    // Skip if already exists (unlikely with new jobId, but good practice)
                    if (fs.existsSync(destPath)) {
                        validPaths.push(destPath);
                        continue;
                    }

                    const localPath = await this.downloadMedia(item.url, destPath);
                    if (localPath) {
                        validPaths.push(localPath);
                    }
                }

                if (validPaths.length > 0) {
                    mediaStructure[keyword] = validPaths;
                }
            }
        }

        // 3. Create Job Config
        const outputFilename = `video_${jobId}.mp4`;
        const outputPath = path.join(OUTPUT_DIR, outputFilename);

        const wsConfig = data.workspaceId ? require('./workspaceUtils').getWorkspaceConfig(data.workspaceId) : null;
        const mediaSource = wsConfig ? (wsConfig.mediaSource || 'pexels') : 'pexels';

        const cleanScript = (data.script || '')
            .replace(/\*/g, '')          // remove asterisks
            .replace(/(^|\n)\s*[-+]\s+/g, ' ') // remove bullet points
            .replace(/#/g, '')           // remove heading hashes
            .replace(/\n+/g, ' ')        // replace newlines with spaces
            .replace(/\s+/g, ' ')        // collapse spaces
            .trim();

        const jobConfig = {
            job_id: jobId,
            script: cleanScript,
            audio_path: audioPath_abs,
            output_file: outputPath,
            keywords: data.keywords,
            media_map: mediaStructure, // keyword -> [paths]
            assembly_api_key: process.env.ASSEMBLYAI_API_KEY,
            job_dir: jobDir, // Pass job directory for temp files e.g. resized images
            settings: data.settings || { aspect_ratio: '9:16', max_duration: 60 },
            media_source: mediaSource
        };

        const jobPath = path.join(jobDir, 'job.json');
        fs.writeFileSync(jobPath, JSON.stringify(jobConfig, null, 2));

        // 4. Spawn Python
        return new Promise((resolve, reject) => {
            const pyCmd = paths.getPythonCommand('build_video', [jobPath]);
            const pythonProcess = spawn(pyCmd.cmd, pyCmd.args, {
                cwd: paths.serverRoot // Run from server root (server/)
            });

            pythonProcess.stdout.on('data', (dataBuffer) => {
                const text = dataBuffer.toString();
                // We typically print many things from Python
                process.stdout.write(`[Python]: ${text}`);

                if (data.workspaceId) {
                    // Look for our custom logger output
                    const match = text.match(/\[PROGRESS\] (\d+)%/);
                    if (match && match[1]) {
                        const perc = parseInt(match[1]);
                        const statusFile = path.join(paths.dataDir, `video_status_${data.workspaceId}.json`);
                        try {
                            fs.writeFileSync(statusFile, JSON.stringify({ status: 'generating', progress: perc }));
                        } catch (e) { }
                    }
                }
            });
            pythonProcess.stderr.on('data', (dataBuffer) => process.stderr.write(`[Python Error]: ${dataBuffer}`));

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    // Save metadata for YouTube Upload
                    // We assume data.title and data.description are passed in
                    const latestVideoData = {
                        video_path: outputPath,
                        title: data.title || "My AI Video",
                        description: data.description || "Generated Video"
                    };
                    const wsIdStr = data.workspaceId || 'default';
                    const latestPath = path.join(paths.dataDir, `latest_video_${wsIdStr}.json`);
                    fs.writeFileSync(latestPath, JSON.stringify(latestVideoData, null, 2));
                    console.log(`Saved latest video metadata to: ${latestPath}`);

                    // --- SAVE TO HISTORY HERE ONLY ON SUCCESSFUL VIDEO GEN ---
                    if (data.workspaceId) {
                        const historyFile = path.join(paths.dataDir, `history_${data.workspaceId}.json`);
                        const generatedDataForHistory = {
                            title: data.title || "My AI Video",
                            keywords: data.keywords || [],
                            timestamp: new Date().toISOString()
                        };

                        let updatedHistory = [];
                        if (fs.existsSync(historyFile)) {
                            try {
                                updatedHistory = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
                            } catch (e) {
                                console.error("Error reading history file for append:", e);
                            }
                        }
                        updatedHistory.push(generatedDataForHistory);
                        fs.writeFileSync(historyFile, JSON.stringify(updatedHistory, null, 2), 'utf8');
                        console.log(`Saved history to ${historyFile}`);
                    }

                    // --- EXPORT COPY ---
                    // Copy the final video to the workspace's export folder
                    try {
                        const wsConfig2 = data.workspaceId ? require('./workspaceUtils').getWorkspaceConfig(data.workspaceId) : null;
                        const defaultExportDir = path.join(require('os').homedir(), 'Documents', 'YT2.0 Exports');
                        const exportDir = (wsConfig2 && wsConfig2.exportPath) ? wsConfig2.exportPath : defaultExportDir;

                        if (!fs.existsSync(exportDir)) {
                            fs.mkdirSync(exportDir, { recursive: true });
                        }

                        const exportDest = path.join(exportDir, outputFilename);
                        fs.copyFileSync(outputPath, exportDest);
                        console.log(`Exported video to: ${exportDest}`);
                    } catch (exportErr) {
                        console.error('Failed to export video copy:', exportErr.message);
                        // Non-fatal — don't break the main flow
                    }

                    resolve({
                        success: true,
                        videoUrl: `/videos/${outputFilename}`,
                        jobId
                    });
                } else {
                    if (data.workspaceId) {
                        const statusFile = path.join(paths.dataDir, `video_status_${data.workspaceId}.json`);
                        try {
                            fs.writeFileSync(statusFile, JSON.stringify({ status: 'error', progress: 0 }));
                        } catch (e) { }
                    }
                    reject(new Error(`Video build failed with code ${code}`));
                }

                // Cleanup (Optional - kept for debugging now)
                // fs.rmSync(jobDir, { recursive: true, force: true });
            });
        });
    }
}

module.exports = new VideoService();
