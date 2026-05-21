import React, { useEffect } from 'react';
import ReactFlow, {
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';

import action_icon from './NodeIcons/action_icon.png';
import condition_icon from './NodeIcons/condition_icon.png';
import data_icon from './NodeIcons/data_icon.png';
import event_icon from './NodeIcons/event_icon.png';
import group_icon from './NodeIcons/group_icon.png';

function FlowNode({ data }) {
  return (
    <div className="flow-node" data-drag-handle>
      <div className="flow-node-header">
        <span className="flow-node-title">{data.label}</span>
        <button className="flow-node-menu">...</button>
      </div>

      <div className="flow-node-body">
        <Handle
          type="target"
          position={Position.Left}
          className="flow-node-handle"
          isConnectable={true}
        />
        <Handle
          type="source"
          position={Position.Right}
          className="flow-node-handle"
          isConnectable={true}
        />

        <div
          className="flow-node-icon"
          style={{
            backgroundImage: `url(${data.icon})`,
          }}
        />
      </div>
    </div>
  );
}

const nodeTypes = {
  flowNode: FlowNode,
};

const initialNodes = [
  {
    id: '1',
    type: 'flowNode',
    position: { x: 250, y: 5 },
    data: { label: 'getmilk', icon: action_icon },
  },
];

const initialEdges = [];

export default function App() {
  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges);

  // Register setters into the engine
  useEffect(() => {
    if (window.FlowScriptReact) {
      window.FlowScriptReact._setNodes = setNodes;
      window.FlowScriptReact._setEdges = setEdges;
    }
  }, [setNodes, setEdges]);

  // ⭐ DELETE KEY HANDLER (edges)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        setEdges((eds) => {
          const remaining = eds.filter((edge) => !edge.selected);

          // Emit deletion events for each removed edge
          eds.forEach((edge) => {
            if (edge.selected) {
              window.FlowScriptReact?.emit("edgeDeleted", { id: edge.id });
            }
          });

          return remaining;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setEdges]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#363b40' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesConnectable={true}
        nodesDraggable={true}
        elementsSelectable={true}
        connectionMode="loose"
        defaultEdgeOptions={{ type: 'default' }}

        onNodesChange={(changes) => {
          handleNodesChange(changes);

          changes.forEach((change) => {
            if (change.type === 'position' && change.position) {
              window.FlowScriptReact?.emit('nodeMoved', {
                id: change.id,
                x: change.position.x,
                y: change.position.y,
              });
            }
          });
        }}

        onEdgesChange={(changes) => {
          handleEdgesChange(changes);

          changes.forEach((change) => {
            if (change.type === 'remove' && change.id) {
              window.FlowScriptReact?.emit('edgeDeleted', {
                id: change.id,
              });
            }
          });
        }}

        onConnect={(connection) => {
          setEdges((eds) => {
            const next = addEdge(connection, eds);

            const newEdge = next[next.length - 1];
            if (newEdge) {
              window.FlowScriptReact?.emit('edgeCreated', {
                id: newEdge.id,
                source: newEdge.source,
                target: newEdge.target,
              });
            }

            return next;
          });
        }}

        onSelectionChange={(params) => {
          window.FlowScriptReact?.emit('selectionChanged', {
            nodes: params.nodes.map((n) => n.id),
            edges: params.edges.map((e) => e.id),
          });
        }}
      />
    </div>
  );
}
