import './engine.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// This function mounts the React Flow app into any element
export function mountReactFlow(elementId, options = {}) {
  const container = document.getElementById(elementId);

  if (!container) {
    console.error(`FlowScriptReact: element #${elementId} not found`);
    return null;
  }

  const root = ReactDOM.createRoot(container);

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  return root;
}
