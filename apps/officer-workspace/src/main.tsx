import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ToastManager } from '@openhands/ui';
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
        {/* Global toast host. api.ts raises toasts for 5xx/401/network failures;
            without a mounted <Toaster> sonner drops them silently. */}
        <ToastManager>
          <App />
        </ToastManager>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
