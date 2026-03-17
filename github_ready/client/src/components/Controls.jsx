import { useState, useEffect } from 'react';

function Controls({ workspaces, activeWorkspaceId, onUpdateWorkspace, onCreateWorkspace, onDeleteWorkspace, onSelectWorkspace }) {
    const [voices, setVoices] = useState([]);
    const [loadingVoices, setLoadingVoices] = useState(false);
    const [previewAudio, setPreviewAudio] = useState(null);
    const [ytSecrets, setYtSecrets] = useState([]);
    const [localWs, setLocalWs] = useState(null);

    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

    useEffect(() => {
        if (activeWorkspace) {
            // Check if localWs differs from activeWorkspace to avoid overwriting ongoing edits 
            // ONLY overwrite when switching workspace IDs or initial load
            setLocalWs(prev => {
                if (!prev || prev.id !== activeWorkspace.id) return { ...activeWorkspace };
                return prev;
            });
        } else {
            setLocalWs(null);
        }
    }, [activeWorkspaceId]);

    useEffect(() => {
        fetch('http://localhost:5000/api/workspaces/yt-secrets')
            .then(res => res.json())
            .then(data => setYtSecrets(data))
            .catch(err => console.error("Failed to load yt-secrets:", err));
    }, []);

    useEffect(() => {
        if (localWs?.ttsProvider && localWs.ttsProvider !== 'elevenlabs') {
            setLoadingVoices(true);
            fetch(`http://localhost:5000/api/tts/voices?provider=${localWs.ttsProvider}`)
                .then(res => res.json())
                .then(data => setVoices(data))
                .catch(err => console.error("Failed to load voices:", err))
                .finally(() => setLoadingVoices(false));
        } else {
            setVoices([]);
        }
    }, [localWs?.ttsProvider]);

    const handleChangeLocal = (field, value) => {
        if (!localWs) return;
        setLocalWs(prev => ({ ...prev, [field]: value }));
    };

    const handleTTSChangeLocal = (field, value) => {
        if (!localWs) return;
        setLocalWs(prev => ({
            ...prev,
            [field]: value,
            voice: ''
        }));
    };

    const handleSettingsChangeLocal = (setting, value) => {
        if (!localWs) return;
        setLocalWs(prev => ({
            ...prev,
            ttsSettings: { ...prev.ttsSettings, [setting]: value }
        }));
    };

    const handleVideoChangeLocal = (setting, value) => {
        if (!localWs) return;
        const current = localWs.videoSettings || { aspectRatio: '9:16', maxDuration: 55 };
        setLocalWs(prev => ({
            ...prev,
            videoSettings: { ...current, [setting]: value }
        }));
    };

    const handleSaveWorkspace = () => {
        if (localWs) {
            onUpdateWorkspace(localWs.id, localWs);
            alert("Workspace Saved!");
        }
    };

    const handleDiscard = () => {
        if (activeWorkspace) setLocalWs({ ...activeWorkspace });
    };

    const handlePreview = async () => {
        if (!localWs?.voice) return;

        try {
            const res = await fetch('http://localhost:5000/api/tts/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: localWs.ttsProvider,
                    voiceId: localWs.voice
                })
            });
            const data = await res.json();
            if (data.audioUrl) {
                const audio = new Audio(`http://localhost:5000${data.audioUrl}`);
                audio.play();
                setPreviewAudio(audio);
            }
        } catch (err) {
            console.error("Preview failed:", err);
        }
    };

    if (!workspaces.length) return <div>Loading workspaces...</div>;

    return (
        <div>
            {localWs ? (
                <>
                    <div className="glass-panel">

                        <div className="form-group">
                            <label>Name</label>
                            <input
                                type="text"
                                value={localWs.name}
                                onChange={(e) => handleChangeLocal('name', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Boss Prompt (Global)</label>
                            <textarea
                                value={localWs.bossPrompt}
                                onChange={(e) => handleChangeLocal('bossPrompt', e.target.value)}
                                rows={5}
                            />
                        </div>

                        <h3>TTS Configuration</h3>
                        <div className="form-group">
                            <label>Provider</label>
                            <select
                                value={localWs.ttsProvider || 'edge'}
                                onChange={(e) => handleTTSChangeLocal('ttsProvider', e.target.value)}
                            >
                                <option value="edge">Microsoft Edge (Free)</option>
                                <option value="elevenlabs">ElevenLabs</option>
                                <option value="google">Google Gemini</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Voice</label>

                            {localWs.ttsProvider === 'elevenlabs' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <input
                                        type="text"
                                        placeholder="Paste ElevenLabs Voice ID associated with your API Key"
                                        value={localWs.voice || ''}
                                        onChange={(e) => handleChangeLocal('voice', e.target.value)}
                                    />
                                    <small style={{ color: '#888' }}>
                                        * Copy the Voice ID from your ElevenLabs dashboard.
                                    </small>
                                </div>
                            ) : (
                                <select
                                    value={localWs.voice || ''}
                                    onChange={(e) => handleChangeLocal('voice', e.target.value)}
                                    disabled={loadingVoices}
                                >
                                    <option value="">
                                        {loadingVoices ? "Loading voices..." : "Select a Voice..."}
                                    </option>
                                    {voices.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            )}

                            <button onClick={handlePreview} disabled={!localWs.voice} style={{ marginLeft: '0px', marginTop: '10px' }}>
                                Preview Voice
                            </button>
                            {localWs.ttsProvider === 'elevenlabs' && (
                                <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                                    Note: Preview consumes ElevenLabs characters.
                                </small>
                            )}
                        </div>

                        <div className="form-group">
                            <label>Speed: {localWs.ttsSettings?.rate || 1.0}x</label>
                            <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={localWs.ttsSettings?.rate || 1.0}
                                onChange={(e) => handleSettingsChangeLocal('rate', parseFloat(e.target.value))}
                            />
                        </div>

                        <h3>Video Configuration</h3>

                        <div className="form-group">
                            <label>Aspect Ratio</label>
                            <select
                                value={localWs.videoSettings ? localWs.videoSettings.aspectRatio : '9:16'}
                                onChange={(e) => handleVideoChangeLocal('aspectRatio', e.target.value)}
                            >
                                <option value="9:16">9:16 (Vertical Shorts)</option>
                                <option value="16:9">16:9 (Horizontal)</option>
                                <option value="1:1">1:1 (Square)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Max Duration: {(localWs.videoSettings ? localWs.videoSettings.maxDuration : 55)}s</label>
                            <input
                                type="range"
                                min="10"
                                max="120"
                                step="1"
                                value={localWs.videoSettings ? localWs.videoSettings.maxDuration : 55}
                                onChange={(e) => handleVideoChangeLocal('maxDuration', parseInt(e.target.value))}
                            />
                        </div>

                        <h3>Upload Destinations</h3>

                        <div className="form-group">
                            <label>YouTube Client Secret File</label>
                            <select
                                value={localWs.youtubeSecret || ''}
                                onChange={(e) => handleChangeLocal('youtubeSecret', e.target.value)}
                            >
                                <option value="">Default (First found)</option>
                                {ytSecrets.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <small style={{ display: 'block', marginTop: '5px', color: '#888' }}>
                                Place your client_secret .json file into the 'credentials' folder to select it.
                            </small>
                        </div>

                        <div className="form-group">
                            <label>Meta Token JSON (FB/IG)</label>
                            <textarea
                                value={localWs.metaToken || ''}
                                onChange={(e) => handleChangeLocal('metaToken', e.target.value)}
                                rows={4}
                                placeholder='{"page_access_token": "...", "page_id": "...", "page_name": "..."}'
                                style={{ width: '100%', fontFamily: 'monospace' }}
                            />
                            <small style={{ display: 'block', marginTop: '5px', color: '#888' }}>
                                Paste the full JSON config for Facebook/Instagram upload here. It will override data/meta_config.json for this workspace.
                            </small>
                        </div>

                        <button onClick={handleSaveWorkspace} style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}>SAVE WORKSPACE</button>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button onClick={onCreateWorkspace} className="secondary" style={{ flex: 1 }}>NEW WORKSPACE</button>
                        <button onClick={handleDiscard} className="secondary" style={{ flex: 1 }}>DISCARD CHANGES</button>
                        <button onClick={() => onDeleteWorkspace(localWs.id)} style={{ flex: 1, backgroundColor: 'transparent', color: '#ff4444', border: '1px solid #ff4444' }}>DELETE WORKSPACE</button>
                    </div>
                </>
            ) : (
                <p style={{ textAlign: 'center', color: '#888' }}>Select a workspace to edit.</p>
            )}

            <style>{`
        .form-group {
            margin-bottom: 1.5rem;
        }
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            font-size: 0.85rem;
            font-weight: 600;
        }
      `}</style>
        </div >
    );
}

export default Controls;
