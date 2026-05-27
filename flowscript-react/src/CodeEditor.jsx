import React from 'react';
import Editor from '@monaco-editor/react';
import { LANGUAGE_ID, register } from './dsl/monacoLanguage';

function beforeMount(monaco) {
  register(monaco);
}

const CodeEditor = React.forwardRef(function CodeEditor({ value, onChange, language }, ref) {
  const editorRef = React.useRef(null);

  React.useImperativeHandle(ref, () => ({
    undo: () => editorRef.current?.trigger('keyboard', 'undo', null),
    redo: () => editorRef.current?.trigger('keyboard', 'redo', null),
  }));

  return (
    <Editor
      height="100%"
      language={language ?? LANGUAGE_ID}
      theme={language ? 'vs-dark' : 'flowscript-dark'}
      value={value}
      onChange={(val) => onChange(val ?? '')}
      beforeMount={beforeMount}
      onMount={(editor) => { editorRef.current = editor; }}
      options={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6,
        },
        padding: { top: 16, bottom: 16 },
      }}
    />
  );
});

export default CodeEditor;
