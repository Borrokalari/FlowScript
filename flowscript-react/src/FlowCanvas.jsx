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
const FW_NODE_WIDTH    = 370;
const FW_NODE_HEIGHT   = 245;

// ─── Frame Walker node descriptions (loaded from public JSON) ────────────────

let _fwDescriptions = {};
fetch('/frame_node_descriptions.json')
  .then(r => r.json())
  .then(d => { _fwDescriptions = d; })
  .catch(() => {});

const FW_TOOLTIP_WIDTH = 270;

function FWTooltip({ anchorRef, label }) {
  const [style, setStyle] = React.useState({});

  React.useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    const left = spaceRight >= FW_TOOLTIP_WIDTH + 16
      ? rect.right + 10
      : rect.left - FW_TOOLTIP_WIDTH - 10;
    setStyle({ position: 'fixed', top: rect.top, left, width: FW_TOOLTIP_WIDTH });
  }, [anchorRef]);

  const text = _fwDescriptions[label] ?? 'No description available.';

  return ReactDOM.createPortal(
    <div className="fw-tooltip" style={style}>
      <div className="fw-tooltip-title">{label}</div>
      {text.split('\n').map((line, i) => (
        <p key={i} className="fw-tooltip-line">{line}</p>
      ))}
    </div>,
    document.body
  );
}

// ─── Frame Walker palette nodes ───────────────────────────────────────────────

export const FRAME_NODES = [
  'Group',
  'EngineBlock', 'Battery', 'MechanicalPump', 'AirFilter', 'AirBreather',
  'Leg Actuator', 'Inventory Container', 'Capacitor Bank', 'Heat Sink', 'Radiator',
  'Thermal Buffer', 'Shield Capacitor', 'Point Defense Turret', 'Chaff Dispenser',
  'Hydraulic Booster', 'Gyro Stabilizer', 'Radar Array', 'Thermal Sensor',
  'LIDAR Scanner', 'Navigation Core', 'Comms Transceiver', 'Repair Nanoforge',
  'Anchor Spike', 'Subsystem Overdrive', 'Reinforced Spine', 'Shock Frame',
  'Vernier Boosters', 'Mini Nuclear Power Plant', 'Oxygen Generator',
  'Fuel Tank', 'Coolant Tank',
  'Recoil Dampener', 'Targeting Module', 'Weapon Cooling Jacket',
  'Charge Regulator', 'RailGun Core', 'HeavyRifle Core', 'AutomaticRifle Core',
  'LaserBeam Core', 'LaserPulse Core', 'MissileSingle Core', 'MissileBarrage Core',
  'PulseCutter Core', 'Light Barrel', 'Long Barrel', 'Heavy Barrel',
  'Power Distributor',
  'Hand HardPoint', 'Shoulder HardPoint', 'Forearm Hardpoint', 'Backpack Hardpoint',
  'Torso Mechanical Hardpoint', 'Waist Mechanical Hardpoint',
  'L Arm Mechanical Hardpoint', 'R Arm Mechanical Hardpoint',
  'L Leg Mechanical Hardpoint', 'R Leg Mechanical Hardpoint',
  'Head Mechanical Hardpoint', 'Backpack Mechanical Hardpoint',
];

const FW_TYPE_COLORS = {
  Power:      '#c0392b',
  Mechanical: '#2471a3',
  Thermal:    '#1e8449',
  Fluid:      '#17a589',
  Sensor:     '#b7950b',
  Defense:    '#7d3c98',
  Weapon:     '#d35400',
  Utility:    '#6d4c41',
  Hardpoint:  '#5d6d7e',
};

const FW_NODE_TYPE_MAP = {
  // Power
  'Battery': 'Power', 'Capacitor Bank': 'Power', 'Shield Capacitor': 'Power',
  'Mini Nuclear Power Plant': 'Power', 'Charge Regulator': 'Power', 'Power Distributor': 'Power',
  // Mechanical
  'EngineBlock': 'Mechanical', 'Leg Actuator': 'Mechanical', 'Hydraulic Booster': 'Mechanical',
  'Gyro Stabilizer': 'Mechanical', 'Recoil Dampener': 'Mechanical', 'Vernier Boosters': 'Mechanical',
  'Shock Frame': 'Mechanical', 'Reinforced Spine': 'Mechanical',
  // Thermal
  'Heat Sink': 'Thermal', 'Radiator': 'Thermal', 'Thermal Buffer': 'Thermal',
  'Weapon Cooling Jacket': 'Thermal',
  // Fluid
  'MechanicalPump': 'Fluid', 'AirFilter': 'Fluid', 'AirBreather': 'Fluid',
  'Oxygen Generator': 'Fluid', 'Fuel Tank': 'Fluid', 'Coolant Tank': 'Thermal',
  // Sensor
  'Radar Array': 'Sensor', 'Thermal Sensor': 'Sensor', 'LIDAR Scanner': 'Sensor',
  'Navigation Core': 'Sensor', 'Comms Transceiver': 'Sensor', 'Targeting Module': 'Sensor',
  // Defense
  'Point Defense Turret': 'Defense', 'Chaff Dispenser': 'Defense',
  'Anchor Spike': 'Defense', 'Subsystem Overdrive': 'Defense',
  // Weapon
  'RailGun Core': 'Weapon', 'HeavyRifle Core': 'Weapon', 'AutomaticRifle Core': 'Weapon',
  'LaserBeam Core': 'Weapon', 'LaserPulse Core': 'Weapon', 'MissileSingle Core': 'Weapon',
  'MissileBarrage Core': 'Weapon', 'Light Barrel': 'Weapon', 'Long Barrel': 'Weapon',
  'Heavy Barrel': 'Weapon',
  // Utility
  'Inventory Container': 'Utility', 'Repair Nanoforge': 'Utility', 'PulseCutter Core': 'Utility',
  // Hardpoint
  'Hand HardPoint': 'Hardpoint', 'Shoulder HardPoint': 'Hardpoint',
  'Forearm Hardpoint': 'Hardpoint', 'Backpack Hardpoint': 'Hardpoint',
  'Torso Mechanical Hardpoint': 'Hardpoint', 'Waist Mechanical Hardpoint': 'Hardpoint',
  'L Arm Mechanical Hardpoint': 'Hardpoint', 'R Arm Mechanical Hardpoint': 'Hardpoint',
  'L Leg Mechanical Hardpoint': 'Hardpoint', 'R Leg Mechanical Hardpoint': 'Hardpoint',
  'Head Mechanical Hardpoint': 'Hardpoint', 'Backpack Mechanical Hardpoint': 'Hardpoint',
};

