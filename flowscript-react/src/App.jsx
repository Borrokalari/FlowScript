import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import FlowCanvas, { NODE_ICONS, rootNodes, rootEdges } from './FlowCanvas';
import CodeEditor from './CodeEditor';
import { serialize } from './dsl/serializer';
import { parse }     from './dsl/parser';
import './App.css';

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
    const persistNodes = nodes.filter(n => !n.id.startsWith('__gateway_'));

    nodes = parentLevel.nodes.map(n => {
      if (n.id !== enteredId) return n;
      let data = { ...n.data, innerNodes: persistNodes, innerEdges: edges };
      if (persistNodes.length > 0 && n.data.nodeType !== 'group') {
        data = { ...data, prevNodeType: n.data.nodeType, prevIcon: n.data.icon, nodeType: 'group', icon: NODE_ICONS.group };
      } else if (persistNodes.length === 0 && n.data.nodeType === 'group') {
        data = { ...data, nodeType: n.data.prevNodeType || 'action', icon: n.data.prevIcon || NODE_ICONS.action, prevNodeType: undefined, prevIcon: undefined };
      }
      return { ...n, data };
    });
    edges = parentLevel.edges;
  }

  return { nodes, edges };
}

function parseCommand(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // addNode(name) in, out, ... — legacy explicit syntax
  const explicit = trimmed.match(/^addNode\(([^)]*)\)(.*)$/);
  if (explicit) {
    const name  = explicit[1].trim() || 'new node';
    const parts = explicit[2].trim().split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
    return {
      label:    name,
      nodeType: 'action',
      icon:     NODE_ICONS.action,
      pinsIn:   parts.filter((p) => p === 'in').length  || 1,
      pinsOut:  parts.filter((p) => p === 'out').length || 1,
    };
  }

  // Plain label — "nodeName" creates an action node with 1 in, 1 out
  return { label: trimmed, nodeType: 'action', icon: NODE_ICONS.action, pinsIn: 1, pinsOut: 1 };
}

export default function App() {
  const [mode, setMode]       = React.useState('graph');
  const [command, setCommand] = React.useState('');
  const [dslText, setDslText] = React.useState('');
  const canvasRef = React.useRef(null);

  const [navStack, setNavStack] = React.useState([
    { levelId: null, nodes: rootNodes, edges: rootEdges },
  ]);

  const currentLevel = navStack[navStack.length - 1];

  const handleModeChange = React.useCallback((newMode) => {
    if (newMode === mode) return;
    if (newMode === 'code') {
      const live      = canvasRef.current?.getState();
      const liveNodes = live?.nodes ?? navStack[navStack.length - 1].nodes;
      const liveEdges = live?.edges ?? navStack[navStack.length - 1].edges;
      const root      = buildRootState(navStack, liveNodes, liveEdges);
      setDslText(serialize(root.nodes, root.edges));
      setNavStack([{ levelId: null, nodes: root.nodes, edges: root.edges }]);
    } else if (newMode === 'graph' && dslText.trim()) {
      const { nodes, edges } = parse(dslText, navStack[0].nodes);
      setNavStack([{ levelId: null, nodes, edges }]);
    }
    setMode(newMode);
  }, [mode, dslText, navStack]);

  const handleCommandSubmit = React.useCallback(() => {
    const trimmed = command.trim();
    if (!trimmed) return;
    const data = parseCommand(trimmed);
    if (data) canvasRef.current?.addNode(data);
    setCommand('');
  }, [command]);

  const handleEnterNode = React.useCallback((nodeId, currentNodes, currentEdges) => {
    const entered     = currentNodes.find((n) => n.id === nodeId);
    const innerNodes  = entered?.data?.innerNodes  || [];
    const innerEdges  = entered?.data?.innerEdges  || [];
    const pinsIn      = entered?.data?.pinsIn      ?? 1;
    const pinsOut     = entered?.data?.pinsOut     ?? 1;
    const pinInNames  = entered?.data?.pinInNames  || [];
    const pinOutNames = entered?.data?.pinOutNames || [];

    const inGateways = Array.from({ length: pinsIn }, (_, i) => ({
      id:         `__gateway_in_${i}`,
      type:       'pinGateway',
      position:   { x: 20, y: 60 + 80 * i },
      draggable:  false,
      selectable: false,
      data:       { side: 'in', label: pinInNames[i] || '' },
    }));
    const outGateways = Array.from({ length: pinsOut }, (_, i) => ({
      id:         `__gateway_out_${i}`,
      type:       'pinGateway',
      position:   { x: 860, y: 60 + 80 * i },
      draggable:  false,
      selectable: false,
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

      const persistNodes = innerNodes.filter((n) => !n.id.startsWith('__gateway_'));

      const updatedParent = {
        ...prev[parentIdx],
        nodes: prev[parentIdx].nodes.map((n) => {
          if (n.id !== enteredId) return n;

          let data = { ...n.data, innerNodes: persistNodes, innerEdges };

          if (persistNodes.length > 0 && n.data.nodeType !== 'group') {
            data = {
              ...data,
              prevNodeType: n.data.nodeType,
              prevIcon:     n.data.icon,
              nodeType:     'group',
              icon:         NODE_ICONS.group,
            };
          } else if (persistNodes.length === 0 && n.data.nodeType === 'group') {
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

  return (
    <div className="app-shell">
      {/* File menu bar */}
      <div className="file-menu-bar">
        <button className="file-menu-btn">File</button>
      </div>

      {/* FlowBar */}
      <div className="flowbar">
        <button
          className={`flowbar-tab${mode === 'graph' ? ' flowbar-tab--active' : ''}`}
          onClick={() => handleModeChange('graph')}
        >
          GRAPH
        </button>
        <button
          className={`flowbar-tab${mode === 'code' ? ' flowbar-tab--active' : ''}`}
          onClick={() => handleModeChange('code')}
        >
          CODE
        </button>
        <input
          className="flowbar-input"
          placeholder="Type a flow command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCommandSubmit(); }}
        />
        <button className="flowbar-submit" onClick={handleCommandSubmit}>&#9658;</button>
      </div>

      {/* Content */}
      <div className="app-content">
        {mode === 'graph' && (
          <ReactFlowProvider>
            <FlowCanvas
              ref={canvasRef}
              key={currentLevel.levelId ?? 'root'}
              initialNodes={currentLevel.nodes}
              initialEdges={currentLevel.edges}
              isNested={navStack.length > 1}
              onEnterNode={handleEnterNode}
              onExitLevel={handleExitLevel}
            />
          </ReactFlowProvider>
        )}
        {mode === 'code' && <CodeEditor value={dslText} onChange={setDslText} />}
      </div>
    </div>
  );
}
