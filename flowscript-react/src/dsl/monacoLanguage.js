export const LANGUAGE_ID = 'flowscript';

let registered = false;

export function register(monaco) {
  if (registered) return;
  registered = true;

  monaco.languages.register({ id: LANGUAGE_ID });

  // ── Monarch tokenizer ──────────────────────────────────────────────────────
  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
    tokenizer: {
      root: [
        // Comments
        [/#.*$/, 'comment'],

        // 'node' keyword → switch to nodeDecl to capture the node name
        [/\bnode\b/, { token: 'keyword', next: '@nodeDecl' }],

        // 'flow' keyword
        [/\bflow\b/, { token: 'keyword', next: '@flowDecl' }],

        // Identifier followed by '.' → node reference in an edge expression
        // Must come before the in/out keyword rules so 'in.0' is a node-ref, not keyword
        [/\w+(?=\.)/, 'node-ref'],

        // Dot in edge expression → next identifier is a pin name
        [/\./, { token: 'delimiter', next: '@afterDot' }],

        // 'in' / 'out' pin-list keywords (only reached when NOT followed by '.')
        [/\b(?:in|out)\b/, { token: 'keyword.pin', next: '@pinList' }],

        // 'body' keyword
        [/\bbody\b/, { token: 'keyword.pin', next: '@bodyRef' }],

        // 'prop' keyword → switch to propDecl to capture the property type
        [/\bprop\b/, { token: 'keyword.pin', next: '@propDecl' }],

        // Arrow operator
        [/->/, 'operator'],

        // Colon (name : type separator)
        [/:/, 'delimiter'],

        // @flow-id reference
        [/@\w+/, 'flow-ref'],

        // Node type names (including property types)
        [/\b(?:action|condition|data|event|group|checkbox|slider|dropdown)\b/, 'type'],

        // Quoted label (e.g. "new node")
        [/"[^"]*"/, 'string'],

        // Number (pin index)
        [/\d+/, 'number'],

        // Underscore = unnamed pin placeholder
        [/_(?!\w)/, 'pin-unnamed'],

        // Generic identifier
        [/\w+/, 'identifier'],

        // Comma
        [/,/, 'delimiter'],

        // Whitespace
        [/[ \t]+/, ''],
      ],

      // Captures the node name immediately after 'node '
      nodeDecl: [
        [/[ \t]+/, ''],
        [/"[^"]*"/, { token: 'node-name', next: '@pop' }],
        [/[^\s:@]+/, { token: 'node-name', next: '@pop' }],
        [/$/, { token: '', next: '@pop' }],
      ],

      // Captures the flow id after 'flow '
      flowDecl: [
        [/[ \t]+/, ''],
        [/@\w+/, { token: 'flow-ref', next: '@pop' }],
        [/\w+/, { token: 'flow-ref', next: '@pop' }],
        [/$/, { token: '', next: '@pop' }],
      ],

      // After a '.' in an edge expression: next token is the pin name or index
      afterDot: [
        [/\w+/, { token: 'pin-name', next: '@pop' }],
        [/\d+/, { token: 'number',   next: '@pop' }],
        [/$/, { token: '', next: '@pop' }],
        [/./,  { token: '', next: '@pop' }],
      ],

      // Pin name list after 'in' or 'out'
      pinList: [
        [/[ \t]+/, ''],
        [/_(?!\w)/, 'pin-unnamed'],
        [/,/, 'delimiter'],
        [/\w+/, 'pin-name'],
        [/$/, { token: '', next: '@pop' }],
      ],

      // Flow id reference after 'body'
      bodyRef: [
        [/[ \t]+/, ''],
        [/@\w+/, { token: 'flow-ref', next: '@pop' }],
        [/$/, { token: '', next: '@pop' }],
      ],

      // Property type after 'prop'
      propDecl: [
        [/[ \t]+/, ''],
        [/\b(?:checkbox|slider|dropdown)\b/, { token: 'type', next: '@pop' }],
        [/$/, { token: '', next: '@pop' }],
      ],
    },
  });

  // ── Theme ──────────────────────────────────────────────────────────────────
  monaco.editor.defineTheme('flowscript-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',    foreground: '4a5568', fontStyle: 'italic' },
      { token: 'keyword',    foreground: '52d7c6', fontStyle: 'bold'   },
      { token: 'keyword.pin',foreground: '6ba7a6'                      },
      { token: 'node-name',  foreground: 'e5c07b'                      }, // faint yellow
      { token: 'node-ref',   foreground: 'e5c07b'                      }, // same in edge refs
      { token: 'type',       foreground: 'f78c6c'                      }, // soft orange
      { token: 'flow-ref',   foreground: '98c379'                      }, // green
      { token: 'pin-name',   foreground: '61afef'                      }, // blue
      { token: 'pin-unnamed',foreground: '3d5066'                      }, // very muted
      { token: 'operator',   foreground: 'c678dd'                      }, // purple
      { token: 'delimiter',  foreground: '4a5568'                      },
      { token: 'identifier', foreground: 'abb2bf'                      }, // default gray
      { token: 'number',     foreground: 'd19a66'                      },
      { token: 'string',     foreground: 'e5c07b'                      }, // quoted = node-name color
    ],
    colors: {
      'editor.background':                    '#1a1d21',
      'editor.wordHighlightBackground':       '#e5c07b18',
      'editor.wordHighlightStrongBackground': '#e5c07b30',
      'editor.selectionHighlightBackground':  '#e5c07b12',
    },
  });

  // ── Document highlight provider ────────────────────────────────────────────
  // Highlights all occurrences of the word under the cursor (VS Code style)
  monaco.languages.registerDocumentHighlightProvider(LANGUAGE_ID, {
    provideDocumentHighlights(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word || word.word.length < 2) return [];

      const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex   = new RegExp(`\\b${escaped}\\b`, 'g');
      const lines   = model.getValue().split('\n');
      const results = [];

      lines.forEach((line, i) => {
        let m;
        while ((m = regex.exec(line)) !== null) {
          results.push({
            range: new monaco.Range(i + 1, m.index + 1, i + 1, m.index + m[0].length + 1),
            kind:  monaco.languages.DocumentHighlightKind.Text,
          });
        }
      });

      return results;
    },
  });
}
