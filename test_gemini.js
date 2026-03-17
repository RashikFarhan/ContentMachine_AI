const { generateContent } = require('./server/services/geminiService');

async function test() {
    try {
        console.log("Testing generateContent...");
        const result = await generateContent("write a one sentence story about a robot");
        console.log("Success:", result);
    } catch (e) {
        console.error("Caught error:", e.message);
        if (e.response) {
            console.error("Response details:", await e.response.text());
        }
    }
}
test();
