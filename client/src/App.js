// client/src/App.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

import './App.css';

function App() {
  // 1. Session ID
  const [sessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const existing = params.get('session');
    if (existing) return existing;
    const gen = uuidv4();
    window.history.replaceState(null, '', `?session=${gen}`);
    return gen;
  });

  // 2. State
  const [language, setLanguage] = useState('cpp');
  const [code, setCode]         = useState('');
  const [stdin, setStdin]       = useState('');
  const [output, setOutput]     = useState('');

  // 3. Socket ref
  const socketRef = useRef(null);

  // 4. Connect & join session
  useEffect(() => {
    // no URL ⇒ connects to same‐origin + proxy ⇒ → http://localhost:5001 in dev
    const socket = io();  
    socketRef.current = socket;

    socket.emit('joinSession', sessionId);

    socket.on('initSession', ({ code, language }) => {
      setCode(code);
      setLanguage(language);
    });

    socket.on('codeUpdate',    (newCode) => setCode(newCode));
    socket.on('languageUpdate',(newLang) => setLanguage(newLang));
    socket.on('runResult',     ({ stdout, stderr }) => {
      setOutput(stderr || stdout);
    });

    return () => { socket.disconnect(); };
  }, [sessionId]);

  // 5. Language extension
  const getLanguageExtension = () => {
    switch (language) {
      case 'cpp':    return cpp();
      case 'python': return python();
      case 'java':   return java();
      default:       return [];
    }
  };

  // 6. Handlers
  const handleCodeChange = (value) => {
    setCode(value);
    socketRef.current.emit('codeChange', { sessionId, code: value });
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    socketRef.current.emit('languageChange', { sessionId, language: lang });
  };

  // 7. SAVE
  const onSave = () => {
    const ext = language === 'cpp'
      ? 'cpp'
      : language === 'python'
      ? 'py'
      : 'java';

    const blob = new Blob([code], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `code.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 8. RUN + broadcast
  const onRun = async () => {
    setOutput('Running...');
    try {
      const res = await fetch(`/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, stdin })
      });
      if (!res.ok) throw new Error(await res.text());
      const { stdout, stderr } = await res.json();

      setOutput(stderr || stdout);
      socketRef.current.emit('runResult', { sessionId, stdout, stderr });
    } catch (err) {
      setOutput(`Error: ${err.message}`);
    }
  };

  // 9. SHARE
  const onShare = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url)
      .then(() => alert('Share link copied!'))
      .catch(() => {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); alert('Share link copied!'); }
        catch { window.prompt('Copy this link:', url); }
        document.body.removeChild(ta);
      });
  }, []);

  return (
    <div className="App">
      <header className="header">
        <h1 className="app-title">CodeKerf</h1>
        <div className="nav-buttons">
          <button className="run-button"   onClick={onRun}>RUN</button>
          <button className="share-button" onClick={onShare}>SHARE</button>
          <button className="save-button"  onClick={onSave}>SAVE</button>
        </div>
      </header>

      <div className="editor-container">
        <div className="left-pane">
          <label htmlFor="lang-select" className="lang-label">Language:</label>
          <select
            id="lang-select"
            value={language}
            onChange={handleLanguageChange}
          >
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>

          <div className="code-editor-container">
            <CodeMirror
              value={code}
              height="100%"
              extensions={[getLanguageExtension()]}
              onChange={handleCodeChange}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
                defaultKeymap: true,
                history: true,
                highlightSelectionMatches: true,
                foldGutter: true
              }}
            />
          </div>

          <textarea
            className="input-pane"
            placeholder="Paste input values here…"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
          />
        </div>

        <div className="right-pane">
          <textarea
            className="output-pane"
            placeholder="Program output will appear here…"
            value={output}
            readOnly
          />
        </div>
      </div>
    </div>
  );
}

export default App;
