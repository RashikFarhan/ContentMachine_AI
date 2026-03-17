# ContentMachineAI

A powerful, automated AI-driven engine that dynamically creates and publishes YouTube Shorts and Meta Reels (Facebook/Instagram/TikTok) from a single "Boss Prompt."

## 🚀 Quick Start

### For Users (Fastest)
1. Navigate to the **[Releases](../../releases)** tab on GitHub.
2. Download the latest `ContentMachieneAI Setup vX.X.X.exe`.
3. Install and run the application.

### For Developers
```bash
git clone https://github.com/RashikFarhan/ContentMachine_AI.git
cd ContentMachine_AI

# Install dependencies for both backend and frontend
npm install
cd server && npm install
cd ../client && npm install
cd ..

# Run in Development Mode
npm run electron-dev
```

---

## ⚙️ Getting Started: Basic Usage & APIs
When you first start the application, you need to provide it with specific APIs to enable its core features. Open the App and navigate to **Settings > API Keys** to input your credentials. 
Here is a quick rundown of the essential APIs you should provide:
1. **Gemini API:** Required for script generation and logic.
2. **AssemblyAI:** Required for generating accurate word-level subtitles.
3. **Pexels API:** Required to automatically fetch background videos and images.
4. **Ngrok Authtoken:** Needed if you want to upload to Instagram.
5. **Social Media Credentials:** You will need to connect YouTube Client Secrets, Meta Tokens, or TikTok keys within your Workspaces for automated uploading.

---

## 🔑 Required APIs & Credentials (How to Get Them)

### 1. Gemini API (Google AI Studio)
Powering the "Boss Prompt", topic generation, and script logic.
* **Get it:** Google AI Studio. The free tier is widely sufficient.

### 2. AssemblyAI
Used for high-quality audio transcription to map exact word-level timings for the animated captions on screen.
* **Get it:** [AssemblyAI Dashboard](https://www.assemblyai.com).

### 3. Pexels API
Used to automatically find and download high-quality stock background photos and videos based on the script's visual context.
* **Get it:** [Pexels API Dashboard](https://www.pexels.com/api/).

### 4. Ngrok Authtoken
**Required for Instagram Uploads.** Instagram requires a public URL to download your video.
* **Setup:** Sign up at ngrok.com and copy your Authtoken.
* **Implementation:** Paste this into the App's API Keys section. The script uses this to temporarily create a "tunnel" so Meta's servers can pull your completed local video files.

### 5. Text-To-Speech (TTS) Options
ContentMachineAI supports multiple voices. You can use standard **Edge-TTS** (Free, built-in), or you input keys for premium voices.

---

## 📱 Social Media Authentication Setup

Meta and YouTube authentication require strict configuration. Follow these instructions perfectly to avoid "Internal Errors" or "Invalid Scope" messages.

### 1. YouTube Data API v3 (OAuth 2.0)
*   **Client Type:** In Google Cloud Console, create an OAuth Client ID as a **Web Application**. *(Do not select Desktop App, or the redirect logic will break).*
*   **Redirect URIs:** Set your Authorized Redirect URIs exactly to `http://localhost:5000/auth/youtube/callback` and `http://localhost:5173/auth/youtube/callback`.
*   **Test Users:** You must manually add your Gmail to the **Test Users list** in the OAuth Consent Screen (Audience tab) while the app is in "Testing" mode.
*   **Connecting to App:** Download the `client_secret.json` from Google Cloud and import it directly into your Workspace Controls tab in the App!
*   **Browser Choice:** When authenticating the first time, use Chrome or Edge. Privacy-focused browsers often block the crucial local redirect callback.

### 2. Meta (Facebook & Instagram) Permanent Token
To allow the script to post without manual login every hour, you must generate a permanent token.
*   **Setup:** Create a Meta App using the "Other" option and select the **Business** app type.
*   **Permissions:** In the Graph API Explorer, you MUST add these 6 scopes: `instagram_basic`, `instagram_content_publish`, `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, and `business_management`.
*   **The Extension:** Copy the generated token into the Access Token Debugger, click Extend, and get a 60-day token.
*   **Final Step:** Paste the 60-day token back into the Explorer, run a `GET /me/accounts` query, and copy the `access_token` from the JSON response. This is your permanent token. Paste this directly into the Workspace Upload settings.

### 3. TikTok
TikTok uploads require a standard TikTok Developer App token with video publishing scopes. Add the Client Key and Secret directly to the Workspace and follow the OAuth authorization flow within the app.

---

## 💡 Core Objects & Terminology (How to Use Inside)

Once your APIs are set up, here is a list of the primary objects and concepts you will work with inside ContentMachineAI:

*   **Workspace:** The central hub isolated for a specific project, channel, or niche. Located at the top of the UI. Each Workspace holds its own connected Social Media accounts, custom system prompts, branding settings, and generation history.
*   **The "Boss Prompt":** This is the global commander of your content for a given Workspace. You set a core directive (e.g., "Make interesting fun fact shorts under 150 words"), and the AI reliably generates scripts, titles, and platform-specific metadata aligning strictly with this rule.
*   **Continuous Generation (Series):** On the Create page, you can produce sequences of new content pieces based on your Boss Prompt theme. The AI maintains a history memory and avoids generating duplicate topics from past videos in that specific workspace.
*   **Special Instructions (Overrides):** Immediate instructions you can add in the main creator area to tweak specific videos (e.g., "Focus specifically on 18th-century London this time") without having to permanently alter your global Boss Prompt settings.
*   **Local Assets & Overrides:** While the AI gathers background assets automatically, you are not permanently locked in. You can provide your own local images, videos, and background music to be strictly used during the render phase.
*   **Automated Assembly Phase:** The internal pipeline where the app handles Text-to-Speech (TTS), background music mixing, image/video gathering, and visual pacing (exact subtitle word-level timing) altogether to output your final `.mp4`.
