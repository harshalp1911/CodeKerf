import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getGuestKey, shareHeaders } from '../utils/guestKey';

// Live sharing of the landing page's code through a one-time link.
// The callbacks apply changes made by the person who opened an editor link.
const useCodeShare = ({ token, authLoading, onRemoteCode, onRemoteLanguage, onRemoteRun }) => {
  const [share, setShare] = useState(null);
  const [joinedBy, setJoinedBy] = useState(null);
  const [socket, setSocket] = useState(null);

  // Kept in a ref so new callback functions on every render don't reconnect the socket
  const handlers = useRef({});
  handlers.current = { onRemoteCode, onRemoteLanguage, onRemoteRun };

  // Pick up an existing share after a refresh, or when logging in or out changes who we are
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    fetch('/api/shares/mine', { headers: shareHeaders(token) })
      .then((res) => (res.ok ? res.json() : { share: null }))
      .then((data) => { if (!cancelled) setShare(data.share); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token, authLoading]);

  // While sharing, stay connected so edits reach the other person as they type
  const shareToken = share?.token;
  useEffect(() => {
    if (!shareToken) return;
    const s = io(window.location.origin, {
      path: '/socket.io',
      auth: { token, guestKey: getGuestKey() }
    });
    s.on('connect', () => s.emit('joinShare', { token: shareToken }));
    // The server's copy is the latest, e.g. after a refresh or reconnect
    s.on('shareState', (state) => {
      handlers.current.onRemoteCode(state.code);
      handlers.current.onRemoteLanguage(state.language);
      if (state.claimed) setJoinedBy((name) => name || 'Someone');
    });
    s.on('shareJoined', ({ name }) => setJoinedBy(name));
    s.on('codeUpdate', (code) => handlers.current.onRemoteCode(code));
    s.on('languageUpdate', (language) => handlers.current.onRemoteLanguage(language));
    s.on('runResult', (result) => handlers.current.onRemoteRun(result));
    s.on('shareEnded', () => setShare(null));
    s.on('shareError', () => setShare(null));
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setJoinedBy(null);
    };
  }, [shareToken, token]);

  const createShare = async (role, code, language) => {
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: shareHeaders(token),
      body: JSON.stringify({ role, code, language })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create share link');
    setShare(data.share);
    return data.share;
  };

  const stopSharing = async () => {
    const res = await fetch('/api/shares/mine', { method: 'DELETE', headers: shareHeaders(token) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to stop sharing');
    setShare(null);
  };

  // Send our own changes to the person who opened the link
  const sendCode = useCallback((code) => {
    socket?.emit('codeChange', { roomId: shareToken, code });
  }, [socket, shareToken]);

  const sendLanguage = useCallback((language) => {
    socket?.emit('languageChange', { roomId: shareToken, language });
  }, [socket, shareToken]);

  const sendRunResult = useCallback(({ stdout, stderr }) => {
    socket?.emit('runResult', { roomId: shareToken, stdout, stderr });
  }, [socket, shareToken]);

  return { share, joinedBy, createShare, stopSharing, sendCode, sendLanguage, sendRunResult };
};

export default useCodeShare;
