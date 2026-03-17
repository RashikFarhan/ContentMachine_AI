const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function writeWavHeader(buffer, sampleRate = 24000) {
    const wav = Buffer.alloc(44 + buffer.length);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + buffer.length, 4);
    wav.write('WAVE', 8);
    wav.write('fmt ', 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(buffer.length, 40);
    buffer.copy(wav, 44);
    return wav;
}

class GoogleTTSService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1alpha/models/gemini-2.5-flash-preview-tts:generateContent';

        // Fixed Gemini audio voices
        this.voices = [
            { id: 'Aoede', name: 'Aoede (Gemini)', previewUrl: null },
            { id: 'Charon', name: 'Charon (Gemini)', previewUrl: null },
            { id: 'Fenrir', name: 'Fenrir (Gemini)', previewUrl: null },
            { id: 'Kore', name: 'Kore (Gemini)', previewUrl: null },
            { id: 'Puck', name: 'Puck (Gemini)', previewUrl: null }
        ];
    }

    async listVoices() {
        console.log(`Google Gemini listVoices: returning fixed list of ${this.voices.length} voices`);
        return this.voices;
    }

    async generateSpeech(text, voiceId, options = {}) {
        try {
            if (!this.apiKey) {
                throw new Error("GEMINI_API_KEY is not set in environment variables.");
            }

            // Fallback to Puck if invalid
            const validVoices = this.voices.map(v => v.id);
            if (!validVoices.includes(voiceId)) {
                voiceId = 'Puck';
            }

            const response = await axios.post(
                `${this.baseUrl}?key=${this.apiKey}`,
                {
                    contents: [{
                        role: 'user',
                        parts: [{ text: `Generate audio for the following text: ${text}` }]
                    }],
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: voiceId
                                }
                            }
                        }
                    }
                },
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            const parts = response.data?.candidates?.[0]?.content?.parts;
            if (!parts) {
                throw new Error("No output generated from Gemini TTS API.");
            }

            let audioBase64 = null;
            for (let part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    audioBase64 = part.inlineData.data;
                    break;
                }
            }

            if (!audioBase64) {
                throw new Error("No audio inlineData found in Gemini TTS response.");
            }

            const pcmBuffer = Buffer.from(audioBase64, 'base64');
            const wavBuffer = writeWavHeader(pcmBuffer, 24000);

            const fileName = `google-${uuidv4()}.wav`;
            const audioDir = path.join(__dirname, '../../public/audio');

            if (!fs.existsSync(audioDir)) {
                fs.mkdirSync(audioDir, { recursive: true });
            }

            const filePath = path.join(audioDir, fileName);
            fs.writeFileSync(filePath, wavBuffer);

            return `/audio/${fileName}`;

        } catch (error) {
            console.error("GoogleTTSService generateSpeech error:", error.response?.data || error.message);
            throw error;
        }
    }

    async previewVoice(voiceId) {
        return this.generateSpeech("Hello! This is a preview of my voice.", voiceId);
    }
}

module.exports = new GoogleTTSService();
