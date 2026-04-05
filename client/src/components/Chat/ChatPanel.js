import React, { useState, useEffect, useRef } from 'react';

const ChatPanel = ({ socket, roomId, user }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    };

    const handleUserTyping = ({ userId, userName }) => {
      if (userId === user?._id) return; // Don't show own typing
      setTypingUsers((prev) => {
        if (!prev.find(u => u.userId === userId)) {
          return [...prev, { userId, userName }];
        }
        return prev;
      });
    };

    const handleUserStoppedTyping = ({ userId }) => {
      setTypingUsers((prev) => prev.filter(u => u.userId !== userId));
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStoppedTyping', handleUserStoppedTyping);
    };
  }, [socket, user]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    
    if (!socket) return;
    
    // Emit typing event
    socket.emit('typing', { roomId, userId: user?._id, userName: user?.name });
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stoppedTyping', { roomId, userId: user?._id });
    }, 2000);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !socket) return;

    socket.emit('sendMessage', { roomId, message: inputValue.trim() });
    socket.emit('stoppedTyping', { roomId, userId: user?._id });
    setInputValue('');
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '8px',
        display: 'flex', flexDirection: 'column', gap: '6px'
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text)', opacity: 0.4, marginTop: '20px' }}>
            No messages yet
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMine = msg.userId?._id === user?._id;
          return (
            <div key={idx} style={{
              alignSelf: isMine ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: isMine ? 'var(--btn)' : 'var(--header)',
              color: isMine ? '#fff' : 'var(--text)',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '13px'
            }}>
              {!isMine && (
                <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.7, marginBottom: '2px' }}>
                  {msg.userId?.name || 'Unknown'}
                </div>
              )}
              <div style={{ wordBreak: 'break-word' }}>{msg.message}</div>
            </div>
          );
        })}
        
        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '6px 10px',
            fontSize: '12px',
            color: 'var(--text)',
            opacity: 0.6,
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>{typingUsers.map(u => u.userName.split(' ')[0]).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing</span>
            <span style={{ display: 'flex', gap: '2px' }}>
              <span style={{ animation: 'blink 1.4s infinite', animationDelay: '0s' }}>•</span>
              <span style={{ animation: 'blink 1.4s infinite', animationDelay: '0.2s' }}>•</span>
              <span style={{ animation: 'blink 1.4s infinite', animationDelay: '0.4s' }}>•</span>
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} style={{ display: 'flex', padding: '6px', borderTop: '1px solid var(--border)' }}>
        <input
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Type a message..."
          style={{
            flex: 1, padding: '6px 10px', fontSize: '13px',
            border: '1px solid var(--border)', borderRight: 'none',
            background: 'var(--bg)', color: 'var(--text)', outline: 'none'
          }}
        />
        <button type="submit" style={{
          padding: '6px 12px', background: 'var(--btn)', color: '#fff',
          border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500
        }}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
