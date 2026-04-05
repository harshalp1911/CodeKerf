import React, { useState } from 'react';

const ROLE_COLORS = {
  owner: '#6366f1',
  editor: '#22c55e',
  viewer: '#f59e0b'
};

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
      const res = await fetch(`/api/rooms/${roomId}/members/invite`, {
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
        setSuccess('Invited!');
        setInviteEmail('');
        setTimeout(() => setSuccess(''), 2000);
      } else {
        setError(data.error || 'Failed to invite user');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/members/${memberId}`, {
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
      const res = await fetch(`/api/rooms/${roomId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
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
      {/* Member List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {members.map(member => (
          <div key={member.userId._id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '6px', padding: '8px 10px',
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px'
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {member.userId.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {member.userId.email}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
              {isOwner && member.role !== 'owner' ? (
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.userId._id, e.target.value)}
                  style={{
                    padding: '2px 4px', fontSize: '11px',
                    background: 'var(--pane)', color: 'var(--text)',
                    border: '1px solid var(--border)', borderRadius: '3px'
                  }}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span style={{
                  fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                  background: ROLE_COLORS[member.role] || '#666',
                  color: '#fff', borderRadius: '3px', textTransform: 'uppercase'
                }}>
                  {member.role}
                </span>
              )}

              {isOwner && member.role !== 'owner' && (
                <button
                  onClick={() => handleRemove(member.userId._id)}
                  style={{
                    color: '#ef4444', border: 'none', background: 'transparent',
                    cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1
                  }}
                  title="Remove member"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Invite Form */}
      {isOwnerOrEditor && (
        <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
          <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              type="email"
              placeholder="Email to invite..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{
                padding: '6px 8px', fontSize: '12px',
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', outline: 'none', borderRadius: '3px'
              }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                style={{
                  flex: 1, padding: '5px', fontSize: '12px',
                  border: '1px solid var(--border)', background: 'var(--pane)',
                  color: 'var(--text)', borderRadius: '3px'
                }}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" style={{
                padding: '5px 12px', background: 'var(--btn)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 500, borderRadius: '3px'
              }}>
                Invite
              </button>
            </div>
            {error && <div style={{ color: '#ef4444', fontSize: '11px' }}>{error}</div>}
            {success && <div style={{ color: '#22c55e', fontSize: '11px' }}>{success}</div>}
          </form>
        </div>
      )}
    </div>
  );
};

export default MemberList;
