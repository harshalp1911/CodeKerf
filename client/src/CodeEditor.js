// client/src/CodeEditor.js
import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, basicSetup } from '@codemirror/basic-setup';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { autocompletion } from '@codemirror/autocomplete';

/**
 * CodeEditor props:
 * - language: 'cpp' | 'python' | 'java'
 * - value: string (initial code)
 * - onChange: function(code: string) => void
 */
export default function CodeEditor({ language, value, onChange }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);

  // Utility to choose the language extension
  const languageExtension = () => {
    if (language === 'cpp') return cpp();
    if (language === 'python') return python();
    if (language === 'java') return java();
    // fallback to plain-text (no syntax)
    return [];
  };

  useEffect(() => {
    if (!editorRef.current) return;

    // Create an EditorState with basicSetup and language mode
    const startState = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        languageExtension(),
        autocompletion(), // enable basic autocomplete
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            // Get the latest code and send it to parent via onChange
            const currentCode = update.state.doc.toString();
            onChange(currentCode);
          }
        }),
      ],
    });

    // Instantiate EditorView and attach it to the DOM
    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      // Cleanup on unmount
      view.destroy();
    };
  }, []); // Run once on mount

  // When the `language` prop changes, reconfigure the editor
  useEffect(() => {
    if (!viewRef.current) return;
    // Reconfigure only the language facet
    viewRef.current.dispatch({
      effects: EditorState.reconfigure.of([basicSetup, languageExtension(), autocompletion()]),
    });
  }, [language]);

  // When the `value` prop changes externally, update the editor unless it already matches
  useEffect(() => {
    if (!viewRef.current) return;
    const current = viewRef.current.state.doc.toString();
    if (value !== current) {
      viewRef.current.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      className="cm-editor-container"
      style={{ height: '100%', width: '100%' }}
    />
  );
}
