// FlowScript React Engine - Version 0.1.0

import { mountReactFlow } from './main.jsx';

window.FlowScriptReact = {
  version: "0.1.0",
  _root: null,

setGraph(graph) {
  console.log("FlowScriptReact.setGraph called", graph);

  if (!this._setNodes || !this._setEdges) {
    console.warn("FlowScriptReact: React Flow not initialized yet");
    return;
  }

  this._setNodes(graph.nodes || []);
  this._setEdges(graph.edges || []);
},

addNode(nodeData = {}) {
  console.log("FlowScriptReact.addNode called", nodeData);

  if (!this._setNodes) {
    console.warn("FlowScriptReact: React Flow not initialized yet");
    return;
  }

  // Default node structure
  const newNode = {
    id: String(Date.now()),
    type: "flowNode",
    position: nodeData.position || { x: 200, y: 200 },
    data: {
      label: nodeData.label || "newnode",
      icon: nodeData.icon || "https://via.placeholder.com/32"
    }
  };

  // Append to existing nodes
  this._setNodes((nds) => [...nds, newNode]);
},

deleteNode(nodeId) {
  console.log("FlowScriptReact.deleteNode called", nodeId);

  if (!this._setNodes) {
    console.warn("FlowScriptReact: React Flow not initialized yet");
    return;
  }

  this._setNodes((nds) => nds.filter((n) => n.id !== nodeId));
},

_listeners: {},

on(eventName, callback) {
  if (!this._listeners[eventName]) {
    this._listeners[eventName] = [];
  }
  this._listeners[eventName].push(callback);
},

off(eventName, callback) {
  if (!this._listeners[eventName]) return;
  this._listeners[eventName] = this._listeners[eventName].filter(
    (cb) => cb !== callback
  );
},

emit(eventName, payload) {
  console.log("FlowScriptReact.emit:", eventName, payload);

  if (!this._listeners[eventName]) return;

  for (const cb of this._listeners[eventName]) {
    cb(payload);
  }
},


  init(options = {}) {
    console.log("FlowScriptReact.init called", options);

    const elementId = options.elementId || "root";

    // Mount React Flow
    this._root = mountReactFlow(elementId, options);
  },

  destroy() {
    console.log("FlowScriptReact.destroy called");

    if (this._root) {
      this._root.unmount();
      this._root = null;
    }
  }
};
