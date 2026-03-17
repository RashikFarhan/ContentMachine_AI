const { createClient } = require('pexels');
require('dotenv').config();

const getClient = () => {
    if (!process.env.PEXELS_API_KEY) {
        throw new Error("Pexels API key is not set");
    }
    return createClient(process.env.PEXELS_API_KEY);
};

const searchMedia = async (keywords) => {
    let client;
    try {
        client = getClient();
    } catch (err) {
        console.error("Skipping Pexels search:", err.message);
        return keywords.map(k => ({ keyword: k, results: [], error: "API Key missing" }));
    }
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return [];
    }

    // Limit to first 15 keywords to allow more variety while staying within hourly limits
    const searchKeywords = keywords.slice(0, 15);
    const results = [];

    for (const keyword of searchKeywords) {
        try {
            // Search photos
            const photos = await client.photos.search({
                query: keyword,
                per_page: 3,
                orientation: 'portrait'
            });

            // Search videos (optional, but requested "media")
            const videos = await client.videos.search({
                query: keyword,
                per_page: 2,
                orientation: 'portrait'
            });

            const mediaItems = [];

            if (photos && photos.photos) {
                photos.photos.forEach(p => {
                    mediaItems.push({
                        type: 'photo',
                        id: p.id,
                        url: p.src.large, // Good for preview
                        preview: p.src.medium,
                        photographer: p.photographer,
                        original: p.src.original
                    });
                });
            }

            if (videos && videos.videos) {
                videos.videos.forEach(v => {
                    // Find a good video file link
                    const file = v.video_files.find(f => f.height >= 720) || v.video_files[0];
                    mediaItems.push({
                        type: 'video',
                        id: v.id,
                        url: file.link,
                        preview: v.image, // Video thumbnail
                        photographer: v.user.name,
                        duration: v.duration
                    });
                });
            }

            results.push({
                keyword: keyword,
                results: mediaItems
            });

        } catch (error) {
            console.error(`Error searching Pexels for keyword "${keyword}":`, error.message);
            // Push empty result for this keyword or skip? Let's push empty to show we tried.
            results.push({
                keyword: keyword,
                results: [],
                error: "Failed to fetch"
            });
        }
    }

    return results;
};

module.exports = { searchMedia };
