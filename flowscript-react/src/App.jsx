import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import FlowCanvas, { NODE_ICONS, FRAME_NODES } from './FlowCanvas';
import flowscriptLogo from './FlowScript_Logo.png';
import CodeEditor from './CodeEditor';
import { serialize } from './dsl/serializer';
import { parse }     from './dsl/parser';
import './App.css';

// ── File serialization ────────────────────────────────────────────────────────

function serializeToFile(nodes, edges) {
  const clean = (n) => {
    if (n.type === 'propertyNode') return n;
    const { icon, prevIcon, ...data } = n.data;
    const cleaned = { ...data };
    if (cleaned.innerNodes) cleaned.innerNodes = cleaned.innerNodes.map(clean);
    return { ...n, data: cleaned };
  };
  return JSON.stringify({ version: 1, nodes: nodes.map(clean), edges }, null, 2);
}

function serializeNodeForTemplate(node) {
  if (node.type === 'propertyNode') return node;
  const { icon, prevIcon, ...data } = node.data;
  const cleaned = { ...data };
  if (cleaned.innerNodes) cleaned.innerNodes = cleaned.innerNodes.map(serializeNodeForTemplate);
  return { ...node, data: cleaned };
}

function deserializeFromFile(jsonStr) {
  const { nodes, edges } = JSON.parse(jsonStr);
  const restore = (n) => {
    if (n.type === 'propertyNode' || n.type === 'shapeNode') return n;
    const icon = NODE_ICONS[n.data.nodeType] ?? NODE_ICONS.action;
    const data = { ...n.data, icon };
    if (n.data.prevNodeType) data.prevIcon = NODE_ICONS[n.data.prevNodeType] ?? NODE_ICONS.action;
    if (data.innerNodes) data.innerNodes = data.innerNodes.map(restore);
    return { ...n, data };
  };
  return { nodes: nodes.map(restore), edges };
}

// ── Themes ────────────────────────────────────────────────────────────────────

const THEMES = {
  'FlowScript (Default)': {
    nodeBodyBg:      '#6c757d',
    nodeBorder:      '#555555',
    nodeHeaderBg:    '#6ba7a6',
    nodeHandleBg:    '#52d7c6',
    nodeMenuBg:      '#f4a261',
    pinGatewayBg:    '#3d7877',
    pinGatewayBorder:'#52d7c6',
  },
  Shard: {
    nodeBodyBg:      '#9E77ED',
    nodeBorder:      '#555555',
    nodeHeaderBg:    '#5F35B2',
    nodeHandleBg:    '#9E77ED',
    nodeMenuBg:      '#8FB2C7',
    pinGatewayBg:    '#3d7877',
    pinGatewayBorder:'#9E77ED',
  },
  FrameWalker: {
    nodeBodyBg:      '#F8EFDF',
    nodeBorder:      '#555555',
    nodeHeaderBg:    '#3E5263',
    nodeHandleBg:    '#C6C8B1',
    nodeMenuBg:      '#F88E30',
    pinGatewayBg:    '#9EA08E',
    pinGatewayBorder:'#9EA08E',
  },
  Command: {
    nodeBodyBg:      '#9DA6B5',
    nodeBorder:      '#555555',
    nodeHeaderBg:    '#363F4E',
    nodeHandleBg:    '#D1D6DA',
    nodeMenuBg:      '#B44A3F',
    pinGatewayBg:    '#A7ABAE',
    pinGatewayBorder:'#A7ABAE',
  },
  Outpost: {
    nodeBodyBg:      '#DED7B5',
    nodeBorder:      '#555555',
    nodeHeaderBg:    '#62583D',
    nodeHandleBg:    '#8E7F5C',
    nodeMenuBg:      '#F3590A',
    pinGatewayBg:    '#72664A',
    pinGatewayBorder:'#72664A',
  },
};

const DEFAULT_PREFS = { theme: 'FlowScript (Default)', nodeTextColor: '#e0e0e0', edgeThickness: 1.5, userThemes: {} };

function darkenHex(hex, factor = 0.2) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (v) => Math.round(v * (1 - factor)).toString(16).padStart(2, '0');
  return `#${d(r)}${d(g)}${d(b)}`;
}

