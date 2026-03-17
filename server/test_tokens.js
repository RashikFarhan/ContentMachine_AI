const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');

async function testTokens() {
    const credsPath = path.join(__dirname, '../credentials', 'client_secret_25001906965-4j0vmfe8r5jv1l65vssgb4omk7b13ijg.apps.googleusercontent.com.json');
    const creds = JSON.parse(fs.readFileSync(credsPath)).installed || JSON.parse(fs.readFileSync(credsPath)).web;
    
    const tokenPaths = fs.readdirSync(path.join(__dirname, '../credentials')).filter(f => f.startsWith('token_') && f.endsWith('.json'));
    
    for (const tp of tokenPaths) {
        const token = JSON.parse(fs.readFileSync(path.join(__dirname, '../credentials', tp)));
        const client = new google.auth.OAuth2(creds.client_id, creds.client_secret, 'http://localhost:5173');
        client.setCredentials(token);
        
        try {
            const service = google.youtube('v3');
            const res = await service.channels.list({
                auth: client,
                part: 'snippet',
                mine: true
            });
            console.log(`Token ${tp} -> Channel: ${res.data.items[0]?.snippet?.title}`);
        } catch (e) {
            console.log(`Token ${tp} -> Error: ${e.message}`);
        }
    }
}

testTokens();
