import React from 'react';
import ReactFlow, {
  Handle,
  Position,
  useNodesState,
  useEdgesState,
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
        />
        <Handle
          type="source"
          position={Position.Right}
          className="flow-node-handle"
        />

        {/* Dynamic icon */}
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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#363b40' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
      />
    </div>
  );
}
