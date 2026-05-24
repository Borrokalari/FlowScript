import ReactDOM from 'react-dom';
import React from 'react';
import ReactFlow, {
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Panel,
  useUpdateNodeInternals,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import action_icon    from './NodeIcons/action_icon.png';
import condition_icon from './NodeIcons/condition_icon.png';
import data_icon      from './NodeIcons/data_icon.png';
import event_icon     from './NodeIcons/event_icon.png';
import group_icon     from './NodeIcons/group_icon.png';

export const NODE_ICONS = {
  action:    action_icon,
  condition: condition_icon,
  data:      data_icon,
  event:     event_icon,
  group:     group_icon,
};

export const rootNodes = [
  {
    id: '1',
    type: 'flowNode',
    position: { x: 250, y: 5 },
    data: { label: 'getmilk', nodeType: 'action', icon: action_icon, pinsIn: 1, pinsOut: 1 },
  },
];
export const rootEdges = [];

// ─── Utilities ────────────────────────────────────────────────────────────────

function computeNodeWidth(label) {
  return Math.max(100, Math.ceil(label.length * 6.6 + 34));
}

function computeNodeHeight(pinsIn, pinsOut) {
  const maxPins = Math.max(pinsIn, pinsOut);
  return Math.max(100, 20 + (maxPins + 1) * 20);
}

function pinPositions(count, totalHeight) {
  if (count === 0) return [];
  const bodyHeight = totalHeight - 20;
  return Array.from({ length: count }, (_, i) =>
    20 + ((i + 1) / (count + 1)) * bodyHeight
  );
}

function findFreePosition(existingNodes, label, pinsIn, pinsOut, startX, startY) {
  const newW = computeNodeWidth(label);
  const newH = computeNodeHeight(pinsIn, pinsOut);
  const gap = 20;

  const isBlocked = (cx, cy) =>
    existingNodes
      .filter((n) => n.type === 'flowNode')
      .some((n) => {
        const nW = computeNodeWidth(n.data?.label ?? '');
        const nH = computeNodeHeight(n.data?.pinsIn ?? 1, n.data?.pinsOut ?? 1);
        return (
          cx < n.position.x + nW + gap &&
          cx + newW + gap > n.position.x &&
          cy < n.position.y + nH + gap &&
          cy + newH + gap > n.position.y
        );
      });

  const colStep = newW + gap;
  const rowStep = newH + gap;

  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 20; col++) {
      const x = startX + col * colStep;
      const y = startY + row * rowStep;
      if (!isBlocked(x, y)) return { x, y };
    }
  }

  return { x: startX, y: startY };
}

// ─── FlowNode ────────────────────────────────────────────────────────────────

