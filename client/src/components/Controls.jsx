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

    const handleSystemPromptChangeLocal = (field, value) => {
        if (!localWs) return;
        const currentSp = localWs.systemPrompt || {
            role: "You are a high-level Content Strategist and SEO Expert.",
            generalConstraints: "1. TITLE: Must be a high-CTR, \"Pattern Interrupt\" headline. SEO-optimized for reach. (Max 60 chars).\n2. SCRIPT: High-retention narrative starting with a strong hook.\n3. DESCRIPTION: 2 sentences of meta-data + 5 trending hashtags related to the content.",
            keywordRules: "   - Generate a dual-layer structure: an optimized 'keyword' for visual search and an array of 'trigger' phrases for script placement.\n   - LIMITATION: You MUST NOT generate more than 6 to 8 unique 'keywords' total! Do NOT exceed 10 keywords under any circumstances."
        };
        setLocalWs(prev => ({
            ...prev,
            systemPrompt: { ...currentSp, [field]: value }
        }));
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

                        <div className="form-group" style={{ border: '1px solid #444', padding: '15px', borderRadius: '8px', background: '#222' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Advanced System Prompt Editor</h3>
                            <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '15px', lineHeight: '1.4' }}>
                                Modify the core behavior of Gemini for this workspace. Read-only blocks show exactly how your prompt is structured, while text areas allow you to inject custom generation rules.
                            </p>

                            {/* Read Only Block 1 */}
                            <div style={{ background: '#111', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontFamily: 'monospace', fontSize: '12px', color: '#888' }}>
                                <div style={{ color: '#a866ff', fontWeight: 'bold' }}>### ROLE</div>
                                <textarea
                                    value={localWs.systemPrompt?.role || "You are a high-level Content Strategist and SEO Expert."}
                                    onChange={(e) => handleSystemPromptChangeLocal('role', e.target.value)}
                                    rows={2}
                                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', background: '#333', color: '#fff', border: '1px solid #555', marginTop: '5px' }}
                                />
                            </div>

                            <div style={{ background: '#111', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontFamily: 'monospace', fontSize: '12px', color: '#888' }}>
                                <div style={{ color: '#a866ff', fontWeight: 'bold', marginBottom: '5px' }}>### DYNAMIC CONTEXT (HISTORY)</div>
                                STRICTLY PROHIBITED: Do not generate content similar to the following previous titles. You must provide something fresh and unique:<br />
                                <span style={{ color: '#555' }}>[INJECTED PREVIOUS TITLES]</span><br /><br />
                                <div style={{ color: '#a866ff', fontWeight: 'bold', marginBottom: '5px' }}>### USER DIRECTION (BOSS PROMPT)</div>
                                <span style={{ color: '#555' }}>[INJECTED BOSS PROMPT]</span><br /><br />
                                <div style={{ color: '#a866ff', fontWeight: 'bold', marginBottom: '5px' }}>### SPECIFIC FOCUS / OVERRIDE</div>
                                <span style={{ color: '#555' }}>[INJECTED SPECIFIC FOCUS OVERRIDE (IF ANY)]</span>
                            </div>

                            {/* Editable Block 1 */}
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ color: '#a866ff', fontWeight: 'bold', fontFamily: 'monospace', display: 'block', marginBottom: '5px' }}>### GENERATION CONSTRAINTS (Title, Script, Meta)</label>
                                <textarea
                                    value={localWs.systemPrompt?.generalConstraints || "1. TITLE: Must be a high-CTR, \"Pattern Interrupt\" headline. SEO-optimized for reach. (Max 60 chars).\n2. SCRIPT: High-retention narrative starting with a strong hook.\n3. DESCRIPTION: 2 sentences of meta-data + 5 trending hashtags related to the content."}
                                    onChange={(e) => handleSystemPromptChangeLocal('generalConstraints', e.target.value)}
                                    rows={4}
                                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px' }}
                                />
                            </div>

                            {/* Editable Block 2 */}
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ color: '#a866ff', fontWeight: 'bold', fontFamily: 'monospace', display: 'block', marginBottom: '5px' }}>4. KEYWORDS (Pexels API & Timeline Optimization):</label>
                                <textarea
                                    value={localWs.systemPrompt?.keywordRules || "   - Generate a dual-layer structure: an optimized 'keyword' for visual search and an array of 'trigger' phrases for script placement.\n   - LIMITATION: You MUST NOT generate more than 6 to 8 unique 'keywords' total! Do NOT exceed 10 keywords under any circumstances."}
                                    onChange={(e) => handleSystemPromptChangeLocal('keywordRules', e.target.value)}
                                    rows={10}
                                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px' }}
                                />
                            </div>

                            {/* Read Only Block 2 */}
                            <div style={{ background: '#111', padding: '10px', borderRadius: '5px', fontFamily: 'monospace', fontSize: '12px', color: '#888' }}>
                                <div style={{ color: '#a866ff', fontWeight: 'bold' }}>### OUTPUT FORMAT</div>
                                Return a valid JSON object ONLY. No markdown, no prose.<br />
                                {'{\n  "title": "...",\n  "script": "...",\n  "description": "...",\n  "keywords": [\n    { "trigger": ["first phrase", "another phrase later in script", "third phrase at end"], "keyword": "visual noun for search" },\n    { "trigger": ["exact phrase"], "keyword": "another visual noun" }\n  ]\n}'}
                            </div>
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

                        <h3>Media Configuration</h3>

                        <div className="form-group">
                            <label>Media Source</label>
                            <select
                                value={localWs.mediaSource || 'pexels'}
                                onChange={(e) => handleChangeLocal('mediaSource', e.target.value)}
                            >
                                <option value="pexels">Pexels API (Stock Footage)</option>
                                <option value="google_genai">Google Generative AI (AI Images)</option>
                            </select>
                        </div>

                        {localWs.mediaSource === 'google_genai' && (
                            <>
                                <div className="form-group">
                                    <label>Image Generation Model</label>
                                    <select
                                        value={localWs.imageGenModel || 'imagen-3.0-generate-001'}
                                        onChange={(e) => handleChangeLocal('imageGenModel', e.target.value)}
                                    >
                                        <option value="imagen-3.0-generate-001">Imagen 3.0 Generate (Billed Plan)</option>
                                        <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (Free)</option>
                                        <option value="gemini-2.0-flash-exp-image-generation">Gemini 2.0 Flash Exp Image (Free)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Image Boss Prompt (Style & Instructions)</label>
                                    <textarea
                                        value={localWs.imageGenPrompt || 'Create a cinematic, photorealistic 9:16 vertical image of [KEYWORD]. Maintain a dark, moody color scheme with dramatic lighting.'}
                                        onChange={(e) => handleChangeLocal('imageGenPrompt', e.target.value)}
                                        rows={4}
                                        placeholder="Instructions for how the images should look. Use [KEYWORD] where the subject should be injected."
                                    />
                                    <small style={{ color: '#888' }}>
                                        This prompt will be sent to the Image Generator for each keyword. [KEYWORD] will be replaced with the actual scene keyword.
                                    </small>
                                </div>
                            </>
                        )}

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
                            <label>Export Folder</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={localWs.exportPath || ''}
                                    onChange={(e) => handleChangeLocal('exportPath', e.target.value)}
                                    placeholder="Default: Documents/YT2.0 Exports/"
                                    style={{ flex: 1 }}
                                />
                                {window.electronAPI && (
                                    <button
                                        onClick={async () => {
                                            const dir = await window.electronAPI.selectDirectory();
                                            if (dir) handleChangeLocal('exportPath', dir);
                                        }}
                                        style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}
                                    >
                                        Browse…
                                    </button>
                                )}
                            </div>
                            <small style={{ display: 'block', marginTop: '5px', color: '#888' }}>
                                Generated videos will be automatically copied here after each build.
                                {!localWs.exportPath && ' Leave empty to use the default folder.'}
                            </small>
                        </div>

                        <div className="form-group">
                            <label>YouTube Client Secret File</label>
                            <select
                                value={localWs.youtubeSecret || ''}
                                onChange={(e) => handleChangeLocal('youtubeSecret', e.target.value)}
                            >
                                <option value="">Default (First found)</option>
                                {ytSecrets.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {window.electronAPI ? (
                                <button
                                    onClick={async () => {
                                        const filePath = await window.electronAPI.selectFile({
                                            title: 'Import YouTube Client Secret',
                                            filters: [{ name: 'JSON Files', extensions: ['json'] }]
                                        });
                                        if (filePath) {
                                            try {
                                                const res = await fetch('http://localhost:5000/api/workspaces/import-yt-secret', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ filePath })
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                    // Refresh the secrets list
                                                    const refreshRes = await fetch('http://localhost:5000/api/workspaces/yt-secrets');
                                                    const refreshData = await refreshRes.json();
                                                    setYtSecrets(refreshData);
                                                    handleChangeLocal('youtubeSecret', data.fileName);
                                                    alert(`Imported: ${data.fileName}`);
                                                }
                                            } catch (e) {
                                                alert('Import failed: ' + e.message);
                                            }
                                        }
                                    }}
                                    style={{ marginTop: '8px', padding: '0.4rem 1rem' }}
                                >
                                    Import client_secret…
                                </button>
                            ) : (
                                <small style={{ display: 'block', marginTop: '5px', color: '#888' }}>
                                    Place your client_secret .json file into the 'credentials' folder to select it.
                                </small>
                            )}
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

                        <div className="form-group">
                            <label>TikTok Client Key</label>
                            <input
                                type="text"
                                value={localWs.tiktokClientKey || ''}
                                onChange={(e) => handleChangeLocal('tiktokClientKey', e.target.value)}
                                placeholder="Paste TikTok Client Key"
                            />
                        </div>

                        <div className="form-group">
                            <label>TikTok Client Secret</label>
                            <input
                                type="text"
                                value={localWs.tiktokClientSecret || ''}
                                onChange={(e) => handleChangeLocal('tiktokClientSecret', e.target.value)}
                                placeholder="Paste TikTok Client Secret"
                            />
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
