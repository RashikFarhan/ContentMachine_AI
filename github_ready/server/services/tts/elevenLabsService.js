const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ElevenLabsService {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY || 'sk_8055a852261ffc460b41de3f153206638b8137d64dd1ac07'; // Fallback to provided key if env not set
        this.baseUrl = 'https://api.elevenlabs.io/v1';
    }

    async listVoices() {
        try {
            console.log(`ElevenLabs listVoices: starting fetch with key [${this.apiKey.substring(0, 5)}...]`);
            const response = await axios.get(`${this.baseUrl}/voices`, {
                headers: {
                    'xi-api-key': this.apiKey
                }
            });
            console.log(`ElevenLabs listVoices: returned ${response.data.voices.length} voices`);

            return response.data.voices.map(v => ({
                id: v.voice_id,
                name: v.name,
                previewUrl: v.preview_url
            }));
        } catch (error) {
            console.error("ElevenLabs listVoices error:", error.response?.data || error.message);
            console.error("DEBUG:", error);
            return [];
        }
    }


    async generateSpeech(text, voiceId, options = {}) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/text-to-speech/${voiceId}`,
                {
                    text: text,
                    model_id: "eleven_monolingual_v1",
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.5
                    }
                },
                {
                    headers: {
                        'xi-api-key': this.apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'audio/mpeg'
                    },
                    responseType: 'stream'
                }
            );

            const fileName = `eleven-${uuidv4()}.mp3`;
            const audioDir = path.join(__dirname, '../../public/audio');

            if (!fs.existsSync(audioDir)) {
                fs.mkdirSync(audioDir, { recursive: true });
            }

            const filePath = path.join(audioDir, fileName);
            const writeStream = fs.createWriteStream(filePath);

            response.data.pipe(writeStream);

            return new Promise((resolve, reject) => {
                writeStream.on('finish', () => {
                    resolve(`/audio/${fileName}`);
                });
                writeStream.on('error', reject);
            });

        } catch (error) {
            console.error("ElevenLabs generateSpeech error:", error.response?.data || error.message);
            throw error;
        }
    }

    async previewVoice(voiceId) {
        // For ElevenLabs, we can generate a short text
        // Or if we had previewUrl from listVoices, frontend could play that.
        // But adhering to interface:
        return this.generateSpeech("Hello! This is a preview of my voice.", voiceId);
    }
}

module.exports = new ElevenLabsService();
