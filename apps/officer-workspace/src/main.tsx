import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import { initAuthSessionListeners } from './services/auth';
import './index.css';

// Bind once: token expiry / sign-out elsewhere -> automatic redirect to /login.
initAuthSessionListeners();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