const FW_MODIFIER_DISPLAY = {
  thermalModifier:     'Thermal Mod:',
  powerLoadModifier:   'PwrLoad Mod:',
  atmosphericModifier: 'Atm. Mod:',
  signalModifier:      'Signal Mod:',
};

const FW_NODE_MODIFIER_MAP = {
  // thermalModifier  (0.8)
  'Shield Capacitor':         { name: 'thermalModifier',     defaultValue: 0.8 },
  'Mini Nuclear Power Plant': { name: 'thermalModifier',     defaultValue: 0.8 },
  'EngineBlock':              { name: 'thermalModifier',     defaultValue: 0.8 },
  'Vernier Boosters':         { name: 'thermalModifier',     defaultValue: 0.8 },
  'Heat Sink':                { name: 'thermalModifier',     defaultValue: 0.8 },
  'Radiator':                 { name: 'thermalModifier',     defaultValue: 0.8 },
  'Thermal Buffer':           { name: 'thermalModifier',     defaultValue: 0.8 },
  'Weapon Cooling Jacket':    { name: 'thermalModifier',     defaultValue: 0.8 },
  'MechanicalPump':           { name: 'thermalModifier',     defaultValue: 0.8 },
  'Thermal Sensor':           { name: 'thermalModifier',     defaultValue: 0.8 },
  'Targeting Module':         { name: 'thermalModifier',     defaultValue: 0.8 },
  'RailGun Core':             { name: 'thermalModifier',     defaultValue: 0.8 },
  'LaserBeam Core':           { name: 'thermalModifier',     defaultValue: 0.8 },
  'LaserPulse Core':          { name: 'thermalModifier',     defaultValue: 0.8 },
  'PulseCutter Core':         { name: 'thermalModifier',     defaultValue: 0.8 },
  // powerLoadModifier (0.9)
  'Capacitor Bank':           { name: 'powerLoadModifier',   defaultValue: 0.9 },
  'Charge Regulator':         { name: 'powerLoadModifier',   defaultValue: 0.9 },
  'Power Distributor':        { name: 'powerLoadModifier',   defaultValue: 0.9 },
  'Leg Actuator':             { name: 'powerLoadModifier',   defaultValue: 0.9 },
  'Subsystem Overdrive':      { name: 'powerLoadModifier',   defaultValue: 0.9 },
  // atmosphericModifier (0.7)
  'AirBreather':              { name: 'atmosphericModifier', defaultValue: 0.7 },
  // signalModifier (0.9)
  'Radar Array':              { name: 'signalModifier',      defaultValue: 0.9 },
  'Navigation Core':          { name: 'signalModifier',      defaultValue: 0.9 },
  'Comms Transceiver':        { name: 'signalModifier',      defaultValue: 0.9 },
};

const FW_PIN_CONFIG = {
  'Oxygen Generator':      { pinsIn: 0, pinsOut: 1, pinInNames: [],                    pinOutNames: ['Out'] },
  'Radar Array':           { pinsIn: 2, pinsOut: 1, pinInNames: ['In', 'Pwr'],         pinOutNames: ['Out'] },
  'LIDAR Scanner':         { pinsIn: 2, pinsOut: 1, pinInNames: ['In', 'Pwr'],         pinOutNames: ['Out'] },
  'Targeting Module':      { pinsIn: 2, pinsOut: 1, pinInNames: ['In', 'Pwr'],         pinOutNames: ['Out'] },
  'Thermal Sensor':        { pinsIn: 2, pinsOut: 1, pinInNames: ['In', 'Pwr'],         pinOutNames: ['Out'] },
  'Radiator':              { pinsIn: 2, pinsOut: 1, pinInNames: ['In', 'Pwr'],         pinOutNames: ['Out'] },
  'Comms Transceiver':     { pinsIn: 2, pinsOut: 1, pinInNames: ['In', 'Pwr'],         pinOutNames: ['Out'] },
  'Vernier Boosters':      { pinsIn: 2, pinsOut: 0, pinInNames: ['Fuel', 'Pwr'],       pinOutNames: [] },
  'Hydraulic Booster':     { pinsIn: 2, pinsOut: 1, pinInNames: ['Cool', 'Pwr'],       pinOutNames: ['Out'] },
  'EngineBlock':           { pinsIn: 3, pinsOut: 1, pinInNames: ['Air', 'Fuel', 'Cool'], pinOutNames: ['Out'] },
  'Thermal Buffer':        { pinsIn: 2, pinsOut: 1, pinInNames: ['In', 'Cool'],        pinOutNames: ['Out'] },
  'Weapon Cooling Jacket': { pinsIn: 2, pinsOut: 1, pinInNames: ['In', 'Cool'],        pinOutNames: ['Out'] },
  'Subsystem Overdrive':   { pinsIn: 2, pinsOut: 1, pinInNames: ['In', 'Cool'],        pinOutNames: ['Out'] },
  'Power Distributor':     { pinsIn: 1, pinsOut: 1, pinInNames: ['In'],                pinOutNames: ['Out 1'] },
  'Light Barrel':          { pinsIn: 1, pinsOut: 0, pinInNames: ['In'],                pinOutNames: [] },
  'Long Barrel':           { pinsIn: 1, pinsOut: 0, pinInNames: ['In'],                pinOutNames: [] },
  'Heavy Barrel':          { pinsIn: 1, pinsOut: 0, pinInNames: ['In'],                pinOutNames: [] },
  'Fuel Tank':             { pinsIn: 0, pinsOut: 1, pinInNames: [],                         pinOutNames: ['Fuel'] },
  'Coolant Tank':          { pinsIn: 0, pinsOut: 1, pinInNames: [],                         pinOutNames: ['Cool'] },
  'RailGun Core':          { pinsIn: 3, pinsOut: 1, pinInNames: ['In', 'Pwr', 'Ammo'],      pinOutNames: ['Out'] },
  'HeavyRifle Core':       { pinsIn: 2, pinsOut: 1, pinInNames: ['In', 'Ammo'],             pinOutNames: ['Out'] },
  'AutomaticRifle Core':   { pinsIn: 3, pinsOut: 1, pinInNames: ['In', 'Pwr', 'Ammo'],      pinOutNames: ['Out'] },
  'LaserBeam Core':        { pinsIn: 3, pinsOut: 1, pinInNames: ['In', 'Pwr', 'Aux'],       pinOutNames: ['Out'] },
  'LaserPulse Core':       { pinsIn: 3, pinsOut: 1, pinInNames: ['In', 'Pwr', 'Aux'],       pinOutNames: ['Out'] },
  'MissileSingle Core':    { pinsIn: 3, pinsOut: 1, pinInNames: ['In', 'Pwr', 'Ammo'],      pinOutNames: ['Out'] },
  'MissileBarrage Core':   { pinsIn: 3, pinsOut: 1, pinInNames: ['In', 'Pwr', 'Ammo'],      pinOutNames: ['Out'] },
  'PulseCutter Core':               { pinsIn: 3, pinsOut: 1, pinInNames: ['In', 'Pwr', 'Aux'], pinOutNames: ['Out'] },
  'Hand HardPoint':                 { pinsIn: 0, pinsOut: 1, pinInNames: [],                   pinOutNames: ['Out'] },
  'Shoulder HardPoint':             { pinsIn: 0, pinsOut: 1, pinInNames: [],                   pinOutNames: ['Out'] },
  'Forearm Hardpoint':              { pinsIn: 0, pinsOut: 1, pinInNames: [],                   pinOutNames: ['Out'] },
  'Backpack Hardpoint':             { pinsIn: 0, pinsOut: 1, pinInNames: [],                   pinOutNames: ['Out'] },
  'Torso Mechanical Hardpoint':     { pinsIn: 1, pinsOut: 0, pinInNames: ['In'],               pinOutNames: [] },
  'Waist Mechanical Hardpoint':     { pinsIn: 1, pinsOut: 0, pinInNames: ['In'],               pinOutNames: [] },
  'L Arm Mechanical Hardpoint':     { pinsIn: 1, pinsOut: 0, pinInNames: ['In'],               pinOutNames: [] },
  'R Arm Mechanical Hardpoint':     { pinsIn: 1, pinsOut: 0, pinInNames: ['In'],               pinOutNames: [] },
  'L Leg Mechanical Hardpoint':     { pinsIn: 1, pinsOut: 0, pinInNames: ['In'],               pinOutNames: [] },
  'R Leg Mechanical Hardpoint':     { pinsIn: 1, pinsOut: 0, pinInNames: ['In'],               pinOutNames: [] },
  'Head Mechanical Hardpoint':      { pinsIn: 1, pinsOut: 0, pinInNames: ['In'],               pinOutNames: [] },
  'Backpack Mechanical Hardpoint':  { pinsIn: 1, pinsOut: 0, pinInNames: ['In'],               pinOutNames: [] },
};

