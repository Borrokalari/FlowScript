# FlowScript – Architecture Specification

## 1. Product overview

FlowScript is a desktop application for designing logic flows using:
- **Graph Mode:** a visual node-based editor.
- **DSL Mode:** a text-based domain-specific language editor.
- **FlowBar:** a command/text field for quick actions and navigation.

The core idea: **visual and textual representations are two views of the same underlying flow**, with the option to use DSL Mode as a standalone notepad when desired.

---

## 2. Goals and principles

- **Low cognitive load:** minimal UI, no cluttered toolbars, “click to create” interactions.
- **Bidirectional representation:** graph ↔ DSL sync (when enabled).
- **Portable artifacts:** shareable `.flowfile` (JSON) and `.txt` exports.
- **Extensible:** future FlowShare repository, node types, plugins.
- **Offline-first:** everything works locally, no mandatory cloud.

---

## 3. High-level architecture

### 3.1 Platform

- **Desktop shell:** Electron (or similar)  
  - **Main process:** app lifecycle, file system, IPC, OS integration.
  - **Renderer process:** UI (Graph Mode, DSL Mode, FlowBar).
  - **Preload/context bridge:** safe APIs exposed to renderer.

### 3.2 Core modules

- **App Shell & Layout**
  - Custom top bar (replacing OS title bar).
  - Menu (File / Edit / View / Help).
  - Below menu: tab strip + FlowBar.
- **Graph Editor Module**
  - Canvas rendering, node/edge interactions.
  - Empty canvas behavior: click → “New Node” button.
- **DSL Editor Module**
  - Text editor with syntax highlighting.
  - Modes: “linked to graph” vs “Do not turn into Flow”.
- **Sync Engine**
  - Converts graph → DSL and DSL → graph.
  - Handles conflicts and validation.
- **Persistence Layer**
  - Read/write `.flowfile` (JSON).
  - Read/write `.txt` for DSL/notepad mode.
- **FlowShare (future)**
  - Optional remote repository integration.
  - Upload/download shared flows.

---

## 4. UI architecture

### 4.1 Top-level layout

- **Custom Title Bar**
  - App name: `FlowScript`
  - Menu items: `File`, `Edit`, `View`, `Window`, `Help` (configurable).
- **Mode Tabs + FlowBar (under title bar)**
  - **Tabs:**
    - `Graph Mode`
    - `DSL Mode`
  - **FlowBar:**
    - Single-line text field.
    - Used for:
      - Quick commands (`/new node`, `/search`, `/run`, etc. – future).
      - Jumping to nodes or labels.
      - Filtering nodes (future).

### 4.2 Graph Mode UI

- **Canvas**
  - Infinite or large scrollable area.
  - When empty:
    - No toolbar.
    - Left-click anywhere → contextual “New Node” button.
  - When nodes exist:
    - Click on node to select.
    - Drag to move.
    - Drag from output anchor to create connections.

- **Node Design**
  - Rounded rectangle, soft beige background.
  - Slightly darker header strip with monospaced label (e.g., `getmilk`).
  - Output anchors (e.g., `+` or small sockets) for branching.
  - Optional subtle hover outline.

- **Interactions**
  - **Create node:** click canvas → “New Node”.
  - **Connect nodes:** drag from output anchor to target node.
  - **Delete node/edge:** context menu or keyboard shortcut.
  - **Pan/zoom:** mouse wheel + drag.

### 4.3 DSL Mode UI

- **Editor**
  - Full-height text editor (Monaco/CodeMirror style).
  - Syntax highlighting for FlowScript DSL.
- **Modes**
  - **Linked Mode (default):**
    - DSL is a textual view of the current graph.
    - Edits in DSL update the graph (on save or debounce).
  - **Notepad Mode (“Do not turn into Flow”):**
    - DSL is treated as plain text.
    - No graph sync.
    - Can be exported as `.txt`.

- **Controls**
  - Toggle: `Do not turn into Flow` (checkbox or menu item).
  - `Apply to Graph` / `Sync` button (when linked).

---

## 5. Data model

### 5.1 Core entities

- **FlowFile**
  ```json
  {
    "version": "1.0",
    "meta": {
      "name": "My Flow",
      "createdAt": "...",
      "updatedAt": "..."
    },
    "graph": {
      "nodes": [],
      "edges": []
    },
    "dsl": {
      "content": "getmilk -> gotostore | stayhome",
      "linkedToGraph": true
    }
  }

- **Node**
  ```json
  {
  "id": "node-1",
  "label": "getmilk",
  "type": "action",        // future: condition, group, etc.
  "position": { "x": 120, "y": 80 },
  "data": { /* node-specific payload */ }
  }


