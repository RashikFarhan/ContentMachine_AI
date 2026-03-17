const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getWorkspaceConfig } = require('../services/workspaceUtils');
const paths = require('../../paths');
require('dotenv').config({ path: paths.envFile });

const TOKEN_PATH = path.join(paths.dataDir, 'tiktok_tokens.json');

// Ensure token file exists
if (!fs.existsSync(TOKEN_PATH)) {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify({}));
}

class TiktokAuth {
    getRedirectUri() {
        // ngrok URL should be set in process.env.PUBLIC_URL if running via index.js logic
        // default to localhost for fallback
        const base = process.env.PUBLIC_URL || 'http://localhost:5173';
        return `${base}/auth/tiktok/callback`;
    }

    getAuthUrl(workspaceId) {
        const config = getWorkspaceConfig(workspaceId);
        if (!config || !config.tiktokClientKey) {
            throw new Error('TikTok Client Key not configured in this workspace.');
        }

        const params = new URLSearchParams({
            client_key: config.tiktokClientKey,
            response_type: 'code',
            scope: 'user.info.basic,video.publish,video.upload',
            redirect_uri: this.getRedirectUri(),
            state: 'tiktok_auth_state'
        });

        return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
    }

    async exchangeCodeForToken(code, workspaceId) {
        try {
            const config = getWorkspaceConfig(workspaceId);
            if (!config || !config.tiktokClientKey || !config.tiktokClientSecret) {
                throw new Error('TikTok Client Key/Secret not configured in this workspace.');
            }

            const data = new URLSearchParams();
            data.append('client_key', config.tiktokClientKey);
            data.append('client_secret', config.tiktokClientSecret);
            data.append('code', code);
            data.append('grant_type', 'authorization_code');
            data.append('redirect_uri', this.getRedirectUri());

            const res = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', data, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cache-Control': 'no-cache'
                },
                timeout: 10000 // 10 second timeout
            });

            const tokenData = res.data;
            if (tokenData.error) {
                throw new Error(`TikTok Auth Error: ${tokenData.error_description}`);
            }

            // Save token mapping to workspace ID
            let tokens = {};
            try {
                tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
            } catch (e) { }

            tokens[workspaceId] = {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                open_id: tokenData.open_id,
                expires_in: tokenData.expires_in,
                updated_at: new Date().toISOString()
            };

            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
            return tokens[workspaceId];

        } catch (error) {
            console.error("TikTok Auth Error:", error.response?.data || error.message);
            throw new Error("Failed to authenticate with TikTok.");
        }
    }

    isAuthenticated(workspaceId) {
        try {
            const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
            return !!tokens[workspaceId]?.access_token;
        } catch (e) {
            return false;
        }
    }

    async getValidToken(workspaceId) {
        let tokens = {};
        try {
            tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        } catch (e) {
            throw new Error("No TikTok tokens found.");
        }

        const tokenData = tokens[workspaceId];
        if (!tokenData || !tokenData.access_token) {
            throw new Error("No access token for this workspace.");
        }

        const now = Date.now();
        const updatedAt = new Date(tokenData.updated_at).getTime();
        const expiresInMs = (tokenData.expires_in || 86400) * 1000;

        // Valid if expires more than 5 minutes from now
        if (now < updatedAt + expiresInMs - 300000) {
            return tokenData.access_token;
        }

        if (!tokenData.refresh_token) {
            throw new Error("Token expired and no refresh token available.");
        }

        // Refresh token
        const config = getWorkspaceConfig(workspaceId);
        if (!config || !config.tiktokClientKey || !config.tiktokClientSecret) {
            throw new Error('TikTok Client Key/Secret not configured.');
        }

        const data = new URLSearchParams();
        data.append('client_key', config.tiktokClientKey);
        data.append('client_secret', config.tiktokClientSecret);
        data.append('grant_type', 'refresh_token');
        data.append('refresh_token', tokenData.refresh_token);

        console.log(`TikTok: Refreshing expired access token...`);
        try {
            const res = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', data, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cache-Control': 'no-cache'
                },
                timeout: 10000
            });

            const newTokenData = res.data;
            if (newTokenData.error) {
                // If refresh fails, delete token
                delete tokens[workspaceId];
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
                throw new Error(`Refresh failed: ${newTokenData.error_description}`);
            }

            tokens[workspaceId] = {
                access_token: newTokenData.access_token,
                refresh_token: newTokenData.refresh_token,
                open_id: newTokenData.open_id,
                expires_in: newTokenData.expires_in,
                updated_at: new Date().toISOString()
            };

            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
            console.log(`TikTok: Token successfully refreshed.`);
            return tokens[workspaceId].access_token;
        } catch (error) {
            delete tokens[workspaceId];
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
            throw new Error("Failed to refresh TikTok token. Please re-authenticate.");
        }
    }
}

module.exports = new TiktokAuth();
