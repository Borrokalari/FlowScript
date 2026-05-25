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

// Tutorial content lives in public/tutorial.flowscript — loaded at runtime.
export const rootNodes = [];
export const rootEdges = [];

// ─── Template instantiation ───────────────────────────────────────────────────

function instantiateTemplateNode(templateNode) {
  const idMap = {};

  function remapNode(n) {
    const newId = crypto.randomUUID();
    idMap[n.id] = newId;

    const data = { ...n.data };

    if (n.type === 'flowNode') {
      data.icon = NODE_ICONS[n.data.nodeType] ?? NODE_ICONS.action;
      if (n.data.prevNodeType) data.prevIcon = NODE_ICONS[n.data.prevNodeType] ?? NODE_ICONS.action;

      if (n.data.innerNodes) {
        // Remap inner nodes first so idMap is populated before edges
        data.innerNodes = n.data.innerNodes.map(remapNode);
        data.innerEdges = (n.data.innerEdges ?? []).map((e) => ({
          ...e,
          id:     crypto.randomUUID(),
          source: idMap[e.source] ?? e.source,
          target: idMap[e.target] ?? e.target,
        }));
      }
    }

    return { ...n, id: newId, data };
  }

  return remapNode(templateNode);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function computeNodeWidth(label) {
  return Math.max(100, Math.ceil(label.length * 6.6 + 34));
}

function computeNodeHeight(pinsIn, pinsOut) {
  const maxPins = Math.max(pinsIn, pinsOut);
  return Math.max(100, 20 + (maxPins + 1) * 20);
}

const NOTE_NODE_WIDTH  = 200;
const NOTE_NODE_HEIGHT = 130;

function getNodeSize(node) {
  if (node.type === 'noteNode')     return { w: NOTE_NODE_WIDTH,  h: NOTE_NODE_HEIGHT };
  if (node.type === 'propertyNode') return { w: 215, h: 120 };
  if (node.type === 'shapeNode')    return { w: node.data?.shapeWidth ?? 200, h: node.data?.shapeHeight ?? 200 };
  return {
    w: computeNodeWidth(node.data?.label ?? ''),
    h: computeNodeHeight(node.data?.pinsIn ?? 1, node.data?.pinsOut ?? 1),
  };
}

function pinPositions(count, totalHeight) {
  if (count === 0) return [];
  const bodyHeight = totalHeight - 20;
  return Array.from({ length: count }, (_, i) =>
    20 + ((i + 1) / (count + 1)) * bodyHeight
  );
}

function inferNodeType(pinsIn, pinsOut) {
  if (pinsIn === 0 && pinsOut >= 1) return 'event';
  if (pinsOut === 0 && pinsIn >= 1) return 'event';
  if (pinsIn === 1 && pinsOut >= 2) return 'condition';
  if (pinsOut === 1 && pinsIn >= 2) return 'condition';
  return null;
}

function findFreePosition(existingNodes, newW, newH, startX, startY) {
  const gap = 20;

  const isBlocked = (cx, cy) =>
    existingNodes
      .filter((n) => n.type === 'flowNode' || n.type === 'propertyNode' || n.type === 'noteNode' || n.type === 'shapeNode')
      .some((n) => {
        const { w: nW, h: nH } = getNodeSize(n);
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

function FlowNode({ id, data, onDeleteNode, onEditNode, onAddPins, onRenamePinName, onEnterNode, onSaveAsTemplate, onDuplicateNode }) {
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
    <div className="flow-node" style={{ width, height, filter: data._cookProgress > 0 ? `sepia(${Math.min(data._cookProgress * 2, 1)}) brightness(${1 - data._cookProgress})` : undefined }} data-drag-handle>
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
                className="flow-node-dropdown-item"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => { onDuplicateNode(id); setMenuOpen(false); }}
              >
                Duplicate Node
              </button>
              <button
                className="flow-node-dropdown-item"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => { onSaveAsTemplate(id); setMenuOpen(false); }}
              >
                Save as Template...
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
        {data.hasProperties && <div className="flow-node-property-dot" />}
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

// ─── NoteNode ────────────────────────────────────────────────────────────────

function NoteNode({ id, data, onDeleteNode, onEditNode, onDuplicateNode, onUpdateNote }) {
  const [menuOpen,  setMenuOpen]  = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft,     setDraft]     = React.useState(data.noteText ?? '');
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    if (!isEditing) setDraft(data.noteText ?? '');
  }, [data.noteText, isEditing]);

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const saveNote = () => { onUpdateNote(id, draft); setIsEditing(false); };

  const pinsIn  = data.pinsIn  ?? 1;
  const pinsOut = data.pinsOut ?? 1;

  return (
    <div className="flow-node note-node" style={{ width: NOTE_NODE_WIDTH, height: NOTE_NODE_HEIGHT, filter: data._cookProgress > 0 ? `sepia(${Math.min(data._cookProgress * 2, 1)}) brightness(${1 - data._cookProgress})` : undefined }}>
      <div className="flow-node-header">
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
              <button className="flow-node-dropdown-item" onMouseDown={(e) => e.stopPropagation()} onClick={() => { onEditNode(id); setMenuOpen(false); }}>Edit</button>
              <button className="flow-node-dropdown-item" onMouseDown={(e) => e.stopPropagation()} onClick={() => { onDuplicateNode(id); setMenuOpen(false); }}>Duplicate Node</button>
              <button className="flow-node-dropdown-item flow-node-dropdown-item--danger" onMouseDown={(e) => e.stopPropagation()} onClick={() => onDeleteNode(id)}>Delete Node</button>
            </div>
          )}
        </div>
      </div>

      <div
        className="note-node-body"
        onDoubleClick={(e) => { e.stopPropagation(); if (!isEditing) { setDraft(data.noteText ?? ''); setIsEditing(true); } }}
      >
        {isEditing ? (
          <textarea
            className="note-node-textarea nodrag"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(); }
              if (e.key === 'Escape') { setDraft(data.noteText ?? ''); setIsEditing(false); }
            }}
            onBlur={saveNote}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="note-node-text">
            {data.noteText
              ? <span style={{ whiteSpace: 'pre-wrap' }}>{data.noteText}</span>
              : <span className="note-node-placeholder">Double click to write a note</span>
            }
          </div>
        )}
      </div>

      {pinPositions(pinsIn, NOTE_NODE_HEIGHT).map((top, i) => (
        <Handle key={`in-${i}`} id={`pin-in-${i}`} type="target" position={Position.Left}
          style={{ top: `${top}px` }} className="flow-node-handle" isConnectable={true} />
      ))}
      {pinPositions(pinsOut, NOTE_NODE_HEIGHT).map((top, i) => (
        <Handle key={`out-${i}`} id={`pin-out-${i}`} type="source" position={Position.Right}
          style={{ top: `${top}px` }} className="flow-node-handle" isConnectable={true} />
      ))}
    </div>
  );
}

