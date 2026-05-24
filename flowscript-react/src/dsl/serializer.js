// Wraps a label in quotes if it contains spaces or dots
function dslLabel(label) {
  return /[\s.]/.test(label) ? `"${label}"` : label;
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

function serializeEndpoint(nodeId, handle, nodes, side) {
  const gw = gatewayRef(nodeId);
  if (gw) return gw;

  const node = nodes.find(n => n.id === nodeId);
  if (!node) return null;

  const label = dslLabel(node.data?.label ?? nodeId);
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

  for (const node of nodes) {
    if (node.type !== 'flowNode') continue;
    const d = node.data;

    lines.push(`${indent}node ${dslLabel(d.label)} : ${d.nodeType}`);

    const inPins  = Array.from({ length: d.pinsIn  ?? 0 }, (_, i) => d.pinInNames?.[i]?.trim()  || '_');
    const outPins = Array.from({ length: d.pinsOut ?? 0 }, (_, i) => d.pinOutNames?.[i]?.trim() || '_');

    if (inPins.length)  lines.push(`${indent}\tin\t${inPins.join(', ')}`);
    if (outPins.length) lines.push(`${indent}\tout\t${outPins.join(', ')}`);

    if (d.nodeType === 'group' && d.innerNodes?.length > 0) {
      const flowId = toFlowId(d.label);
      lines.push(`${indent}\tbody\t@${flowId}`);
      childFlows.push({ id: flowId, nodes: d.innerNodes, edges: d.innerEdges ?? [] });
    }

    lines.push('');
  }

  for (const edge of edges) {
    const src = serializeEndpoint(edge.source, edge.sourceHandle, nodes, 'out');
    const tgt = serializeEndpoint(edge.target, edge.targetHandle, nodes, 'in');
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
