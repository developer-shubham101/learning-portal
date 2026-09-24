import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, StandaloneNodePage } from './App.jsx';
import { routeFromUrl } from './api';
import './styles.css';

const route = routeFromUrl();
createRoot(document.getElementById('root')).render(
  <React.StrictMode>{route.nodeId ? <StandaloneNodePage nodeId={route.nodeId} /> : <App />}</React.StrictMode>
);
