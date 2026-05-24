import { NODE_ICONS } from '../FlowCanvas';

// ── Helpers ───────────────────────────────────────────────────────────────────

function unquote(s) {
  return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

function parsePins(str) {
  if (!str || !str.trim()) return [''];
  return str.split(',').map(s => {
    const v = s.trim();
    return v === '_' ? '' : v;
  });
}

function buildPropData(typeStr, attrs) {
  const type = typeStr[0].toUpperCase() + typeStr.slice(1).toLowerCase();
  const name = attrs.name || '';
  if (type === 'Checkbox') {
    return { propertyType: 'Checkbox', name, checked: attrs.checked === 'true' };
  }
  if (type === 'Slider') {
    return {
      propertyType: 'Slider', name,
      min:         parseInt(attrs.min   ?? '0',   10) || 0,
      max:         parseInt(attrs.max   ?? '100', 10) || 100,
      sliderValue: parseInt(attrs.value ?? '0',   10) || 0,
    };
  }
  if (type === 'Dropdown') {
    return { propertyType: 'Dropdown', name, dropdownOptions: attrs.options || '', selectedOption: attrs.value || '' };
  }
  return { propertyType: type, name };
}

function resolvePinIndex(ref, names = []) {
  const n = parseInt(ref, 10);
  if (!isNaN(n)) return n;
  const i = names.indexOf(ref);
  return i >= 0 ? i : 0;
}

function makeNode(label, nodeType, existingPos, existingId, autoY, usedIds) {
  let id = existingId[label];
  if (!id || usedIds.has(id)) id = crypto.randomUUID();
  usedIds.add(id);
  return {
    id,
    type:     'flowNode',
    position: existingPos[label] || { x: 100, y: autoY },
    data: {
      label,
      nodeType,
      icon:        NODE_ICONS[nodeType] ?? NODE_ICONS.action,
      pinsIn:      0,
      pinsOut:     0,
      pinInNames:  [],
      pinOutNames: [],
    },
  };
}

// Resolves "label.pin", "in.N", or "out.N" to { nodeId, handle }
function parseEndpoint(str, nodes, role) {
  // Gateway patterns come first — they use dot notation too
  const gwIn  = str.match(/^in\.(\d+)$/);
  if (gwIn)  return { nodeId: `__gateway_in_${gwIn[1]}`,  handle: null };
  const gwOut = str.match(/^out\.(\d+)$/);
  if (gwOut) return { nodeId: `__gateway_out_${gwOut[1]}`, handle: null };

  // Regular: (quoted_or_bare_label).(pin)
  const m = str.match(/^("[^"]*"|[^.]+)\.(.+)$/);
  if (!m) return null;

  const label = unquote(m[1].trim());
  const pin   = m[2].trim();
  const node  = nodes.find(n => n.data?.label === label);
  if (!node) return null;

  const names = role === 'source' ? node.data?.pinOutNames : node.data?.pinInNames;
  const idx   = resolvePinIndex(pin, names);
  return {
    nodeId: node.id,
    handle: role === 'source' ? `pin-out-${idx}` : `pin-in-${idx}`,
  };
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parse(text, existingNodes = []) {
  // Build lookup maps from existing graph for position and ID preservation.
  // For nodes with duplicate labels the serializer appends " 1", " 2", etc., so
  // we pre-populate those numbered keys here using the same ordering logic.
  const existingPos = {};
  const existingId  = {};

  const labelOccurrences = {};
  for (const n of existingNodes) {
    if (n.type !== 'flowNode' || !n.data?.label) continue;
    const lbl = n.data.label;
    if (!labelOccurrences[lbl]) labelOccurrences[lbl] = [];
    labelOccurrences[lbl].push(n);
  }
  for (const [lbl, occurrences] of Object.entries(labelOccurrences)) {
    if (occurrences.length === 1) {
      existingPos[lbl] = occurrences[0].position;
      existingId[lbl]  = occurrences[0].id;
    } else {
      occurrences.forEach((n, i) => {
        existingPos[`${lbl} ${i + 1}`] = n.position;
        existingId[`${lbl} ${i + 1}`]  = n.id;
      });
    }
  }

  const usedIds = new Set();

  const sections = new Map();               // flowId → { nodes[], edges[] }
  sections.set(null, { nodes: [], edges: [] });

  let sectionId   = null;
  let currentNode = null;
  let autoY       = 100;

  for (const rawLine of text.split('\n')) {
    const trimmed = rawLine.trimEnd();
    if (!trimmed || trimmed.trimStart().startsWith('#')) continue;

    const indent  = (trimmed.match(/^(\t*)/) ?? ['', ''])[1].length;
    const content = trimmed.trimStart();

    // ── flow @id header ───────────────────────────────────────────────────────
    if (indent === 0 && content.startsWith('flow @')) {
      sectionId   = content.slice(6).trim();
      currentNode = null;
      sections.set(sectionId, { nodes: [], edges: [] });
      continue;
    }

    const section   = sections.get(sectionId);
    const nodeDepth = sectionId === null ? 0 : 1;  // indent level for node declarations
    const bodyDepth = nodeDepth + 1;                // indent level for in/out/body

    // ── node declaration ──────────────────────────────────────────────────────
    if (indent === nodeDepth) {
      const nm = content.match(/^node\s+("[^"]*"|\S+)\s*:\s*(\w+)$/);
      if (nm) {
        const label = unquote(nm[1]);
        currentNode = makeNode(label, nm[2], existingPos, existingId, autoY, usedIds);
        autoY += 150;
        section.nodes.push(currentNode);
        continue;
      }

      // edge declaration (ends any open node body)
      if (content.includes(' -> ')) {
        currentNode = null;
        const em = content.match(/^(.+?)\s+->\s+(.+)$/);
        if (em) {
          const src = parseEndpoint(em[1].trim(), section.nodes, 'source');
          const tgt = parseEndpoint(em[2].trim(), section.nodes, 'target');
          if (src && tgt) {
            section.edges.push({
              id:           crypto.randomUUID(),
              source:       src.nodeId,
              target:       tgt.nodeId,
              sourceHandle: src.handle,
              targetHandle: tgt.handle,
            });
          }
        }
        continue;
      }
    }

    // ── node body: in / out / body ─────────────────────────────────────────────
    if (indent === bodyDepth && currentNode) {
      const inM   = content.match(/^in(?:\s+(.+))?$/);
      const outM  = content.match(/^out(?:\s+(.+))?$/);
      const bodyM = content.match(/^body\s+@(\S+)$/);

      if (inM) {
        const pins = parsePins(inM[1]);
        currentNode.data.pinInNames = pins;
        currentNode.data.pinsIn     = pins.length;
      } else if (outM) {
        const pins = parsePins(outM[1]);
        currentNode.data.pinOutNames = pins;
        currentNode.data.pinsOut     = pins.length;
      } else if (bodyM) {
        currentNode._bodyRef = bodyM[1];
      } else {
        const propM = content.match(/^prop\s+(\w+)\s*(.*)/);
        if (propM) {
          const attrs = {};
          const kvRe  = /(\w+):((?:"[^"]*"|\S+))/g;
          let km;
          while ((km = kvRe.exec(propM[2])) !== null) {
            let val = km[2];
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            attrs[km[1]] = val;
          }
          if (!currentNode._propNodes) currentNode._propNodes = [];
          currentNode._propNodes.push({
            id:       crypto.randomUUID(),
            type:     'propertyNode',
            position: { x: 200, y: 20 + currentNode._propNodes.length * 140 },
            data:     buildPropData(propM[1], attrs),
          });
        }
      }
    }
  }

  // ── Link flow bodies and properties to their nodes ────────────────────────
  for (const { nodes } of sections.values()) {
    for (const node of nodes) {
      const propNodes = node._propNodes || [];
      delete node._propNodes;

      let bodyNodes = [], bodyEdges = [];
      if (node._bodyRef) {
        const inner = sections.get(node._bodyRef);
        if (inner) {
          bodyNodes = inner.nodes;
          bodyEdges = inner.edges;
          node.data.nodeType = 'group';
          node.data.icon     = NODE_ICONS.group;
        }
        delete node._bodyRef;
      }

      if (propNodes.length > 0 || bodyNodes.length > 0) {
        node.data.innerNodes    = [...propNodes, ...bodyNodes];
        node.data.innerEdges    = bodyEdges;
        node.data.hasProperties = propNodes.length > 0;
      }
    }
  }

  return sections.get(null);
}
