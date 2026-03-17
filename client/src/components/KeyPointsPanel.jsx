import { useState, useEffect } from 'react';

export default function KeyPointsPanel({ keywords, onUpdateKeywords, onRefreshMedia }) {
    const [localKeywords, setLocalKeywords] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        // Convert to newline-separated string so commas inside triggers don't break the layout
        if (keywords && Array.isArray(keywords)) {
            setLocalKeywords(keywords.map(k => {
                if (typeof k === 'object') {
                    const t = Array.isArray(k.trigger) ? k.trigger.join(' | ') : k.trigger;
                    return `${t}: ${k.keyword}`;
                }
                return k;
            }).join("\n"));
        }
    }, [keywords]);

    const handleBlur = () => {
        // Parse back to array of objects
        const newKeywords = localKeywords.split('\n').map(k => {
            const str = k.trim();
            if (str.length === 0) return null;
            if (str.includes(':')) {
                const parts = str.split(':');
                const triggerStr = parts[0].trim();
                const keywordPart = parts.slice(1).join(':').trim();

                const triggers = triggerStr.split('|').map(t => t.trim()).filter(t => t.length > 0);
                return { trigger: triggers, keyword: keywordPart };
            }
            return { trigger: [str], keyword: str };
        }).filter(k => k !== null);

        onUpdateKeywords(newKeywords);
        setIsEditing(false);
    };

    return (
        <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: 0, color: 'var(--text-secondary)' }}>KEY POINTS / KEYWORDS</h2>
                <button onClick={onRefreshMedia} className="secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                    REFRESH MEDIA
                </button>
            </div>

            {isEditing ? (
                <textarea
                    value={localKeywords}
                    onChange={(e) => setLocalKeywords(e.target.value)}
                    onBlur={handleBlur}
                    autoFocus
                    rows={8}
                    style={{ fontFamily: 'monospace', width: '100%', padding: '0.5rem', background: '#111', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
            ) : (
                <div
                    onClick={() => setIsEditing(true)}
                    style={{
                        background: '#1a1a1c',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '1rem',
                        cursor: 'text',
                        minHeight: '80px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                    }}
                >
                    {keywords && keywords.length > 0 ? (
                        keywords.map((k, i) => {
                            const triggersText = typeof k === 'object' ? (Array.isArray(k.trigger) ? k.trigger.join(', ') : k.trigger) : k;
                            const keywordText = typeof k === 'object' ? k.keyword : k;
                            return (
                                <span key={i} style={{
                                    background: 'transparent',
                                    color: 'var(--text-primary)',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '1rem',
                                    fontSize: '0.85rem',
                                    border: '1px solid var(--accent-primary)'
                                }}>
                                    {triggersText !== keywordText ?
                                        <><span style={{ color: 'var(--text-secondary)' }}>[{triggersText}]</span> → <strong>{keywordText}</strong></>
                                        : keywordText}
                                </span>
                            );
                        })
                    ) : (
                        <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            No keywords generated. Click to add manual keywords...
                        </span>
                    )}
                </div>
            )}
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Click keywords to edit manually. Format: trigger1 | trigger2 : keyword
            </div>
        </div>
    );
}
