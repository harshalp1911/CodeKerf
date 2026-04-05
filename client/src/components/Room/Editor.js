import React, { useState, useEffect, useCallback, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { PlayIcon } from '../../Icons';

const Editor = ({ socket, roomId, role, initialCode, initialLang }) => {
  const [code, setCode] = useState(initialCode || '');
  const [language, setLanguage] = useState(initialLang || 'cpp');
  const [output, setOutput] = useState('');
  const [stdin, setStdin] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [splitPct, setSplitPct] = useState(55); // editor takes 55%
  const [remoteCursors, setRemoteCursors] = useState([]); // {userId, userName, line, ch, color}
  const isDragging = useRef(false);
  const containerRef = useRef(null);
  const editorViewRef = useRef(null);
  const cursorDebounceRef = useRef(null);

  const isViewer = role === 'viewer';

  useEffect(() => {
    if (!socket) return;
    socket.on('codeUpdate', (newCode) => setCode(newCode));
    socket.on('languageUpdate', (newLang) => setLanguage(newLang));
    socket.on('runResult', ({ stdout, stderr }) => {
      setOutput(stderr || stdout);
      setIsRunning(false);
    });
    
    // Cursor tracking
    socket.on('cursorMove', ({ userId, userName, line, ch, color }) => {
      setRemoteCursors(prev => {
        const existing = prev.find(c => c.userId === userId);
        if (existing) {
          return prev.map(c => c.userId === userId ? { userId, userName, line, ch, color } : c);
        }
        return [...prev, { userId, userName, line, ch, color }];
      });
    });
    
    socket.on('cursorLeft', ({ userId }) => {
      setRemoteCursors(prev => prev.filter(c => c.userId !== userId));
    });
    
    return () => {
      socket.off('codeUpdate');
      socket.off('languageUpdate');
      socket.off('runResult');
      socket.off('cursorMove');
      socket.off('cursorLeft');
    };
  }, [socket]);

  const handleCodeChange = useCallback((val, viewUpdate) => {
    if (isViewer) return;
    setCode(val);
    if (socket) socket.emit('codeChange', { roomId, code: val });
    
    // Track cursor position on change
    if (viewUpdate && socket) {
      const selection = viewUpdate.state.selection.main;
      const line = viewUpdate.state.doc.lineAt(selection.head);
      const ch = selection.head - line.from;
      
      if (cursorDebounceRef.current) clearTimeout(cursorDebounceRef.current);
      cursorDebounceRef.current = setTimeout(() => {
        socket.emit('cursorMove', {
          roomId,
          line: line.number - 1,
          ch
        });
      }, 100);
    }
  }, [socket, roomId, isViewer]);

  const handleLanguageChange = (e) => {
    if (isViewer) return;
    const lang = e.target.value;
    setLanguage(lang);
    if (socket) socket.emit('languageChange', { roomId, language: lang });
  };

  const getLanguageExtension = () => {
    switch (language) {
      case 'cpp': return cpp();
      case 'python': return python();
      case 'java': return java();
      default: return [];
    }
  };

  const onRun = async () => {
    if (isViewer) return;
    setIsRunning(true);
    setOutput('Running...');
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, stdin })
      });
      if (!res.ok) throw new Error(await res.text());
      const { stdout, stderr } = await res.json();
      const result = stderr || stdout;
      setOutput(result);
      if (socket) socket.emit('runResult', { roomId, stdout, stderr });
    } catch (err) {
      setOutput(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Drag handler for editor/output split
  const onDragStart = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;

    const onMove = (ev) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = (ev.clientX || ev.touches?.[0]?.clientX) - rect.left;
      const pct = Math.max(25, Math.min(80, (mouseX / rect.width) * 100));
      setSplitPct(pct);
    };

    const onUp = () => {
      isDragging.current = false;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header Bar */}
      <div style={{
        padding: '6px 14px', background: 'var(--pane)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text)', opacity: 0.6 }}>Language:</label>
          <select
            value={language}
            onChange={handleLanguageChange}
            disabled={isViewer}
            style={{
              padding: '4px 8px', fontSize: '13px',
              border: '1px solid var(--border)', background: 'var(--pane)',
              color: 'var(--text)', borderRadius: '3px'
            }}
          >
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </div>

        <button
          onClick={onRun}
          disabled={isViewer || isRunning}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 16px', background: '#22c55e', color: 'white', border: 'none',
            fontSize: '13px', fontWeight: 600, borderRadius: '3px',
            opacity: (isViewer || isRunning) ? 0.5 : 1,
            cursor: (isViewer || isRunning) ? 'not-allowed' : 'pointer'
          }}
        >
          <PlayIcon size={13} /> {isRunning ? 'RUNNING...' : 'RUN'}
        </button>
      </div>

      {/* Editor + Output (resizable horizontal split) */}
      <div ref={containerRef} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Code + Stdin */}
        <div style={{
          width: `${splitPct}%`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transition: isDragging.current ? 'none' : 'width 0.1s ease'
        }}>
          <div style={{ flex: 1, overflow: 'auto', background: '#282a36', position: 'relative' }}>
            <CodeMirror
              value={code}
              height="100%"
              extensions={[getLanguageExtension()]}
              onChange={handleCodeChange}
              theme={dracula}
              readOnly={isViewer}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                foldGutter: true
              }}
            />
            {/* Remote cursor indicators */}
            {remoteCursors.map(cursor => (
              <div
                key={cursor.userId}
                style={{
                  position: 'absolute',
                  top: `${cursor.line * 20 + 10}px`,
                  left: `${cursor.ch * 7.2 + 50}px`,
                  pointerEvents: 'none',
                  zIndex: 100
                }}
              >
                <div style={{
                  width: '2px',
                  height: '18px',
                  background: cursor.color,
                  animation: 'blink 1s infinite'
                }} />
                <div style={{
                  position: 'absolute',
                  top: '-22px',
                  left: '0',
                  background: cursor.color,
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}>
                  {cursor.userName.split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: '90px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <textarea
              placeholder="Paste input values here..."
              value={stdin}
              onChange={e => setStdin(e.target.value)}
              disabled={isViewer}
              style={{
                width: '100%', height: '100%', padding: '8px 10px',
                border: 'none', resize: 'none',
                background: 'var(--pane)', color: 'var(--text)',
                fontFamily: 'monospace', fontSize: '13px', outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Drag Handle */}
        <div
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          style={{
            width: '6px', cursor: 'col-resize', background: 'var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, zIndex: 5
          }}
        >
          <div style={{ width: '2px', height: '40px', background: 'var(--text)', opacity: 0.2, borderRadius: '2px' }} />
        </div>

        {/* Output */}
        <div style={{
          width: `${100 - splitPct}%`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'var(--outbg)',
          transition: isDragging.current ? 'none' : 'width 0.1s ease'
        }}>
          <div style={{
            padding: '6px 14px', borderBottom: '1px solid var(--border)',
            fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
            color: 'var(--text)', opacity: 0.6
          }}>
            Output
          </div>
          <textarea
            value={output}
            readOnly
            placeholder="Program output will appear here..."
            style={{
              flex: 1, width: '100%', padding: '10px',
              border: 'none', resize: 'none',
              background: 'transparent', color: 'var(--text)',
              fontFamily: 'monospace', fontSize: '13px', outline: 'none'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Editor;
