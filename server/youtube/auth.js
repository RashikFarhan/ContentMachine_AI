const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { getWorkspaceConfig } = require('../services/workspaceUtils');
const paths = require('../../paths');

// Define paths
const CREDENTIALS_DIR = paths.credentialsDir;

function getTokenPath(workspaceId, secretFileBaseName) {
    const wsId = workspaceId || 'default';
    if (!secretFileBaseName) return path.join(CREDENTIALS_DIR, `token_${wsId}.json`);
    return path.join(CREDENTIALS_DIR, `token_${wsId}_${secretFileBaseName}`);
}

// Ensure credentials directory exists
if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
}

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

class YouTubeAuth {
    constructor() {
        this.oauth2Clients = {};
    }

    /**
     * Finds the valid client_secret file in the credentials directory based on workspace optionally.
     */
    findClientSecret(workspaceId) {
        if (!fs.existsSync(CREDENTIALS_DIR)) return null;

        const files = fs.readdirSync(CREDENTIALS_DIR);
        const wsConfig = getWorkspaceConfig(workspaceId);

        if (wsConfig && wsConfig.youtubeSecret && files.includes(wsConfig.youtubeSecret)) {
            return path.join(CREDENTIALS_DIR, wsConfig.youtubeSecret);
        }

        const secretFile = files.find(f => f.startsWith('client_secret') && f.endsWith('.json'));

        if (!secretFile) return null;
        return path.join(CREDENTIALS_DIR, secretFile);
    }

    /**
     * Initializes the OAuth2 client.
     * Changed to SYNCHRONOUS to avoid Promise bugs in call sites.
     */
    getAuthClient(workspaceId) {
        const cacheKey = workspaceId || 'default';
        if (this.oauth2Clients[cacheKey]) return this.oauth2Clients[cacheKey];

        const secretPath = this.findClientSecret(workspaceId);
        if (!secretPath) {
            // Throwing here might break app startup if called too early, 
            // but usually called when needed.
            throw new Error('No client_secret file found in /credentials folder.');
        }

        const content = fs.readFileSync(secretPath);
        const credentials = JSON.parse(content);

        // Extract client ID, secret, and redirect URI
        const keys = credentials.installed || credentials.web;
        if (!keys) {
            throw new Error('Invalid client_secret file format.');
        }

        let redirectUri = (keys.redirect_uris && keys.redirect_uris.length > 0)
            ? keys.redirect_uris[0]
            : 'http://localhost:5173';

        // Normalize: Remove trailing slash if present to prevent common mismatch errors
        if (redirectUri.endsWith('/')) {
            redirectUri = redirectUri.slice(0, -1);
        }

        console.log(`YouTube Auth: Initialize with Redirect URI: ${redirectUri}`);
        console.log(`IMPORTANT: Ensure '${redirectUri}' is added to 'Authorized redirect URIs' in your Google Cloud Console.`);

        const client = new google.auth.OAuth2(
            keys.client_id,
            keys.client_secret,
            redirectUri
        );

        // Check for existing token
        const secretBaseName = path.basename(secretPath);
        const tokPath = getTokenPath(workspaceId, secretBaseName);

        if (fs.existsSync(tokPath)) {
            try {
                const token = fs.readFileSync(tokPath, 'utf8');
                const parsed = JSON.parse(token);
                if (parsed && Object.keys(parsed).length > 0) {
                    client.setCredentials(parsed);
                } else {
                    console.warn(`YouTube Auth: Token file exists but empty at ${tokPath}.`);
                }
            } catch (e) {
                console.error(`YouTube Auth: Failed to parse token file ${tokPath}.`, e);
            }
        }

        this.oauth2Clients[cacheKey] = client;
        return client;
    }

    /**
     * Generates the authentication URL.
     * Sync.
     */
    getAuthUrl(workspaceId) {
        const client = this.getAuthClient(workspaceId);
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            state: 'youtube_auth_state',
            prompt: 'consent select_account' // Force refresh token and channel selection
        });
    }

    /**
     * Exchanges auth code for tokens and saves them.
     * Async (network).
     */
    async saveToken(code, workspaceId) {
        const client = this.getAuthClient(workspaceId);
        const secretPath = this.findClientSecret(workspaceId);
        const tokPath = getTokenPath(workspaceId, path.basename(secretPath));

        try {
            const { tokens } = await client.getToken(code);

            if (!tokens || Object.keys(tokens).length === 0) {
                throw new Error("Received empty tokens from Google.");
            }

            // Merge tokens if file exists (crucial to save refresh_token)
            if (fs.existsSync(tokPath)) {
                try {
                    const oldTokenStr = fs.readFileSync(tokPath, 'utf8');
                    const oldTokens = JSON.parse(oldTokenStr);
                    if (!tokens.refresh_token && oldTokens.refresh_token) {
                        tokens.refresh_token = oldTokens.refresh_token;
                    }
                } catch (e) { }
            }

            client.setCredentials(tokens);

            // Save to file
            fs.writeFileSync(tokPath, JSON.stringify(tokens));
            console.log('YouTube: Token stored to', tokPath);
            return tokens;
        } catch (error) {
            // Check if it's invalid_grant but we already have a valid token
            if (error.message === 'invalid_grant' && this.isAuthenticated(workspaceId)) {
                console.log('YouTube: Ignored invalid_grant due to React double-fire. Already authenticated.');
                return client.credentials;
            }
            throw error;
        }
    }

    /**
     * Checks if we have a valid token (or can refresh one).
     * Sync.
     */
    isAuthenticated(workspaceId) {
        try {
            const client = this.getAuthClient(workspaceId);
            // Check if credentials are set on the client
            const creds = client.credentials;
            // Safer check: ensure we have at least an access token or refresh token
            return !!(creds && (creds.access_token || creds.refresh_token));
        } catch (e) {
            return false;
        }
    }

    /**
     * Clears the current token data if it's invalid.
     */
    clearToken(workspaceId) {
        try {
            const secretPath = this.findClientSecret(workspaceId);
            if (!secretPath) return;

            const tokPath = getTokenPath(workspaceId, path.basename(secretPath));
            if (fs.existsSync(tokPath)) {
                fs.unlinkSync(tokPath);
            }

            const cacheKey = workspaceId || 'default';
            if (this.oauth2Clients[cacheKey]) {
                this.oauth2Clients[cacheKey].setCredentials({});
            }
        } catch (e) {
            console.error("Failed to clear YouTube token:", e);
        }
    }
}

module.exports = new YouTubeAuth();
