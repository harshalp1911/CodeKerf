import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';

import Editor from '../components/Room/Editor';
import Whiteboard from '../components/Whiteboard/Whiteboard';
import Chat from '../components/Chat/ChatPanel';
import Members from '../components/Room/MemberList';

const Room = () => {
  const { id: roomId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState('viewer');
  const [activeTab, setActiveTab] = useState('code'); // 'code' or 'whiteboard'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const socketRef = useRef(null);

  // 1. Fetch Room Data
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch(`http://localhost:5001/api/rooms/${roomId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setRoom(data);
          setRole(data.currentUserRole);
        } else {
          setError('Failed to load room. You might not have access.');
        }
      } catch (err) {
        setError('Error connecting to server.');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchRoom();
  }, [roomId, token]);

  // 2. Setup Socket.io
  useEffect(() => {
    if (loading || error || !room) return;

    const socket = io('http://localhost:5001', {
      path: '/socket.io',
      auth: { token }
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinRoom', { roomId });
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, token, loading, error, room]);

  if (loading) return <div style={{ padding: '20px' }}>Loading room...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;
  if (!room) return <div style={{ padding: '20px' }}>Room not found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '0 20px',
        height: '60px',
        background: 'var(--header)',
        borderBottom: '2px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>{room.name}</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setActiveTab('code')}
              style={{ 
                padding: '6px 12px', 
                background: activeTab === 'code' ? 'var(--btn)' : 'transparent',
                color: activeTab === 'code' ? '#fff' : 'var(--text)',
                border: '1px solid var(--border)',
                cursor: 'pointer'
              }}
            >
              Code Editor
            </button>
            <button 
              onClick={() => setActiveTab('whiteboard')}
              style={{ 
                padding: '6px 12px', 
                background: activeTab === 'whiteboard' ? 'var(--btn)' : 'transparent',
                color: activeTab === 'whiteboard' ? '#fff' : 'var(--text)',
                border: '1px solid var(--border)',
                cursor: 'pointer'
              }}
            >
              Whiteboard
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: 'var(--secondary-text)' }}>
            Role: <strong>{role}</strong>
          </span>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            Leave
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left/Middle - Editor or Whiteboard */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {activeTab === 'code' ? (
            <Editor socket={socketRef.current} roomId={roomId} role={role} initialCode={room.code} initialLang={room.language} />
          ) : (
            <Whiteboard socket={socketRef.current} roomId={roomId} role={role} />
          )}
        </div>

        {/* Right Sidebar - Chat & Members */}
        <div style={{ 
          width: '300px', 
          display: 'flex', 
          flexDirection: 'column',
          borderLeft: '1px solid var(--border)',
          background: 'var(--pane)'
        }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Chat socket={socketRef.current} roomId={roomId} user={user} />
          </div>
          <div style={{ height: '40%', borderTop: '1px solid var(--border)', overflow: 'hidden' }}>
            <Members roomId={roomId} members={room.members} role={role} token={token} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;