const FW_PIN_DEFAULT = { pinsIn: 1, pinsOut: 1, pinInNames: ['In'], pinOutNames: ['Out'] };

const FW_BARREL_NODES    = ['Light Barrel', 'Long Barrel', 'Heavy Barrel'];
const FW_TANK_NODES      = ['Fuel Tank', 'Coolant Tank'];
const FW_HARDPOINT_NODES = [
  'Hand HardPoint', 'Shoulder HardPoint', 'Forearm Hardpoint', 'Backpack Hardpoint',
  'Torso Mechanical Hardpoint', 'Waist Mechanical Hardpoint',
  'L Arm Mechanical Hardpoint', 'R Arm Mechanical Hardpoint',
  'L Leg Mechanical Hardpoint', 'R Leg Mechanical Hardpoint',
  'Head Mechanical Hardpoint', 'Backpack Mechanical Hardpoint',
];

const FW_CATEGORY_ORDER = ['Power', 'Mechanical', 'Thermal', 'Fluid', 'Sensor', 'Defense', 'Weapon', 'Utility', 'Hardpoint'];

function buildGroupedNodes() {
  const groups = {};
  for (const name of FRAME_NODES) {
    if (name === 'Group') continue;
    const cat = FW_NODE_TYPE_MAP[name] ?? 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(name);
  }
  const order = [...FW_CATEGORY_ORDER, 'Other'];
  return order.filter((c) => groups[c]).map((c) => ({ category: c, nodes: groups[c] }));
}

const FW_GROUPED_NODES = buildGroupedNodes();

