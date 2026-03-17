const axios = require('axios');
const fs = require('fs');

async function testDl() {
    try {
        console.log("Downloading...");
        const response = await axios({
            url: "http://localhost:5000/media/test", // just a dummy to see if timeout mapping
            method: 'GET',
            responseType: 'stream',
            timeout: 5000
        });
        console.log("Connected...");
        response.data.on('end', () => console.log('End stream'));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
testDl();
