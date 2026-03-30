import React, { useState, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { PlayIcon, ShareIcon } from '../../Icons';

const Editor = ({ socket, roomId, role, initialCode, initialLang }) => {
  const [code, setCode] = useState(initialCode || '');
  const [language, setLanguage] = useState(initialLang || 'cpp');
  const [output, setOutput] = useState('');
  const [stdin, setStdin] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const isViewer = role === 'viewer';

  useEffect(() => {
    if (!socket) return;

    socket.on('codeUpdate', (newCode) => {
      setCode(newCode);
    });

    socket.on('languageUpdate', (newLang) => {
      setLanguage(newLang);
    });

    socket.on('runResult', ({ stdout, stderr }) => {
      setOutput(stderr || stdout);
      setIsRunning(false);
    });

    return () => {
      socket.off('codeUpdate');
      socket.off('languageUpdate');
      socket.off('runResult');
    };
  }, [socket]);

  const handleCodeChange = useCallback((val) => {
    if (isViewer) return;
    setCode(val);
    socket.emit('codeChange', { roomId, code: val });
  }, [socket, roomId, isViewer]);

  const handleLanguageChange = (e) => {
    if (isViewer) return;
    const lang = e.target.value;
    setLanguage(lang);
    socket.emit('languageChange', { roomId, language: lang });
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
      const res = await fetch('http://localhost:5001/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, stdin })
      });
      
      if (!res.ok) throw new Error(await res.text());
      
      const { stdout, stderr } = await res.json();
      const result = stderr || stdout;
      setOutput(result);
      
      // Broadcast result to others
      socket.emit('runResult', { roomId, stdout, stderr });
    } catch(err) {
      setOutput(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="editor-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Editor Header */}
      <div className="left-pane-header" style={{ padding: '10px 20px', background: 'var(--pane)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="lang-section" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label className="lang-label" style={{ fontSize: '12px', fontWeight: 'bold' }}>LANGUAGE:</label>
          <select 
            value={language} 
            onChange={handleLanguageChange}
            disabled={isViewer}
            style={{ padding: '4px 8px', border: '1px solid var(--border)' }}
          >
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </div>
        
        <div className="action-buttons">
          <button 
            onClick={onRun} 
            disabled={isViewer || isRunning}
            className="run-button"
            style={{ 
              display: 'flex', alignItems: 'center', gap: '5px', 
              padding: '6px 16px', background: 'var(--btn)', color: 'white', border: 'none',
              opacity: (isViewer || isRunning) ? 0.5 : 1, cursor: (isViewer || isRunning) ? 'not-allowed' : 'pointer'
            }}
          >
            <PlayIcon size={14} /> {isRunning ? 'RUNNING...' : 'RUN'}
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left - Code & Stdin */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
          <div style={{ flex: 1, overflow: 'auto', background: '#282a36' }}>
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
          </div>
          <div style={{ height: '120px', borderTop: '1px solid var(--border)' }}>
            <textarea
              placeholder="Paste input values here..."
              value={stdin}
              onChange={e => setStdin(e.target.value)}
              disabled={isViewer}
              style={{ width: '100%', height: '100%', padding: '10px', border: 'none', resize: 'none', background: 'var(--pane)', color: 'var(--text)' }}
            />
          </div>
        </div>

        {/* Right - Output */}
        <div style={{ flex: 1, background: 'var(--outbg)' }}>
          <div style={{ padding: '10px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 'bold' }}>
            OUTPUT
          </div>
          <textarea
            value={output}
            readOnly
            style={{ width: '100%', height: 'calc(100% - 35px)', padding: '10px', border: 'none', resize: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'monospace' }}
          />
        </div>
      </div>
    </div>
  );
};

export default Editor;
