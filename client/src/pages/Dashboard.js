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
      const res = await fetch('http://localhost:5001/api/rooms', {
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
      const res = await fetch('http://localhost:5001/api/rooms', {
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
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h2>Welcome, {user?.name}</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setShowCreate(!showCreate)}
            style={{ padding: '8px 16px', background: 'var(--btn)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            {showCreate ? 'Cancel' : 'Create New Room'}
          </button>
          <button 
            onClick={logout}
            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </header>

      {showCreate && (
        <form onSubmit={createRoom} style={{ marginBottom: '30px', padding: '20px', background: 'var(--pane)', border: '1px solid var(--border)' }}>
          <h3>Create a Room</h3>
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <input 
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Enter room name"
              style={{ flex: 1, padding: '8px', border: '1px solid var(--border)' }}
            />
            <button type="submit" style={{ padding: '8px 16px', background: 'var(--btn)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Create & Join
            </button>
          </div>
        </form>
      )}

      <div>
        <h3>Your Rooms</h3>
        {loading ? (
          <p>Loading rooms...</p>
        ) : rooms.length === 0 ? (
          <p style={{ color: 'var(--secondary-text)' }}>You haven't joined any rooms yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '15px', marginTop: '15px' }}>
            {rooms.map(room => (
              <div 
                key={room._id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '15px',
                  background: 'var(--pane)',
                  border: '1px solid var(--border)'
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 5px 0' }}>{room.name}</h4>
                  <small style={{ color: 'var(--secondary-text)' }}>Role: {room.userRole}</small>
                </div>
                <button 
                  onClick={() => joinRoom(room._id)}
                  style={{ padding: '6px 16px', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
