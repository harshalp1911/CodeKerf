import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import Editor from '../components/Room/Editor';
import LoginModal from '../components/Auth/LoginModal';
import { REDIRECT_KEY } from '../components/Auth/ProtectedRoute';
import { getGuestKey } from '../utils/guestKey';

const ROLE_COLORS = { owner: '#6366f1', editor: '#22c55e', viewer: '#f59e0b' };

const centered = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px',
  height: '100vh', background: 'var(--bg)', color: 'var(--text)', textAlign: 'center', padding: '0 16px'
};

// Opens a one-time share link. Works for guests on viewer links; editor links need an account.
const SharePage = () => {
  const { token: shareToken } = useParams();
  const { token, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [socket, setSocket] = useState(null);
  const [joinState, setJoinState] = useState(null);
  const [error, setError] = useState(null); // { code, message }
  const [showLogin, setShowLogin] = useState(false);

  // Reconnects when the user logs in, so a "log in to open this link" error can retry
  useEffect(() => {
    if (loading) return;
    const s = io(window.location.origin, {
      path: '/socket.io',
      auth: { token, guestKey: getGuestKey() }
    });
    s.on('connect', () => s.emit('joinShare', { token: shareToken }));
    s.on('shareState', (state) => {
      setError(null);
      setJoinState(state);
    });
    s.on('shareError', (err) => setError(err));
    s.on('shareEnded', ({ message }) => setError({ code: 'ENDED', message }));
    s.on('connect_error', (err) => {
      if (err.message === 'Authentication error') {
        setError({ code: 'LOGIN_REQUIRED', message: 'Your session has expired. Please log in again.' });
      }
    });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [shareToken, token, loading]);

  const openLogin = () => {
    // Google login leaves the page, so remember to come back here afterwards
    try {
      sessionStorage.setItem(REDIRECT_KEY, location.pathname);
    } catch (_) { /* storage blocked: email login still works in place */ }
    setShowLogin(true);
  };

  if (error) {
    return (
      <div style={centered}>
        <h2 style={{ margin: 0 }}>{error.code === 'LOGIN_REQUIRED' ? 'Log in to continue' : 'Link unavailable'}</h2>
        <p style={{ margin: 0, opacity: 0.7 }}>{error.message}</p>
        {error.code === 'LOGIN_REQUIRED' ? (
          <button className="run-button" onClick={openLogin}>Log in</button>
        ) : (
          <button className="share-button" onClick={() => navigate('/')}>Go to CodeKerf</button>
        )}
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      </div>
    );
  }

  if (!joinState) {
    return <div style={centered}>Opening shared code...</div>;
  }

  const { role } = joinState;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '0 16px', height: '48px', minHeight: '48px',
        background: 'var(--header)', borderBottom: '1px solid var(--border)'
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '16px', fontWeight: 700, padding: '4px 6px' }}
        >
          ← CodeKerf
        </button>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>Shared code</span>
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '2px 7px', background: ROLE_COLORS[role],
          color: '#fff', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px'
        }}>
          {role}
        </span>
        {role === 'viewer' && <span style={{ fontSize: '12px', opacity: 0.6 }}>Read-only: you'll see changes as they happen</span>}
      </header>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Editor
          socket={socket}
          roomId={shareToken}
          role={role}
          initialCode={joinState.code}
          initialLang={joinState.language}
          joinState={joinState}
        />
      </div>
    </div>
  );
};

export default SharePage;
