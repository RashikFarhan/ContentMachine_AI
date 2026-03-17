export default function OutputDisplay({ data, onUpdate, audioUrl }) {
    // data = { title: "", script: "", description: "" }

    const handleChange = (key, value) => {
        onUpdate({ ...data, [key]: value });
    };

    return (
        <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>GENERATION OUTPUT</h2>

            {audioUrl && (
                <div className="output-card audio-card" style={{ borderColor: '#4caf50' }}>
                    <label style={{ color: '#4caf50' }}>NARRATION GENERATED</label>
                    <audio controls src={audioUrl} style={{ width: '100%', marginTop: '10px' }} />
                </div>
            )}

            <div className="output-card">
                <label>TITLE</label>
                <input
                    type="text"
                    value={data.title || ""}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="No title generated yet..."
                />
            </div>

            <div className="output-card">
                <label>SCRIPT</label>
                <textarea
                    value={data.script || ""}
                    onChange={(e) => handleChange('script', e.target.value)}
                    rows={12}
                    placeholder="No script generated yet..."
                    style={{ fontFamily: 'monospace' }}
                />
            </div>

            <div className="output-card">
                <label>DESCRIPTION</label>
                <textarea
                    value={data.description || ""}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    placeholder="No description generated yet..."
                />
            </div>
        </div>
    );
}
