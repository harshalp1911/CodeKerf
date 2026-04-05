import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { useAuth } from '../contexts/AuthContext';
import { PlayIcon, ShareIcon, SaveIcon, SunIcon, MoonIcon } from '../Icons';
import LoginModal from '../components/Auth/LoginModal';

const LandingPage = ({ darkMode, setDarkMode }) => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [language, setLanguage] = useState('cpp');
  const [code, setCode] = useState('');
  const [stdin, setStdin] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinLink, setJoinLink] = useState('');

  const isAuthenticated = !!user;

  const getLanguageExtension = () => {
    switch (language) {
      case 'cpp': return cpp();
      case 'python': return python();
      case 'java': return java();
      default: return [];
    }
  };

  const handleCodeChange = useCallback((val) => {
    setCode(val);
  }, []);

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
  };

  const onRun = async () => {
    setIsRunning(true);
    setOutput('Running...');
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, stdin })
      });
      if (!res.ok) throw new Error(await res.text());
      const { stdout, stderr } = await res.json();
      setOutput(stderr || stdout);
    } catch (err) {
      setOutput(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const onSave = () => {
    const ext = language === 'cpp' ? 'cpp' : language === 'python' ? 'py' : 'java';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onShare = useCallback(() => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    const url = window.location.href;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => alert('Link copied!'));
    } else {
      window.prompt('Copy this link:', url);
    }
  }, [isAuthenticated]);

  const onCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newRoomName })
      });
      if (res.ok) {
        const room = await res.json();
        navigate(`/room/${room._id}`);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const onJoinRoom = () => {
    if (!joinLink.trim()) return;
    // Extract room ID from link or use as-is
    const roomId = joinLink.includes('/room/') 
      ? joinLink.split('/room/')[1] 
      : joinLink.trim();
    navigate(`/room/${roomId}`);
  };

  const handleProtectedAction = (action) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    action();
  };

  return (
    <div className="App" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="header">
        <h1 className="app-title">CodeKerf</h1>
        <div className="nav-buttons">
          {/* Auth-aware buttons */}
          <button
            className="share-button"
            onClick={() => handleProtectedAction(() => setShowCreateRoom(true))}
            style={{
              opacity: isAuthenticated ? 1 : 0.4,
              cursor: isAuthenticated ? 'pointer' : 'not-allowed'
            }}
            title={isAuthenticated ? 'Create a room' : 'Login to create a room'}
          >
            + Create Room
          </button>

          <button
            className="share-button"
            onClick={() => handleProtectedAction(() => navigate('/dashboard'))}
            style={{
              opacity: isAuthenticated ? 1 : 0.4,
              cursor: isAuthenticated ? 'pointer' : 'not-allowed'
            }}
            title={isAuthenticated ? 'View your rooms' : 'Login to join a room'}
          >
            Join Room
          </button>

          <button className="share-button" onClick={onShare}
            style={{
              opacity: isAuthenticated ? 1 : 0.4,
              cursor: isAuthenticated ? 'pointer' : 'not-allowed'
            }}
            title={isAuthenticated ? 'Share code' : 'Login to share'}
          >
            <ShareIcon size={14} /> Share
          </button>

          <button className="save-button" onClick={onSave}>
            <SaveIcon size={14} /> Save
          </button>

          <button
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            title="Toggle light/dark"
          >
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>

          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                {user.name}
              </span>
              <button className="share-button" onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <button
              className="run-button"
              onClick={() => setShowLoginModal(true)}
              style={{ background: 'var(--btn)' }}
            >
              Login
            </button>
          )}
        </div>
      </header>

      {/* Editor Container */}
      <div className="editor-container">
        <div className="left-pane">
          <div className="left-pane-header">
            <div className="lang-section">
              <label htmlFor="lang-select" className="lang-label">Language:</label>
              <select
                id="lang-select"
                value={language}
                onChange={handleLanguageChange}
                className="lang-select"
              >
                <option value="cpp">C++</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
              </select>
            </div>
            <div className="action-buttons">
              <button className="run-button" onClick={onRun} disabled={isRunning}>
                <PlayIcon size={14} /> {isRunning ? 'RUNNING...' : 'RUN'}
              </button>
            </div>
          </div>

          <div className="code-editor-container">
            <CodeMirror
              value={code}
              height="100%"
              extensions={[getLanguageExtension()]}
              onChange={handleCodeChange}
              theme={darkMode ? dracula : 'light'}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
                defaultKeymap: true,
                history: true,
                highlightSelectionMatches: true,
                foldGutter: true
              }}
            />
          </div>

          <textarea
            className="input-pane"
            placeholder="Paste input values here..."
            value={stdin}
            onChange={e => setStdin(e.target.value)}
          />
        </div>

        <div className="right-pane">
          <textarea
            className="output-pane"
            placeholder="Program output will appear here..."
            value={output}
            readOnly
          />
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}

      {/* Create Room Modal */}
      {showCreateRoom && isAuthenticated && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000
        }} onClick={() => setShowCreateRoom(false)}>
          <div style={{
            background: 'var(--pane)', border: '1px solid var(--border)',
            padding: '30px', width: '400px', maxWidth: '90vw'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '20px' }}>Create a Room</h3>
            <form onSubmit={onCreateRoom}>
              <input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Enter room name"
                style={{
                  width: '100%', padding: '10px', border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)', marginBottom: '15px'
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="share-button" onClick={() => setShowCreateRoom(false)}>
                  Cancel
                </button>
                <button type="submit" className="run-button">
                  Create & Join
                </button>
              </div>
            </form>

            <div style={{ marginTop: '25px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <h4 style={{ marginBottom: '10px' }}>Join with Link</h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  value={joinLink}
                  onChange={(e) => setJoinLink(e.target.value)}
                  placeholder="Paste room link or ID"
                  style={{
                    flex: 1, padding: '10px', border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text)'
                  }}
                />
                <button type="button" className="run-button" onClick={onJoinRoom}>
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
