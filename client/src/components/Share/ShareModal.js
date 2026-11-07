import React, { useState } from 'react';

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 2000
};

const panelStyle = {
  background: 'var(--pane)', border: '1px solid var(--border)', color: 'var(--text)',
  padding: '24px', width: '440px', maxWidth: '90vw'
};

const mutedStyle = { fontSize: '13px', opacity: 0.7, margin: '0 0 14px 0', lineHeight: 1.5 };

// Creates a one-time share link, or shows the current one and who has opened it
const ShareModal = ({ isAuthenticated, share, joinedBy, onCreate, onStop, onLogin, onClose }) => {
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = share ? `${window.location.origin}/share/${share.token}` : '';

  const run = async (action) => {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      window.prompt('Copy this link:', link);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Share your code</h3>
          <button className="share-button" onClick={onClose}>Close</button>
        </div>

        {share ? (
          <>
            <p style={mutedStyle}>
              This link works for <strong>one person</strong>: whoever opens it first.
              {share.role === 'editor' ? ' They can edit and run the code with you.' : ' They can watch your code live but not change it.'}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <button className="run-button" onClick={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>
            <p style={{ ...mutedStyle, margin: '0 0 6px 0' }}>
              Access: <strong>{share.role === 'editor' ? 'Editor' : 'Viewer'}</strong>
              {' · '}{joinedBy ? `${joinedBy} has opened it` : 'Waiting for someone to open it'}
            </p>
            <p style={mutedStyle}>Expires {new Date(share.expiresAt).toLocaleString()}.</p>
            {isAuthenticated ? (
              <button className="share-button" disabled={busy} onClick={() => run(onStop)} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                Stop sharing
              </button>
            ) : (
              <p style={{ ...mutedStyle, margin: 0 }}>Guests can share one link. Log in to stop sharing or share with editor access.</p>
            )}
          </>
        ) : (
          <>
            {isAuthenticated ? (
              <>
                <p style={mutedStyle}>Create a link for one person. Whoever opens it first gets access, and the link stops working for anyone else.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', fontSize: '14px' }}>
                  <label>
                    <input type="radio" name="share-role" checked={role === 'viewer'} onChange={() => setRole('viewer')} />
                    {' '}Viewer: can watch your code live
                  </label>
                  <label>
                    <input type="radio" name="share-role" checked={role === 'editor'} onChange={() => setRole('editor')} />
                    {' '}Editor: can edit and run it with you (they need to log in)
                  </label>
                </div>
              </>
            ) : (
              <p style={mutedStyle}>
                Create a read-only link for one person: whoever opens it first can watch your code live.
                Guests can share one link. <button onClick={onLogin} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--btn)', cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}>Log in</button> to share with editor access.
              </p>
            )}
            <button className="run-button" disabled={busy} onClick={() => run(() => onCreate(isAuthenticated ? role : 'viewer'))}>
              {busy ? 'Creating...' : 'Create link'}
            </button>
          </>
        )}

        {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: '12px 0 0 0' }}>{error}</p>}
      </div>
    </div>
  );
};

export default ShareModal;
