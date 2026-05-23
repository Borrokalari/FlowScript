import { ReactFlowProvider } from 'reactflow';
import React, { useEffect } from 'react';
import ReactFlow, {
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
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
  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  //
  // 1. ENGINE INITIALIZATION
  //
  useEffect(() => {
    if (window.FlowScriptReact) {
      window.FlowScriptReact.init({
        setNodes,
        setEdges,
        initialNodes,
        initialEdges,
      });
    }
  }, []);

  //
  // 2. DELETE KEY HANDLER (edges only)
  //
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        setEdges((eds) => {
          const remaining = eds.filter((edge) => !edge.selected);

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

  //
  // 3. SELECTION HANDLER (ReactFlow → engine)
  //
  const onSelectionChange = (params) => {
    const selectedNode = params.nodes?.[0];
    const id = selectedNode ? selectedNode.id : null;

    window.FlowScriptReact?.onSelectionChanged(id);
  };

  //
  // 4. NODE MOVEMENT HANDLER (ReactFlow → engine)
  //
  const onNodeDragStop = (event, node) => {
    window.FlowScriptReact?.onNodePositionChanged(node.id, node.position);
  };

  //
  // 5. EDGE CHANGES (ReactFlow → engine)
  //
  const onEdgesChangeWrapped = (changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));

    changes.forEach((change) => {
      if (change.type === 'remove' && change.id) {
        window.FlowScriptReact?.emit('edgeDeleted', { id: change.id });
      }
    });
  };

  //
  // 6. NODE CHANGES (ReactFlow → engine)
  //
  const onNodesChangeWrapped = (changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));

    changes.forEach((change) => {
      if (change.type === 'position' && change.position) {
        window.FlowScriptReact?.onNodePositionChanged(change.id, change.position);
      }
    });
  };

  //
  // 7. EDGE CREATION (ReactFlow → engine)
  //
  const onConnect = (connection) => {
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
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#363b40' }}>
      <ReactFlowProvider>
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
          onSelectionChange={onSelectionChange}
          onNodeDragStop={onNodeDragStop}
        />
      </ReactFlowProvider>
    </div>
  );
}
