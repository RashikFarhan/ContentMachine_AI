import { useState, useEffect } from 'react';
import BossPrompt from './components/BossPrompt';
import ControlPanel from './components/ControlPanel';
import OutputDisplay from './components/OutputDisplay';
import KeyPointsPanel from './components/KeyPointsPanel';
import MediaGallery from './components/MediaGallery';
import LocalMediaManager from './components/LocalMediaManager';
import Controls from './components/Controls';
import ApiKeys from './components/ApiKeys';
import './App.css';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);

  // Content State
  const [bossPrompt, setBossPrompt] = useState("");
  const [specificFocus, setSpecificFocus] = useState("");
  const [generatedData, setGeneratedData] = useState({
    title: "",
    script: "",
    description: "",
    keywords: []
  });
  const [mediaResults, setMediaResults] = useState([]);
  const [audioUrl, setAudioUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  // Loading States
  const [loading, setLoading] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  // Upload States
  const [uploadLoading, setUploadLoading] = useState(false); // YouTube
  const [uploadStatus, setUploadStatus] = useState(null); // YouTube

  const [metaLoading, setMetaLoading] = useState(false);
  const [metaStatus, setMetaStatus] = useState(null); // 'success', 'error', 'auth_required'

  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [tiktokStatus, setTiktokStatus] = useState(null); // 'success', 'error', 'auth_required'

  const [error, setError] = useState(null);

  // Initial Load & Auth Callback Check
  useEffect(() => {
    // Check for Meta OAuth Callback in popup
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state === 'meta_auth_state') {
      // We are in the popup callback
      if (window.opener) {
        window.opener.postMessage({ type: 'META_AUTH_CODE', code }, window.location.origin);
        window.close();
        return; // Stop rendering app in popup
      }
    }

    if (code && state === 'tiktok_auth_state') {
      if (window.opener) {
        window.opener.postMessage({ type: 'TIKTOK_AUTH_CODE', code }, window.location.origin);
        window.close();
        return;
      }
    }

    if (code && state === 'youtube_auth_state') {
      if (window.opener) {
        window.opener.postMessage({ type: 'YOUTUBE_AUTH_CODE', code }, window.location.origin);
        window.close();
        return;
      }
    }

    fetch(`${API_BASE}/workspaces`)
      .then(res => res.json())
      .then(data => {
        setWorkspaces(data);
        if (data.length > 0) {
          selectWorkspace(data[0].id, data);
        } else {
          createDefaultWorkspace();
        }
      })
      .catch(err => console.error("Failed to load workspaces:", err));
  }, []);

  const createDefaultWorkspace = async () => {
    try {
      const res = await fetch(`${API_BASE}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: "My Project" })
      });
      const newWs = await res.json();
      setWorkspaces([newWs]);
      selectWorkspace(newWs.id, [newWs]);
    } catch (e) {
      setError("Failed to init workspace");
    }
  };

  const selectWorkspace = (id, allWorkspaces = workspaces) => {
    const ws = allWorkspaces.find(w => w.id === id);
    if (ws) {
      setActiveWorkspaceId(id);

      const savedStr = localStorage.getItem('cm_ai_state_' + id);
      if (savedStr) {
        try {
          const s = JSON.parse(savedStr);
          setBossPrompt(s.bossPrompt !== undefined ? s.bossPrompt : (ws.bossPrompt || ""));
          setSpecificFocus(s.specificFocus || "");
          setGeneratedData(s.generatedData || { title: "", script: "", description: "", keywords: [] });
          setMediaResults(s.mediaResults || []);
          setAudioUrl(s.audioUrl || null);
          setVideoUrl(s.videoUrl || null);
        } catch (e) {
          setBossPrompt(ws.bossPrompt || "");
        }
      } else {
        setBossPrompt(ws.bossPrompt || "");
        setSpecificFocus("");
        setGeneratedData({ title: "", script: "", description: "", keywords: [] });
        setMediaResults([]);
        setAudioUrl(null);
        setVideoUrl(null);
      }
    }
  };

  // Autosave to localStorage
  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem('cm_ai_state_' + activeWorkspaceId, JSON.stringify({
        bossPrompt,
        specificFocus,
        generatedData,
        mediaResults,
        audioUrl,
        videoUrl
      }));
    }
  }, [activeWorkspaceId, bossPrompt, specificFocus, generatedData, mediaResults, audioUrl, videoUrl]);

  // Poll for background video processing
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const checkVideoStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/video/status/${activeWorkspaceId}`);
        const data = await res.json();
        if (data.status === 'generating') {
          setVideoLoading(true);
          setVideoProgress(data.progress || 0);
        } else if (data.status === 'completed') {
          const newUrl = `http://localhost:5000${data.videoUrl}`;
          setVideoUrl((prev) => {
            if (prev !== newUrl) return newUrl;
            return prev;
          });
          setVideoLoading(false);
        } else if (data.status === 'error') {
          setVideoLoading((prev) => {
            if (prev) setError("Video Generation Failed in Background.");
            return false;
          });
        } else if (data.status === 'idle') {
          setVideoLoading(false);
        }
      } catch (e) { }
    };

    checkVideoStatus(); // check immediately
    const interval = setInterval(checkVideoStatus, 3000);
    return () => clearInterval(interval);
  }, [activeWorkspaceId]);

  const handleCreateWorkspace = async () => {
    const name = prompt("Workspace Name:");
    if (!name) return;
    try {
      const res = await fetch(`${API_BASE}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const newWs = await res.json();
      setWorkspaces([...workspaces, newWs]);
      selectWorkspace(newWs.id, [...workspaces, newWs]);
      setActiveTab('controls');
    } catch (e) {
      setError("Create failed");
    }
  };

  const handleUpdateWorkspace = async (id, updates) => {
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));

    if (id === activeWorkspaceId) {
      if (updates.bossPrompt !== undefined) setBossPrompt(updates.bossPrompt);
    }

    try {
      await fetch(`${API_BASE}/workspaces/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      console.error("Update failed", e);
    }
  };

  const handleDeleteWorkspace = async (id) => {
    if (!window.confirm("Delete this workspace?")) return;
    try {
      await fetch(`${API_BASE}/workspaces/${id}`, { method: 'DELETE' });
      const newWorkspaces = workspaces.filter(w => w.id !== id);
      setWorkspaces(newWorkspaces);
      if (newWorkspaces.length > 0) {
        selectWorkspace(newWorkspaces[0].id, newWorkspaces);
      } else {
        createDefaultWorkspace();
      }
    } catch (e) {
      setError("Delete failed");
    }
  };

  const handleSaveBossPrompt = () => {
    if (activeWorkspaceId) {
      handleUpdateWorkspace(activeWorkspaceId, { bossPrompt });
    }
  };

  const handleToggleExcludeMedia = (keyword, itemId) => {
    setMediaResults(prev => prev.map(group => {
      if (group.keyword === keyword) {
        return {
          ...group,
          results: group.results.map(item =>
            item.id === itemId ? { ...item, excluded: !item.excluded } : item
          )
        };
      }
      return group;
    }));
  };

  const handleGenerateAudio = async () => {
    if (!generatedData.script || !activeWorkspaceId) return;
    const ws = workspaces.find(w => w.id === activeWorkspaceId);

    if (!ws || !ws.voice) {
      setError("No voice configured for this workspace");
      return;
    }

    setTtsLoading(true);
    setError(null);
    fetch(`${API_BASE}/tts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: ws.ttsProvider,
        text: generatedData.script,
        voiceId: ws.voice,
        options: ws.ttsSettings
      })
    })
      .then(r => r.json())
      .then(d => setAudioUrl(`http://localhost:5000${d.audioUrl}`))
      .catch(e => {
        console.error("TTS Error", e);
        setError("Failed to generate audio.");
      })
      .finally(() => setTtsLoading(false));
  };

  const handleContinue = async () => {
    if (!bossPrompt.trim()) {
      setError("Please write a Boss Prompt first.");
      return;
    }

    setLoading(true);
    setError(null);
    setAudioUrl(null);
    setVideoUrl(null);
    setUploadStatus(null);
    setMetaStatus(null);
    setTiktokStatus(null);
    setGeneratedData(prev => ({ ...prev, title: "", script: "", description: "", keywords: [] }));

    // Clear previous video generation status on the backend to avoid stale polling
    try {
      await fetch(`${API_BASE}/video/status/${activeWorkspaceId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Could not clear video status", e);
    }

    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bossPrompt, workspaceId: activeWorkspaceId, specificFocus })
      });

      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();

      if (!data.keywords) data.keywords = [];

      setGeneratedData(data);

      if (data.keywords && data.keywords.length > 0) {
        const ws = workspaces.find(w => w.id === activeWorkspaceId);
        const currentMediaSource = ws ? ws.mediaSource : 'pexels';

        if (!currentMediaSource || currentMediaSource === 'pexels') {
          setMediaLoading(true);
          const searchTerms = data.keywords.map(k => typeof k === 'object' ? k.keyword : k);
          fetch(`${API_BASE}/pexels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: searchTerms })
          })
            .then(r => r.json())
            .then(d => setMediaResults(d.results))
            .finally(() => setMediaLoading(false));
        } else {
          // google_genai or local chosen. 
          setMediaResults([]); // Reset media 
        }
      }

      // Stop before automatic audio generation to let user review script/keywords
      console.log('Script generated. Ready for audio generation.');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualProcess = async () => {
    if (!generatedData.script || !generatedData.title) {
      setError("Please provide a script and a title manually.");
      return;
    }

    setLoading(true);
    setError(null);
    setAudioUrl(null);
    setVideoUrl(null);
    setUploadStatus(null);
    setMetaStatus(null);
    setTiktokStatus(null);

    // Clear previous video generation status on the backend to avoid stale polling
    try {
      await fetch(`${API_BASE}/video/status/${activeWorkspaceId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Could not clear video status", e);
    }

    try {
      if (generatedData.keywords && generatedData.keywords.length > 0) {
        const ws = workspaces.find(w => w.id === activeWorkspaceId);
        if (!ws || ws.mediaSource === 'pexels' || !ws.mediaSource) {
          setMediaLoading(true);
          const searchTerms = generatedData.keywords.map(k => typeof k === 'object' ? k.keyword : k);
          fetch(`${API_BASE}/pexels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: searchTerms })
          })
            .then(r => r.json())
            .then(d => setMediaResults(d.results))
            .finally(() => setMediaLoading(false));
        } else {
          // Not automatically populating.
          setMediaResults([]);
        }
      }

      // Wait for manual trigger of Generate Audio
      console.log('Manual process updated. Waiting for audio generation.');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!generatedData.keywords || !generatedData.keywords.length || !activeWorkspaceId) return;

    setMediaLoading(true);
    setError(null);

    const searchTerms = generatedData.keywords.map(k => typeof k === 'object' ? k.keyword : k);

    try {
      const res = await fetch(`${API_BASE}/generate-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: searchTerms, workspaceId: activeWorkspaceId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image generation failed.");
      setMediaResults(data.results);
    } catch (err) {
      setError(`AI Image Error: ${err.message}`);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!audioUrl || !mediaResults.length || !activeWorkspaceId) return;
    const ws = workspaces.find(w => w.id === activeWorkspaceId);

    setVideoLoading(true);
    setVideoProgress(0); // Reset progress
    setError(null);
    setUploadStatus(null);
    setMetaStatus(null);
    setTiktokStatus(null);

    try {
      const res = await fetch(`${API_BASE}/video/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: generatedData.script,
          title: generatedData.title,
          description: generatedData.description,
          audioUrl: audioUrl.replace('http://localhost:5000', ''), // Send relative path
          keywords: generatedData.keywords,
          mediaResults: mediaResults.map(group => ({
            ...group,
            results: group.results ? group.results.filter(i => !i.excluded) : []
          })),
          settings: ws.videoSettings,
          workspaceId: activeWorkspaceId
        })
      });

      if (!res.ok) throw new Error("Video generation failed");
      const data = await res.json();
      setVideoUrl(`http://localhost:5000${data.videoUrl}`);

    } catch (err) {
      setError("Video Error: " + err.message);
    } finally {
      setVideoLoading(false);
      setVideoProgress(0); // Reset after done
    }
  };

  const handleUploadYouTube = async () => {
    setUploadLoading(true);
    setUploadStatus(null);
    setError(null);

    try {
      // 1. Check Auth
      const authCheck = await fetch(`${API_BASE}/youtube/auth?workspaceId=${activeWorkspaceId}`);
      const authData = await authCheck.json();

      if (!authData.authenticated) {
        // Open Popup
        const popup = window.open(authData.url, 'YouTubeAuth', 'width=600,height=700');
        setUploadStatus('auth_required');

        // Listener for popup message
        const handleMessage = async (event) => {
          if (!event.data || event.data.type !== 'YOUTUBE_AUTH_CODE') return;
          window.removeEventListener('message', handleMessage);
          // Exchange Code
          try {
            const exchangeRes = await fetch(`${API_BASE}/youtube/oauth2callback`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: event.data.code, workspaceId: activeWorkspaceId })
            });
            if (!exchangeRes.ok) throw new Error("Auth Exchange Failed");

            // Auth success, now trigger upload
            performYouTubeUpload();
          } catch (e) {
            setError("YouTube Auth Failed: " + e.message);
            setUploadLoading(false);
          }
        };
        window.addEventListener('message', handleMessage);
        return;
      }

      // If authenticated, upload directly
      performYouTubeUpload();

    } catch (err) {
      console.error(err);
      setError("YouTube check failed: " + err.message);
      setUploadLoading(false);
    }
  };

  const performYouTubeUpload = async () => {
    setUploadLoading(true);
    try {
      const uploadRes = await fetch(`${API_BASE}/youtube/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workspaceId: activeWorkspaceId,
          videoUrl: videoUrl,
          title: generatedData.title,
          description: generatedData.description
        })
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      setUploadStatus('success');
    } catch (err) {
      console.error(err);
      setError("YouTube Upload Failed: " + err.message);
      setUploadStatus('error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleUploadMeta = async () => {
    setMetaLoading(true);
    setMetaStatus(null);
    setError(null);

    try {
      // 1. Check Auth
      const authCheck = await fetch(`${API_BASE}/meta/auth?workspaceId=${activeWorkspaceId}`);
      const authData = await authCheck.json();

      if (!authData.authenticated) {
        // Open Popup
        const popup = window.open(authData.url, 'MetaAuth', 'width=600,height=700');
        setMetaStatus('auth_required');

        // Listener for popup message
        const handleMessage = async (event) => {
          if (!event.data || event.data.type !== 'META_AUTH_CODE') return;
          if (event.data.type === 'META_AUTH_CODE') {
            window.removeEventListener('message', handleMessage);
            // Exchange Code
            try {
              const exchangeRes = await fetch(`${API_BASE}/meta/oauth/callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: event.data.code })
              });
              if (!exchangeRes.ok) throw new Error("Auth Exchange Failed");

              // Auth success, now trigger upload
              performMetaUpload();
            } catch (e) {
              setError("Meta Auth Failed: " + e.message);
              setMetaLoading(false);
            }
          }
        };
        window.addEventListener('message', handleMessage);
        return;
      }

      // If authenticated, upload directly
      performMetaUpload();

    } catch (err) {
      console.error(err);
      setError("Meta check failed: " + err.message);
      setMetaLoading(false);
    }
  };

  const performMetaUpload = async () => {
    setMetaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/meta/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workspaceId: activeWorkspaceId,
          videoUrl: videoUrl,
          title: generatedData.title,
          description: generatedData.description
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setMetaStatus('success'); // Partial success handled by log/console for now
      // Could inspect data.results to show partial success
    } catch (err) {
      setError("Meta Upload Error: " + err.message);
      setMetaStatus('error');
    } finally {
      setMetaLoading(false);
    }
  };

  const handleUploadTiktok = async () => {
    setTiktokLoading(true);
    setTiktokStatus(null);
    setError(null);

    try {
      // 1. Check Auth
      const authCheck = await fetch(`${API_BASE}/tiktok/auth?workspaceId=${activeWorkspaceId}`);
      const authData = await authCheck.json();

      if (!authData.authenticated) {
        // Open Popup
        const popup = window.open(authData.url, 'TiktokAuth', 'width=600,height=700');
        setTiktokStatus('auth_required');

        // Listener for popup message
        const handleMessage = async (event) => {
          if (!event.data || event.data.type !== 'TIKTOK_AUTH_CODE') return;
          if (event.data.type === 'TIKTOK_AUTH_CODE') {
            window.removeEventListener('message', handleMessage);
            // Exchange Code
            try {
              const exchangeRes = await fetch(`${API_BASE}/tiktok/oauth/callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: event.data.code, workspaceId: activeWorkspaceId })
              });
              if (!exchangeRes.ok) throw new Error("Auth Exchange Failed");

              // Auth success, now trigger upload
              performTiktokUpload();
            } catch (e) {
              setError("TikTok Auth Failed: " + e.message);
              setTiktokLoading(false);
            }
          }
        };
        window.addEventListener('message', handleMessage);
        return;
      }

      // If authenticated, upload directly
      performTiktokUpload();

    } catch (err) {
      console.error(err);
      setError("TikTok check failed: " + err.message);
      setTiktokLoading(false);
    }
  };

  const performTiktokUpload = async () => {
    setTiktokLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tiktok/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workspaceId: activeWorkspaceId,
          videoUrl: videoUrl,
          title: generatedData.title,
          description: generatedData.description
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setTiktokStatus('success');
    } catch (err) {
      setError("TikTok Upload Error: " + err.message);
      setTiktokStatus('error');
    } finally {
      setTiktokLoading(false);
    }
  };

  const handleUpdateKeywords = (newKeys) => {
    setGeneratedData(p => ({ ...p, keywords: newKeys }));
  };

  const handleRefreshMedia = () => {
    if (generatedData.keywords.length) {
      setMediaLoading(true);
      const searchTerms = generatedData.keywords.map(k => typeof k === 'object' ? k.keyword : k);
      fetch(`${API_BASE}/pexels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: searchTerms })
      })
        .then(r => r.json())
        .then(d => setMediaResults(d.results))
        .finally(() => setMediaLoading(false));
    }
  };

  // If we are handling auth callback in popup, show simple message
  if (new URLSearchParams(window.location.search).get('code')) {
    const state = new URLSearchParams(window.location.search).get('state');
    if (state === 'meta_auth_state') {
      return <div style={{ color: 'white', padding: '20px' }}>Authenticating with Meta... please wait.</div>;
    }
    if (state === 'tiktok_auth_state') {
      return <div style={{ color: 'white', padding: '20px' }}>Authenticating with TikTok... please wait.</div>;
    }
  }

  return (
    <div className="app-container">
      <nav className="top-navbar">
        <div className="nav-logo">ContentMachine_AI</div>
        <div className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            CREATE
          </button>
          <button
            className={`tab-btn ${activeTab === 'controls' ? 'active' : ''}`}
            onClick={() => setActiveTab('controls')}
          >
            CONTROLS
          </button>
          <button
            className={`tab-btn ${activeTab === 'apikeys' ? 'active' : ''}`}
            onClick={() => setActiveTab('apikeys')}
          >
            API KEYS
          </button>
        </div>
        <div className="nav-actions">
          <select
            className="workspace-select"
            value={activeWorkspaceId || ""}
            onChange={(e) => {
              const selectedId = e.target.value;
              const w = workspaces.find(w => w.id === selectedId);
              if (w) selectWorkspace(selectedId, workspaces);
            }}
          >
            <option disabled value="">Select Workspace...</option>
            {workspaces.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </nav>

      <div className="page-body">
        {activeTab === 'create' ? (
          <>
            <h1 className="page-title">AI Script Creator Dashboard</h1>
            <div className="dashboard-grid">
              <BossPrompt
                prompt={bossPrompt}
                setPrompt={setBossPrompt}
                onSave={handleSaveBossPrompt}
              />

              <ControlPanel
                onContinue={handleContinue}
                onManual={handleManualProcess}
                loading={loading}
                error={error}
                specificFocus={specificFocus}
                setSpecificFocus={setSpecificFocus}
                isLocalMedia={workspaces.find(w => w.id === activeWorkspaceId)?.mediaSource === 'local'}
                onToggleLocalMedia={(checked) => handleUpdateWorkspace(activeWorkspaceId, { mediaSource: checked ? 'local' : 'pexels' })}
              />

              {/* GENERATE AUDIO BUTTON */}
              {generatedData.script && (
                <div style={{ textAlign: 'center', margin: '1rem 0', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button
                    onClick={handleGenerateAudio}
                    disabled={ttsLoading}
                    style={{
                      padding: '1rem 2rem',
                      fontSize: '1.2rem',
                      backgroundColor: 'var(--accent-secondary)',
                      color: 'black',
                      fontWeight: 'bold',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: ttsLoading ? 'not-allowed' : 'pointer',
                      opacity: ttsLoading ? 0.7 : 1
                    }}
                  >
                    {ttsLoading ? 'GENERATING AUDIO...' : (audioUrl ? 'REGENERATE AUDIO 🎙️' : 'GENERATE AUDIO 🎙️')}
                  </button>

                  {/* GENERATE IMAGES BUTTON (Only if google_genai source) */}
                  {workspaces.find(w => w.id === activeWorkspaceId)?.mediaSource === 'google_genai' && generatedData.keywords?.length > 0 && (
                    <button
                      onClick={handleGenerateImages}
                      disabled={mediaLoading}
                      style={{
                        padding: '1rem 2rem',
                        fontSize: '1.2rem',
                        backgroundColor: '#4285F4',
                        color: 'white',
                        fontWeight: 'bold',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: mediaLoading ? 'not-allowed' : 'pointer',
                        opacity: mediaLoading ? 0.7 : 1
                      }}
                    >
                      {mediaLoading ? 'GENERATING AI IMAGES...' : (mediaResults.length ? 'REGENERATE AI IMAGES 🖼️' : 'GENERATE AI IMAGES 🖼️')}
                    </button>
                  )}
                </div>
              )}
              {ttsLoading && <div style={{ textAlign: 'center', color: '#4caf50' }}>Generating Audio...</div>}
              {mediaLoading && workspaces.find(w => w.id === activeWorkspaceId)?.mediaSource === 'google_genai' && <div style={{ textAlign: 'center', color: '#4285F4' }}>Generating AI Images (this may take a minute)...</div>}

              <OutputDisplay
                data={generatedData}
                onUpdate={setGeneratedData}
                audioUrl={audioUrl}
              />

              {workspaces.find(w => w.id === activeWorkspaceId)?.mediaSource === 'local' ? (
                <LocalMediaManager
                  keywords={generatedData.keywords}
                  onUpdateKeywords={handleUpdateKeywords}
                  mediaResults={mediaResults}
                  onUpdateMediaResults={setMediaResults}
                />
              ) : (
                <>
                  <KeyPointsPanel
                    keywords={generatedData.keywords}
                    onUpdateKeywords={handleUpdateKeywords}
                    onRefreshMedia={handleRefreshMedia}
                  />

                  {mediaLoading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                      Finding visuals...
                    </div>
                  ) : (
                    <MediaGallery results={mediaResults} onToggleExclude={handleToggleExcludeMedia} />
                  )}
                </>
              )}

              {/* VIDEO GENERATION SECTION */}
              {audioUrl && (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                  <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>AUTOMATED VIDEO BUILDER</h2>

                  {!videoLoading && (
                    <button onClick={handleGenerateVideo} style={{ width: '100%', fontSize: '1.2rem', padding: '1rem', marginBottom: '1.5rem' }}>
                      {videoUrl ? 'REGENERATE VIDEO 🎬' : 'GENERATE VIDEO 🎬'}
                    </button>
                  )}

                  {videoLoading && (
                    <div style={{ padding: '2rem' }}>
                      <div style={{ marginBottom: '1rem' }}>
                        <span className="spinner"></span> Building your video... {videoProgress > 0 ? `${videoProgress}% completed` : '(Setting up...)'}
                      </div>
                      {videoProgress > 0 && (
                        <div style={{ width: '100%', backgroundColor: '#333', height: '10px', borderRadius: '5px', marginTop: '10px', overflow: 'hidden' }}>
                          <div style={{ width: `${videoProgress}%`, backgroundColor: 'var(--accent)', height: '100%', transition: 'width 0.5s' }}></div>
                        </div>
                      )}
                    </div>
                  )}

                  {videoUrl && (
                    <div className="video-result">
                      <h3>FINAL VIDEO</h3>
                      <video controls src={videoUrl} style={{ width: '100%', maxHeight: '500px', borderRadius: '8px' }} />

                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                        <a href={videoUrl} download className="download-btn" style={{ flex: '1 1 100%', textAlign: 'center', textDecoration: 'none', padding: '10px' }}>
                          Download MP4
                        </a>

                        {/* YouTube Button */}
                        <button
                          onClick={handleUploadYouTube}
                          style={{ flex: 1, backgroundColor: '#ff0000', color: 'white' }}
                          disabled={uploadLoading || uploadStatus === 'success'}
                        >
                          {uploadLoading ? 'Uploading...' : uploadStatus === 'success' ? 'YT Uploaded ✅' : 'Upload to YouTube 🚀'}
                        </button>

                        {/* Meta Button */}
                        <button
                          onClick={handleUploadMeta}
                          style={{ flex: 1, backgroundColor: '#4267B2', color: 'white' }}
                          disabled={metaLoading || metaStatus === 'success'}
                        >
                          {metaLoading ? 'Uploading...' : metaStatus === 'success' ? 'Meta Uploaded ✅' : 'Upload to Meta ♾️'}
                        </button>

                        {/* TikTok Button */}
                        <button
                          onClick={handleUploadTiktok}
                          style={{ flex: 1, backgroundColor: '#000000', color: 'white', border: '1px solid #ffffff' }}
                          disabled={tiktokLoading || tiktokStatus === 'success'}
                        >
                          {tiktokLoading ? 'Uploading...' : tiktokStatus === 'success' ? 'TikTok Uploaded ✅' : 'Upload to TikTok 🎶'}
                        </button>
                      </div>

                      {uploadStatus === 'auth_required' && (
                        <div style={{ marginTop: '10px', color: '#ffcc00' }}>
                          YouTube: Please log in via the popup window, then click Upload again.
                        </div>
                      )}
                      {metaStatus === 'auth_required' && (
                        <div style={{ marginTop: '10px', color: '#ffcc00' }}>
                          Meta: Please log in via the popup window. Upload will start automatically.
                        </div>
                      )}
                      {tiktokStatus === 'auth_required' && (
                        <div style={{ marginTop: '10px', color: '#ffcc00' }}>
                          TikTok: Please log in via the popup window. Upload will start automatically.
                        </div>
                      )}

                      {/* Status Messages */}
                      {uploadStatus === 'success' && <div style={{ marginTop: '5px', color: '#4caf50' }}>YouTube Upload Complete!</div>}
                      {metaStatus === 'success' && <div style={{ marginTop: '5px', color: '#4caf50' }}>Meta Upload Complete!</div>}
                      {tiktokStatus === 'success' && <div style={{ marginTop: '5px', color: '#4caf50' }}>TikTok Upload Complete!</div>}
                    </div>
                  )}
                </div>
              )}

            </div>
          </>
        ) : activeTab === 'controls' ? (
          <>
            <h1 className="page-title">Workspace Settings</h1>
            <Controls
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              onUpdateWorkspace={handleUpdateWorkspace}
              onCreateWorkspace={handleCreateWorkspace}
              onDeleteWorkspace={handleDeleteWorkspace}
              onSelectWorkspace={selectWorkspace}
            />
          </>
        ) : activeTab === 'apikeys' ? (
          <>
            <h1 className="page-title">Manage API Keys</h1>
            <ApiKeys />
          </>
        ) : null}
      </div>
    </div>
  );
}

export default App;
