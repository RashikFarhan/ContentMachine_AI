const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const { getWorkspaceConfig } = require('./workspaceUtils');
const paths = require('../../paths');
require('dotenv').config({ path: paths.envFile });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Updated to use the available stable model for 2026
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const generateContent = async (bossPrompt, workspaceId = 'default', specificFocus = '') => {
    const maxRetries = 3;
    let attempt = 0;

    const historyFile = path.join(paths.dataDir, `history_${workspaceId}.json`);

    // 1. Read history
    let previousTitles = [];
    if (fs.existsSync(historyFile)) {
        try {
            const historyData = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
            // Keep only latest 50 to avoid prompt overload
            previousTitles = historyData.map(item => item.title).slice(-50);
        } catch (e) {
            console.error("Error reading history file:", e);
        }
    }

    const historyContext = previousTitles.length > 0
        ? previousTitles.join(', ')
        : "No previous titles generated yet.";

    const wsConfig = getWorkspaceConfig(workspaceId);

    // Fallbacks if systemPrompt hasn't been saved yet
    const systemPrompt = wsConfig?.systemPrompt || {};
    const roleContent = systemPrompt.role || "You are a high-level Content Strategist and SEO Expert.";
    const constraintsContent = systemPrompt.generalConstraints || `1. TITLE: Must be a high-CTR, "Pattern Interrupt" headline. SEO-optimized for reach. (Max 60 chars).
2. SCRIPT: High-retention narrative starting with a strong hook.
3. DESCRIPTION: 2 sentences of meta-data + 5 trending hashtags related to the content.`;
    const keywordRulesContent = systemPrompt.keywordRules || `   - Analyze the script and visualize it as a sequence of scenes. Divide the entire script into non-overlapping visual blocks (e.g., from the 1st word to the 25th word, from the 26th to 45th, etc.) so that absolutely NO areas are left without a visual.
   - For each block, determine ONE highly visual 'keyword' to query stock APIs. Limit yourself to 5-8 total unique 'keywords', reusing them if similar scenes appear or backtracking is needed.
   - 'keyword': A highly visual context noun (1-3 words max). Use your AI intelligence:
      * Rule A: If the segment is about a very common visual tool or object (e.g., "scissor", "bucket", "sword"), use that exact specific object name.
      * Rule B: If the segment is about something historically bound or abstract (e.g., "16th century Austrian army", "political collapse"), use a generalized, highly searchable term (e.g., "medieval armies", "map", "document") to get proper results.
   - 'trigger': This is a location marker. It MUST be an ARRAY containing EXACT, verbatim phrases (4-6 words long) from the script that mark the EXACT starting point of where this keyword's visual block begins. Do NOT use single words, use a unique 4-6 word chunk.
   - CRITICAL: The very first trigger of the very first keyword MUST be the exact first 4-6 words of the script! Every time the visual should switch to a new scene, grab the exact 4-6 words starting that new block and put it in the trigger array for that keyword.
   - You can reuse a keyword by adding another 4-6 word starting phrase to its trigger array if the same topic comes up again later.`;

    let prompt = `### ROLE
${roleContent}

### DYNAMIC CONTEXT (HISTORY)
STRICTLY PROHIBITED: Do not generate content similar to the following previous titles. You must provide something fresh and unique:
${historyContext}

### USER DIRECTION (BOSS PROMPT)
${bossPrompt}

${specificFocus ? `### SPECIFIC FOCUS / OVERRIDE\n${specificFocus}\n` : ''}
### GENERATION CONSTRAINTS
${constraintsContent}
4. KEYWORDS (Pexels API & Timeline Optimization):
${keywordRulesContent}

### OUTPUT FORMAT
Return a valid JSON object ONLY. No markdown, no prose.
{
  "title": "...",
  "script": "...",
  "description": "...",
  "keywords": [
    { "trigger": ["First four words of script", "Another four word boundary later"], "keyword": "visual noun for search" },
    { "trigger": ["Exactly four words starting here"], "keyword": "another visual noun" }
  ]
}`;

    while (attempt < maxRetries) {
        try {
            attempt++;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean up markdown code blocks if Gemini adds them
            const jsonString = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            const parsedResult = JSON.parse(jsonString);

            return parsedResult;

        } catch (error) {
            console.error(`Attempt ${attempt} - Error parsing Gemini response:`, error.message);
            if (attempt >= maxRetries) {
                throw new Error(`Failed to generate content after ${maxRetries} attempts. Last error: ${error.message}`);
            }
            // Optional delay before retry
            await new Promise(r => setTimeout(r, 1000));
        }
    }
};

module.exports = { generateContent };
