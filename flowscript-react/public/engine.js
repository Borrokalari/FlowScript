// FlowScriptEngine: central engine for FlowScript
// - Owns graph state
// - Talks to ReactFlow via injected setters
// - No Bubble, no iframe, no parent window

const FlowScriptEngine = {
  // -------------------------
  // Internal state
  // -------------------------
  _nodes: [],
  _edges: [],
  _selectedNodeId: null,

  // ReactFlow setters (injected from React)
  _setNodes: null,
  _setEdges: null,

  // -------------------------
  // Initialization
  // -------------------------
  init({ setNodes, setEdges, initialNodes = [], initialEdges = [] }) {
    this._setNodes = setNodes;
    this._setEdges = setEdges;

    this._nodes = [...initialNodes];
    this._edges = [...initialEdges];

    this._setNodes(this._nodes);
    this._setEdges(this._edges);
  },

  // -------------------------
  // Selection handling
  // -------------------------
  onSelectionChanged(nodeId) {
    const id = nodeId ? String(nodeId) : null;
    this._selectedNodeId = id;
    console.log("FlowScriptEngine.onSelectionChanged:", id);
  },

  // -------------------------
  // Graph mutation API
  // -------------------------
  addNode(nodeConfig) {
    const id = nodeConfig.id || String(Date.now());

    const newNode = {
      id,
      type: nodeConfig.type || "default",
      position: nodeConfig.position || { x: 0, y: 0 },
      data: nodeConfig.data || {},
      ...nodeConfig.extraProps,
    };

    this._nodes = [...this._nodes, newNode];
    this._setNodes(this._nodes);

    this._emitGraphChanged();
    return id;
  },

  deleteNode(nodeId) {
    const id = String(nodeId);
    console.log("FlowScriptEngine.deleteNode:", id);

    this._nodes = this._nodes.filter((n) => n.id !== id);
    this._edges = this._edges.filter(
      (e) => e.source !== id && e.target !== id
    );

    this._setNodes(this._nodes);
    this._setEdges(this._edges);

    if (this._selectedNodeId === id) {
      this._selectedNodeId = null;
    }

    this._emitGraphChanged();
  },

  deleteSelectedNode() {
    if (!this._selectedNodeId) {
      console.warn("FlowScriptEngine.deleteSelectedNode: no node selected");
      return;
    }
    this.deleteNode(this._selectedNodeId);
  },

  onNodePositionChanged(nodeId, position) {
    const id = String(nodeId);

    this._nodes = this._nodes.map((n) =>
      n.id === id ? { ...n, position: { ...position } } : n
    );

    this._setNodes(this._nodes);
    this._emitGraphChanged();
  },

  // -------------------------
  // Graph sync
  // -------------------------
  setGraph({ nodes, edges }) {
    this._nodes = nodes || [];
    this._edges = edges || [];

    this._setNodes(this._nodes);
    this._setEdges(this._edges);

    this._emitGraphChanged();
  },

  getGraph() {
    return {
      nodes: this._nodes,
      edges: this._edges,
    };
  },

  // -------------------------
  // Event emission (local only)
  // -------------------------
  _emitGraphChanged() {
    console.log("FlowScriptEngine.graphChanged:", this._nodes, this._edges);
    // No Bubble, no Monaco — clean and local
  },
};

export default FlowScriptEngine;
