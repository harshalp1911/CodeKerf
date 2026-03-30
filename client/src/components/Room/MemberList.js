import React, { useState } from 'react';

const MemberList = ({ roomId, members: initialMembers, role, token }) => {
  const [members, setMembers] = useState(initialMembers || []);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOwnerOrEditor = role === 'owner' || role === 'editor';
  const isOwner = role === 'owner';

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`http://localhost:5001/api/rooms/${roomId}/members/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      const data = await res.json();

      if (res.ok) {
        setMembers([...members, data]);
        setSuccess('User invited successfully');
        setInviteEmail('');
      } else {
        setError(data.error || 'Failed to invite user');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      const res = await fetch(`http://localhost:5001/api/rooms/${roomId}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (res.ok) {
        setMembers(members.map(m => m.userId._id === memberId ? { ...m, role: newRole } : m));
      }
    } catch (err) {
      console.error('Failed to update role');
    }
  };

  const handleRemove = async (memberId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/rooms/${roomId}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        setMembers(members.filter(m => m.userId._id !== memberId));
      }
    } catch (err) {
      console.error('Failed to remove member');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px', background: 'var(--header)', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>
        Members ({members.length})
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {members.map(member => (
          <div key={member.userId._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: '500', fontSize: '14px' }}>{member.userId.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>{member.userId.email}</div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {isOwner && member.role !== 'owner' ? (
                <select 
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.userId._id, e.target.value)}
                  style={{ padding: '2px', fontSize: '12px' }}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span style={{ fontSize: '12px', padding: '2px 6px', background: '#eee', borderRadius: '3px' }}>
                  {member.role}
                </span>
              )}
              
              {isOwner && member.role !== 'owner' && (
                <button 
                  onClick={() => handleRemove(member.userId._id)}
                  style={{ color: 'red', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '16px' }}
                  title="Remove member"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isOwnerOrEditor && (
        <div style={{ padding: '10px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Invite Member</div>
          <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              type="email" 
              placeholder="Email address" 
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{ padding: '6px', border: '1px solid var(--border)' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                style={{ flex: 1, padding: '6px', border: '1px solid var(--border)' }}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" style={{ padding: '6px 12px', background: 'var(--btn)', color: 'white', border: 'none', cursor: 'pointer' }}>
                Invite
              </button>
            </div>
            {error && <div style={{ color: 'red', fontSize: '12px' }}>{error}</div>}
            {success && <div style={{ color: 'green', fontSize: '12px' }}>{success}</div>}
          </form>
        </div>
      )}
    </div>
  );
};

export default MemberList;
