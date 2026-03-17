ContentMachine_AI
A powerful, automated AI-driven engine that dynamically creates and publishes YouTube Shorts and Meta Reels (Facebook/Instagram) from a single "Boss Prompt."
Quick Start
Clone the Repository
Bash
git clone https://github.com/yourusername/yt-2.0-video-generator.git
cd yt-2.0-video-generator


Run setup.bat
This script automatically handles the heavy lifting, installing all necessary Python and Node.js dependencies for both the frontend and backend.
Run start-dev.bat
Launches the development servers for the UI and automation engine.
Configure API Keys
Open the web UI (typically at http://localhost:3000) and navigate to the API Keys section to input your core credentials.
How It Works (Functional Overview)
The system is designed to streamline the entire content creation lifecycle, from initial idea to final upload.
Workspace Management: Located at the top of the UI, you can select or create a Workspace. This isolates your projects. In the Controls tab, you can link specific upload credentials (like your YouTube client_secret.json or Meta Token JSON) to that workspace.
The "Boss Prompt": This is the global commander of your content. You set a core directive (e.g., "Make interesting fun fact shorts under 150 words"), and the AI generates the script, title, and platform-specific metadata.
Series & Continuous Generation: On the Create page, clicking Continue Generation produces a sequence of new content pieces based on your Boss Prompt theme.
Specific Focus / Override: You can add "Special Instructions" in the main creator area to tweak specific videos (e.g., "Focus specifically on 18th-century London") without changing your global Boss Prompt settings.
Automated Assembly: The system handles Text-to-Speech (TTS), background music, and visual pacing automatically before routing the final .mp4 to your social destinations.
API Guide (API Instructions)
Meta and YouTube authentication are complex. Follow these instructions strictly to avoid "Internal Errors" or "Invalid Scope" messages.
1. Meta (Facebook & Instagram) Permanent Token
To allow the script to post without manual login every hour, you must generate a permanent token.
Setup: Create a Meta App using the "Other" option and select the Business app type.
Permissions: In the Graph API Explorer, you MUST add these 6 scopes: instagram_basic, instagram_content_publish, pages_manage_posts, pages_read_engagement, pages_show_list, and business_management.
The Extension: Copy the generated token into the Access Token Debugger, click Extend, and get a 60-day token.
Final Step: Paste the 60-day token back into the Explorer, run GET /me/accounts, and copy the access_token from the JSON response. This is your permanent token.
2. YouTube Data API v3 (OAuth 2.0)
Client Type: In Google Cloud Console, create an OAuth Client ID as a Web Application. Do not select Desktop App, or the redirect logic will break.
Redirect URIs: Set your Authorized Redirect URI exactly to http://localhost:5173/.
Test Users: You must manually add your Gmail to the Test Users list in the OAuth Consent Screen (Audience tab) while the app is in "Testing" mode.
Browser Choice: When authenticating the first time, use Chrome or Edge. Privacy-focused browsers (like Zen) often block the crucial redirect callback.
3. Ngrok (Instagram Workaround)
Instagram requires a public URL to download your video.
Setup: Sign up at ngrok.com and copy your Authtoken.
Implementation: Add this to your .env as NGROK_AUTHTOKEN. The script uses this to create a temporary "tunnel" so Meta's servers can pull your local video files.
4. Additional APIs
Gemini API: Powering the "Boss Prompt" and script logic. Get yours at Google AI Studio.
AssemblyAI: Used for high-quality audio processing and transcription. Get your key from the AssemblyAI Dashboard.
Axios: The core dependency for handling all API communication.