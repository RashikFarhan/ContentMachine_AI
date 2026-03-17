import React from 'react';

export default function ControlPanel({ onContinue, onManual, loading, error, specificFocus, setSpecificFocus, isLocalMedia, onToggleLocalMedia }) {
    return (
        <div style={{ marginBottom: '2rem', textAlign: 'center', width: '100%' }}>
            {/* Specific Focus Input */}
            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                    Specific Focus / Override (Optional)
                </label>
                <textarea
                    value={specificFocus || ''}
                    onChange={(e) => setSpecificFocus(e.target.value)}
                    placeholder="e.g. Focus specifically on 18th century London, or follow this exact incident..."
                    rows={2}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        backgroundColor: 'var(--bg-lighter)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.5rem',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        resize: 'vertical'
                    }}
                />
            </div>

            <div style={{ marginBottom: '1.5rem', textAlign: 'left', display: 'flex', alignItems: 'center' }}>
                <input
                    type="checkbox"
                    id="localMediaCheckbox"
                    checked={isLocalMedia}
                    onChange={(e) => onToggleLocalMedia(e.target.checked)}
                    style={{ width: '20px', height: '20px', marginRight: '10px', cursor: 'pointer' }}
                />
                <label htmlFor="localMediaCheckbox" style={{ fontSize: '1.1rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Use Local Media (Manual Media Uploads)
                </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                    onClick={() => onContinue()}
                    disabled={loading}
                    style={{
                        flex: 1,
                        fontSize: '1rem',
                        padding: '1.25rem 2rem',
                        letterSpacing: '0.05em',
                        fontWeight: 700
                    }}
                >
                    {loading ? (
                        <>
                            <span className="spinner"></span> GENERATING...
                        </>
                    ) : (
                        "CONTINUE GENERATION"
                    )}
                </button>

                <button
                    onClick={onManual}
                    disabled={loading}
                    className="secondary"
                    style={{
                        flex: 1,
                        fontSize: '1rem',
                        padding: '1.25rem 2rem',
                        letterSpacing: '0.05em',
                        fontWeight: 700,
                        backgroundColor: 'transparent',
                        border: '1px solid var(--primary-color)'
                    }}
                >
                    USE MANUAL SCRIPT
                </button>
            </div>

            {error && (
                <div style={{
                    color: '#ef4444',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    width: '100%',
                    marginTop: '1rem'
                }}>
                    <b>Error:</b> {error}
                </div>
            )}
        </div>
    );
}
