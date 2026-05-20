import React from 'react';
import ReactFlow from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes = [
  {
    id: '1',
    position: { x: 250, y: 5 },
    data: { label: 'Hello FlowScript' }
  },
  {
     id: '2',
     position: { x: 100, y: 100 },
     data: { label: 'Node 2' } 
  },
];

const initialEdges = [];

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow nodes={initialNodes} edges={initialEdges} />
    </div>
  );
}
