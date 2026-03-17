export default function MediaGallery({ results, onToggleExclude }) {
    if (!results || results.length === 0) return null;

    return (
        <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>PEXELS RESULTS</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {results.map((group, index) => (
                    <div key={index}>
                        <h3 style={{
                            fontSize: '1rem',
                            color: 'var(--accent-secondary)',
                            marginBottom: '1rem',
                            borderBottom: '1px solid var(--border-color)',
                            paddingBottom: '0.5rem'
                        }}>
                            {group.keyword.toUpperCase()}
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                            {group.results && group.results.length > 0 ? (
                                group.results.map((item) => (
                                    <div key={item.id} className="media-item" style={{ position: 'relative', aspectRatio: '9/16', overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border-color)', opacity: item.excluded ? 0.3 : 1 }}>
                                        <a href={item.url || item.videoUrl} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={item.preview || item.url}
                                                alt={item.photographer}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                                onMouseOver={(e) => { if (!item.excluded) e.currentTarget.style.transform = 'scale(1.1)'; }}
                                                onMouseOut={(e) => { if (!item.excluded) e.currentTarget.style.transform = 'scale(1.0)'; }}
                                            />
                                        </a>
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            background: 'rgba(0,0,0,0.7)',
                                            color: 'white',
                                            fontSize: '0.7rem',
                                            padding: '0.25rem',
                                            textAlign: 'center'
                                        }}>
                                            {item.type === 'video' ? '🎥 VIDEO' : '📷 PHOTO'}
                                        </div>

                                        {/* Cross Button */}
                                        <button
                                            onClick={() => onToggleExclude(group.keyword, item.id)}
                                            style={{
                                                position: 'absolute', top: 5, right: 5,
                                                background: item.excluded ? 'rgba(255,0,0,0.8)' : 'rgba(0,0,0,0.5)',
                                                color: 'white', border: 'none', borderRadius: '50%',
                                                width: '24px', height: '24px', cursor: 'pointer', zIndex: 10,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '14px', fontWeight: 'bold'
                                            }}
                                            title={item.excluded ? 'Include Item' : 'Exclude Item'}
                                        >
                                            {item.excluded ? '✓' : '✖'}
                                        </button>

                                        {item.excluded && (
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'red', fontWeight: 'bold', fontSize: '1.2rem', pointerEvents: 'none', background: 'rgba(255,255,255,0.7)', padding: '4px 8px', borderRadius: '4px' }}>
                                                EXCLUDED
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No results found.</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
