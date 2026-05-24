import React from 'react';
import Editor from '@monaco-editor/react';
import { LANGUAGE_ID, register } from './dsl/monacoLanguage';

function beforeMount(monaco) {
  register(monaco);
}

export default function CodeEditor({ value, onChange }) {
  return (
    <Editor
      height="100%"
      language={LANGUAGE_ID}
      theme="flowscript-dark"
      value={value}
      onChange={(val) => onChange(val ?? '')}
      beforeMount={beforeMount}
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
}
