// FlowScriptReact: central engine for FlowScript
// - Owns graph state
// - Talks to ReactFlow
// - Talks to Bubble + Monaco via events/commands

window.FlowScriptReact = {
  // -------------------------
  // Internal state
  // -------------------------
  _nodes: [],
  _edges: [],
  _selectedNodeId: null,

  // ReactFlow setters (injected from the React side)
  _setNodes: null,
  _setEdges: null,

  // -------------------------
  // Initialization from React
  // -------------------------
  init({ setNodes, setEdges, initialNodes = [], initialEdges = [] }) {
    this._setNodes = setNodes;
    this._setEdges = setEdges;

    this._nodes = initialNodes;
    this._edges = initialEdges;

    this._setNodes(this._nodes);
    this._setEdges(this._edges);
  },

  // -------------------------
  // Selection handling (ReactFlow → engine)
  // -------------------------
  onSelectionChanged(nodeId) {
    const id = nodeId ? String(nodeId) : null;
    this._selectedNodeId = id;

    console.log("FlowScriptReact.onSelectionChanged:", id);

    // If you still want to notify Bubble, do it here (optional)
    // if (window.bubble_fn_selectionChanged) {
    //   window.bubble_fn_selectionChanged(id);
    // }
  },

  // -------------------------
  // Graph mutation API (model)
  // -------------------------
  addNode(nodeConfig) {
    // nodeConfig: { id?, type?, position, data, ... }
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
    console.log("FlowScriptReact.deleteNode:", id);

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

  // Command‑level helper: Bubble calls this
  deleteSelectedNode() {
    if (!this._selectedNodeId) {
      console.warn("FlowScriptReact.deleteSelectedNode: no node selected");
      return;
    }
    this.deleteNode(this._selectedNodeId);
  },

  // Example: ReactFlow node drag/move → engine
  onNodePositionChanged(nodeId, position) {
    const id = String(nodeId);

    this._nodes = this._nodes.map((n) =>
      n.id === id ? { ...n, position: { ...position } } : n
    );

    this._setNodes(this._nodes);
    this._emitGraphChanged();
  },

  // -------------------------
  // Graph sync / DSL hooks
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

  // Here’s where Monaco sync plugs in:
  // serializeGraphToDSL() { ... }
  // loadDSL(dslString) { ... }

  // -------------------------
  // Event emission (Bubble / Monaco)
  // -------------------------
  _emitGraphChanged() {
    console.log("FlowScriptReact.graphChanged:", this._nodes, this._edges);

    // Bubble bridge (optional)
    // if (window.bubble_fn_graphChanged) {
    //   window.bubble_fn_graphChanged(JSON.stringify(this.getGraph()));
    // }

    // Monaco bridge (optional)
    // if (window.FlowScriptMonaco && window.FlowScriptMonaco.onGraphChanged) {
    //   window.FlowScriptMonaco.onGraphChanged(this.getGraph());
    // }
  },
};

// Expose engine to Bubble parent window (HTML element runs in an iframe)
if (window.parent && window.parent !== window) {
  window.parent.FlowScriptReact = window.FlowScriptReact;
}