function FramePalette({ onAdd }) {
  const [open,    setOpen]    = React.useState(false);
  const [query,   setQuery]   = React.useState('');
  const [grouped, setGrouped] = React.useState(
    () => localStorage.getItem('fp-grouped') !== 'false'
  );
  const wrapRef               = React.useRef(null);

  const filtered = query.trim()
    ? FRAME_NODES.filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    : FRAME_NODES;

  const showGrouped = grouped && !query.trim();

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const renderItem = (name) => {
    const typeColor = FW_TYPE_COLORS[FW_NODE_TYPE_MAP[name]];
    return (
      <button
        key={name}
        className="fp-item"
        style={typeColor ? { '--fw-type-color': typeColor } : undefined}
        onClick={() => { onAdd(name); setOpen(false); setQuery(''); }}
      >
        {name}
      </button>
    );
  };

  return (
    <div className="fp-wrap nodrag" ref={wrapRef}>
      <button
        className="toolbar-btn fp-btn"
        onClick={() => { setOpen((v) => !v); setQuery(''); }}
      >
        + Node ▾
      </button>
      {open && (
        <div className="fp-panel">
          <div className="fp-panel-header">
            Select Node
            <button
              className={`fp-group-toggle${grouped ? ' fp-group-toggle--active' : ''}`}
              onClick={() => setGrouped((v) => {
                localStorage.setItem('fp-grouped', String(!v));
                return !v;
              })}
              title="Group by category"
            >
              ⊟
            </button>
          </div>
          <input
            className="fp-search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {showGrouped ? (
            <div className="fp-grouped">
              {FW_GROUPED_NODES.map(({ category, nodes: catNodes }) => (
                <div key={category} className="fp-category">
                  <div className="fp-category-header" style={{ '--fw-type-color': FW_TYPE_COLORS[category] }}>
                    {category}
                  </div>
                  <div className="fp-grid fp-grid--nosroll">
                    {catNodes.map(renderItem)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="fp-grid">
              {filtered.length === 0
                ? <div className="fp-empty">No results</div>
                : filtered.map(renderItem)
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getNodeSize(node) {
  if (node.type === 'noteNode')        return { w: NOTE_NODE_WIDTH,  h: NOTE_NODE_HEIGHT };
  if (node.type === 'propertyNode')    return { w: 215, h: 120 };
  if (node.type === 'shapeNode')       return { w: node.data?.shapeWidth ?? 200, h: node.data?.shapeHeight ?? 200 };
  if (node.data?.locked && node.data.nodeType !== 'group') {
    const h = node.data.label === 'Power Distributor'
      ? FW_NODE_HEIGHT + Math.max(0, (node.data.pinsOut ?? 1) - 5) * 30
      : FW_NODE_HEIGHT;
    return { w: FW_NODE_WIDTH, h };
  }
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

// ─── FrameNodeBody ───────────────────────────────────────────────────────────

const FW_BASE_RATE = 5;

function FrameNodeBody({ id, data, onUpdateNodeData, isDevMode, onAddOutPin, onRemoveOutPin }) {
  const isBarrel     = FW_BARREL_NODES.includes(data.label);
  const isTankNode   = FW_TANK_NODES.includes(data.label);
  const isHardpoint  = FW_HARDPOINT_NODES.includes(data.label);

  if (isHardpoint) {
    const active   = data.fwActive   ?? true;
    const flowRate = data.fwFlowRate ?? null;
    return (
      <div className="fw-node-body nodrag" onMouseDown={(e) => e.stopPropagation()}>
        <div className="fw-props-header">
          {data.label} Properties
          {data.fwNodeType && (
            <span className="fw-type-badge" style={{ '--fw-type-color': FW_TYPE_COLORS[data.fwNodeType] }}>
              {data.fwNodeType}
            </span>
          )}
          {isDevMode && <span className="fw-dev-badge">DEV</span>}
        </div>
        <div className="fw-props-content">
          <div className="fw-props-left">
            <div className="fw-prop-row">
              <span className="fw-prop-label">Active?</span>
              <input type="checkbox" className="fw-prop-checkbox" checked={active}
                onChange={(e) => onUpdateNodeData(id, { fwActive: e.target.checked })} />
            </div>
            {isDevMode && (
              <div className="fw-prop-row">
                <span className="fw-prop-label">Flow Rate:</span>
                <input type="number" className="fw-prop-text-input fw-prop-factor-input"
                  placeholder="∞" value={flowRate ?? ''} min={0} step={1}
                  onChange={(e) => {
                    const raw = e.target.value;
                    onUpdateNodeData(id, { fwFlowRate: raw === '' ? null : (parseFloat(raw) || null) });
                  }} />
                <span className="fw-prop-factor-hint">{flowRate === null ? 'Unlimited' : 'u/s'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isBarrel || isTankNode) {
    const active    = data.fwActive   ?? true;
    const health    = data.fwHealth   ?? 100;
    const quantity  = data.fwQuantity ?? 100;
    const flowRate  = data.fwFlowRate ?? null;
    return (
      <div className="fw-node-body nodrag" onMouseDown={(e) => e.stopPropagation()}>
        <div className="fw-props-header">
          {data.label} Properties
          {data.fwNodeType && (
            <span className="fw-type-badge" style={{ '--fw-type-color': FW_TYPE_COLORS[data.fwNodeType] }}>
              {data.fwNodeType}
            </span>
          )}
          {isDevMode && <span className="fw-dev-badge">DEV</span>}
        </div>
        <div className="fw-props-content">
          <div className="fw-props-left">
            <div className="fw-prop-row">
              <span className="fw-prop-label">Active?</span>
              <input type="checkbox" className="fw-prop-checkbox" checked={active}
                onChange={(e) => onUpdateNodeData(id, { fwActive: e.target.checked })} />
            </div>
            {isTankNode && (
              <div className="fw-prop-row">
                <span className="fw-prop-label">Quantity:</span>
                {isDevMode ? (
                  <>
                    <input type="number" className="fw-prop-text-input fw-prop-factor-input"
                      value={quantity} min={0} max={100} step={1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) onUpdateNodeData(id, { fwQuantity: Math.min(100, Math.max(0, val)) });
                      }} />
                    <span className="fw-prop-factor-hint">%</span>
                  </>
                ) : (
                  <input type="text" className="fw-prop-text-input" value={`${quantity}%`} readOnly disabled />
                )}
              </div>
            )}
            {isDevMode && (
              <div className="fw-prop-row">
                <span className="fw-prop-label">Flow Rate:</span>
                <input type="number" className="fw-prop-text-input fw-prop-factor-input"
                  placeholder="∞" value={flowRate ?? ''} min={0} step={1}
                  onChange={(e) => {
                    const raw = e.target.value;
                    onUpdateNodeData(id, { fwFlowRate: raw === '' ? null : (parseFloat(raw) || null) });
                  }} />
                <span className="fw-prop-factor-hint">{flowRate === null ? 'Unlimited' : 'u/s'}</span>
              </div>
            )}
          </div>
          <div className="fw-props-divider" />
          <div className="fw-props-right">
            <div className="fw-prop-row">
              <span className="fw-prop-label">Health:</span>
              {isDevMode ? (
                <input type="number" className="fw-prop-text-input fw-prop-factor-input"
                  value={health} min={0} max={100} step={1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) onUpdateNodeData(id, { fwHealth: Math.min(100, Math.max(0, val)) });
                  }} />
              ) : (
                <input type="text" className="fw-prop-text-input" value={`${health}%`} readOnly disabled />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const active         = data.fwActive         ?? true;
  const efficiency     = data.fwEfficiency     ?? 100;
  const health         = data.fwHealth         ?? 100;
  const inputFactor    = data.fwInputFactor    ?? 1.0;
  const baseRate       = data.fwBaseRate       ?? FW_BASE_RATE;
  const modifierValue  = data.fwModifierValue  ?? 1.0;

  const isPowerDist    = data.label === 'Power Distributor';
  const pinsOut        = data.pinsOut ?? 1;
  const overloadPins   = isPowerDist ? Math.max(0, pinsOut - 5) : 0;
  const overloadPenalty = overloadPins * 10;
  const effectiveEfficiency = isPowerDist ? Math.max(0, efficiency - overloadPenalty) : efficiency;

  const efficiencyMultiplier = effectiveEfficiency / 100;
  const damageMultiplier     = health / 100;
  const activeMultiplier     = active ? 1 : 0;

  const outputRate = baseRate * efficiencyMultiplier * damageMultiplier * activeMultiplier * modifierValue;
  const inputRate  = outputRate * inputFactor;

  const handleFactorChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) onUpdateNodeData(id, { fwInputFactor: Math.min(1, Math.max(0, val)) });
  };

  const handleHealthChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) onUpdateNodeData(id, { fwHealth: Math.min(100, Math.max(0, val)) });
  };

  const handleBaseRateChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) onUpdateNodeData(id, { fwBaseRate: val });
  };

  const handleModifierChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) onUpdateNodeData(id, { fwModifierValue: val });
  };

  return (
    <div className="fw-node-body nodrag" onMouseDown={(e) => e.stopPropagation()}>
      <div className="fw-props-header">
        {data.label} Properties
        {data.fwNodeType && (
          <span
            className="fw-type-badge"
            style={{ '--fw-type-color': FW_TYPE_COLORS[data.fwNodeType] }}
          >
            {data.fwNodeType}
          </span>
        )}
        {isDevMode && <span className="fw-dev-badge">DEV</span>}
      </div>
      <div className="fw-props-content">
        <div className="fw-props-left">
          <div className="fw-prop-row">
            <span className="fw-prop-label">Active?</span>
            <input
              type="checkbox"
              className="fw-prop-checkbox"
              checked={active}
              onChange={(e) => onUpdateNodeData(id, { fwActive: e.target.checked })}
            />
          </div>
          <div className="fw-prop-row fw-prop-row--slider">
            <span className="fw-prop-label">Efficiency:</span>
            <div className="fw-prop-slider-wrap">
              <input
                type="range"
                className="fw-prop-slider"
                min={0}
                max={200}
                value={efficiency}
                onChange={(e) => onUpdateNodeData(id, { fwEfficiency: Number(e.target.value) })}
              />
              <span className="fw-prop-slider-val">{efficiency}%</span>
            </div>
          </div>
          {isDevMode && (
            <div className="fw-prop-row">
              <span className="fw-prop-label">In. Factor:</span>
              <input
                type="number"
                className="fw-prop-text-input fw-prop-factor-input"
                value={inputFactor}
                min={0}
                max={1}
                step={0.1}
                onChange={handleFactorChange}
              />
              <span className="fw-prop-factor-hint">≤ 1.0</span>
            </div>
          )}
          {isDevMode && (
            <div className="fw-prop-row">
              <span className="fw-prop-label">Base Rate:</span>
              <input
                type="number"
                className="fw-prop-text-input fw-prop-factor-input"
                value={baseRate}
                min={0}
                step={0.5}
                onChange={handleBaseRateChange}
              />
              <span className="fw-prop-factor-hint">u/s</span>
            </div>
          )}
        </div>
        <div className="fw-props-divider" />
        <div className="fw-props-right">
          <div className="fw-prop-row">
            <span className="fw-prop-label">Health:</span>
            {isDevMode ? (
              <input
                type="number"
                className="fw-prop-text-input fw-prop-factor-input"
                value={health}
                min={0}
                max={100}
                step={1}
                onChange={handleHealthChange}
              />
            ) : (
              <input
                type="text"
                className="fw-prop-text-input"
                value={`${health}%`}
                readOnly
                disabled
              />
            )}
          </div>
          {isDevMode && data.fwModifierName && (
            <div className="fw-prop-row">
              <span className="fw-prop-label">{FW_MODIFIER_DISPLAY[data.fwModifierName]}</span>
              <input
                type="number"
                className="fw-prop-text-input fw-prop-factor-input"
                value={modifierValue}
                min={0}
                max={2}
                step={0.05}
                onChange={handleModifierChange}
              />
            </div>
          )}
          {overloadPins > 0 && (
            <div className="fw-prop-row fw-prop-row--overload">
              <span className="fw-prop-overload">Overload: −{overloadPenalty}%</span>
            </div>
          )}
          <div className="fw-prop-row">
            <span className="fw-prop-label">Input Rate:</span>
            <span className="fw-prop-value">{inputRate.toFixed(2)} u/s</span>
          </div>
          <div className="fw-prop-row">
            <span className="fw-prop-label">Output Rate:</span>
            <span className="fw-prop-value">{outputRate.toFixed(2)} u/s</span>
          </div>
        </div>
      </div>
      {isPowerDist && (
        <div className="fw-add-out-row">
          <button className="fw-add-out-btn" onClick={() => onAddOutPin?.(id)}>＋ Out</button>
          <button className="fw-add-out-btn fw-add-out-btn--remove" onClick={() => onRemoveOutPin?.(id)} disabled={pinsOut <= 1}>－ Out</button>
          <span className="fw-add-out-hint">{pinsOut} output{pinsOut !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

// ─── FlowNode ────────────────────────────────────────────────────────────────

function FlowNode({ id, data, dragging, onDeleteNode, onEditNode, onAddPins, onRenamePinName, onEnterNode, onSaveAsTemplate, onDuplicateNode, onUpdateNodeData, isDevMode, onAddOutPin, onRemoveOutPin }) {
  const [menuOpen,      setMenuOpen]      = React.useState(false);
  const [editingPin,    setEditingPin]    = React.useState(null);
  const [tooltipVisible, setTooltipVisible] = React.useState(false);
  const menuRef        = React.useRef(null);
  const headerRef      = React.useRef(null);
  const tooltipTimer   = React.useRef(null);
  const updateNodeInternals = useUpdateNodeInternals();

  const handleHeaderEnter = React.useCallback(() => {
    tooltipTimer.current = setTimeout(() => setTooltipVisible(true), 700);
  }, []);
  const handleHeaderLeave = React.useCallback(() => {
    clearTimeout(tooltipTimer.current);
    setTooltipVisible(false);
  }, []);

  React.useEffect(() => {
    if (dragging) {
      clearTimeout(tooltipTimer.current);
      setTooltipVisible(false);
    }
  }, [dragging]);

  const isLocked          = !!data.locked;
  const isLockedComponent = isLocked && data.nodeType !== 'group';
  const pinsIn  = data.pinsIn  ?? 1;
  const pinsOut = data.pinsOut ?? 1;
  const height  = isLockedComponent
    ? FW_NODE_HEIGHT + (data.label === 'Power Distributor' ? Math.max(0, pinsOut - 5) * 30 : 0)
    : computeNodeHeight(pinsIn, pinsOut);
  const width   = isLockedComponent ? FW_NODE_WIDTH  : computeNodeWidth(data.label);

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
    <div
      className={`flow-node${isLocked ? ' flow-node--locked' : ''}`}
      style={{
        width,
        height,
        filter: data._cookProgress > 0 ? `sepia(${Math.min(data._cookProgress * 2, 1)}) brightness(${1 - data._cookProgress})` : undefined,
        transform: data._babyProgress !== undefined ? `scale(${(0.05 + 0.95 * data._babyProgress).toFixed(3)})` : undefined,
        transformOrigin: 'center center',
        ...(isLockedComponent && data.fwNodeType ? { '--fw-type-color': FW_TYPE_COLORS[data.fwNodeType] } : {}),
      }}
      data-drag-handle
    >
      <div
        ref={isLockedComponent ? headerRef : undefined}
        className={`flow-node-header${isLockedComponent ? ' flow-node-header--locked' : ''}`}
        onDoubleClick={isLockedComponent ? undefined : (e) => { e.stopPropagation(); onEnterNode(id); }}
        onMouseEnter={isLockedComponent ? handleHeaderEnter : undefined}
        onMouseLeave={isLockedComponent ? handleHeaderLeave : undefined}
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
              {!isLocked && (
                <button
                  className="flow-node-dropdown-item"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => { onAddPins(id); setMenuOpen(false); }}
                >
                  Add Pins
                </button>
              )}
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
        {isLockedComponent
          ? <FrameNodeBody id={id} data={data} onUpdateNodeData={onUpdateNodeData} isDevMode={isDevMode} onAddOutPin={onAddOutPin} onRemoveOutPin={onRemoveOutPin} />
          : <>
              <div className="flow-node-icon" style={{ backgroundImage: `url(${data.icon})` }} />
              {data.hasProperties && <div className="flow-node-property-dot" />}
            </>
        }
      </div>

      {isLockedComponent && tooltipVisible && <FWTooltip anchorRef={headerRef} label={data.label} />}

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

function ShapeNode({ id, data, selected, onPushUndo }) {
  const { setNodes, getNode, getViewport } = useReactFlow();
  const w = data.shapeWidth  ?? 200;
  const h = data.shapeHeight ?? 200;
  const isCircle = data.shapeType === 'circle';

  const startResize = React.useCallback((e, dir) => {
    e.stopPropagation();
    e.preventDefault();
    onPushUndo?.();

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

  const SW = 8;
  const HS = 10;
  const hBase = {
    position: 'absolute',
    width: HS,
    height: HS,
    background: '#e0e0e0',
    border: '1.5px solid #666',
    borderRadius: 2,
    zIndex: 10,
    pointerEvents: 'all',
  };

  return (
    <div className="shape-node-root" style={{ width: w, height: h, position: 'relative' }}>
      <svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
        {isCircle ? (
          <circle
            cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - SW / 2}
            fill="none" strokeWidth={SW}
            style={{ stroke: 'var(--node-header-bg, #6ba7a6)', pointerEvents: 'stroke', cursor: 'move' }}
          />
        ) : (
          <rect
            x={SW / 2} y={SW / 2} width={w - SW} height={h - SW}
            fill="none" strokeWidth={SW}
            style={{ stroke: 'var(--node-header-bg, #6ba7a6)', pointerEvents: 'stroke', cursor: 'move' }}
          />
        )}
      </svg>

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
  const isNote      = node.type === 'noteNode';
  const isGroup     = node.data?.nodeType === 'group';
  const isLocked    = !!node.data?.locked && !isGroup;

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
              className={`modal-input${isLocked ? ' modal-input--locked' : ''}`}
              value={label}
              onChange={isLocked ? undefined : (e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              readOnly={isLocked}
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
  { initialNodes, initialEdges, isNested, isFrame, isDevMode, onEnterNode, onExitLevel, onDirty, onSaveAsTemplate, onUndoChange },
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

  const undoStack          = React.useRef([]);
  const redoStack          = React.useRef([]);
  const dragStartSnapshot  = React.useRef(null);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);
  const onUndoChangeRef = React.useRef(onUndoChange);
  onUndoChangeRef.current = onUndoChange;

  React.useEffect(() => {
    onUndoChangeRef.current?.(canUndo, canRedo);
  }, [canUndo, canRedo]);

  const pushUndo = React.useCallback(() => {
    undoStack.current = [...undoStack.current, { nodes: nodesRef.current, edges: edgesRef.current }].slice(-50);
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = React.useCallback(() => {
    if (!undoStack.current.length) return;
    const snapshot = undoStack.current[undoStack.current.length - 1];
    redoStack.current = [{ nodes: nodesRef.current, edges: edgesRef.current }, ...redoStack.current].slice(0, 50);
    undoStack.current = undoStack.current.slice(0, -1);
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    onDirty?.();
  }, [setNodes, setEdges, onDirty]);

  const redo = React.useCallback(() => {
    if (!redoStack.current.length) return;
    const snapshot = redoStack.current[0];
    undoStack.current = [...undoStack.current, { nodes: nodesRef.current, edges: edgesRef.current }];
    redoStack.current = redoStack.current.slice(1);
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    onDirty?.();
  }, [setNodes, setEdges, onDirty]);

  React.useImperativeHandle(ref, () => ({
    undo,
    redo,
    addNode: (data) => {
      pushUndo();
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const position = findFreePosition(nodesRef.current, computeNodeWidth(data.label), computeNodeHeight(data.pinsIn, data.pinsOut), center.x, center.y);
      const inferred = inferNodeType(data.pinsIn, data.pinsOut);
      const nodeData = inferred ? { ...data, nodeType: inferred, icon: NODE_ICONS[inferred] } : data;
      setNodes((nds) => [
        ...nds,
        { id: crypto.randomUUID(), type: 'flowNode', position, data: nodeData },
      ]);
    },
    addFrameNode: (label) => addFrameNode(label),
    babyNode: (label, asFrame) => {
      pushUndo();
      const newId  = crypto.randomUUID();
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

      let nodeData, w, h;
      if (asFrame) {
        const isGroup      = label === 'Group';
        const pinCfg       = FW_PIN_CONFIG[label] ?? FW_PIN_DEFAULT;
        const isPowerDist  = label === 'Power Distributor';
        const isBarrelNode    = FW_BARREL_NODES.includes(label);
        const isTankNode      = FW_TANK_NODES.includes(label);
        const isHardpointNode = FW_HARDPOINT_NODES.includes(label);
        const isSimple        = isBarrelNode || isTankNode || isHardpointNode;
        w = isGroup ? computeNodeWidth('Group') : FW_NODE_WIDTH;
        h = isGroup ? computeNodeHeight(1, 1) : isPowerDist
          ? FW_NODE_HEIGHT + Math.max(0, pinCfg.pinsOut - 5) * 30
          : FW_NODE_HEIGHT;
        nodeData = isGroup
          ? { label: 'Group', nodeType: 'group', icon: group_icon, pinsIn: 1, pinsOut: 1, locked: true }
          : {
              label, nodeType: 'action', icon: action_icon, ...pinCfg, locked: true,
              fwNodeType: FW_NODE_TYPE_MAP[label] ?? null,
              fwActive: true, fwHealth: 100,
              ...(isTankNode ? { fwQuantity: 100 } : {}),
              ...(!isSimple ? {
                fwModifierName:  FW_NODE_MODIFIER_MAP[label]?.name        ?? null,
                fwModifierValue: FW_NODE_MODIFIER_MAP[label]?.defaultValue ?? null,
                fwEfficiency: 100, fwInputFactor: 1.0,
              } : {}),
            };
      } else {
        const lbl = label || 'new node';
        w = computeNodeWidth(lbl);
        h = computeNodeHeight(1, 1);
        nodeData = { label: lbl, nodeType: 'action', icon: action_icon, pinsIn: 1, pinsOut: 1 };
      }

      const position = findFreePosition(nodesRef.current, w, h, center.x, center.y);
      setNodes((nds) => [...nds, { id: newId, type: 'flowNode', position, data: { ...nodeData, _babyProgress: 0 } }]);
      onDirty?.();

      const duration = 2000;
      const startTime = performance.now();
      const tick = (now) => {
        const raw   = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - raw, 3);
        setNodes((nds) => nds.map((n) =>
          n.id === newId ? { ...n, data: { ...n.data, _babyProgress: eased } } : n
        ));
        if (raw < 1) {
          requestAnimationFrame(tick);
        } else {
          setNodes((nds) => nds.map((n) => {
            if (n.id !== newId) return n;
            const { _babyProgress, ...rest } = n.data;
            return { ...n, data: rest };
          }));
        }
      };
      requestAnimationFrame(tick);
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
      pushUndo();
      const center   = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const position = findFreePosition(nodesRef.current, NOTE_NODE_WIDTH, NOTE_NODE_HEIGHT, center.x, center.y);
      setNodes((nds) => [
        ...nds,
        { id: crypto.randomUUID(), type: 'noteNode', position, data: { label: label || 'note', noteText: noteText || '', pinsIn: 1, pinsOut: 1 } },
      ]);
    },
    addShape: (shapeType) => {
      pushUndo();
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
      pushUndo();
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
      pushUndo();
      clipboardRef.current = node;
      const copy = instantiateTemplateNode(node);
      const { w, h } = getNodeSize(node);
      copy.position = findFreePosition(nodesRef.current, w, h, node.position.x + 40, node.position.y + 40);
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...copy, selected: true }]);
      onDirty?.();
      return true;
    },
    addFromTemplate: (templateNode) => {
      pushUndo();
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
        pushUndo();
        setNodes(nds => nds.filter(n => n.id !== t.id));
        setEdges(eds => eds.filter(e => e.source !== t.id && e.target !== t.id));
      }

      else if (cmd.command === 'addPins') {
        const t = byName(cmd.name);
        if (!t) return;
        pushUndo();
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
        pushUndo();
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
        pushUndo();
        setNodes(nds => nds.map(n => n.id !== t.id ? n : {
          ...n, data: { ...n.data, nodeType: cmd.nodeType, icon: NODE_ICONS[cmd.nodeType] },
        }));
      }

      else if (cmd.command === 'renameNode') {
        const t = byName(cmd.name);
        if (!t || (t.data?.locked && t.data?.nodeType !== 'group')) return;
        pushUndo();
        setNodes(nds => nds.map(n => n.id !== t.id ? n : {
          ...n, data: { ...n.data, label: cmd.newName },
        }));
      }
    },
  }), [screenToFlowPosition, fitView, setNodes, setEdges, pushUndo, undo, redo]);

  const onUpdateNodeData = React.useCallback((nodeId, updates) => {
    setNodes((nds) => nds.map((n) => n.id !== nodeId ? n : { ...n, data: { ...n.data, ...updates } }));
    onDirty?.();
  }, [setNodes, onDirty]);

  const onDeleteNode = React.useCallback((nodeId) => {
    pushUndo();
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
  }, [setNodes, pushUndo]);

  const onAddOutPin = React.useCallback((nodeId) => {
    pushUndo();
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const newCount = (n.data.pinsOut ?? 1) + 1;
      const newNames = [...(n.data.pinOutNames || []), `Out ${newCount}`];
      return { ...n, data: { ...n.data, pinsOut: newCount, pinOutNames: newNames } };
    }));
    onDirty?.();
  }, [setNodes, pushUndo, onDirty]);

  const onRemoveOutPin = React.useCallback((nodeId) => {
    pushUndo();
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const newCount = Math.max(1, (n.data.pinsOut ?? 1) - 1);
      const newNames = (n.data.pinOutNames || []).slice(0, newCount);
      return { ...n, data: { ...n.data, pinsOut: newCount, pinOutNames: newNames } };
    }));
    setEdges((eds) => eds.filter((e) => {
      if (e.source !== nodeId) return true;
      const node = nodesRef.current.find((n) => n.id === nodeId);
      const removedIdx = (node?.data?.pinsOut ?? 1) - 1;
      return e.sourceHandle !== `pin-out-${removedIdx}`;
    }));
    onDirty?.();
  }, [setNodes, setEdges, pushUndo, onDirty]);

  const onEditNode = React.useCallback((nodeId) => {
    setEditingNode(nodesRef.current.find((n) => n.id === nodeId) ?? null);
  }, []);

  const onAddPins = React.useCallback((nodeId) => {
    pushUndo();
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
  }, [setNodes, pushUndo]);

  const onRenamePinName = React.useCallback((nodeId, side, index, name) => {
    pushUndo();
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const key   = side === 'in' ? 'pinInNames' : 'pinOutNames';
      const names = [...(n.data[key] || [])];
      names[index] = name;
      return { ...n, data: { ...n.data, [key]: names } };
    }));
  }, [setNodes, pushUndo]);

  const handleEnterNode = React.useCallback((nodeId) => {
    onEnterNode(nodeId, nodesRef.current, edgesRef.current);
  }, [onEnterNode]);

  const onChangePropertyType = React.useCallback((nodeId, propertyType) => {
    pushUndo();
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
  }, [setNodes, pushUndo]);

  const onUpdatePropertyData = React.useCallback((nodeId, updates) => {
    pushUndo();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ));
  }, [setNodes, pushUndo]);

  const onUpdateNote = React.useCallback((nodeId, noteText) => {
    pushUndo();
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, noteText } } : n));
    onDirty?.();
  }, [setNodes, onDirty, pushUndo]);

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
          pushUndo();
          clipboardRef.current = node;
          const copy = instantiateTemplateNode(node);
          const { w, h } = getNodeSize(node);
          copy.position = findFreePosition(nodesRef.current, w, h, node.position.x + 40, node.position.y + 40);
          setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...copy, selected: true }]);
          onDirty?.();
        }}
        onUpdateNodeData={onUpdateNodeData}
        isDevMode={isDevMode}
        onAddOutPin={onAddOutPin}
        onRemoveOutPin={onRemoveOutPin}
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
          pushUndo();
          clipboardRef.current = node;
          const copy = instantiateTemplateNode(node);
          copy.position = findFreePosition(nodesRef.current, NOTE_NODE_WIDTH, NOTE_NODE_HEIGHT, node.position.x + 40, node.position.y + 40);
          setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...copy, selected: true }]);
          onDirty?.();
        }}
        onUpdateNote={onUpdateNote}
      />
    ),
    shapeNode: (props) => <ShapeNode {...props} onPushUndo={pushUndo} />,
    pinGateway: PinGatewayNode,
    propertyNode: (props) => (
      <PropertyNode
        {...props}
        onDeleteProperty={onDeleteNode}
        onChangePropertyType={onChangePropertyType}
        onUpdatePropertyData={onUpdatePropertyData}
      />
    ),
  }), [onDeleteNode, onEditNode, onAddPins, onRenamePinName, handleEnterNode, onChangePropertyType, onUpdatePropertyData, onUpdateNote, onUpdateNodeData, isDevMode, pushUndo, onAddOutPin, onRemoveOutPin]);

  const onSaveEdit = (updatedNode) => {
    pushUndo();
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
    pushUndo();
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

  const addFrameNode = (label) => {
    pushUndo();
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    const isGroup = label === 'Group';
    const pinCfg = FW_PIN_CONFIG[label] ?? FW_PIN_DEFAULT;
    const isPowerDist = label === 'Power Distributor';
    const w = isGroup ? computeNodeWidth('Group') : FW_NODE_WIDTH;
    const h = isGroup ? computeNodeHeight(1, 1) : isPowerDist ? FW_NODE_HEIGHT + Math.max(0, pinCfg.pinsOut - 5) * 30 : FW_NODE_HEIGHT;
    const position = findFreePosition(nodesRef.current, w, h, center.x, center.y);
    const isBarrelNode    = FW_BARREL_NODES.includes(label);
    const isTankNode      = FW_TANK_NODES.includes(label);
    const isHardpointNode = FW_HARDPOINT_NODES.includes(label);
    const isSimple        = isBarrelNode || isTankNode || isHardpointNode;
    const data = isGroup
      ? { label: 'Group', nodeType: 'group', icon: group_icon, pinsIn: 1, pinsOut: 1, locked: true }
      : {
          label,
          nodeType:  'action',
          icon:      action_icon,
          ...pinCfg,
          locked:    true,
          fwNodeType:   FW_NODE_TYPE_MAP[label]                  ?? null,
          fwActive:     true,
          ...(!isHardpointNode ? { fwHealth: 100 } : {}),
          ...(isTankNode ? { fwQuantity: 100 } : {}),
          ...(!isSimple ? {
            fwModifierName:  FW_NODE_MODIFIER_MAP[label]?.name        ?? null,
            fwModifierValue: FW_NODE_MODIFIER_MAP[label]?.defaultValue ?? null,
            fwEfficiency:    100,
            fwInputFactor:   1.0,
          } : {}),
        };

    setNodes((nds) => [
      ...nds,
      { id: crypto.randomUUID(), type: 'flowNode', position, data },
    ]);
    onDirty?.();
  };

  const addNote = () => {
    pushUndo();
    const center   = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const position = findFreePosition(nodesRef.current, NOTE_NODE_WIDTH, NOTE_NODE_HEIGHT, center.x, center.y);
    setNodes((nds) => [
      ...nds,
      { id: crypto.randomUUID(), type: 'noteNode', position, data: { label: 'note', noteText: '', pinsIn: 1, pinsOut: 1 } },
    ]);
  };

  const addProperty = () => {
    pushUndo();
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

      if (!isInput && e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (!isInput && e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      if (!isInput && (e.key === 'Delete' || e.key === 'Backspace')) {
        const deletedIds = new Set(
          nodesRef.current
            .filter((n) => n.selected && !n.id.startsWith('__gateway_'))
            .map((n) => n.id)
        );
        const hasSelectedEdges = edgesRef.current.some((e) => e.selected);
        if (deletedIds.size > 0 || hasSelectedEdges) {
          pushUndo();
          if (deletedIds.size > 0) {
            setNodes((nds) => nds.filter((n) => !deletedIds.has(n.id)));
            setEdges((eds) => eds.filter((edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target)));
            onDirty?.();
          }
          setEdges((eds) => eds.filter((edge) => !edge.selected));
        }
      }

      if (!isInput && e.ctrlKey && e.key === 'c') {
        const selected = nodesRef.current.find((n) => (n.type === 'flowNode' || n.type === 'noteNode') && n.selected);
        if (selected) { clipboardRef.current = selected; e.preventDefault(); }
      }

      if (!isInput && e.ctrlKey && e.key === 'v') {
        const src = clipboardRef.current;
        if (src) {
          e.preventDefault();
          pushUndo();
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
  }, [setEdges, setNodes, onDirty, undo, redo, pushUndo]);

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
    pushUndo();
    onDirty?.();
    setEdges((eds) => addEdge(connection, eds));
  };

  const onNodeDragStart = React.useCallback((_, node) => {
    if (node.id.startsWith('__gateway_')) return;
    dragStartSnapshot.current = { nodes: nodesRef.current, edges: edgesRef.current };
  }, []);

  const onNodeDragStop = React.useCallback((_, node) => {
    if (node.id.startsWith('__gateway_')) return;
    const snap = dragStartSnapshot.current;
    dragStartSnapshot.current = null;
    if (!snap) return;
    undoStack.current = [...undoStack.current, snap].slice(-50);
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

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
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
      >
        <Panel position="top-left">
          <div className="toolbar">
            {isFrame
              ? <FramePalette onAdd={addFrameNode} />
              : <button className="toolbar-btn" onClick={addNode}>+ Node</button>
            }
            {isFrame && !isNested && (
              <button className="toolbar-btn toolbar-btn--fw-group" onClick={() => addFrameNode('Group')}>+ Group</button>
            )}
            <button className="toolbar-btn toolbar-btn--note" onClick={addNote}>+ Note</button>
            {isNested && !isFrame && (
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
