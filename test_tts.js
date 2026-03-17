require('dotenv').config({ path: './server/.env' });
const tts = require('./server/services/tts/googleTTSService');

async function test() {
    try {
        console.log("Testing TTS generateSpeech...");
        const result = await tts.generateSpeech("Hello world", "Aoede");
        console.log("Success:", result);
    } catch (e) {
        console.error("Caught error:", e.message);
    }
}
test();