function FlowNode({ id, data, onDeleteNode, onEditNode, onAddPins, onRenamePinName, onEnterNode }) {
  const [menuOpen,   setMenuOpen]   = React.useState(false);
  const [editingPin, setEditingPin] = React.useState(null);
  const menuRef = React.useRef(null);
  const updateNodeInternals = useUpdateNodeInternals();

  const pinsIn  = data.pinsIn  ?? 1;
  const pinsOut = data.pinsOut ?? 1;
  const height  = computeNodeHeight(pinsIn, pinsOut);
  const width   = computeNodeWidth(data.label);

  const savePinName = () => {
    if (!editingPin) return;
    onRenamePinName(id, editingPin.side, editingPin.index, editingPin.value.trim());
    setEditingPin(null);
  };

  React.useEffect(() => {
    updateNodeInternals(id);
  }, [id, pinsIn, pinsOut, width, updateNodeInternals]);

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div className="flow-node" style={{ width, height }} data-drag-handle>
      <div
        className="flow-node-header"
        onDoubleClick={(e) => { e.stopPropagation(); onEnterNode(id); }}
      >
        <span className="flow-node-title">{data.label}</span>

        <div className="flow-node-menu-wrap" ref={menuRef}>
          <button
            className="flow-node-menu"
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          >
            ...
          </button>

          {menuOpen && (
            <div className="flow-node-dropdown">
              <button
                className="flow-node-dropdown-item"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => { onEditNode(id); setMenuOpen(false); }}
              >
                Edit
              </button>
              <button
                className="flow-node-dropdown-item"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => { onAddPins(id); setMenuOpen(false); }}
              >
                Add Pins
              </button>
              <button
                className="flow-node-dropdown-item flow-node-dropdown-item--danger"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onDeleteNode(id)}
              >
                Delete Node
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flow-node-body">
        <div className="flow-node-icon" style={{ backgroundImage: `url(${data.icon})` }} />
      </div>

      {pinPositions(pinsIn, height).map((top, i) => {
        const name      = (data.pinInNames || [])[i] || '';
        const isEditing = editingPin?.side === 'in' && editingPin?.index === i;
        return (
          <React.Fragment key={`in-${i}`}>
            <Handle
              id={`pin-in-${i}`}
              type="target"
              position={Position.Left}
              style={{ top: `${top}px` }}
              className="flow-node-handle"
              isConnectable={true}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingPin({ side: 'in', index: i, value: name }); }}
            />
            {isEditing ? (
              <input
                className="pin-name-input pin-name-input--in"
                style={{ top: `${top}px` }}
                value={editingPin.value}
                maxLength={4}
                autoFocus
                onChange={(e) => setEditingPin((p) => ({ ...p, value: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') savePinName(); if (e.key === 'Escape') setEditingPin(null); }}
                onBlur={savePinName}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : name ? (
              <span className="pin-name-label pin-name-label--in" style={{ top: `${top}px` }}>{name}</span>
            ) : null}
          </React.Fragment>
        );
      })}

      {pinPositions(pinsOut, height).map((top, i) => {
        const name      = (data.pinOutNames || [])[i] || '';
        const isEditing = editingPin?.side === 'out' && editingPin?.index === i;
        return (
          <React.Fragment key={`out-${i}`}>
            <Handle
              id={`pin-out-${i}`}
              type="source"
              position={Position.Right}
              style={{ top: `${top}px` }}
              className="flow-node-handle"
              isConnectable={true}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingPin({ side: 'out', index: i, value: name }); }}
            />
            {isEditing ? (
              <input
                className="pin-name-input pin-name-input--out"
                style={{ top: `${top}px` }}
                value={editingPin.value}
                maxLength={4}
                autoFocus
                onChange={(e) => setEditingPin((p) => ({ ...p, value: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') savePinName(); if (e.key === 'Escape') setEditingPin(null); }}
                onBlur={savePinName}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : name ? (
              <span className="pin-name-label pin-name-label--out" style={{ top: `${top}px` }}>{name}</span>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── PinGatewayNode ──────────────────────────────────────────────────────────

function PinGatewayNode({ data }) {
  const isIn = data.side === 'in';
  return (
    <div className="pin-gateway">
      {data.label && <span className="pin-gateway-label">{data.label}</span>}
      <Handle
        type={isIn ? 'source' : 'target'}
        position={isIn ? Position.Right : Position.Left}
        className="pin-gateway-handle"
        isConnectable={true}
      />
    </div>
  );
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({ node, onSave, onClose }) {
  const [label,    setLabel]    = React.useState(node.data.label);
  const [nodeType, setNodeType] = React.useState(node.data.nodeType ?? 'action');
  const [pinsIn,   setPinsIn]   = React.useState(node.data.pinsIn  ?? 1);
  const [pinsOut,  setPinsOut]  = React.useState(node.data.pinsOut ?? 1);

  const handleSave = () => {
    onSave({
      ...node,
      data: { ...node.data, label, nodeType, icon: NODE_ICONS[nodeType], pinsIn, pinsOut },
    });
  };

  return ReactDOM.createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Edit Node</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-label">Name</label>
            <input
              className="modal-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              autoFocus
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">Type</label>
            <div className="modal-type-row">
              <select
                className="modal-select"
                value={nodeType}
                onChange={(e) => setNodeType(e.target.value)}
                disabled={nodeType === 'group'}
                title={nodeType === 'group' ? 'Type is locked while the node has inner content' : undefined}
              >
                {nodeType === 'group' ? (
                  <option value="group">Group (has inner nodes)</option>
                ) : (
                  <>
                    <option value="action">Action</option>
                    <option value="condition">Condition</option>
                    <option value="data">Data</option>
                    <option value="event">Event</option>
                  </>
                )}
              </select>
              <div
                className="modal-type-icon"
                style={{ backgroundImage: `url(${NODE_ICONS[nodeType]})` }}
              />
            </div>
          </div>

          <div className="modal-divider" />

          <div className="modal-pins-row">
            <span className="modal-pins-label">Pin In:</span>
            <button className="modal-pins-btn" onClick={() => setPinsIn((v) => v + 1)}>+</button>
            <button className="modal-pins-btn" onClick={() => setPinsIn((v) => Math.max(0, v - 1))}>−</button>
            <span className="modal-pins-count">{pinsIn}</span>
          </div>

          <div className="modal-pins-row">
            <span className="modal-pins-label">Pin Out:</span>
            <button className="modal-pins-btn" onClick={() => setPinsOut((v) => v + 1)}>+</button>
            <button className="modal-pins-btn" onClick={() => setPinsOut((v) => Math.max(0, v - 1))}>−</button>
            <span className="modal-pins-count">{pinsOut}</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn modal-btn--primary" onClick={handleSave}>Save</button>
          <button className="modal-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── FlowCanvas ───────────────────────────────────────────────────────────────

const FlowCanvas = React.forwardRef(function FlowCanvas(
  { initialNodes, initialEdges, isNested, onEnterNode, onExitLevel },
  ref
) {
  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const [editingNode, setEditingNode] = React.useState(null);

  const nodesRef = React.useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = React.useRef(edges);
  edgesRef.current = edges;

  React.useImperativeHandle(ref, () => ({
    addNode: (data) => {
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const position = findFreePosition(nodesRef.current, data.label, data.pinsIn, data.pinsOut, center.x, center.y);
      setNodes((nds) => [
        ...nds,
        { id: crypto.randomUUID(), type: 'flowNode', position, data },
      ]);
    },
    getState: () => ({
      nodes: nodesRef.current,
      edges: edgesRef.current,
    }),
  }), [screenToFlowPosition, setNodes]);

  const onDeleteNode = React.useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
  }, [setNodes]);

  const onEditNode = React.useCallback((nodeId) => {
    setEditingNode(nodesRef.current.find((n) => n.id === nodeId) ?? null);
  }, []);

  const onAddPins = React.useCallback((nodeId) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, pinsIn: (n.data.pinsIn ?? 1) + 1, pinsOut: (n.data.pinsOut ?? 1) + 1 } }
        : n
    ));
  }, [setNodes]);

  const onRenamePinName = React.useCallback((nodeId, side, index, name) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const key   = side === 'in' ? 'pinInNames' : 'pinOutNames';
      const names = [...(n.data[key] || [])];
      names[index] = name;
      return { ...n, data: { ...n.data, [key]: names } };
    }));
  }, [setNodes]);

  const handleEnterNode = React.useCallback((nodeId) => {
    onEnterNode(nodeId, nodesRef.current, edgesRef.current);
  }, [onEnterNode]);

  const nodeTypes = React.useMemo(() => ({
    flowNode: (props) => (
      <FlowNode
        {...props}
        onDeleteNode={onDeleteNode}
        onEditNode={onEditNode}
        onAddPins={onAddPins}
        onRenamePinName={onRenamePinName}
        onEnterNode={handleEnterNode}
      />
    ),
    pinGateway: PinGatewayNode,
  }), [onDeleteNode, onEditNode, onAddPins, onRenamePinName, handleEnterNode]);

  const onSaveEdit = (updatedNode) => {
    const old        = nodesRef.current.find((n) => n.id === updatedNode.id);
    const newPinsIn  = updatedNode.data.pinsIn;
    const newPinsOut = updatedNode.data.pinsOut;
    const oldPinsIn  = old?.data?.pinsIn  ?? 1;
    const oldPinsOut = old?.data?.pinsOut ?? 1;

    const nodeToSave = {
      ...updatedNode,
      data: {
        ...updatedNode.data,
        pinInNames:  (updatedNode.data.pinInNames  || []).slice(0, newPinsIn),
        pinOutNames: (updatedNode.data.pinOutNames || []).slice(0, newPinsOut),
      },
    };

    setNodes((nds) => nds.map((n) => n.id === updatedNode.id ? nodeToSave : n));

    if (newPinsIn < oldPinsIn || newPinsOut < oldPinsOut) {
      setEdges((eds) => eds.filter((edge) => {
        if (edge.target === updatedNode.id && edge.targetHandle) {
          const idx = parseInt(edge.targetHandle.replace('pin-in-', ''), 10);
          if (!isNaN(idx) && idx >= newPinsIn) return false;
        }
        if (edge.source === updatedNode.id && edge.sourceHandle) {
          const idx = parseInt(edge.sourceHandle.replace('pin-out-', ''), 10);
          if (!isNaN(idx) && idx >= newPinsOut) return false;
        }
        return true;
      }));
    }

    setEditingNode(null);
  };

  const addNode = () => {
    const label = 'new node';
    const pinsIn = 1, pinsOut = 1;
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const position = findFreePosition(nodesRef.current, label, pinsIn, pinsOut, center.x, center.y);
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: 'flowNode',
        position,
        data: { label, nodeType: 'action', icon: action_icon, pinsIn, pinsOut },
      },
    ]);
  };

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setEdges((eds) => eds.filter((edge) => !edge.selected));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setEdges]);

  const onNodesChangeWrapped = (changes) =>
    setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChangeWrapped = (changes) =>
    setEdges((eds) => applyEdgeChanges(changes, eds));
  const onConnect = (connection) =>
    setEdges((eds) => addEdge(connection, eds));

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={true}
        nodesDraggable={true}
        elementsSelectable={true}
        connectionMode="loose"
        defaultEdgeOptions={{ type: 'default' }}
        onNodesChange={onNodesChangeWrapped}
        onEdgesChange={onEdgesChangeWrapped}
        onConnect={onConnect}
      >
        <Panel position="top-left">
          <div className="toolbar">
            <button className="toolbar-btn" onClick={addNode}>+ Node</button>
            {isNested && (
              <button
                className="toolbar-btn toolbar-btn--up"
                onClick={() => onExitLevel(nodesRef.current, edgesRef.current)}
              >
                ↑ Up
              </button>
            )}
          </div>
        </Panel>
      </ReactFlow>

      {editingNode && (
        <EditModal
          node={editingNode}
          onSave={onSaveEdit}
          onClose={() => setEditingNode(null)}
        />
      )}
    </>
  );
});

export default FlowCanvas;
