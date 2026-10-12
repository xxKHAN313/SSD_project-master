/**
 * @fileoverview React 18 application entry point.
 * Mounts the root App component into the #root DOM element.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// createRoot is the React 18 API for concurrent mode rendering
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  // StrictMode double-invokes effects in dev to help surface side-effect bugs
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
