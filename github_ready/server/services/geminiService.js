const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Updated to use the available stable model for 2026
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const generateContent = async (bossPrompt, workspaceId = 'default', specificFocus = '') => {
    const maxRetries = 3;
    let attempt = 0;

    const historyFile = path.join(__dirname, `../data/history_${workspaceId}.json`);

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

    const prompt = `### ROLE
You are a high-level Content Strategist and SEO Expert.

### DYNAMIC CONTEXT (HISTORY)
STRICTLY PROHIBITED: Do not generate content similar to the following previous titles. You must provide something fresh and unique:
${historyContext}

### USER DIRECTION (BOSS PROMPT)
${bossPrompt}

${specificFocus ? `### SPECIFIC FOCUS / OVERRIDE\n${specificFocus}\n` : ''}
### GENERATION CONSTRAINTS
1. TITLE: Must be a high-CTR, "Pattern Interrupt" headline. SEO-optimized for reach. (Max 60 chars).
2. SCRIPT: High-retention narrative starting with a strong hook.
3. DESCRIPTION: 2 sentences of meta-data + 5 trending hashtags related to the content.
4. KEYWORDS (Pexels API & Timeline Optimization):
   - Generate a dual-layer structure: an optimized 'keyword' for visual search and an array of 'trigger' phrases for script placement.
   - LIMITATION: You MUST NOT generate more than 6 to 8 unique 'keywords' total! Do NOT exceed 10 keywords under any circumstances.
   - 'trigger': MUST be an ARRAY of EXACT, verbatim 1-3 word phrases found in the generated script.
   - To cover the entire video duration without huge gaps, DO NOT add more unique keywords. Instead, REUSE the same keyword by adding MULTIPLE 'trigger' phrases to its array. (e.g., if "British Army" is mentioned at the beginning, middle, and end, put all occurrences into the trigger array for the "British Army" keyword).
   - CRITICAL: Space out the triggers throughout the ENTIRE script. There should NEVER be huge gaps (e.g., 30+ words) without a trigger!
   - 'keyword': A highly visual context noun (1-3 words max) optimized for stock photography/video search. Use your AI intelligence to logically decide between specific items vs. generalized concepts:
     * Rule A (Specific, Common Objects): If the trigger is a common, highly visual object that is easy to find natively on stock sites (e.g., "bucket", "tank", "sword", "campfire"), use the EXACT object name. Do NOT over-generalize simple objects (e.g. do not turn "bucket" into "ancient tools", do not turn "tank" into "military weapons").
     * Rule B (Abstract, Anachronistic, or Complex Concepts): If the trigger is too complex, historically bound, or abstract (e.g., "British Army" in an 1800s context, "government intervention"), DO NOT use the exact script words. Generalize it powerfully to capture the broader vibe and era (e.g., "ancient soldiers", "historic battle", "landscape").
     Always balance specificity and vibe to get the absolute best, most relevant stock media results.

### OUTPUT FORMAT
Return a valid JSON object ONLY. No markdown, no prose.
{
  "title": "...",
  "script": "...",
  "description": "...",
  "keywords": [
    { "trigger": ["first phrase", "another phrase later in script", "third phrase at end"], "keyword": "visual noun for search" },
    { "trigger": ["exact phrase"], "keyword": "another visual noun" }
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
