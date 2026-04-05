import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async (e) => {
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

  const joinRoom = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--header)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', height: '56px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>CodeKerf</h1>
          <span style={{ fontSize: '13px', color: 'var(--text)', opacity: 0.5 }}>|</span>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Welcome, {user?.name?.split(' ')[0]}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setShowCreate(!showCreate)}
            style={{
              padding: '7px 16px', background: showCreate ? 'transparent' : 'var(--btn)',
              color: showCreate ? 'var(--text)' : '#fff',
              border: showCreate ? '1px solid var(--border)' : 'none',
              cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderRadius: '4px'
            }}
          >
            {showCreate ? '✕ Cancel' : '+ Create Room'}
          </button>
          <button 
            onClick={logout}
            style={{
              padding: '7px 16px', background: 'transparent',
              border: '1px solid var(--border)', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, borderRadius: '4px', color: 'var(--text)'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>

        {showCreate && (
          <form onSubmit={createRoom} style={{
            marginBottom: '32px', padding: '24px',
            background: 'var(--pane)', border: '1px solid var(--border)',
            borderRadius: '8px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Create a New Room</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="e.g., Interview Prep, Hackathon Team, Study Group"
                autoFocus
                style={{
                  flex: 1, padding: '10px 14px',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: '14px', borderRadius: '4px', outline: 'none'
                }}
              />
              <button type="submit" style={{
                padding: '10px 24px', background: '#22c55e', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: '14px',
                fontWeight: 600, borderRadius: '4px', whiteSpace: 'nowrap'
              }}>
                Create & Join
              </button>
            </div>
          </form>
        )}

        <div>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>Your Rooms</h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text)', opacity: 0.5 }}>
              Loading rooms...
            </div>
          ) : rooms.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '80px 20px',
              background: 'var(--pane)', border: '1px solid var(--border)',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📂</div>
              <p style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 8px 0' }}>No rooms yet</p>
              <p style={{ fontSize: '14px', color: 'var(--text)', opacity: 0.6, margin: 0 }}>
                Create a room to start collaborating or ask someone to share a room link with you.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {rooms.map(room => {
                const roleColor = room.userRole === 'owner' ? '#6366f1' : room.userRole === 'editor' ? '#22c55e' : '#f59e0b';
                return (
                  <div 
                    key={room._id} 
                    onClick={() => joinRoom(room._id)}
                    style={{ 
                      padding: '20px',
                      background: 'var(--pane)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--btn)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '8px',
                        background: 'var(--bg)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '20px', flexShrink: 0
                      }}>
                        💻
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{
                          margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {room.name}
                        </h4>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                          background: roleColor, color: '#fff',
                          borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>
                          {room.userRole}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      fontSize: '12px', color: 'var(--text)', opacity: 0.6,
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      <span>→</span> Click to join
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