function ThemePreviewNode({ nodeBodyBg, nodeHeaderBg, nodeMenuBg, nodeHandleBg }) {
  const pin = { position: 'absolute', width: 10, height: 10, background: nodeHandleBg, border: '2px solid white', borderRadius: 2, top: '50%', transform: 'translateY(-50%)' };
  return (
    <div style={{ background: nodeBodyBg, border: '1px solid #555', fontFamily: "'JetBrains Mono',monospace", width: 160, position: 'relative' }}>
      <div style={{ background: nodeHeaderBg, padding: '3px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 600, color: '#e0e0e0' }}>
        <span>preview</span>
        <span style={{ background: nodeMenuBg, padding: '1px 5px', fontSize: 12, fontWeight: 'bold', color: '#222' }}>...</span>
      </div>
      <div style={{ height: 50, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...pin, left: -5 }} />
        <span style={{ fontSize: 10, color: '#888', fontStyle: 'italic' }}>node body</span>
        <div style={{ ...pin, right: -5 }} />
      </div>
    </div>
  );
}

// ── Menu definitions ──────────────────────────────────────────────────────────

const MENUS = [
  {
    label: 'File',
    items: [
      { label: 'New .flowscript', action: 'file:new' },
      { label: 'New .frame', action: 'file:newFrame' },
      { label: 'New Window', action: 'app:newWindow' },
      { type: 'sep' },
      { label: 'Open...', action: 'file:open' },
      { label: 'Open Recent', arrow: true, submenuKey: 'recentFiles' },
      { type: 'sep' },
      { label: 'Save', action: 'file:save' },
      { label: 'Save As...', action: 'file:saveAs' },
      { type: 'sep' },
      { label: 'Preferences...', action: 'app:preferences' },
      { type: 'sep' },
      { label: 'Close', action: 'app:close' },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: "What's New in FlowScript?", action: 'help:whatsnew' },
      { type: 'sep' },
      { label: 'QuickStart', action: 'help:quickstart' },
      { type: 'sep' },
      { label: 'My Account...', disabled: true },
      { type: 'sep' },
      { label: 'Check for Updates...', disabled: true },
      { label: 'Found an issue?', action: 'help:reportissue' },
      { label: 'About...', action: 'app:about' },
    ],
  },
];

function TitleBar({ onAction, fileName, fileType, isDirty, recentFiles, onOpenRecent, onClearRecent, onUndo, onRedo, canUndo, canRedo, mode }) {
  const [openIdx, setOpenIdx] = React.useState(null);
  const [submenuOpenIdx, setSubmenuOpenIdx] = React.useState(null);
  const [maximized, setMaximized] = React.useState(false);
  const barRef = React.useRef(null);
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  React.useEffect(() => { if (openIdx === null) setSubmenuOpenIdx(null); }, [openIdx]);

  React.useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.isMaximized().then(setMaximized);
    window.electronAPI.onMaximizeChange(setMaximized);
  }, [isElectron]);

  React.useEffect(() => {
    if (openIdx === null) return;
    const close = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setOpenIdx(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openIdx]);

  return (
    <div className="title-bar" ref={barRef}>
      {/* Logo */}
      <img src={flowscriptLogo} className="title-bar-logo" alt="FlowScript" />

      {/* Menus */}
      <div className="title-bar-menus">
        {MENUS.map((menu, i) => (
          <div key={menu.label} className="menu-bar-entry">
            <button
              className={`menu-bar-btn${openIdx === i ? ' menu-bar-btn--active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); setOpenIdx(openIdx === i ? null : i); }}
              onMouseEnter={() => { if (openIdx !== null) setOpenIdx(i); }}
            >
              {menu.label}
            </button>
            {openIdx === i && (
              <div className="menu-dropdown">
                {menu.items.map((item, j) =>
                  item.type === 'sep' ? (
                    <div key={j} className="menu-sep" />
                  ) : item.submenuKey === 'recentFiles' ? (
                    <div key={j} className="menu-item-wrap" onMouseEnter={() => setSubmenuOpenIdx(j)}>
                      <button className="menu-item">
                        <span>{item.label}</span>
                        <span className="menu-item-arrow">›</span>
                      </button>
                      {submenuOpenIdx === j && (
                        <div className="menu-submenu">
                          {!recentFiles?.length ? (
                            <button className="menu-item menu-item--disabled" disabled><span>No recent files</span></button>
                          ) : recentFiles.map((f, k) => (
                            <button
                              key={k}
                              className="menu-item"
                              title={f.filePath}
                              onMouseDown={(e) => { e.preventDefault(); setOpenIdx(null); onOpenRecent?.(f.filePath); }}
                            >
                              <span>{f.fileName}</span>
                            </button>
                          ))}
                          <div className="menu-sep" />
                          <button className="menu-item" onMouseDown={(e) => { e.preventDefault(); setOpenIdx(null); onClearRecent?.(); }}>
                            <span>Clear List</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      key={j}
                      className={`menu-item${item.disabled ? ' menu-item--disabled' : ''}`}
                      disabled={item.disabled}
                      onMouseDown={(e) => { e.preventDefault(); if (!item.disabled) { setOpenIdx(null); if (item.action) onAction?.(item.action); } }}
                      onMouseEnter={() => setSubmenuOpenIdx(null)}
                    >
                      <span>{item.label}</span>
                      {item.arrow && <span className="menu-item-arrow">›</span>}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Undo / Redo */}
      <div className="title-bar-undo">
        <button
          className="title-bar-undo-btn"
          onClick={onUndo}
          disabled={mode === 'graph' && !canUndo}
          title="Undo (Ctrl+Z)"
        >↩</button>
        <button
          className="title-bar-undo-btn"
          onClick={onRedo}
          disabled={mode === 'graph' && !canRedo}
          title="Redo (Ctrl+Y)"
        >↪</button>
      </div>

      {/* Drag area + title */}
      <div
        className="title-bar-drag"
        onDoubleClick={() => isElectron && window.electronAPI.maximize()}
      >
        <span className="title-bar-title">
          {(() => { const app = fileType === 'frame' ? 'Frame Walker' : 'FlowScript'; return fileName ? `${app} — ${fileName}${isDirty ? ' *' : ''}` : `${app}${isDirty ? ' *' : ''}`; })()}
        </span>
      </div>

      {/* Window controls — only in Electron */}
      {isElectron && (
        <div className="title-bar-controls">
          <button className="winctl winctl-min" title="Minimize" onClick={() => window.electronAPI.minimize()}>
            <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
          </button>
          <button className="winctl winctl-max" title={maximized ? 'Restore' : 'Maximize'} onClick={() => window.electronAPI.maximize()}>
            {maximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="0" y="3" width="7" height="7"/>
                <path d="M3 3V1h6v6H7"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="0.5" y="0.5" width="9" height="9"/>
              </svg>
            )}
          </button>
          <button className="winctl winctl-close" title="Close" onClick={() => window.electronAPI.close()}>
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.1">
              <line x1="0" y1="0" x2="10" y2="10"/>
              <line x1="10" y1="0" x2="0" y2="10"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// Commits every nested level of navStack back up to root using the live
// canvas state, mirroring the logic in handleExitLevel.
function buildRootState(navStack, liveNodes, liveEdges) {
  if (navStack.length === 1) {
    return { nodes: liveNodes, edges: liveEdges };
  }

  let nodes = liveNodes;
  let edges = liveEdges;

  for (let depth = navStack.length - 1; depth > 0; depth--) {
    const enteredId    = navStack[depth].levelId;
    const parentLevel  = navStack[depth - 1];
    const gateways        = nodes.filter(n => n.id.startsWith('__gateway_'));
    const pinInPositions  = gateways.filter(n => n.id.startsWith('__gateway_in_')).map(n => n.position);
    const pinOutPositions = gateways.filter(n => n.id.startsWith('__gateway_out_')).map(n => n.position);
    const persistNodes  = nodes.filter(n => !n.id.startsWith('__gateway_'));
    const regularNodes  = persistNodes.filter(n => n.type === 'flowNode');
    const propertyNodes = persistNodes.filter(n => n.type === 'propertyNode');

    nodes = parentLevel.nodes.map(n => {
      if (n.id !== enteredId) return n;
      let data = { ...n.data, innerNodes: persistNodes, innerEdges: edges, hasProperties: propertyNodes.length > 0, pinInPositions, pinOutPositions };
      if (regularNodes.length > 0 && n.data.nodeType !== 'group') {
        data = { ...data, prevNodeType: n.data.nodeType, prevIcon: n.data.icon, nodeType: 'group', icon: NODE_ICONS.group };
      } else if (regularNodes.length === 0 && n.data.nodeType === 'group') {
        data = { ...data, nodeType: n.data.prevNodeType || 'action', icon: n.data.prevIcon || NODE_ICONS.action, prevNodeType: undefined, prevIcon: undefined };
      }
      return { ...n, data };
    });
    edges = parentLevel.edges;
  }

  return { nodes, edges };
}

function parseCommand(input) {
  const t = input.trim();
  if (!t) return null;
  let m;

  if (/^showHelp$/i.test(t))       return { command: 'showHelp' };
  m = t.match(/^zoomNode\(([^)]*)\)$/i);
  if (m) return { command: 'zoomNode', name: m[1].trim() };

  m = t.match(/^saveTemplate\(([^)]*)\)$/i);
  if (m) return { command: 'saveTemplate', name: m[1].trim() };

  m = t.match(/^copyNode\(([^)]*)\)$/i);
  if (m) return { command: 'copyNode', name: m[1].trim() };

  if (/^pasteLastNode$/i.test(t)) return { command: 'pasteLastNode' };

  m = t.match(/^deleteNode\(([^)]*)\)$/i);
  if (m) return { command: 'deleteNode', name: m[1].trim() };

  m = t.match(/^addProperty\(([^)]*)\)$/i);
  if (m) return { command: 'addProperty', name: m[1].trim() };

  m = t.match(/^addPins\(([^)]*)\)\s*:\s*(.+)$/i);
  if (m) {
    const inM  = m[2].match(/in\s+(\d+)/i);
    const outM = m[2].match(/out\s+(\d+)/i);
    return { command: 'addPins', name: m[1].trim(),
      pinsIn:  inM  ? parseInt(inM[1],  10) : 0,
      pinsOut: outM ? parseInt(outM[1], 10) : 0 };
  }

  m = t.match(/^changeType\(([^)]*)\)\s*:\s*(\w+)$/i);
  if (m) return { command: 'changeType', name: m[1].trim(), nodeType: m[2].trim().toLowerCase() };

  m = t.match(/^renameNode\(([^)]*)\)\s*:\s*(.+)$/i);
  if (m) return { command: 'renameNode', name: m[1].trim(), newName: m[2].trim() };

  m = t.match(/^newTheme\(([^)]*)\)$/i);
  if (m) return { command: 'newTheme', name: m[1].trim() };

  m = t.match(/^cookNode\(([^)]*)\)$/i);
  if (m) return { command: 'cookNode', name: m[1].trim() };

  m = t.match(/^newNote\(([^)]*)\)(?:\s*:\s*(.*))?$/i);
  if (m) return { command: 'newNote', label: m[1].trim() || 'note', noteText: m[2]?.trim() ?? '' };

  m = t.match(/^addShape\s*\(\s*(box|circle)\s*\)$/i);
  if (m) return { command: 'addShape', shape: m[1].toLowerCase() };

  m = t.match(/^addNode\(([^)]*)\)(.*)$/i);
  if (m) {
    const name  = m[1].trim() || 'new node';
    const parts = m[2].trim().split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    return { command: 'addNode', label: name, nodeType: 'action', icon: NODE_ICONS.action,
      pinsIn:  parts.filter(p => p === 'in').length  || 1,
      pinsOut: parts.filter(p => p === 'out').length || 1 };
  }

  return { command: 'addNode', label: t, nodeType: 'action', icon: NODE_ICONS.action, pinsIn: 1, pinsOut: 1 };
}

export default function App() {
  const [mode, setMode]           = React.useState('graph');
  const [command, setCommand]     = React.useState('');
  const [cmdHistory, setCmdHistory] = React.useState([]);
  const [historyIdx, setHistoryIdx] = React.useState(-1);
  const [draftCmd,   setDraftCmd]   = React.useState('');
  const [dslText, setDslText]     = React.useState('');
  const [showHelp, setShowHelp]   = React.useState(false);
  const [fileName, setFileName]   = React.useState(null);
  const [fileType, setFileType]   = React.useState('flowscript'); // 'flowscript' | 'frame'
  const [isDirty, setIsDirty]           = React.useState(false);
  const [textFileMode, setTextFileMode] = React.useState(null); // null | { language }
  const [recentFiles, setRecentFiles]   = React.useState([]);
  const [appVersion, setAppVersion]     = React.useState('');
  const [isDevMode, setIsDevMode]       = React.useState(false);
  const [showAbout, setShowAbout]       = React.useState(false);
  const [prefs, setPrefs]               = React.useState(DEFAULT_PREFS);
  const [prefsDraft, setPrefsDraft]     = React.useState(null);
  const [showPrefs, setShowPrefs]       = React.useState(false);
  const [showNewTheme, setShowNewTheme]         = React.useState(false);
  const [newThemeDraft, setNewThemeDraft]       = React.useState(null);
  const [deleteConfirmTheme, setDeleteConfirmTheme] = React.useState(null);
  const [showIssueReport, setShowIssueReport]   = React.useState(false);
  const [issueDraft, setIssueDraft]             = React.useState({ title: '', body: '' });
  const [templates, setTemplates]           = React.useState([]);
  const [showTemplates, setShowTemplates]   = React.useState(false);
  const [pendingTemplateNode, setPendingTemplateNode] = React.useState(null);
  const [templateDraftName, setTemplateDraftName]     = React.useState('');
  const canvasRef       = React.useRef(null);
  const codeEditorRef   = React.useRef(null);
  const flowbarInputRef = React.useRef(null);
  const cursorPosRef    = React.useRef(null);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);
  const preFrameThemeRef = React.useRef(null);
  const prevFileTypeRef  = React.useRef('flowscript');
  const prefsThemeRef    = React.useRef(prefs.theme);
  prefsThemeRef.current  = prefs.theme;

  const [navStack, setNavStack] = React.useState([
    { levelId: null, nodes: [], edges: [] },
  ]);
  const [loadKey, setLoadKey] = React.useState(0);

  const currentLevel = navStack[navStack.length - 1];

  // ── First-launch / new-window initial load ──────────────────────────────────
  React.useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getRecentFiles().then(setRecentFiles);
    window.electronAPI.getVersion().then(setAppVersion);
    window.electronAPI.getTemplates().then(setTemplates);
    window.electronAPI.isDevMode().then(setIsDevMode);
    window.electronAPI.getPreferences().then((saved) => {
      if (saved && Object.keys(saved).length > 0) {
        setPrefs((p) => ({ ...p, ...saved }));
      }
    });
    window.electronAPI.getInitialState().then((state) => {
      if (state.textFile) {
        const { content, fileName, language } = state.textFile;
        setFileName(fileName);
        setTextFileMode({ language });
        setDslText(content);
        setMode('code');
        setIsDirty(false);
      } else if (state.content) {
        const { nodes, edges } = deserializeFromFile(state.content);
        setNavStack([{ levelId: null, nodes, edges }]);
        setLoadKey((k) => k + 1);
        setIsDirty(false);
      }
    });
  }, []);

  React.useEffect(() => {
    if (cursorPosRef.current !== null && flowbarInputRef.current) {
      flowbarInputRef.current.setSelectionRange(cursorPosRef.current, cursorPosRef.current);
      cursorPosRef.current = null;
    }
  }, [command]);

  React.useEffect(() => {
    const prev = prevFileTypeRef.current;
    prevFileTypeRef.current = fileType;
    if (fileType === 'frame' && prev !== 'frame') {
      preFrameThemeRef.current = prefsThemeRef.current;
      setPrefs(p => ({ ...p, theme: 'FrameWalker' }));
    } else if (fileType === 'flowscript' && prev === 'frame') {
      const restored = preFrameThemeRef.current ?? 'FlowScript (Default)';
      preFrameThemeRef.current = null;
      setPrefs(p => ({ ...p, theme: restored }));
    }
  }, [fileType]);

  const handleUndo = React.useCallback(() => {
    if (mode === 'code') codeEditorRef.current?.undo();
    else canvasRef.current?.undo();
  }, [mode]);

  const handleRedo = React.useCallback(() => {
    if (mode === 'code') codeEditorRef.current?.redo();
    else canvasRef.current?.redo();
  }, [mode]);

  const handleModeChange = React.useCallback((newMode) => {
    if (newMode === mode) return;
    if (newMode === 'graph' && textFileMode) return;
    if (newMode === 'code') {
      const live      = canvasRef.current?.getState();
      const liveNodes = live?.nodes ?? navStack[navStack.length - 1].nodes;
      const liveEdges = live?.edges ?? navStack[navStack.length - 1].edges;
      const root      = buildRootState(navStack, liveNodes, liveEdges);
      setDslText(serialize(root.nodes, root.edges));
      setNavStack([{ levelId: null, nodes: root.nodes, edges: root.edges }]);
    } else if (newMode === 'graph' && dslText.trim()) {
      const shapeNodes = navStack[0].nodes.filter((n) => n.type === 'shapeNode');
      const { nodes, edges } = parse(dslText, navStack[0].nodes);
      setNavStack([{ levelId: null, nodes: [...nodes, ...shapeNodes], edges }]);
    }
    setMode(newMode);
  }, [mode, dslText, navStack, textFileMode]);

  // ── File operations ─────────────────────────────────────────────────────────

  const getSerializedState = React.useCallback(() => {
    const live      = canvasRef.current?.getState();
    const liveNodes = live?.nodes ?? navStack[navStack.length - 1].nodes;
    const liveEdges = live?.edges ?? navStack[navStack.length - 1].edges;
    const root      = buildRootState(navStack, liveNodes, liveEdges);
    return serializeToFile(root.nodes, root.edges);
  }, [navStack]);

  const handleFileNew = React.useCallback(() => {
    window.electronAPI?.newFile();
    setFileName(null);
    setFileType('flowscript');
    setIsDirty(false);
    setTextFileMode(null);
    setNavStack([{ levelId: null, nodes: [], edges: [] }]);
    setLoadKey((k) => k + 1);
    setMode('graph');
    setDslText('');
  }, []);

  const handleNewFrame = React.useCallback(() => {
    window.electronAPI?.newFrame();
    setFileName(null);
    setFileType('frame');
    setIsDirty(false);
    setTextFileMode(null);
    setNavStack([{ levelId: null, nodes: [], edges: [] }]);
    setLoadKey((k) => k + 1);
    setMode('graph');
    setDslText('');
  }, []);

  const refreshRecentFiles = React.useCallback(() => {
    window.electronAPI?.getRecentFiles().then(setRecentFiles);
  }, []);

  const handleOpenRecent = React.useCallback(async (filePath) => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.openRecentFile(filePath);
    if (!result.success) { refreshRecentFiles(); return; }
    const ext = result.fileName.split('.').pop().toLowerCase();
    if (ext === 'flowscript' || ext === 'frame') {
      const { nodes, edges } = deserializeFromFile(result.content);
      setFileName(result.fileName);
      setFileType(ext === 'frame' ? 'frame' : 'flowscript');
      setIsDirty(false);
      setTextFileMode(null);
      setNavStack([{ levelId: null, nodes, edges }]);
      setLoadKey((k) => k + 1);
      setMode('graph');
      setDslText('');
    } else {
      const language = ext === 'md' ? 'markdown' : 'plaintext';
      const hasNodes = (navStack[0]?.nodes.length ?? 0) > 0;
      if (hasNodes) {
        window.electronAPI.openTextInNewWindow(result.content, result.filePath, result.fileName, language);
      } else {
        await window.electronAPI.loadTextLocally(result.filePath);
        setFileName(result.fileName);
        setIsDirty(false);
        setTextFileMode({ language });
        setDslText(result.content);
        setMode('code');
      }
    }
    refreshRecentFiles();
  }, [navStack, refreshRecentFiles]);

  const handleClearRecent = React.useCallback(async () => {
    await window.electronAPI?.clearRecentFiles();
    setRecentFiles([]);
  }, []);

  const handleQuickStart = React.useCallback(async () => {
    if (!window.electronAPI) return;
    const dirty = fileName !== null || (navStack[0]?.nodes.length ?? 0) > 0;
    if (dirty) {
      window.electronAPI.openTutorialNewWindow();
    } else {
      const content = await window.electronAPI.getTutorialContent();
      if (!content) return;
      const { nodes, edges } = deserializeFromFile(content);
      setNavStack([{ levelId: null, nodes, edges }]);
      setLoadKey((k) => k + 1);
      setIsDirty(false);
      setMode('graph');
      setDslText('');
    }
  }, [fileName, navStack]);

  const handleFileOpen = React.useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.openFile();
    if (!result.success) return;
    const ext = result.fileName.split('.').pop().toLowerCase();
    if (ext === 'flowscript' || ext === 'frame') {
      const { nodes, edges } = deserializeFromFile(result.content);
      setFileName(result.fileName);
      setFileType(ext === 'frame' ? 'frame' : 'flowscript');
      setIsDirty(false);
      setTextFileMode(null);
      setNavStack([{ levelId: null, nodes, edges }]);
      setLoadKey((k) => k + 1);
      setMode('graph');
      setDslText('');
    } else {
      const language = ext === 'md' ? 'markdown' : 'plaintext';
      const hasNodes = (navStack[0]?.nodes.length ?? 0) > 0;
      if (hasNodes) {
        window.electronAPI.openTextInNewWindow(result.content, result.filePath, result.fileName, language);
      } else {
        await window.electronAPI.loadTextLocally(result.filePath);
        setFileName(result.fileName);
        setIsDirty(false);
        setTextFileMode({ language });
        setDslText(result.content);
        setMode('code');
      }
    }
  }, [navStack]);

  const handleFileSave = React.useCallback(async () => {
    if (!window.electronAPI) return false;
    const content = textFileMode ? dslText : getSerializedState();
    const result = await window.electronAPI.saveFile(content, fileType);
    if (result.success) { setFileName(result.fileName); setIsDirty(false); refreshRecentFiles(); }
    return result.success;
  }, [textFileMode, dslText, fileType, getSerializedState, refreshRecentFiles]);

  const handleFileSaveAs = React.useCallback(async () => {
    if (!window.electronAPI) return;
    if (textFileMode) {
      const result = await window.electronAPI.saveTextAs(dslText);
      if (result.success) { setFileName(result.fileName); setIsDirty(false); refreshRecentFiles(); }
    } else {
      const result = await window.electronAPI.saveFileAs(getSerializedState(), fileType);
      if (result.success) { setFileName(result.fileName); setIsDirty(false); refreshRecentFiles(); }
    }
  }, [textFileMode, dslText, fileType, getSerializedState, refreshRecentFiles]);

  const handleMenuAction = React.useCallback((action) => {
    switch (action) {
      case 'file:new':      handleFileNew();    break;
      case 'file:newFrame': handleNewFrame();   break;
      case 'file:open':     handleFileOpen();   break;
      case 'file:save':   handleFileSave();   break;
      case 'file:saveAs': handleFileSaveAs(); break;
      case 'app:close':        window.electronAPI?.close(); break;
      case 'app:newWindow':    window.electronAPI?.newWindow(); break;
      case 'help:whatsnew':    window.electronAPI?.openWhatsNew(); break;
      case 'app:about':        setShowAbout(true); break;
      case 'app:preferences':  setPrefsDraft({ ...prefs }); setShowPrefs(true); break;
      case 'help:quickstart':  handleQuickStart(); break;
      case 'help:reportissue': setIssueDraft({ title: '', body: '' }); setShowIssueReport(true); break;
    }
  }, [handleFileNew, handleNewFrame, handleFileOpen, handleFileSave, handleFileSaveAs, handleQuickStart, prefs]);

  const handleSavePrefs = React.useCallback(async () => {
    setPrefs(prefsDraft);
    setPrefsDraft(null);
    setShowPrefs(false);
    await window.electronAPI?.savePreferences(prefsDraft);
  }, [prefsDraft]);

  const handleCancelPrefs = React.useCallback(() => {
    setPrefsDraft(null);
    setShowPrefs(false);
  }, []);

  const handleSaveNewTheme = React.useCallback(async () => {
    const name = newThemeDraft?.name?.trim();
    if (!name) return;
    const { nodeBodyBg, nodeHeaderBg, nodeMenuBg, nodeHandleBg } = newThemeDraft;
    const darkened = darkenHex(nodeHandleBg, 0.2);
    const themeObj = { nodeBodyBg, nodeBorder: '#555555', nodeHeaderBg, nodeHandleBg, nodeMenuBg, pinGatewayBg: darkened, pinGatewayBorder: darkened };
    const updated  = { ...prefs, userThemes: { ...(prefs.userThemes ?? {}), [name]: themeObj }, theme: name };
    setPrefs(updated);
    await window.electronAPI?.savePreferences(updated);
    setShowNewTheme(false);
    setNewThemeDraft(null);
  }, [newThemeDraft, prefs]);

  const handleDeleteUserTheme = React.useCallback(async (themeName) => {
    const updatedUserThemes = { ...(prefs.userThemes ?? {}) };
    delete updatedUserThemes[themeName];
    const updated = {
      ...prefs,
      userThemes: updatedUserThemes,
      theme: prefs.theme === themeName ? 'FlowScript (Default)' : prefs.theme,
    };
    setPrefs(updated);
    if (prefsDraft) setPrefsDraft((d) => ({ ...d, theme: updated.theme, userThemes: updatedUserThemes }));
    await window.electronAPI?.savePreferences(updated);
    setDeleteConfirmTheme(null);
  }, [prefs, prefsDraft]);

  const handleSubmitIssue = React.useCallback(() => {
    const { title, body } = issueDraft;
    if (!title.trim()) return;
    const url = `https://github.com/Borrokalari/FlowScript/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url);
    else window.open(url, '_blank');
    setShowIssueReport(false);
    setIssueDraft({ title: '', body: '' });
  }, [issueDraft]);

  const handleSaveAsTemplate = React.useCallback((node) => {
    setPendingTemplateNode(node);
    setTemplateDraftName(node.data.label ?? '');
  }, []);

  const handleConfirmSaveTemplate = React.useCallback(async () => {
    if (!pendingTemplateNode) return;
    const template = {
      id:        crypto.randomUUID(),
      name:      templateDraftName.trim() || pendingTemplateNode.data.label,
      createdAt: new Date().toISOString(),
      node:      serializeNodeForTemplate(pendingTemplateNode),
    };
    await window.electronAPI?.saveTemplate(template);
    setTemplates((prev) => [...prev, template]);
    setPendingTemplateNode(null);
    setTemplateDraftName('');
  }, [pendingTemplateNode, templateDraftName]);

  const handleDeleteTemplate = React.useCallback(async (templateId) => {
    await window.electronAPI?.deleteTemplate(templateId);
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }, []);

  const handleUseTemplate = React.useCallback((template) => {
    if (mode !== 'graph') return;
    canvasRef.current?.addFromTemplate(template.node);
    setIsDirty(true);
  }, [mode]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────

  React.useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey) return;
      if (e.key === 's' && e.shiftKey) { e.preventDefault(); handleFileSaveAs(); }
      else if (e.key === 's')          { e.preventDefault(); handleFileSave(); }
      else if (e.key === 'o')          { e.preventDefault(); handleFileOpen(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleFileSave, handleFileSaveAs, handleFileOpen]);

  // ── Close guard ─────────────────────────────────────────────────────────────

  React.useEffect(() => {
    const removeCheck = window.electronAPI?.onCheckUnsaved?.(() => {
      window.electronAPI.sendUnsavedResponse({ isDirty, fileName: fileName || 'Untitled' });
    });
    const removeSave = window.electronAPI?.onTriggerSaveAndClose?.(() => {
      handleFileSave().then((saved) => {
        if (saved) window.electronAPI.sendSavedAndReady();
      });
    });
    return () => { removeCheck?.(); removeSave?.(); };
  }, [isDirty, fileName, handleFileSave]);

  // ────────────────────────────────────────────────────────────────────────────

  const handleCommandSubmit = React.useCallback(() => {
    const trimmed = command.trim();
    if (!trimmed) return;
    setCmdHistory((prev) => [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 50));
    setHistoryIdx(-1);
    setDraftCmd('');
    const cmd = parseCommand(trimmed);
    if (cmd) {
      if (cmd.command === 'showHelp') {
        setShowHelp(true);
      } else if (cmd.command === 'zoomNode') {
        if (cmd.name.toLowerCase() === 'all') {
          canvasRef.current?.fitView();
        } else {
          const live = canvasRef.current?.getState();
          const node = live?.nodes.find((n) => n.data?.label === cmd.name);
          if (node) canvasRef.current?.zoomToNode(node.id);
        }
      } else if (cmd.command === 'saveTemplate') {
        const live = canvasRef.current?.getState();
        const node = live?.nodes.find((n) => n.type === 'flowNode' && n.data?.label === cmd.name);
        if (node) handleSaveAsTemplate(node);
      } else if (cmd.command === 'copyNode') {
        const live = canvasRef.current?.getState();
        const node = live?.nodes.find((n) => n.type === 'flowNode' && n.data?.label === cmd.name);
        if (node) canvasRef.current?.copyNode(node.id);
      } else if (cmd.command === 'pasteLastNode') {
        const pasted = canvasRef.current?.pasteNode();
        if (pasted) setIsDirty(true);
      } else if (cmd.command === 'newTheme') {
        const base = allThemes[prefs.theme] ?? THEMES['FlowScript (Default)'];
        setNewThemeDraft({ name: cmd.name || 'My Theme', nodeBodyBg: base.nodeBodyBg, nodeHeaderBg: base.nodeHeaderBg, nodeMenuBg: base.nodeMenuBg, nodeHandleBg: base.nodeHandleBg });
        setShowNewTheme(true);
      } else if (cmd.command === 'cookNode') {
        const live = canvasRef.current?.getState();
        const node = live?.nodes.find((n) => n.data?.label === cmd.name);
        if (node) canvasRef.current?.cookNode(node.id);
      } else if (cmd.command === 'newNote') {
        canvasRef.current?.addNote({ label: cmd.label, noteText: cmd.noteText });
        setIsDirty(true);
      } else if (['addPins', 'renameNode', 'addProperty', 'addShape'].includes(cmd.command)) {
        if (fileType !== 'frame') {
          if (cmd.command === 'addShape') { canvasRef.current?.addShape(cmd.shape); setIsDirty(true); }
          else canvasRef.current?.executeCommand(cmd);
        }
      } else if (cmd.command === 'addNode') {
        if (fileType === 'frame') {
          const match = FRAME_NODES.find((n) => n.toLowerCase() === cmd.label.toLowerCase());
          if (match) { canvasRef.current?.addFrameNode(match); setIsDirty(true); }
        } else {
          canvasRef.current?.addNode({ label: cmd.label, nodeType: cmd.nodeType, icon: cmd.icon, pinsIn: cmd.pinsIn, pinsOut: cmd.pinsOut });
        }
      } else {
        canvasRef.current?.executeCommand(cmd);
      }
    }
    setCommand('');
  }, [command]);

  const handleFlowBarKeyDown = React.useCallback((e) => {
    if (e.key === 'Enter') { handleCommandSubmit(); return; }

    if (e.key === '(') {
      e.preventDefault();
      const pos = e.target.selectionStart;
      setCommand((prev) => prev.slice(0, pos) + '()' + prev.slice(pos));
      cursorPosRef.current = pos + 1;
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      if (historyIdx === -1) setDraftCmd(command);
      const newIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(newIdx);
      const entry = cmdHistory[newIdx];
      setCommand(entry);
      cursorPosRef.current = entry.length;
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      const entry = newIdx === -1 ? draftCmd : cmdHistory[newIdx];
      setCommand(entry);
      cursorPosRef.current = entry.length;
    }
  }, [handleCommandSubmit, command, cmdHistory, historyIdx, draftCmd]);

  const handleEnterNode = React.useCallback((nodeId, currentNodes, currentEdges) => {
    const entered      = currentNodes.find((n) => n.id === nodeId);
    const innerNodes   = entered?.data?.innerNodes   || [];
    const innerEdges   = entered?.data?.innerEdges   || [];
    const pinsIn       = entered?.data?.pinsIn       ?? 1;
    const pinsOut      = entered?.data?.pinsOut      ?? 1;
    const pinInNames   = entered?.data?.pinInNames   || [];
    const pinOutNames  = entered?.data?.pinOutNames  || [];
    const pinInPositions  = entered?.data?.pinInPositions  || [];
    const pinOutPositions = entered?.data?.pinOutPositions || [];

    const inGateways = Array.from({ length: pinsIn }, (_, i) => ({
      id:         `__gateway_in_${i}`,
      type:       'pinGateway',
      position:   pinInPositions[i] ?? { x: 20, y: 60 + 80 * i },
      draggable:  true,
      selectable: true,
      data:       { side: 'in', label: pinInNames[i] || '' },
    }));
    const outGateways = Array.from({ length: pinsOut }, (_, i) => ({
      id:         `__gateway_out_${i}`,
      type:       'pinGateway',
      position:   pinOutPositions[i] ?? { x: 860, y: 60 + 80 * i },
      draggable:  true,
      selectable: true,
      data:       { side: 'out', label: pinOutNames[i] || '' },
    }));

    setNavStack((prev) => [
      ...prev.slice(0, -1),
      { ...prev[prev.length - 1], nodes: currentNodes, edges: currentEdges },
      { levelId: nodeId, nodes: [...inGateways, ...outGateways, ...innerNodes], edges: innerEdges },
    ]);
  }, []);

  const handleExitLevel = React.useCallback((innerNodes, innerEdges) => {
    setNavStack((prev) => {
      const parentIdx = prev.length - 2;
      const enteredId = prev[prev.length - 1].levelId;

      const gateways       = innerNodes.filter((n) => n.id.startsWith('__gateway_'));
      const pinInPositions  = gateways.filter((n) => n.id.startsWith('__gateway_in_')).map((n) => n.position);
      const pinOutPositions = gateways.filter((n) => n.id.startsWith('__gateway_out_')).map((n) => n.position);
      const persistNodes  = innerNodes.filter((n) => !n.id.startsWith('__gateway_'));
      const regularNodes  = persistNodes.filter((n) => n.type === 'flowNode');
      const propertyNodes = persistNodes.filter((n) => n.type === 'propertyNode');

      const updatedParent = {
        ...prev[parentIdx],
        nodes: prev[parentIdx].nodes.map((n) => {
          if (n.id !== enteredId) return n;

          let data = { ...n.data, innerNodes: persistNodes, innerEdges, hasProperties: propertyNodes.length > 0, pinInPositions, pinOutPositions };

          if (regularNodes.length > 0 && n.data.nodeType !== 'group') {
            data = {
              ...data,
              prevNodeType: n.data.nodeType,
              prevIcon:     n.data.icon,
              nodeType:     'group',
              icon:         NODE_ICONS.group,
            };
          } else if (regularNodes.length === 0 && n.data.nodeType === 'group') {
            data = {
              ...data,
              nodeType:     n.data.prevNodeType || 'action',
              icon:         n.data.prevIcon     || NODE_ICONS.action,
              prevNodeType: undefined,
              prevIcon:     undefined,
            };
          }

          return { ...n, data };
        }),
      };
      return [...prev.slice(0, parentIdx), updatedParent];
    });
  }, []);

  const livePrefs  = prefsDraft ?? prefs;
  const allThemes  = { ...THEMES, ...(prefs.userThemes ?? {}) };
  const liveTheme  = allThemes[livePrefs.theme] ?? THEMES['FlowScript (Default)'];
  const cssVars = {
    '--node-body-bg':        liveTheme.nodeBodyBg,
    '--node-border-color':   liveTheme.nodeBorder,
    '--node-header-bg':      liveTheme.nodeHeaderBg,
    '--node-handle-bg':      liveTheme.nodeHandleBg,
    '--node-menu-bg':        liveTheme.nodeMenuBg,
    '--pin-gateway-bg':      liveTheme.pinGatewayBg,
    '--pin-gateway-border':  liveTheme.pinGatewayBorder,
    '--node-text-color':     livePrefs.nodeTextColor,
    '--edge-stroke-width':   livePrefs.edgeThickness,
    '--ui-accent':           fileType === 'frame' ? '#F88E30' : liveTheme.nodeHandleBg,
  };

  return (
    <div className={`app-shell${fileType === 'frame' ? ' app-shell--frame' : ''}`} style={cssVars}>
      <TitleBar
        onAction={handleMenuAction}
        fileName={fileName}
        fileType={fileType}
        isDirty={isDirty}
        recentFiles={recentFiles}
        onOpenRecent={handleOpenRecent}
        onClearRecent={handleClearRecent}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        mode={mode}
      />

      {/* FlowBar */}
      <div className="flowbar">
        <button
          className={`flowbar-tab${mode === 'graph' ? ' flowbar-tab--active' : ''}${textFileMode ? ' flowbar-tab--disabled' : ''}`}
          onClick={() => handleModeChange('graph')}
          title={textFileMode ? 'Close the text file to use Graph mode' : undefined}
        >
          GRAPH
        </button>
        <button
          className={`flowbar-tab${mode === 'code' ? ' flowbar-tab--active' : ''}${fileType === 'frame' ? ' flowbar-tab--disabled' : ''}`}
          onClick={() => { if (fileType !== 'frame') handleModeChange('code'); }}
          title={fileType === 'frame' ? 'CODE mode is not available in Frame Walker' : undefined}
        >
          CODE
        </button>
        <button
          className={`flowbar-tab${showTemplates ? ' flowbar-tab--active' : ''}${mode !== 'graph' ? ' flowbar-tab--disabled' : ''}`}
          onClick={() => { if (mode === 'graph') setShowTemplates((v) => !v); }}
          title={mode !== 'graph' ? 'Switch to Graph mode to use templates' : undefined}
        >
          Templates
        </button>
        <div className={`flowbar-command${mode === 'code' ? ' flowbar-command--hidden' : ''}`}>
          <input
            className="flowbar-input"
            ref={flowbarInputRef}
            placeholder="Type a flow command..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleFlowBarKeyDown}
          />
          <button className="flowbar-submit" onClick={handleCommandSubmit}>&#9658;</button>
        </div>
      </div>

      {/* Content */}
      <div className="app-content">
        {mode === 'graph' && fileType !== 'frame' && (
          <img src={flowscriptLogo} className="canvas-watermark" alt="" />
        )}
        {mode === 'graph' && fileType === 'frame' && (
          <div className="canvas-watermark-text">Frame Walker</div>
        )}
        {mode === 'graph' && (
          <ReactFlowProvider>
            <FlowCanvas
              ref={canvasRef}
              key={`${currentLevel.levelId ?? 'root'}-${loadKey}`}
              initialNodes={currentLevel.nodes}
              initialEdges={currentLevel.edges}
              isNested={navStack.length > 1}
              isFrame={fileType === 'frame'}
              isDevMode={isDevMode}
              onEnterNode={handleEnterNode}
              onExitLevel={handleExitLevel}
              onDirty={() => setIsDirty(true)}
              onSaveAsTemplate={handleSaveAsTemplate}
              onUndoChange={(u, r) => { setCanUndo(u); setCanRedo(r); }}
            />
          </ReactFlowProvider>
        )}
        {mode === 'code' && (
          <CodeEditor
            ref={codeEditorRef}
            value={dslText}
            onChange={(val) => { setDslText(val); if (textFileMode) setIsDirty(true); }}
            language={textFileMode?.language}
          />
        )}
      </div>

      {/* Templates panel */}
      {showTemplates && mode === 'graph' && (
        <div className="templates-panel">
          <div className="templates-panel-header">
            <span className="templates-panel-title">Templates</span>
            <button className="templates-panel-close" onClick={() => setShowTemplates(false)}>×</button>
          </div>
          {templates.length === 0 ? (
            <div className="templates-empty">
              No templates yet.<br />Right-click a node and choose<br />"Save as Template…"
            </div>
          ) : (
            <div className="templates-list">
              {templates.map((t) => {
                const innerCount = t.node?.data?.innerNodes?.filter(n => n.type === 'flowNode').length ?? 0;
                const nodeType   = t.node?.data?.nodeType ?? 'action';
                return (
                  <div key={t.id} className="template-card">
                    <div className="template-card-info">
                      <span className="template-card-name">{t.name}</span>
                      <span className="template-card-meta">
                        <span className="template-card-type">{nodeType}</span>
                        {innerCount > 0 && <span className="template-card-inner">{innerCount} inner</span>}
                      </span>
                    </div>
                    <div className="template-card-actions">
                      <button className="template-btn template-btn--use" onClick={() => handleUseTemplate(t)}>Use</button>
                      <button className="template-btn template-btn--delete" onClick={() => handleDeleteTemplate(t.id)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Save-as-template modal */}
      {pendingTemplateNode && (
        <div className="modal-overlay" onClick={() => { setPendingTemplateNode(null); setTemplateDraftName(''); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Save as Template</span>
              <button className="modal-close" onClick={() => { setPendingTemplateNode(null); setTemplateDraftName(''); }}>×</button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">Template Name</label>
                <input
                  className="modal-input"
                  value={templateDraftName}
                  onChange={(e) => setTemplateDraftName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSaveTemplate(); }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn" onClick={() => { setPendingTemplateNode(null); setTemplateDraftName(''); }}>Cancel</button>
              <button className="modal-btn modal-btn--primary" onClick={handleConfirmSaveTemplate}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close about-modal-close" onClick={() => setShowAbout(false)}>×</button>
            <div className="about-content">
              <img src={flowscriptLogo} className="about-logo" alt="FlowScript" />
              <div className="about-info">
                <div className="about-title">FlowScript {appVersion ? `v${appVersion}` : ''}</div>
                <div className="about-code-block">
                  <span className="about-comment">{'// ─────────────────────────────────────'}</span>
                  <span className="about-comment">{'// Creator    : Pierre-Luc Gagnon'}</span>
                  <span className="about-comment">{'// '}</span>
                  <span className="about-comment">{'// Built with :'}</span>
                  <span className="about-comment">{'//   React 19  ·  Vite 8'}</span>
                  <span className="about-comment">{'//   ReactFlow 11  ·  Zustand 5'}</span>
                  <span className="about-comment">{'//   Monaco Editor  ·  Electron 32'}</span>
                  <span className="about-comment">{'// ─────────────────────────────────────'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIssueReport && (
        <div className="modal-overlay" onClick={() => setShowIssueReport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>Found an issue?</span>
              <button className="modal-close" onClick={() => setShowIssueReport(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">Title</label>
                <input
                  className="modal-input"
                  value={issueDraft.title}
                  onChange={(e) => setIssueDraft((d) => ({ ...d, title: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && issueDraft.title.trim()) handleSubmitIssue(); }}
                  placeholder="Short description of the issue"
                  autoFocus
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">Description</label>
                <textarea
                  className="note-modal-textarea"
                  style={{ minHeight: 120, marginTop: 4 }}
                  value={issueDraft.body}
                  onChange={(e) => setIssueDraft((d) => ({ ...d, body: e.target.value }))}
                  placeholder="Steps to reproduce, expected vs actual behavior..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn modal-btn--primary" onClick={handleSubmitIssue} disabled={!issueDraft.title.trim()}>
                Open on GitHub
              </button>
              <button className="modal-btn" onClick={() => setShowIssueReport(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showNewTheme && newThemeDraft && (
        <div className="modal-overlay" onClick={() => { setShowNewTheme(false); setNewThemeDraft(null); }}>
          <div className="new-theme-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New Nodes Theme</span>
              <button className="modal-close" onClick={() => { setShowNewTheme(false); setNewThemeDraft(null); }}>×</button>
            </div>
            <div className="new-theme-body">
              <div className="new-theme-form">
                <div className="modal-field">
                  <label className="modal-label">Name</label>
                  <input className="modal-input" value={newThemeDraft.name} onChange={(e) => setNewThemeDraft((d) => ({ ...d, name: e.target.value }))} autoFocus />
                </div>
                {[
                  { label: 'Node Background', key: 'nodeBodyBg'   },
                  { label: 'Node Header',      key: 'nodeHeaderBg' },
                  { label: 'Node Button',      key: 'nodeMenuBg'   },
                  { label: 'Node Pins',        key: 'nodeHandleBg' },
                ].map(({ label, key }) => (
                  <div key={key} className="modal-field">
                    <label className="modal-label">{label}</label>
                    <div className="prefs-color-row">
                      <input type="color" className="prefs-color-input" value={newThemeDraft[key]}
                        onChange={(e) => setNewThemeDraft((d) => ({ ...d, [key]: e.target.value }))} />
                      <span className="prefs-color-value">{newThemeDraft[key]}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="new-theme-preview">
                <span className="new-theme-preview-label">Preview</span>
                <ThemePreviewNode
                  nodeBodyBg={newThemeDraft.nodeBodyBg}
                  nodeHeaderBg={newThemeDraft.nodeHeaderBg}
                  nodeMenuBg={newThemeDraft.nodeMenuBg}
                  nodeHandleBg={newThemeDraft.nodeHandleBg}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn modal-btn--primary" onClick={handleSaveNewTheme}>Save</button>
              <button className="modal-btn" onClick={() => { setShowNewTheme(false); setNewThemeDraft(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPrefs && prefsDraft && (
        <div className="modal-overlay" onClick={handleCancelPrefs}>
          <div className="prefs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Preferences</span>
              <button className="modal-close" onClick={handleCancelPrefs}>×</button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">Theme</label>
                <div className="theme-selector">
                  {Object.keys(allThemes).map((t) => {
                    const isUser      = !!(prefs.userThemes ?? {})[t];
                    const isSelected  = prefsDraft.theme === t;
                    const isConfirming = deleteConfirmTheme === t;
                    return (
                      <div
                        key={t}
                        className={`theme-selector-item${isSelected ? ' theme-selector-item--selected' : ''}`}
                        onClick={() => { setPrefsDraft((d) => ({ ...d, theme: t })); setDeleteConfirmTheme(null); }}
                      >
                        <span className="theme-selector-name">{t}</span>
                        {isUser && !isConfirming && (
                          <button className="theme-selector-delete" title="Delete theme"
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmTheme(t); }}>🗑</button>
                        )}
                        {isUser && isConfirming && (
                          <div className="theme-selector-confirm" onClick={(e) => e.stopPropagation()}>
                            <span className="theme-confirm-label">Delete?</span>
                            <button className="theme-confirm-btn theme-confirm-btn--yes" onClick={() => handleDeleteUserTheme(t)}>✓</button>
                            <button className="theme-confirm-btn theme-confirm-btn--no" onClick={() => setDeleteConfirmTheme(null)}>✗</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="modal-field">
                <label className="modal-label">Node Text Color</label>
                <div className="prefs-color-row">
                  <input
                    type="color"
                    value={prefsDraft.nodeTextColor}
                    onChange={(e) => setPrefsDraft((d) => ({ ...d, nodeTextColor: e.target.value }))}
                    className="prefs-color-input"
                  />
                  <span className="prefs-color-value">{prefsDraft.nodeTextColor}</span>
                </div>
              </div>
              <div className="modal-field">
                <label className="modal-label">Edge Thickness</label>
                <div className="prefs-slider-row">
                  <input
                    type="range"
                    min="0.5"
                    max="6"
                    step="0.5"
                    value={prefsDraft.edgeThickness}
                    onChange={(e) => setPrefsDraft((d) => ({ ...d, edgeThickness: parseFloat(e.target.value) }))}
                    className="prefs-slider"
                  />
                  <span className="prefs-slider-value">{prefsDraft.edgeThickness}px</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn" onClick={handleCancelPrefs}>Cancel</button>
              <button className="modal-btn modal-btn--primary" onClick={handleSavePrefs}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-header">
              <span>FlowBar Commands</span>
              <button className="help-close" onClick={() => setShowHelp(false)}>×</button>
            </div>
            <table className="help-table">
              <tbody>
                <tr><td><code>name</code></td><td>Create a node (1 in, 1 out)</td></tr>
                <tr><td><code>addNode(name)</code></td><td>Create an action node</td></tr>
                <tr><td><code>newNote(name) : text</code></td><td>Create a note node with optional text</td></tr>
                <tr><td><code>deleteNode(name)</code></td><td>Delete a node by name</td></tr>
                <tr><td><code>addPins(name) : in N, out N</code></td><td>Add N in and N out pins to a node</td></tr>
                <tr><td><code>addProperty(name)</code></td><td>Add a property inside a node</td></tr>
                <tr><td><code>changeType(name) : type</code></td><td>Change type — action / condition / data / event</td></tr>
                <tr><td><code>renameNode(name) : new name</code></td><td>Rename a node</td></tr>
                <tr><td><code>zoomNode(name)</code></td><td>Zoom to a specific node by name</td></tr>
                <tr><td><code>zoomNode(all)</code></td><td>Zoom to fit all nodes in view</td></tr>
                <tr><td><code>saveTemplate(name)</code></td><td>Save node by name as a template</td></tr>
                <tr><td><code>copyNode(name)</code></td><td>Copy a node by name to clipboard</td></tr>
                <tr><td><code>pasteLastNode</code></td><td>Paste the last copied node</td></tr>
                <tr><td><code>addShape(shape)</code></td><td>Add a box or circle shape (not in CODE mode)</td></tr>
                <tr><td><code>newTheme(name)</code></td><td>Create a custom node theme</td></tr>
                <tr><td><code>cookNode(name)</code></td><td>Cooks the node???</td></tr>
                <tr><td><code>showHelp</code></td><td>Show this window</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
