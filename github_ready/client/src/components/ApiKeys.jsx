import { useState, useEffect } from 'react';

function ApiKeys() {
    const [keys, setKeys] = useState({
        GEMINI_API_KEY: '',
        PEXELS_API_KEY: '',
        ELEVENLABS_API_KEY: '',
        NGROK_AUTHTOKEN: '',
        ASSEMBLYAI_API_KEY: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [visibleKeys, setVisibleKeys] = useState({});

    const toggleVisibility = (keyName) => {
        setVisibleKeys(prev => ({
            ...prev,
            [keyName]: !prev[keyName]
        }));
    };

    useEffect(() => {
        fetch('http://localhost:5000/api/apikeys')
            .then(res => res.json())
            .then(data => {
                setKeys(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch API keys:", err);
                setMessage("Failed to load keys.");
                setLoading(false);
            });
    }, []);

    const handleChange = (keyName, value) => {
        setKeys(prev => ({ ...prev, [keyName]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            const res = await fetch('http://localhost:5000/api/apikeys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(keys)
            });
            if (res.ok) {
                setMessage('API Keys saved successfully!');
            } else {
                setMessage('Failed to save API keys.');
            }
        } catch (e) {
            setMessage('Error: ' + e.message);
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    if (loading) return <div>Loading API Keys...</div>;

    return (
        <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2>Manage API Keys</h2>
            <p className="subtitle" style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                Update your API keys here without modifying the code. Meta and YouTube keys are managed separately.
            </p>

            <div className="form-group">
                <label>Gemini API Key</label>
                <div className="input-with-button">
                    <input
                        type={visibleKeys.GEMINI_API_KEY ? "text" : "password"}
                        value={keys.GEMINI_API_KEY}
                        onChange={e => handleChange('GEMINI_API_KEY', e.target.value)}
                        placeholder="AIzaSy..."
                    />
                    <button className="icon-btn" onClick={() => toggleVisibility('GEMINI_API_KEY')} title="Toggle visibility">
                        {visibleKeys.GEMINI_API_KEY ? "Hide" : "Show"}
                    </button>
                </div>
            </div>

            <div className="form-group">
                <label>Pexels API Key</label>
                <div className="input-with-button">
                    <input
                        type={visibleKeys.PEXELS_API_KEY ? "text" : "password"}
                        value={keys.PEXELS_API_KEY}
                        onChange={e => handleChange('PEXELS_API_KEY', e.target.value)}
                        placeholder="Pexels key..."
                    />
                    <button className="icon-btn" onClick={() => toggleVisibility('PEXELS_API_KEY')} title="Toggle visibility">
                        {visibleKeys.PEXELS_API_KEY ? "Hide" : "Show"}
                    </button>
                </div>
            </div>

            <div className="form-group">
                <label>ElevenLabs API Key</label>
                <div className="input-with-button">
                    <input
                        type={visibleKeys.ELEVENLABS_API_KEY ? "text" : "password"}
                        value={keys.ELEVENLABS_API_KEY}
                        onChange={e => handleChange('ELEVENLABS_API_KEY', e.target.value)}
                        placeholder="sk_..."
                    />
                    <button className="icon-btn" onClick={() => toggleVisibility('ELEVENLABS_API_KEY')} title="Toggle visibility">
                        {visibleKeys.ELEVENLABS_API_KEY ? "Hide" : "Show"}
                    </button>
                </div>
            </div>

            <div className="form-group">
                <label>Ngrok Authtoken</label>
                <div className="input-with-button">
                    <input
                        type={visibleKeys.NGROK_AUTHTOKEN ? "text" : "password"}
                        value={keys.NGROK_AUTHTOKEN}
                        onChange={e => handleChange('NGROK_AUTHTOKEN', e.target.value)}
                        placeholder="1a2b3c..."
                    />
                    <button className="icon-btn" onClick={() => toggleVisibility('NGROK_AUTHTOKEN')} title="Toggle visibility">
                        {visibleKeys.NGROK_AUTHTOKEN ? "Hide" : "Show"}
                    </button>
                </div>
            </div>

            <div className="form-group">
                <label>AssemblyAI API Key</label>
                <div className="input-with-button">
                    <input
                        type={visibleKeys.ASSEMBLYAI_API_KEY ? "text" : "password"}
                        value={keys.ASSEMBLYAI_API_KEY}
                        onChange={e => handleChange('ASSEMBLYAI_API_KEY', e.target.value)}
                        placeholder="Key for captions..."
                    />
                    <button className="icon-btn" onClick={() => toggleVisibility('ASSEMBLYAI_API_KEY')} title="Toggle visibility">
                        {visibleKeys.ASSEMBLYAI_API_KEY ? "Hide" : "Show"}
                    </button>
                </div>
            </div>

            <button onClick={handleSave} disabled={saving} style={{ marginTop: '1rem', width: '200px' }}>
                {saving ? 'Saving...' : 'Save Keys'}
            </button>

            {message && <div style={{ marginTop: '1rem', color: message.includes('success') ? '#4caf50' : '#ff4444' }}>{message}</div>}

            <style>{`
                .form-group {
                    margin-bottom: 1.5rem;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                    color: var(--text-secondary);
                    font-weight: 600;
                    text-transform: uppercase;
                    font-size: 0.85rem;
                }
                .form-group input {
                    flex: 1;
                    font-family: monospace;
                }
                .input-with-button {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .icon-btn {
                    padding: 0.875rem 1rem;
                    background: var(--bg-dark);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    color: var(--text-primary);
                    cursor: pointer;
                    min-width: 60px;
                    transition: border-color 0.2s;
                }
                .icon-btn:hover {
                    border-color: var(--accent-primary);
                }
            `}</style>
        </div>
    );
}

export default ApiKeys;
