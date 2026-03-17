const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const TOKEN_PATH = path.join(__dirname, '../data/meta_token.json');
const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const REDIRECT_URI = process.env.META_REDIRECT_URI || 'http://localhost:5173/auth/meta/callback';

class MetaAuth {
    constructor() {
        if (!APP_ID || !APP_SECRET) {
            console.warn("MetaAuth: Missing META_APP_ID or META_APP_SECRET in .env");
        }
    }

    getAuthUrl() {
        const params = new URLSearchParams({
            client_id: APP_ID,
            redirect_uri: REDIRECT_URI,
            scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_manage_posts,pages_read_engagement',
            response_type: 'code',
            state: 'meta_auth_state'
        });
        return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
    }

    async exchangeCodeForToken(code) {
        try {
            // 1. Get Short-lived User Token
            const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
                params: {
                    client_id: APP_ID,
                    redirect_uri: REDIRECT_URI,
                    client_secret: APP_SECRET,
                    code: code
                }
            });

            const shortLivedToken = tokenRes.data.access_token;

            // 2. Exchange for Long-lived User Token (60 days)
            const longTokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: APP_ID,
                    client_secret: APP_SECRET,
                    fb_exchange_token: shortLivedToken
                }
            });

            const longLivedToken = longTokenRes.data.access_token;

            // 3. Fetch Accounts (Pages & Instagram)
            const accounts = await this.fetchAccounts(longLivedToken);

            const tokenData = {
                user_access_token: longLivedToken,
                accounts: accounts,
                updated_at: new Date().toISOString()
            };

            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
            return tokenData;

        } catch (error) {
            console.error("Meta Auth Error:", error.response?.data || error.message);
            throw new Error("Failed to authenticate with Meta.");
        }
    }

    async fetchAccounts(accessToken) {
        // Get User's Pages and connected Instagram Accounts
        const res = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
            params: {
                access_token: accessToken,
                fields: 'name,access_token,instagram_business_account{id,username}'
            }
        });

        return res.data.data.map(page => ({
            page_id: page.id,
            page_name: page.name,
            page_access_token: page.access_token,
            instagram_id: page.instagram_business_account?.id,
            instagram_username: page.instagram_business_account?.username
        }));
    }

    isAuthenticated() {
        // Check for manual config first
        const configPath = path.join(__dirname, '../data/meta_config.json');
        if (fs.existsSync(configPath)) return true;

        if (!fs.existsSync(TOKEN_PATH)) return false;
        try {
            const data = JSON.parse(fs.readFileSync(TOKEN_PATH));
            // Basic check if token exists and has accounts
            return !!(data.user_access_token && data.accounts && data.accounts.length > 0);
        } catch (e) {
            return false;
        }
    }

    getTokenData() {
        if (!this.isAuthenticated()) return null;
        return JSON.parse(fs.readFileSync(TOKEN_PATH));
    }
}

module.exports = new MetaAuth();
