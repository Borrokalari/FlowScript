// Wraps a label in quotes if it contains spaces or dots
function dslLabel(label) {
  return /[\s.]/.test(label) ? `"${label}"` : label;
}

// Always-quoted string for property values (avoids ambiguity with key:value parsing)
function propStr(s) {
  return `"${(s == null ? '' : String(s)).replace(/"/g, '\\"')}"`;
}

// Returns "in.N" / "out.N" for gateway node IDs, null otherwise
function gatewayRef(nodeId) {
  if (nodeId.startsWith('__gateway_in_'))  return `in.${nodeId.slice('__gateway_in_'.length)}`;
  if (nodeId.startsWith('__gateway_out_')) return `out.${nodeId.slice('__gateway_out_'.length)}`;
  return null;
}

// Resolves a handle ID + pinNames array to the DSL pin reference (name or index)
function pinRef(handleId, pinNames) {
  if (!handleId) return null;
  const m = handleId.match(/pin-(?:in|out)-(\d+)/);
  if (!m) return null;
  const idx  = parseInt(m[1], 10);
  const name = (pinNames ?? [])[idx];
  return (name && name.trim()) ? name : String(idx);
}

function serializeEndpoint(nodeId, handle, nodes, dslNameOf, side) {
  const gw = gatewayRef(nodeId);
  if (gw) return gw;

  const node = nodes.find(n => n.id === nodeId);
  if (!node) return null;

  const name  = dslNameOf.get(nodeId) ?? (node.data?.label ?? nodeId);
  const label = dslLabel(name);
  const names = side === 'out' ? node.data?.pinOutNames : node.data?.pinInNames;
  const pin   = pinRef(handle, names) ?? '0';
  return `${label}.${pin}`;
}

function toFlowId(label) {
  return label.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || 'flow';
}

function serializeSection(nodes, edges, indent) {
  const lines      = [];
  const childFlows = [];

  // Build unique DSL names for nodes that share a label
  const labelCount = {};
  const labelSeen  = {};
  const dslNameOf  = new Map();
  for (const n of nodes) {
    if (n.type !== 'flowNode') continue;
    const lbl = n.data?.label ?? 'node';
    labelCount[lbl] = (labelCount[lbl] || 0) + 1;
  }
  for (const n of nodes) {
    if (n.type !== 'flowNode') continue;
    const lbl = n.data?.label ?? 'node';
    if (labelCount[lbl] === 1) {
      dslNameOf.set(n.id, lbl);
    } else {
      labelSeen[lbl] = (labelSeen[lbl] || 0) + 1;
      dslNameOf.set(n.id, `${lbl} ${labelSeen[lbl]}`);
    }
  }

  for (const node of nodes) {
    if (node.type !== 'flowNode') continue;
    const d    = node.data;
    const name = dslNameOf.get(node.id) ?? (d.label ?? node.id);

    lines.push(`${indent}node ${dslLabel(name)} : ${d.nodeType}`);

    const inPins  = Array.from({ length: d.pinsIn  ?? 0 }, (_, i) => d.pinInNames?.[i]?.trim()  || '_');
    const outPins = Array.from({ length: d.pinsOut ?? 0 }, (_, i) => d.pinOutNames?.[i]?.trim() || '_');

    if (inPins.length)  lines.push(`${indent}\tin\t${inPins.join(', ')}`);
    if (outPins.length) lines.push(`${indent}\tout\t${outPins.join(', ')}`);

    const allInner  = d.innerNodes ?? [];
    const propNodes = allInner.filter(n => n.type === 'propertyNode');
    const regNodes  = allInner.filter(n => n.type === 'flowNode');

    for (const prop of propNodes) {
      const pd = prop.data;
      const nm = propStr(pd.name);
      if (pd.propertyType === 'Checkbox') {
        lines.push(`${indent}\tprop checkbox name:${nm} checked:${pd.checked ? 'true' : 'false'}`);
      } else if (pd.propertyType === 'Slider') {
        lines.push(`${indent}\tprop slider name:${nm} min:${pd.min ?? 0} max:${pd.max ?? 100} value:${pd.sliderValue ?? 0}`);
      } else if (pd.propertyType === 'Dropdown') {
        lines.push(`${indent}\tprop dropdown name:${nm} options:${propStr(pd.dropdownOptions)} value:${propStr(pd.selectedOption)}`);
      }
    }

    if (d.nodeType === 'group' && regNodes.length > 0) {
      const flowId = toFlowId(name);
      lines.push(`${indent}\tbody\t@${flowId}`);
      childFlows.push({ id: flowId, nodes: regNodes, edges: d.innerEdges ?? [] });
    }

    lines.push('');
  }

  for (const edge of edges) {
    const src = serializeEndpoint(edge.source, edge.sourceHandle, nodes, dslNameOf, 'out');
    const tgt = serializeEndpoint(edge.target, edge.targetHandle, nodes, dslNameOf, 'in');
    if (src && tgt) lines.push(`${indent}${src} -> ${tgt}`);
  }

  return { lines, childFlows };
}

export function serialize(rootNodes, rootEdges) {
  const output = [];
  const queue  = [{ id: null, nodes: rootNodes, edges: rootEdges, indent: '' }];

  while (queue.length) {
    const { id, nodes, edges, indent } = queue.shift();

    if (id !== null) {
      if (output.length) output.push('');
      output.push(`flow @${id}`);
    }

    const { lines, childFlows } = serializeSection(nodes, edges, indent);
    output.push(...lines);

    for (const f of childFlows) {
      queue.push({ ...f, indent: '\t' });
    }
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
