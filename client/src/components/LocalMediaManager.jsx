import React, { useState } from 'react';

export default function LocalMediaManager({ keywords, onUpdateKeywords, mediaResults, onUpdateMediaResults }) {
    const [newKeyword, setNewKeyword] = useState('');
    const [newTriggers, setNewTriggers] = useState('');
    const [bulkImportText, setBulkImportText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [unassignedMedia, setUnassignedMedia] = useState([]);

    const API_BASE = "http://localhost:5000/api";

    const handleAddKeywordSet = () => {
        if (!newKeyword.trim()) return;
        const triggersArray = newTriggers.split(',').map(t => t.trim()).filter(t => t);

        const updatedKeywords = [...(keywords || []), { keyword: newKeyword, trigger: triggersArray }];
        onUpdateKeywords(updatedKeywords);

        const updatedMedia = [...(mediaResults || [])];
        if (!updatedMedia.find(m => m.keyword === newKeyword)) {
            updatedMedia.push({ keyword: newKeyword, results: [] });
            onUpdateMediaResults(updatedMedia);
        }

        setNewKeyword('');
        setNewTriggers('');
    };

    const handleBulkImport = () => {
        if (!bulkImportText.trim()) return;

        const groups = bulkImportText.split(';').map(g => g.trim()).filter(Boolean);
        let updatedKeywords = [...(keywords || [])];
        let updatedMedia = [...(mediaResults || [])];

        for (const group of groups) {
            const parts = group.split('|').map(p => p.trim()).filter(Boolean);
            if (parts.length > 0) {
                const kw = parts[0];
                const triggers = parts.slice(1);

                if (!updatedKeywords.find(k => k.keyword === kw)) {
                    updatedKeywords.push({ keyword: kw, trigger: triggers });
                    updatedMedia.push({ keyword: kw, results: [] });
                }
            }
        }

        onUpdateKeywords(updatedKeywords);
        onUpdateMediaResults(updatedMedia);
        setBulkImportText('');
    };

    const handleRemoveKeywordSet = (keywordToRemove) => {
        onUpdateKeywords((keywords || []).filter(k => k.keyword !== keywordToRemove));
        onUpdateMediaResults((mediaResults || []).filter(m => m.keyword !== keywordToRemove));
    };

    const handleFileUploadGlobal = async (files) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
        try {
            const res = await fetch(`${API_BASE}/local-media/upload`, {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            setUnassignedMedia(prev => [...prev, ...data.results]);
        } catch (e) {
            console.error(e);
            alert("Error uploading media");
        } finally {
            setUploading(false);
        }
    };

    const handleDragStart = (e, mediaItem, sourceKeyword) => {
        e.dataTransfer.setData('mediaId', mediaItem.id);
        e.dataTransfer.setData('sourceKeyword', sourceKeyword);
    };

    const handleDropOnKeyword = (e, targetKeyword) => {
        e.preventDefault();
        const mediaId = e.dataTransfer.getData('mediaId');
        const sourceKeyword = e.dataTransfer.getData('sourceKeyword');
        if (sourceKeyword === targetKeyword) return;

        let mediaItem = unassignedMedia.find(m => m.id === mediaId);
        let newUnassigned = [...unassignedMedia];
        let newMediaResults = [...mediaResults];

        if (mediaItem) {
            newUnassigned = newUnassigned.filter(m => m.id !== mediaId);
        } else {
            const sourceGroup = newMediaResults.find(g => g.keyword === sourceKeyword);
            if (sourceGroup) {
                mediaItem = sourceGroup.results.find(m => m.id === mediaId);
                newMediaResults = newMediaResults.map(g => {
                    if (g.keyword === sourceKeyword) {
                        return { ...g, results: g.results.filter(m => m.id !== mediaId) };
                    }
                    return g;
                });
            }
        }

        if (!mediaItem) return;

        const targetGroupIndex = newMediaResults.findIndex(g => g.keyword === targetKeyword);
        if (targetGroupIndex !== -1) {
            newMediaResults[targetGroupIndex].results.push(mediaItem);
        } else {
            newMediaResults.push({ keyword: targetKeyword, results: [mediaItem] });
        }

        setUnassignedMedia(newUnassigned);
        onUpdateMediaResults(newMediaResults);
    };

    const handleRemoveMedia = (sourceKeyword, mediaId) => {
        if (sourceKeyword === 'unassigned') {
            setUnassignedMedia(prev => prev.filter(m => m.id !== mediaId));
        } else {
            const updatedMediaResults = mediaResults.map(group => {
                if (group.keyword === sourceKeyword) {
                    return { ...group, results: group.results.filter(m => m.id !== mediaId) };
                }
                return group;
            });
            onUpdateMediaResults(updatedMediaResults);
        }
    };

    const renderMediaItem = (item, sourceKeyword) => (
        <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item, sourceKeyword)}
            style={{ position: 'relative', aspectRatio: '9/16', overflow: 'hidden', borderRadius: '4px', border: '1px solid #555', cursor: 'grab', minWidth: '80px' }}
        >
            {item.type === 'video' ? (
                <video src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
            ) : (
                <img src={item.url} alt="media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            <button
                onClick={() => handleRemoveMedia(sourceKeyword, item.id)}
                style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(255,0,0,0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✖
            </button>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.6rem', padding: '0.15rem', textAlign: 'center' }}>
                {item.type.toUpperCase()}
            </div>
        </div>
    );

    return (
        <div className="glass-panel" style={{ padding: '2rem', marginTop: '1.5rem', border: '1px solid #4CAF50' }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#4CAF50' }}>MANUAL MEDIA UPLOAD</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Upload media into your Unassigned Pool, then drag & drop them into their target Keywords.
            </p>

            {/* BULK IMPORT ROW */}
            <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px dashed #555' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', display: 'block', marginBottom: '10px' }}>Bulk Import Keywords & Triggers</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <textarea
                        value={bulkImportText}
                        onChange={(e) => setBulkImportText(e.target.value)}
                        placeholder="Format: Keyword1 | trigger1 | trigger2 ; Keyword2 | trigger1 | trigger2 ; ..."
                        style={{ flex: 1, padding: '10px', fontSize: '0.9rem', borderRadius: '5px', border: '1px solid #444', background: '#222', color: '#fff', minHeight: '60px' }}
                    />
                    <button onClick={handleBulkImport} disabled={!bulkImportText.trim()} style={{ background: 'var(--accent-primary)', color: 'black', fontWeight: 'bold' }}>
                        IMPORT
                    </button>
                </div>
            </div>

            {/* ADD SINGLE KEYWORD ROW */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-end', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Single Keyword Identifier</label>
                    <input
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        placeholder="e.g. 1"
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div style={{ flex: 2, minWidth: '250px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Triggers (comma separated)</label>
                    <input
                        type="text"
                        value={newTriggers}
                        onChange={(e) => setNewTriggers(e.target.value)}
                        placeholder="e.g. ancient rome, julius caesar"
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <button onClick={handleAddKeywordSet} disabled={!newKeyword.trim()} style={{ background: '#4CAF50', color: 'black' }}>
                    + ADD KEYWORD
                </button>
            </div>

            {/* UNASSIGNED MEDIA POOL */}
            <div style={{ marginBottom: '2rem', background: '#1e1e1e', padding: '1.5rem', borderRadius: '8px', border: '2px dashed #4CAF50' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnKeyword(e, 'unassigned')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ color: '#4CAF50', margin: 0 }}>📁 UNASSIGNED MEDIA POOL</h3>
                    <div>
                        <input
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            onChange={(e) => handleFileUploadGlobal(e.target.files)}
                            id="global-file-upload"
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="global-file-upload" style={{
                            display: 'inline-block', padding: '8px 16px', background: '#4CAF50', color: 'black', fontWeight: 'bold',
                            borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem'
                        }}>
                            {uploading ? 'Uploading...' : '📁 UPLOAD MEDIA'}
                        </label>
                    </div>
                </div>

                {unassignedMedia.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#666', fontStyle: 'italic', padding: '2rem 0' }}>
                        No unassigned media. Upload files here to drag them into keywords below.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px', padding: '10px' }}>
                        {unassignedMedia.map(item => renderMediaItem(item, 'unassigned'))}
                    </div>
                )}
            </div>

            {/* KEYWORD GROUPS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(keywords || []).map((k, index) => {
                    const groupMedia = (mediaResults || []).find(m => m.keyword === k.keyword)?.results || [];

                    return (
                        <div
                            key={index}
                            style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333', minHeight: '120px' }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDropOnKeyword(e, k.keyword)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', display: 'inline' }}>
                                        {k.keyword}
                                    </h3>
                                    <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        Triggers: {k.trigger?.join(', ')}
                                    </span>
                                </div>
                                <button onClick={() => handleRemoveKeywordSet(k.keyword)} style={{ background: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
                            </div>

                            {groupMedia.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#555', fontStyle: 'italic', padding: '1rem 0' }}>
                                    Drag media here to assign it to this keyword.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px' }}>
                                    {groupMedia.map(item => renderMediaItem(item, k.keyword))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {(keywords || []).length === 0 && (
                <div style={{ textAlign: 'center', color: '#666', fontStyle: 'italic', marginTop: '1rem' }}>
                    No keywords defined yet.
                </div>
            )}
        </div>
    );
}
