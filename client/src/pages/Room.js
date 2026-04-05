import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';

import Editor from '../components/Room/Editor';
import Whiteboard from '../components/Whiteboard/Whiteboard';
import Chat from '../components/Chat/ChatPanel';
import Members from '../components/Room/MemberList';
import { ChatIcon, ChevronDownIcon, MinusIcon } from '../components/Whiteboard/WhiteboardIcons';

const SIDEBAR_WIDTH = 260;
const CHAT_WIDTH = 340;
const CHAT_HEIGHT = 380;

const Room = () => {
  const { id: roomId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Whiteboard overlay
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [wbWidth, setWbWidth] = useState(50);
  const isDraggingWb = useRef(false);
  const editorAreaRef = useRef(null);

  // Chat floating popup
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Members sidebar toggle
  const [membersOpen, setMembersOpen] = useState(true);

  const socketRef = useRef(null);

  // 1. Fetch Room
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setRoom(data);
          setRole(data.currentUserRole);
        } else {
          setError('Failed to load room.');
        }
      } catch (err) {
        setError('Error connecting to server.');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchRoom();
  }, [roomId, token]);

  // 2. Socket.io
  useEffect(() => {
    if (loading || error || !room) return;
    const socket = io(window.location.origin, {
      path: '/socket.io',
      auth: { token }
    });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('joinRoom', { roomId }));
    return () => socket.disconnect();
  }, [roomId, token, loading, error, room]);

  // Unread count
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handleMsg = () => {
      if (!chatOpen) setUnreadCount(prev => prev + 1);
    };
    socket.on('newMessage', handleMsg);
    return () => socket.off('newMessage', handleMsg);
  }, [chatOpen]);

  // Handle room deletion when owner leaves
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    
    const handleRoomDeleted = ({ message }) => {
      alert(message);
      navigate('/dashboard');
    };
    
    socket.on('roomDeleted', handleRoomDeleted);
    return () => socket.off('roomDeleted', handleRoomDeleted);
  }, [navigate]);

  // Whiteboard drag
  const onWbDragStart = useCallback((e) => {
    e.preventDefault();
    isDraggingWb.current = true;
    const onMove = (ev) => {
      if (!isDraggingWb.current || !editorAreaRef.current) return;
      const rect = editorAreaRef.current.getBoundingClientRect();
      const mouseX = (ev.clientX || ev.touches?.[0]?.clientX) - rect.left;
      const pct = Math.max(15, Math.min(85, ((rect.width - mouseX) / rect.width) * 100));
      setWbWidth(pct);
    };
    const onUp = () => {
      isDraggingWb.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
  }, []);

  const copyRoomLink = () => {
    const link = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => alert('Room link copied!'));
    } else {
      window.prompt('Copy this link:', link);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      Loading room...
    </div>
  );
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: '#ef4444' }}>
      {error}
    </div>
  );
  if (!room) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      Room not found.
    </div>
  );

  const roleBadgeColor = role === 'owner' ? '#6366f1' : role === 'editor' ? '#22c55e' : '#f59e0b';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* ── Header ── */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 16px', height: '48px', minHeight: '48px',
        background: 'var(--header)', borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '16px', fontWeight: 700, padding: '4px 6px' }}
            title="Back to home"
          >
            ← CodeKerf
          </button>
          <div style={{ width: '1px', height: '22px', background: 'var(--border)' }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{room.name}</span>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
            background: roleBadgeColor, color: '#fff', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px'
          }}>
            {role}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setShowWhiteboard(!showWhiteboard)}
            style={{
              padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              background: showWhiteboard ? 'var(--btn)' : 'transparent',
              color: showWhiteboard ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)', borderRadius: '3px'
            }}
          >
            {showWhiteboard ? '✕ Whiteboard' : '🖊 Whiteboard'}
          </button>
          <button
            onClick={copyRoomLink}
            style={{
              padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px'
            }}
            title="Copy room invite link"
          >
            🔗 Share
          </button>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '3px'
            }}
          >
            Leave
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* ── Editor + Whiteboard area ── */}
        <div ref={editorAreaRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Code Editor */}
          <div style={{
            width: showWhiteboard ? `${100 - wbWidth}%` : '100%',
            transition: isDraggingWb.current ? 'none' : 'width 0.15s ease',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <Editor socket={socketRef.current} roomId={roomId} role={role} initialCode={room.code} initialLang={room.language} />
          </div>

          {/* WB Drag Handle */}
          {showWhiteboard && (
            <div
              onMouseDown={onWbDragStart}
              onTouchStart={onWbDragStart}
              style={{
                width: '6px', cursor: 'col-resize', background: 'var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 10, flexShrink: 0
              }}
            >
              <div style={{ width: '2px', height: '40px', background: 'var(--text)', opacity: 0.25, borderRadius: '2px' }} />
            </div>
          )}

          {/* Whiteboard */}
          {showWhiteboard && (
            <div style={{
              width: `${wbWidth}%`,
              transition: isDraggingWb.current ? 'none' : 'width 0.15s ease',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              <Whiteboard socket={socketRef.current} roomId={roomId} role={role} />
            </div>
          )}
        </div>

        {/* ── Right Sidebar (Members - collapsible) ── */}
        <div style={{
          width: membersOpen ? `${SIDEBAR_WIDTH}px` : '36px',
          minWidth: membersOpen ? `${SIDEBAR_WIDTH}px` : '36px',
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid var(--border)', background: 'var(--pane)', overflow: 'hidden',
          transition: 'width 0.2s ease, min-width 0.2s ease'
        }}>
          {/* Toggle bar */}
          <button
            onClick={() => setMembersOpen(!membersOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: membersOpen ? 'space-between' : 'center',
              padding: membersOpen ? '8px 12px' : '8px 0',
              background: 'var(--header)', border: 'none', borderBottom: '1px solid var(--border)',
              color: 'var(--text)', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              width: '100%', minHeight: '36px'
            }}
            title={membersOpen ? 'Minimize members' : 'Expand members'}
          >
            {membersOpen && <span>👥 Members ({room.members?.length})</span>}
            <span style={{ fontSize: '14px' }}>{membersOpen ? '→' : '←'}</span>
          </button>
          {membersOpen && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Members roomId={roomId} members={room.members} role={role} token={token} />
            </div>
          )}
        </div>

        {/* ── Floating Chat Popup (bottom-right, over editor/whiteboard) ── */}
        {/* Chat always mounted, hidden when closed */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: `${(membersOpen ? SIDEBAR_WIDTH : 36) + 16}px`,
          width: `${CHAT_WIDTH}px`,
          height: `${CHAT_HEIGHT}px`,
          background: 'var(--pane)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          display: chatOpen ? 'flex' : 'none',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 100,
          transition: 'right 0.2s ease'
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--header)', borderBottom: '1px solid var(--border)',
            flexShrink: 0
          }}>
            <span style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ChatIcon size={15} /> Chat
            </span>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text)', padding: '2px', display: 'flex', alignItems: 'center'
              }}
              title="Minimize chat"
            >
              <MinusIcon size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Chat socket={socketRef.current} roomId={roomId} user={user} />
          </div>
        </div>

        {/* Collapsed: chat bubble button */}
        {!chatOpen && (
          <button
            onClick={() => { setChatOpen(true); setUnreadCount(0); }}
            style={{
              position: 'absolute',
              bottom: '16px',
              right: `${(membersOpen ? SIDEBAR_WIDTH : 36) + 16}px`,
              width: '48px', height: '48px',
              borderRadius: '50%',
              background: 'var(--btn)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 100,
              transition: 'right 0.2s ease'
            }}
            title="Open chat"
          >
            <ChatIcon size={22} color="#fff" />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 700,
                padding: '1px 5px', borderRadius: '10px', minWidth: '18px', textAlign: 'center',
                lineHeight: '16px'
              }}>
                {unreadCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default Room;
