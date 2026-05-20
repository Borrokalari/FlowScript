# FlowScript Architecture Diagram

This diagram shows how all major components of FlowScript interact:
Bubble (UI), React Flow (graph engine), Monaco (DSL editor), Electron (desktop wrapper), and Node.js (file system).

1. ## High-Level Overview

+------------------------------------------------------------------------------------------+
|                         Electron App                                                                |
|   (Windows desktop wrapper, menus, file system, IPC bridge)   |
+--------------------------------------+--------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------+
|                           Bubble                                                            |
|   (UI shell, tabs, FlowBar, DSL editor container, state)      |
+-------------------------------------+------------------------------------------+
            | JS to Bubble events                | Run JS
            v                                                   v
+------------------------------------+     +------------------------------------+
|       React Flow                  |     |         Monaco Editor         |
| (Graph canvas engine)   |     | (DSL text editor)               |
| - Nodes                             |     | - Syntax highlighting        |
| - Edges                              |     | - Autocomplete (future)  |
| - Zoom/Pan                      |     | - Error markers                |
| - Dragging                        |     |                                             |
+-----------------------------------+     +-------------------------------------+
            ^                                                                   ^
            | Graph JSON                                             | DSL text
            | Events (node moved, edge created)   | Changes
            |                                                                   |
+---------------------------+--------------------------------------------------+
|                 Bubble State / Logic                                             |
|  - FlowFile JSON                                                                     |
|  - Sync engine (Graph <-> DSL)                                           |
|  - Settings                                                                               |
+-------------------------------------------------------------------------------+

2. ## Detailed Component Flow

   **Electron Layer**

Electron
│
├── Main Process
│     ├── Creates window
│     ├── Loads Bubble app URL
│     ├── Handles file dialogs
│     └── Manages packaging (.exe)
│
└── Preload Script (IPC Bridge)
      ├── openFlowFile()
      ├── saveFlowFile()
      ├── exportTxt()
      └── expose APIs to Bubble

​	**Bubble Layer**

Bubble App
│
├── UI Shell
│     ├── Custom title bar (Electron)
│     ├── Tabs: Graph Mode / DSL Mode
│     ├── FlowBar
│     └── Settings / Menus
│
├── State Management
│     ├── Current graph JSON
│     ├── Current DSL text
│     ├── Sync mode (linked / notepad)
│     └── File metadata
│
├── React Flow Container (HTML element)
│     └── Loads bundled React Flow JS
│
└── Monaco Editor Container (HTML element)
      └── Loads Monaco JS bundle

​	**React Flow Layer**

React Flow Engine
│
├── Renders nodes & edges
├── Handles zoom/pan
├── Handles dragging
├── Emits events:
│     ├── onNodesChange
│     ├── onEdgesChange
│     ├── onConnect
│     └── onNodeDragStop
│
└── Sends updates back to Bubble

​	**Monaco Editor Layer**

Monaco Editor
│
├── Displays DSL text
├── Syntax highlighting
├── Error markers (future)
├── Autocomplete (future)
└── Emits text changes to Bubble

3. ## Data Flow Diagram

   User Action
      │
      ├── Creates/moves node → React Flow → Bubble → Update FlowFile JSON
      │
      ├── Edits DSL → Monaco → Bubble → Parse DSL → Update Graph JSON
      │
      ├── Saves file → Bubble → Electron → Write .flowfile
      │
      └── Opens file → Electron → Bubble → Load graph + DSL

4. ## Technology Stack Diagram

   Frontend (Bubble)
   │
   ├── React Flow (graph)
   ├── Monaco Editor (DSL)
   └── Custom JS (communication bridge)
        │
        └── Electron Preload (IPC)
              │
              └── Node.js (file system)