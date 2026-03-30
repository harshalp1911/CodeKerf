import React, { useState, useEffect, useRef } from 'react';

const ChatPanel = ({ socket, roomId, user }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !socket) return;

    socket.emit('sendMessage', { roomId, message: inputValue.trim() });
    setInputValue('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px', background: 'var(--header)', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>
        Chat
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ 
            alignSelf: msg.userId?._id === user?._id ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            background: msg.userId?._id === user?._id ? 'var(--btn)' : 'var(--border)',
            color: msg.userId?._id === user?._id ? '#fff' : 'var(--text)',
            padding: '8px 12px',
            borderRadius: '4px'
          }}>
            <div style={{ fontSize: '10px', opacity: 0.8, marginBottom: '2px' }}>
              {msg.userId?.name || 'Unknown'}
            </div>
            <div>{msg.message}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', padding: '10px', borderTop: '1px solid var(--border)' }}>
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', borderRight: 'none' }}
        />
        <button type="submit" style={{ padding: '8px 16px', background: 'var(--btn)', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
