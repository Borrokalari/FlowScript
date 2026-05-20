# **FlowScript – Implementation Plan**

## **Phase 0 — Prep (1–2 days)**

Set up the foundation so you don’t fight your tools later.

- [x] ### **0.1 Install & prepare**


- Install Node.js (LTS)
- Install VS Code
- Install Git
- Install Electron Forge or Electron Builder

- [x] ### **0.2 Create the React Flow bundle project**


You’ll need a separate folder for the embedded JS app:

```
flowscript-react/
```

Inside it:

- Initialize with Vite (`npm create vite@latest`)
- Install:
  - `react`
  - `react-dom`
  - `reactflow`
  - `uuid`
  - `zustand` (optional state store)
- Create a simple React Flow canvas that loads static nodes

### **0.3 Create the Monaco bundle project**

Same idea:

```
flowscript-monaco/
```

- Initialize with Vite
- Install Monaco
- Create a simple editor that loads text and emits changes

### **0.4 Create the Electron wrapper**

```
flowscript-electron/
```

- Basic Electron window
- Loads your Bubble app URL
- Preload script with:
  - `openFlowFile()`
  - `saveFlowFile()`
  - `exportTxt()`

------

# **Phase 1 — Bubble UI Shell (3–5 days)**

### **1.1 Build the main layout**

- Custom top bar (Electron)
- Tabs:
  - Graph Mode
  - DSL Mode
- FlowBar (single-line input)
- Settings modal
- File menu (Open / Save / Export)

### **1.2 Add the two HTML elements**

- One for React Flow
- One for Monaco

These are just empty containers for now.

### **1.3 Add Bubble states**

- `flowfile_json`
- `dsl_text`
- `sync_mode` (linked / notepad)
- `selected_node_id`
- `graph_dirty`
- `dsl_dirty`

------

# **Phase 2 — Integrate React Flow (5–10 days)**

### **2.1 Bundle React Flow**

- Build your React Flow project with Vite
- Output a single `bundle.js`

### **2.2 Load it inside Bubble**

- Place an HTML element
- Inject the script
- Initialize React Flow inside that element

### **2.3 Implement communication**

**Bubble → React Flow**

- Send graph JSON
- Commands: “add node”, “delete node”, “center view”

**React Flow → Bubble**

- Node moved
- Node created
- Edge created
- Edge deleted

### **2.4 Implement FlowScript-style nodes**

- Beige rounded rectangles
- Monospaced header
- Two output anchors
- Clean edges

### **2.5 Implement empty canvas behavior**

- Click → “New Node” button appears

------

# **Phase 3 — Integrate Monaco (3–6 days)**

### **3.1 Bundle Monaco**

- Build with Vite
- Output `monaco-bundle.js`

### **3.2 Load inside Bubble**

- Place HTML element
- Inject script
- Initialize Monaco

### **3.3 Communication**

**Bubble → Monaco**

- Set DSL text
- Set theme
- Set read-only mode (if needed)

**Monaco → Bubble**

- On text change → update `dsl_text`

------

# **Phase 4 — Sync Engine (7–14 days)**

### **4.1 Graph → DSL**

- Traverse nodes
- Generate DSL lines
- Update Monaco

### **4.2 DSL → Graph**

- Parse DSL
- Build AST
- Convert AST → graph JSON
- Update React Flow

### **4.3 Handle errors**

- Invalid DSL → show error markers in Monaco
- Keep last valid graph

### **4.4 Notepad mode**

- Disable sync
- DSL becomes plain text editor
- Export `.txt`

------

# **Phase 5 — File System Integration (3–5 days)**

### **5.1 Electron → Bubble**

Expose:

- `openFlowFile()`
- `saveFlowFile()`
- `exportTxt()`

### **5.2 Bubble → Electron**

Use:

- “Run JavaScript”
- “Trigger event from JS”

### **5.3 Implement `.flowfile` format**

JSON structure:

- meta
- graph
- dsl
- sync mode

### **5.4 Implement import/export**

- Save `.flowfile`
- Open `.flowfile`
- Export `.txt`

------

# **Phase 6 — Polish & UX (5–10 days)**

### **6.1 Node interactions**

- Hover states
- Smooth dragging
- Snap-to-grid (optional)

### **6.2 FlowBar commands**

- `/new node`
- `/search`
- `/goto <node>`

### **6.3 Mini-map (React Flow built-in)**

### **6.4 Undo/Redo**

- Use React Flow’s change history
- Or Bubble state snapshots

------

# **Phase 7 — Packaging & Release (2–4 days)**

### **7.1 Build Windows installer**

- Electron Builder or Forge

### **7.2 App icon**

- `.ico` file

### **7.3 Auto-update (optional)**

------

# **Total Estimated Time**

- **Minimum viable prototype:** 4–6 weeks
- **Polished v1.0:** 8–12 weeks
- **With FlowShare repo:** +4–6 weeks

