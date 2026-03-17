const edgeService = require('./edgeTTSService');
const elevenService = require('./elevenLabsService');
const googleService = require('./googleTTSService');
const { spawn } = require('child_process');
const path = require('path');
const paths = require('../../../paths');

class TTSManager {
    getService(provider) {
        if (provider === 'elevenlabs') {
            return elevenService;
        } else if (provider === 'google') {
            return googleService;
        }
        // Default to Edge TTS
        return edgeService;
    }

    async listVoices(provider) {
        return this.getService(provider).listVoices();
    }

    /*
     * Generates audio for a given text and returns the file path.
     * @param {string} provider - 'edge' or 'elevenlabs'
     * @param {string} text - The text to speak.
     * @param {string} voiceId - The voice ID.
     * @param {object} options - Options (speed, maxDuration, etc.)
     * @returns {string} - Relative path to the generated audio file.
     */
    async generateSpeech(provider, text, voiceId, options = {}) {
        const relativePath = await this.getService(provider).generateSpeech(text, voiceId, options);

        // Apply TTS Speed if requested (can be rate or speed)
        const playbackSpeed = options?.rate || options?.speed || 1.0;
        if (playbackSpeed !== 1.0) {
            await this.applySpeed(relativePath, playbackSpeed);
        }

        // Enforce Duration if requested
        if (options && options.maxDuration && typeof options.maxDuration === 'number') {
            await this.enforceDuration(relativePath, options.maxDuration);
        }

        return relativePath;
    }

    async applySpeed(relativePath, speedFactor) {
        return new Promise((resolve, reject) => {
            const absolutePath = path.join(paths.publicDir, relativePath);

            console.log(`TTS Manager: Applying speed ${speedFactor}x on ${relativePath}`);

            const pyCmd = paths.getPythonCommand('change_speed', [absolutePath, speedFactor.toString()]);
            const pythonProcess = spawn(pyCmd.cmd, pyCmd.args);

            pythonProcess.stdout.on('data', (data) => console.log(`[Speed]: ${data}`));
            pythonProcess.stderr.on('data', (data) => console.error(`[Speed Err]: ${data}`));

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    console.log("TTS Manager: Speed adjustment successful.");
                    resolve();
                } else {
                    console.error(`TTS Manager: Speed adjustment failed with code ${code}`);
                    resolve();
                }
            });

            pythonProcess.on('error', (err) => {
                console.error("TTS Manager: Failed to spawn speed adjustment script:", err);
                resolve(); // Resolve to not block
            });
        });
    }

    async enforceDuration(relativePath, maxDuration) {
        return new Promise((resolve, reject) => {
            // Convert to absolute path
            // relativePath is like "/audio/filename.mp3"
            // public is at ../../public
            const absolutePath = path.join(paths.publicDir, relativePath);

            console.log(`TTS Manager: Enforcing max duration of ${maxDuration}s on ${relativePath}`);

            const pyCmd = paths.getPythonCommand('enforce_duration', [absolutePath, maxDuration.toString()]);
            const pythonProcess = spawn(pyCmd.cmd, pyCmd.args);

            pythonProcess.stdout.on('data', (data) => console.log(`[Enforce]: ${data}`));
            pythonProcess.stderr.on('data', (data) => console.error(`[Enforce Err]: ${data}`));

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    console.log("TTS Manager: Duration enforcement successful.");
                    resolve();
                } else {
                    console.error(`TTS Manager: Duration enforcement failed with code ${code}`);
                    // We resolve anyway so as not to break the whole flow, but log error
                    resolve();
                }
            });

            pythonProcess.on('error', (err) => {
                console.error("TTS Manager: Failed to spawn enforcement script:", err);
                resolve(); // Resolve to not block
            });
        });
    }

    /*
     * Generates a preview for a given voice.
     * @param {string} provider - 'edge' or 'elevenlabs'
     * @param {string} voiceId - The voice ID.
     * @returns {string} - Relative path to the generated audio file.
     */
    async previewVoice(provider, voiceId) {
        return this.getService(provider).previewVoice(voiceId);
    }
}

module.exports = new TTSManager();
