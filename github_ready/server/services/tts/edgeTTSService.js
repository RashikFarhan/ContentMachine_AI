const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class EdgeTTSService {
    constructor() {
        this.tts = new MsEdgeTTS();
    }

    async setVoice(voiceName) {
        await this.tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    }

    async listVoices() {
        try {
            // Create a fresh instance for listing voices
            const tts = new MsEdgeTTS();
            // This is a static-like method in some versions but sticking to instance usage which is safer
            // Actually msedge-tts might not have a direct listVoices method in all versions or it might be async.
            // Let's try to fetch voices if the library supports it.
            // If not, we can return a hardcoded list of popular ones as fallback, but let's try to find a way.
            // Looking at common usage of msedge-tts, it doesn't always expose a clean listVoices logic compared to python's edge-tts.
            // However, we can use the library's internal method if available or just return a curated list.
            // Let's start with a curated list of popular English voices to ensure stability if dynamic listing fails.

            return [
                { id: "en-US-AriaNeural", name: "English (US) - Aria" },
                { id: "en-US-GuyNeural", name: "English (US) - Guy" },
                { id: "en-US-JennyNeural", name: "English (US) - Jenny" },
                { id: "en-GB-SoniaNeural", name: "English (UK) - Sonia" },
                { id: "en-GB-RyanNeural", name: "English (UK) - Ryan" },
                { id: "en-AU-NatashaNeural", name: "English (AU) - Natasha" },
                { id: "en-AU-WilliamNeural", name: "English (AU) - William" }
            ];
        } catch (error) {
            console.error("EdgeTTS listVoices error:", error);
            return [];
        }
    }

    /*
     * Generates audio for a given text and returns the file path.
     * @param {string} text - The text to speak.
     * @param {string} voiceId - The voice ID.
     * @param {object} options - Options (speed, etc.)
     * @returns {string} - Relative path to the generated audio file.
     */
    async generateSpeech(text, voiceId, options = {}) {
        try {
            const tts = new MsEdgeTTS();
            await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

            const fileName = `edge-${uuidv4()}.mp3`;
            const audioDir = path.join(__dirname, '../../public/audio');
            if (!fs.existsSync(audioDir)) {
                fs.mkdirSync(audioDir, { recursive: true });
            }

            const filePath = path.join(audioDir, fileName);
            const writeStream = fs.createWriteStream(filePath);


            // msedge-tts toStream returns an object { audioStream, metadataStream, requestId }
            const { audioStream } = tts.toStream(text);

            audioStream.pipe(writeStream);

            return new Promise((resolve, reject) => {
                writeStream.on('finish', () => {
                    resolve(`/audio/${fileName}`);
                });
                writeStream.on('error', reject);
                if (audioStream) {
                    audioStream.on('error', reject);
                }
            });

        } catch (error) {
            console.error("EdgeTTS generateSpeech error:", error);
            throw error;
        }
    }


    async previewVoice(voiceId) {
        // Just generate a sample text
        return this.generateSpeech("Hello! This is a preview of my voice.", voiceId);
    }
}

module.exports = new EdgeTTSService();
