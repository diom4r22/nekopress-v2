import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './index.css';
import { EditorialPanel } from './components/EditorialPanel.js';

import { MediaLibrary } from './components/MediaLibrary.js';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/^\/admin\/?$/.test(window.location.pathname) ? <EditorialPanel /> : /^\/biblioteca\/?$/.test(window.location.pathname) ? <MediaLibrary /> : <App />}
  </React.StrictMode>
);