- **Edge**
  
  ```json
  {
    "id": "edge-1",
    "from": "node-1",
    "to": "node-2",
    "label": null            // optional: condition, branch name
  }
  
- **DSL Document**
  
  ```json
  {
    "content": "getmilk -> gotostore | stayhome",
    "linkedToGraph": true
  }

### 5.2 DSL ↔ Graph mapping

  #### Graph → DSL
  - Traverse nodes and edges in a deterministic order.
  - Emit DSL lines like:
    - `getmilk -> gotostore | stayhome`
    - `gotostore -> pay | leave`

  #### DSL → Graph
  - Parse DSL into an AST.
  - Create/update nodes and edges based on identifiers and relationships.
  - Handle unknown nodes or syntax errors with clear feedback.

---

  ## 6. Application logic

  ### 6.1 File operations
  - **New Flow:** starts with a tutorial flow or empty canvas.
  - **Open Flow:** loads `.flowfile` and populates graph + DSL.
  - **Save Flow:** serializes current state to `.flowfile`.
  - **Export DSL:** saves DSL content as `.txt`.
  - **Import DSL (future):** loads `.txt` and optionally parses into a flow.

  ### 6.2 Sync engine behavior
  - **Linked Mode:** graph and DSL stay synchronized.
  - **Notepad Mode:** DSL is independent; graph remains static.

---

  ## 7. Electron process responsibilities

  ### 7.1 Main process
  - Manages app lifecycle, window creation, and file dialogs.
  - Handles read/write operations for `.flowfile` and `.txt`.
  - IPC channels:
    - `flowfile:open`
    - `flowfile:save`
    - `dsl:exportTxt`
    - `app:getRecentFiles`

  ### 7.2 Preload / context bridge
  Exposes a minimal API:
  ```ts
  window.flowScriptAPI = {
    openFlowFile(): Promise<FlowFile>,
    saveFlowFile(flow: FlowFile): Promise<void>,
    exportDsl(content: string): Promise<void>,
    showError(message: string): void
  };  
  ```

### 7.3 Renderer

- **UI framework:** React, Vue, or Svelte (implementation choice).
- **State management:** Redux, Zustand, or Signals for managing graph state, DSL state, and UI state.
- **Renderer modules:**
  - `GraphView` — renders nodes, edges, canvas interactions.
  - `NodeComponent` — visual representation of a node.
  - `EdgeComponent` — visual representation of a connection.
  - `DslView` — DSL editor with syntax highlighting.
  - `FlowBar` — command input field.
  - `TopBar` — custom title bar + menu.
  - `FileMenu` — open/save/export actions.
  - `Settings` — preferences, theme, sync mode.

---

## 8. Future extensions

- **FlowShare Repository**
  - Online hub for sharing `.flowfile` templates.
  - Browse, import, fork, and remix flows.
  - Optional authentication for publishing.

- **Node Types & Plugins**
  - Extend FlowScript with new node categories:
    - Condition nodes
    - Loop nodes
    - API call nodes
    - Group/Container nodes
  - Plugin system for community extensions.

- **Execution / Simulation Mode**
  - Step-by-step traversal of a flow.
  - Highlight active nodes and branches.
  - Useful for debugging logic.

- **Theming & Customization**
  - Light/dark mode.
  - Custom color palettes.
  - Node-style presets (rounded, sharp, minimal).

---

## 9. Directory structure (proposed)

```text
flowscript/
  package.json
  electron/
    main.ts
    preload.ts
  src/
    app/
      AppShell.tsx
      TopBar/
      Tabs/
      FlowBar/
    graph/
      GraphView.tsx
      NodeComponent.tsx
      EdgeComponent.tsx
      graphStore.ts
    dsl/
      DslView.tsx
      dslStore.ts
      parser/
        lexer.ts
        parser.ts
        ast.ts
      sync/
        graphToDsl.ts
        dslToGraph.ts
    services/
      flowfileService.ts
      settingsService.ts
    styles/
      theme.css
  assets/
  dist/
```

## 10. Summary

FlowScript is a **desktop‑first, dual‑mode flow editor** designed around clarity, minimalism, and the seamless coexistence of visual and textual logic building. It provides:

- A clean, intuitive interface with **Graph Mode**, **DSL Mode**, and the **FlowBar**.
- A unified underlying data model (`FlowFile`) that keeps flows portable and easy to share.
- A sync engine that maintains consistency between the visual graph and the DSL when desired.
- A flexible architecture ready for future enhancements such as FlowShare, plugin systems, execution/simulation tools, and theming.

This section concludes the architecture document and establishes the foundation for FlowScript’s implementation and long‑term evolution.