// ─── ShapeNode ───────────────────────────────────────────────────────────────

function ShapeNode({ id, data, selected }) {
  const { setNodes, getNode, getViewport } = useReactFlow();
  const w = data.shapeWidth  ?? 200;
  const h = data.shapeHeight ?? 200;
  const isCircle = data.shapeType === 'circle';

  const startResize = React.useCallback((e, dir) => {
    e.stopPropagation();
    e.preventDefault();

    const node = getNode(id);
    if (!node) return;

    const { zoom } = getViewport();
    const startX   = e.clientX;
    const startY   = e.clientY;
    const startW   = node.data.shapeWidth  ?? 200;
    const startH   = node.data.shapeHeight ?? 200;
    const startNX  = node.position.x;
    const startNY  = node.position.y;

    const onMove = (me) => {
      const dx = (me.clientX - startX) / zoom;
      const dy = (me.clientY - startY) / zoom;

      setNodes(nds => nds.map(n => {
        if (n.id !== id) return n;
        let newW = startW, newH = startH, newX = startNX, newY = startNY;

        if (isCircle) {
          const s = Math.max(60, startW + (dx + dy) / 2);
          newW = s; newH = s;
        } else {
          if (dir === 'right')  newW = Math.max(60, startW + dx);
          if (dir === 'bottom') newH = Math.max(60, startH + dy);
          if (dir === 'left')  { newW = Math.max(60, startW - dx); newX = startNX + (startW - newW); }
          if (dir === 'top')   { newH = Math.max(60, startH - dy); newY = startNY + (startH - newH); }
        }

        return {
          ...n,
          position: { x: newX, y: newY },
          style:    { ...n.style, width: newW, height: newH },
          data:     { ...n.data, shapeWidth: newW, shapeHeight: newH },
        };
      }));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [id, isCircle, getNode, getViewport, setNodes]);

  const HS = 10;
  const hBase = {
    position: 'absolute',
    width: HS,
    height: HS,
    background: '#e0e0e0',
    border: '1.5px solid #666',
    borderRadius: 2,
    zIndex: 10,
  };

  return (
    <div className="shape-node-root" style={{ width: w, height: h, position: 'relative' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          border: '15px solid var(--node-header-bg, #6ba7a6)',
          borderRadius: isCircle ? '50%' : 0,
          background: 'transparent',
          boxSizing: 'border-box',
        }}
      />

      {selected && !isCircle && (
        <>
          <div className="nodrag" style={{ ...hBase, top: -HS/2, left: '50%', marginLeft: -HS/2, cursor: 'ns-resize' }}
               onMouseDown={(e) => startResize(e, 'top')} />
          <div className="nodrag" style={{ ...hBase, bottom: -HS/2, left: '50%', marginLeft: -HS/2, cursor: 'ns-resize' }}
               onMouseDown={(e) => startResize(e, 'bottom')} />
          <div className="nodrag" style={{ ...hBase, left: -HS/2, top: '50%', marginTop: -HS/2, cursor: 'ew-resize' }}
               onMouseDown={(e) => startResize(e, 'left')} />
          <div className="nodrag" style={{ ...hBase, right: -HS/2, top: '50%', marginTop: -HS/2, cursor: 'ew-resize' }}
               onMouseDown={(e) => startResize(e, 'right')} />
        </>
      )}

      {selected && isCircle && (
        <div className="nodrag" style={{ ...hBase, bottom: -HS/2, right: -HS/2, cursor: 'nwse-resize' }}
             onMouseDown={(e) => startResize(e, 'prop')} />
      )}
    </div>
  );
}

// ─── PropertyNode ────────────────────────────────────────────────────────────

function PropertyNode({ id, data, onDeleteProperty, onChangePropertyType, onUpdatePropertyData }) {
  const stop   = (e) => e.stopPropagation();
  const update = (updates) => onUpdatePropertyData(id, updates);

  const parsedOptions = (data.dropdownOptions || '')
    .split(',').map(o => o.trim()).filter(Boolean);

  const safeMin     = data.min ?? 0;
  const safeMax     = Math.max(safeMin + 1, data.max ?? 100);
  const sliderValue = Math.min(safeMax, Math.max(safeMin, data.sliderValue ?? safeMin));

  return (
    <div className="property-node">
      <div className="property-node-header">
        <span className="property-node-label">Property Type:</span>
        <select
          className="property-node-select"
          value={data.propertyType}
          onChange={(e) => onChangePropertyType(id, e.target.value)}
          onMouseDown={stop}
        >
          <option value="Checkbox">Checkbox</option>
          <option value="Slider">Slider</option>
          <option value="Dropdown">Dropdown</option>
        </select>
        <button
          className="property-node-trash"
          onClick={() => onDeleteProperty(id)}
          onMouseDown={stop}
          onDoubleClick={stop}
        >
          🗑
        </button>
      </div>

      <div className="property-node-body">
        <div className="prop-row">
          <span className="prop-label">Name:</span>
          <input
            className="prop-input"
            type="text"
            value={data.name || ''}
            onChange={(e) => update({ name: e.target.value })}
            onMouseDown={stop}
          />
        </div>

        {data.propertyType === 'Checkbox' && (<>
          <div className="prop-row">
            <span className="prop-label">Checkbox:</span>
            <input
              type="checkbox"
              className="prop-checkbox"
              checked={!!data.checked}
              onChange={(e) => update({ checked: e.target.checked })}
              onMouseDown={stop}
            />
          </div>
          <div className="prop-row">
            <span className="prop-label">Value:</span>
            <span className="prop-value-label">{data.checked ? 'yes' : 'no'}</span>
          </div>
        </>)}

        {data.propertyType === 'Dropdown' && (<>
          <div className="prop-row prop-row--stacked">
            <span className="prop-label">Dropdown Options:</span>
            <input
              className="prop-input"
              type="text"
              value={data.dropdownOptions || ''}
              placeholder="option1, option2, option3"
              onChange={(e) => {
                const dropdownOptions = e.target.value;
                const opts = dropdownOptions.split(',').map(o => o.trim()).filter(Boolean);
                update({
                  dropdownOptions,
                  selectedOption: opts.includes(data.selectedOption) ? data.selectedOption : (opts[0] || ''),
                });
              }}
              onMouseDown={stop}
            />
          </div>
          <div className="prop-row">
            <span className="prop-label">Dropdown:</span>
            <select
              className="prop-input"
              value={data.selectedOption || ''}
              onChange={(e) => update({ selectedOption: e.target.value })}
              onMouseDown={stop}
              disabled={parsedOptions.length === 0}
            >
              {parsedOptions.length === 0
                ? <option value="">—</option>
                : parsedOptions.map(o => <option key={o} value={o}>{o}</option>)
              }
            </select>
          </div>
          <div className="prop-row">
            <span className="prop-label">Value:</span>
            <span className="prop-value-label">{data.selectedOption || '—'}</span>
          </div>
        </>)}

        {data.propertyType === 'Slider' && (<>
          <div className="prop-row prop-row--stacked">
            <span className="prop-label">Slider Values:</span>
            <div className="prop-minmax">
              <span className="prop-sublabel">Min:</span>
              <input
                type="number"
                className="prop-input prop-input--mini"
                value={data.min ?? 0}
                onChange={(e) => {
                  const min = parseInt(e.target.value, 10) || 0;
                  update({ min, sliderValue: Math.max(min, Math.min(safeMax, sliderValue)) });
                }}
                onMouseDown={stop}
              />
              <span className="prop-sublabel">Max:</span>
              <input
                type="number"
                className="prop-input prop-input--mini"
                value={data.max ?? 100}
                onChange={(e) => {
                  const max = parseInt(e.target.value, 10) || 0;
                  update({ max, sliderValue: Math.min(max, Math.max(safeMin, sliderValue)) });
                }}
                onMouseDown={stop}
              />
            </div>
          </div>
          <div className="prop-row">
            <span className="prop-label">Slider:</span>
            <input
              type="range"
              className="prop-slider nodrag"
              min={safeMin}
              max={safeMax}
              step={1}
              value={sliderValue}
              onChange={(e) => update({ sliderValue: parseInt(e.target.value, 10) })}
              onMouseDown={stop}
              onPointerDown={stop}
            />
          </div>
          <div className="prop-row">
            <span className="prop-label">Value:</span>
            <span className="prop-value-label">{sliderValue}</span>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({ node, onSave, onClose }) {
  const isNote = node.type === 'noteNode';

  const [label,    setLabel]    = React.useState(node.data.label);
  const [noteText, setNoteText] = React.useState(node.data.noteText ?? '');
  const [nodeType, setNodeType] = React.useState(node.data.nodeType ?? 'action');
  const [pinsIn,   setPinsIn]   = React.useState(node.data.pinsIn  ?? 1);
  const [pinsOut,  setPinsOut]  = React.useState(node.data.pinsOut ?? 1);

  React.useEffect(() => {
    if (isNote || nodeType === 'group') return;
    const inferred = inferNodeType(pinsIn, pinsOut);
    if (inferred) setNodeType(inferred);
  }, [pinsIn, pinsOut, isNote]);

  const handleSave = () => {
    if (isNote) {
      onSave({ ...node, data: { ...node.data, label, noteText } });
    } else {
      onSave({ ...node, data: { ...node.data, label, nodeType, icon: NODE_ICONS[nodeType], pinsIn, pinsOut } });
    }
  };

  return ReactDOM.createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{isNote ? 'Edit Note' : 'Edit Node'}</span>
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

          {isNote ? (
            <div className="modal-field">
              <label className="modal-label">Note</label>
              <textarea
                className="modal-input note-modal-textarea"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={6}
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>
          ) : (
            <>
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
            </>
          )}
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
  { initialNodes, initialEdges, isNested, onEnterNode, onExitLevel, onDirty, onSaveAsTemplate },
  ref
) {
  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const clipboardRef = React.useRef(null);
  const [editingNode, setEditingNode] = React.useState(null);

  const nodesRef = React.useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = React.useRef(edges);
  edgesRef.current = edges;

  React.useImperativeHandle(ref, () => ({
    addNode: (data) => {
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const position = findFreePosition(nodesRef.current, computeNodeWidth(data.label), computeNodeHeight(data.pinsIn, data.pinsOut), center.x, center.y);
      const inferred = inferNodeType(data.pinsIn, data.pinsOut);
      const nodeData = inferred ? { ...data, nodeType: inferred, icon: NODE_ICONS[inferred] } : data;
      setNodes((nds) => [
        ...nds,
        { id: crypto.randomUUID(), type: 'flowNode', position, data: nodeData },
      ]);
    },
    cookNode: (nodeId) => {
      const duration  = 2500;
      const startTime = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        setNodes((nds) => {
          if (!nds.some((n) => n.id === nodeId)) return nds;
          return nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, _cookProgress: progress } } : n);
        });
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          setNodes((nds) => nds.filter((n) => n.id !== nodeId));
          setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
          onDirty?.();
        }
      };
      requestAnimationFrame(tick);
    },
    addNote: ({ label, noteText } = {}) => {
      const center   = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const position = findFreePosition(nodesRef.current, NOTE_NODE_WIDTH, NOTE_NODE_HEIGHT, center.x, center.y);
      setNodes((nds) => [
        ...nds,
        { id: crypto.randomUUID(), type: 'noteNode', position, data: { label: label || 'note', noteText: noteText || '', pinsIn: 1, pinsOut: 1 } },
      ]);
    },
    addShape: (shapeType) => {
      const center   = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const sw       = shapeType === 'circle' ? 180 : 240;
      const sh       = shapeType === 'circle' ? 180 : 160;
      const position = findFreePosition(nodesRef.current, sw, sh, center.x, center.y);
      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        {
          id:       crypto.randomUUID(),
          type:     'shapeNode',
          position,
          selected: true,
          style:    { width: sw, height: sh },
          data:     { shapeType, shapeWidth: sw, shapeHeight: sh },
        },
      ]);
      onDirty?.();
    },
    getState: () => ({
      nodes: nodesRef.current,
      edges: edgesRef.current,
    }),
    fitView: () => fitView({ padding: 0.15, duration: 300 }),
    zoomToNode: (nodeId) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return false;
      fitView({ nodes: [{ id: nodeId }], padding: 0.4, duration: 300 });
      return true;
    },
    copyNode: (nodeId) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return false;
      clipboardRef.current = node;
      return true;
    },
    pasteNode: () => {
      const src = clipboardRef.current;
      if (!src) return false;
      const copy = instantiateTemplateNode(src);
      const { w, h } = getNodeSize(src);
      copy.position = findFreePosition(nodesRef.current, w, h, src.position.x + 40, src.position.y + 40);
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...copy, selected: true }]);
      onDirty?.();
      return true;
    },
    duplicateNode: (nodeId) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return false;
      clipboardRef.current = node;
      const copy = instantiateTemplateNode(node);
      const { w, h } = getNodeSize(node);
      copy.position = findFreePosition(nodesRef.current, w, h, node.position.x + 40, node.position.y + 40);
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...copy, selected: true }]);
      onDirty?.();
      return true;
    },
    addFromTemplate: (templateNode) => {
      const node     = instantiateTemplateNode(templateNode);
      const center   = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const w        = computeNodeWidth(node.data.label);
      const h        = computeNodeHeight(node.data.pinsIn ?? 1, node.data.pinsOut ?? 1);
      node.position  = findFreePosition(nodesRef.current, w, h, center.x, center.y);
      setNodes((nds) => [...nds, node]);
    },
    executeCommand: (cmd) => {
      const byName = (name) =>
        nodesRef.current.find(n => n.type === 'flowNode' && n.data?.label === name);

      if (cmd.command === 'deleteNode') {
        const t = byName(cmd.name);
        if (!t) return;
        setNodes(nds => nds.filter(n => n.id !== t.id));
        setEdges(eds => eds.filter(e => e.source !== t.id && e.target !== t.id));
      }

      else if (cmd.command === 'addPins') {
        const t = byName(cmd.name);
        if (!t) return;
        setNodes(nds => nds.map(n => {
          if (n.id !== t.id) return n;
          const newIn  = (n.data.pinsIn  ?? 0) + cmd.pinsIn;
          const newOut = (n.data.pinsOut ?? 0) + cmd.pinsOut;
          const inferred = n.data.nodeType !== 'group' ? inferNodeType(newIn, newOut) : null;
          return {
            ...n, data: {
              ...n.data,
              pinsIn:   newIn,
              pinsOut:  newOut,
              nodeType: inferred ?? n.data.nodeType,
              icon:     inferred ? NODE_ICONS[inferred] : n.data.icon,
            },
          };
        }));
      }

      else if (cmd.command === 'addProperty') {
        const t = byName(cmd.name);
        if (!t) return;
        const existingProps = (t.data.innerNodes ?? []).filter(n => n.type === 'propertyNode');
        const newProp = {
          id:       crypto.randomUUID(),
          type:     'propertyNode',
          position: { x: 200, y: 20 + existingProps.length * 140 },
          data:     { propertyType: 'Checkbox', name: '', checked: false },
        };
        setNodes(nds => nds.map(n => n.id !== t.id ? n : {
          ...n, data: {
            ...n.data,
            innerNodes:    [...(n.data.innerNodes ?? []), newProp],
            hasProperties: true,
          },
        }));
      }

      else if (cmd.command === 'changeType') {
        const VALID = ['action', 'condition', 'data', 'event'];
        if (!VALID.includes(cmd.nodeType)) return;
        const t = byName(cmd.name);
        if (!t || t.data.nodeType === 'group') return;
        setNodes(nds => nds.map(n => n.id !== t.id ? n : {
          ...n, data: { ...n.data, nodeType: cmd.nodeType, icon: NODE_ICONS[cmd.nodeType] },
        }));
      }

      else if (cmd.command === 'renameNode') {
        const t = byName(cmd.name);
        if (!t) return;
        setNodes(nds => nds.map(n => n.id !== t.id ? n : {
          ...n, data: { ...n.data, label: cmd.newName },
        }));
      }
    },
  }), [screenToFlowPosition, fitView, setNodes, setEdges]);

  const onDeleteNode = React.useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
  }, [setNodes]);

  const onEditNode = React.useCallback((nodeId) => {
    setEditingNode(nodesRef.current.find((n) => n.id === nodeId) ?? null);
  }, []);

  const onAddPins = React.useCallback((nodeId) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const newIn  = (n.data.pinsIn  ?? 1) + 1;
      const newOut = (n.data.pinsOut ?? 1) + 1;
      const inferred = n.data.nodeType !== 'group' ? inferNodeType(newIn, newOut) : null;
      return {
        ...n, data: {
          ...n.data,
          pinsIn:   newIn,
          pinsOut:  newOut,
          nodeType: inferred ?? n.data.nodeType,
          icon:     inferred ? NODE_ICONS[inferred] : n.data.icon,
        },
      };
    }));
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

  const onChangePropertyType = React.useCallback((nodeId, propertyType) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const base = { propertyType, name: n.data.name || '' };
      if (propertyType === 'Checkbox')
        return { ...n, data: { ...base, checked: false } };
      if (propertyType === 'Dropdown')
        return { ...n, data: { ...base, dropdownOptions: '', selectedOption: '' } };
      if (propertyType === 'Slider')
        return { ...n, data: { ...base, min: 0, max: 100, sliderValue: 0 } };
      return { ...n, data: { ...n.data, propertyType } };
    }));
  }, [setNodes]);

  const onUpdatePropertyData = React.useCallback((nodeId, updates) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ));
  }, [setNodes]);

  const onUpdateNote = React.useCallback((nodeId, noteText) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, noteText } } : n));
    onDirty?.();
  }, [setNodes, onDirty]);

  const nodeTypes = React.useMemo(() => ({
    flowNode: (props) => (
      <FlowNode
        {...props}
        onDeleteNode={onDeleteNode}
        onEditNode={onEditNode}
        onAddPins={onAddPins}
        onRenamePinName={onRenamePinName}
        onEnterNode={handleEnterNode}
        onSaveAsTemplate={(nodeId) => {
          const node = nodesRef.current.find((n) => n.id === nodeId);
          if (node) onSaveAsTemplate?.(node);
        }}
        onDuplicateNode={(nodeId) => {
          const node = nodesRef.current.find((n) => n.id === nodeId);
          if (!node) return;
          clipboardRef.current = node;
          const copy = instantiateTemplateNode(node);
          const { w, h } = getNodeSize(node);
          copy.position = findFreePosition(nodesRef.current, w, h, node.position.x + 40, node.position.y + 40);
          setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...copy, selected: true }]);
          onDirty?.();
        }}
      />
    ),
    noteNode: (props) => (
      <NoteNode
        {...props}
        onDeleteNode={onDeleteNode}
        onEditNode={onEditNode}
        onDuplicateNode={(nodeId) => {
          const node = nodesRef.current.find((n) => n.id === nodeId);
          if (!node) return;
          clipboardRef.current = node;
          const copy = instantiateTemplateNode(node);
          copy.position = findFreePosition(nodesRef.current, NOTE_NODE_WIDTH, NOTE_NODE_HEIGHT, node.position.x + 40, node.position.y + 40);
          setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...copy, selected: true }]);
          onDirty?.();
        }}
        onUpdateNote={onUpdateNote}
      />
    ),
    shapeNode: (props) => <ShapeNode {...props} />,
    pinGateway: PinGatewayNode,
    propertyNode: (props) => (
      <PropertyNode
        {...props}
        onDeleteProperty={onDeleteNode}
        onChangePropertyType={onChangePropertyType}
        onUpdatePropertyData={onUpdatePropertyData}
      />
    ),
  }), [onDeleteNode, onEditNode, onAddPins, onRenamePinName, handleEnterNode, onChangePropertyType, onUpdatePropertyData, onUpdateNote]);

  const onSaveEdit = (updatedNode) => {
    if (updatedNode.type === 'noteNode') {
      setNodes((nds) => nds.map((n) => n.id === updatedNode.id ? updatedNode : n));
      setEditingNode(null);
      onDirty?.();
      return;
    }
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
    onDirty?.();
  };

  const addNode = () => {
    const label = 'new node';
    const pinsIn = 1, pinsOut = 1;
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const position = findFreePosition(nodesRef.current, computeNodeWidth(label), computeNodeHeight(pinsIn, pinsOut), center.x, center.y);
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

  const addNote = () => {
    const center   = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const position = findFreePosition(nodesRef.current, NOTE_NODE_WIDTH, NOTE_NODE_HEIGHT, center.x, center.y);
    setNodes((nds) => [
      ...nds,
      { id: crypto.randomUUID(), type: 'noteNode', position, data: { label: 'note', noteText: '', pinsIn: 1, pinsOut: 1 } },
    ]);
  };

  const addProperty = () => {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const position = findFreePosition(nodesRef.current, 215, 120, center.x, center.y);
    setNodes((nds) => [
      ...nds,
      { id: crypto.randomUUID(), type: 'propertyNode', position, data: { propertyType: 'Checkbox', name: '', checked: false } },
    ]);
  };

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if (!isInput && (e.key === 'Delete' || e.key === 'Backspace')) {
        const deletedIds = new Set(
          nodesRef.current
            .filter((n) => n.selected && !n.id.startsWith('__gateway_'))
            .map((n) => n.id)
        );
        if (deletedIds.size > 0) {
          setNodes((nds) => nds.filter((n) => !deletedIds.has(n.id)));
          setEdges((eds) => eds.filter((edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target)));
          onDirty?.();
        }
        setEdges((eds) => eds.filter((edge) => !edge.selected));
      }

      if (!isInput && e.ctrlKey && e.key === 'c') {
        const selected = nodesRef.current.find((n) => (n.type === 'flowNode' || n.type === 'noteNode') && n.selected);
        if (selected) { clipboardRef.current = selected; e.preventDefault(); }
      }

      if (!isInput && e.ctrlKey && e.key === 'v') {
        const src = clipboardRef.current;
        if (src) {
          e.preventDefault();
          const copy = instantiateTemplateNode(src);
          const w    = computeNodeWidth(copy.data.label);
          const h    = computeNodeHeight(copy.data.pinsIn ?? 1, copy.data.pinsOut ?? 1);
          copy.position = findFreePosition(nodesRef.current, w, h, src.position.x + 40, src.position.y + 40);
          setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...copy, selected: true }]);
          onDirty?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setEdges, setNodes, onDirty]);

  const DIRTY_NODE_TYPES = new Set(['add', 'remove', 'reset', 'position']);
  const DIRTY_EDGE_TYPES = new Set(['add', 'remove', 'reset']);

  const onNodesChangeWrapped = (changes) => {
    if (changes.some((c) => DIRTY_NODE_TYPES.has(c.type))) onDirty?.();
    setNodes((nds) => applyNodeChanges(changes, nds));
  };
  const onEdgesChangeWrapped = (changes) => {
    if (changes.some((c) => DIRTY_EDGE_TYPES.has(c.type))) onDirty?.();
    setEdges((eds) => applyEdgeChanges(changes, eds));
  };
  const onConnect = (connection) => {
    onDirty?.();
    setEdges((eds) => addEdge(connection, eds));
  };

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
        deleteKeyCode={null}
        defaultEdgeOptions={{ type: 'default' }}
        onNodesChange={onNodesChangeWrapped}
        onEdgesChange={onEdgesChangeWrapped}
        onConnect={onConnect}
      >
        <Panel position="top-left">
          <div className="toolbar">
            <button className="toolbar-btn" onClick={addNode}>+ Node</button>
            <button className="toolbar-btn toolbar-btn--note" onClick={addNote}>+ Note</button>
            {isNested && (
              <button className="toolbar-btn toolbar-btn--property" onClick={addProperty}>+ Property</button>
            )}
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
