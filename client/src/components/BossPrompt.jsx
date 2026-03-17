import { useState, useEffect } from 'react';

export default function BossPrompt({ prompt, setPrompt, onSave }) {
    const [localPrompt, setLocalPrompt] = useState(prompt);
    const [isChanged, setIsChanged] = useState(false);

    useEffect(() => {
        setLocalPrompt(prompt);
    }, [prompt]);

    const handleChange = (e) => {
        setLocalPrompt(e.target.value);
        setPrompt(e.target.value);
        setIsChanged(true);
    };

    const handleSave = () => {
        onSave();
        setIsChanged(false);
    };

    return (
        <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>BOSS PROMPT</h2>
            <textarea
                value={localPrompt}
                onChange={handleChange}
                rows={6}
                placeholder="Define your master instructions here (e.g. 'You are a sarcastic tech reviewer...')"
                style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
                    SAVE BOSS PROMPT
                </button>
                {isChanged && <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>UNSAVED CHANGES</span>}
            </div>
        </div>
    );
}
